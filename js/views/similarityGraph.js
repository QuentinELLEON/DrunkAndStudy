// D. Graphe de similarité   [Gabriel LOIRAT]
// Conteneur : #viz-similarity-graph   ·   Doc : docs/visualisations.md#d-graphe-de-similarité
//
// Un nœud par élève, relié à ses 5 plus proches voisins sur son profil (11 facteurs de SIMILARITY_KEYS, sans les notes).
// Disposition par forces calculée une seule fois et mise en cache par (matière, inclNE).
// Couleur par réussite ou tendance, opacité pilotée par la sélection active.
// Profil fictif (« Tester un profil ») : nœud losange relié à ses 5 voisins.

/* global d3 */

import {
  DIMS, SIMILARITY_KEYS, SIMILARITY_NOMINAL, NEIGHBORS, PASS_MARK, SMALL_N, DATASETS,
  dimLabel, valueName,
} from "../meta.js";
import { setState } from "../state.js";
import { knn, gower, gowerRanges } from "../stats.js";
import {
  pct, f1, f2, plural, showTip, moveTip, hideTip, makeActionable, widthOf, prepareContainer, colors, cssVar,
} from "../utils.js";

const H = 460;
let host = null;
let svgEl = null;
let zoomBehavior = null;
let zoomT = d3.zoomIdentity;
let hoveredIndex = null;
let cache = { sig: "", nodes: [], links: [], neighborsMap: [], ranges: null, near: NaN, rand: NaN };
let controlsWired = false;

export function init(container) {
  host = prepareContainer(container);
  host.innerHTML = "";

  // Structure interne du conteneur
  const box = d3.select(host);

  // Barre d'outils zoom intégrée
  const zoomBar = box.append("div")
    .attr("class", "graph-zoom-bar")
    .style("display", "flex")
    .style("justify-content", "flex-end")
    .style("gap", "6px")
    .style("margin-bottom", "6px");

  zoomBar.append("button")
    .attr("type", "button")
    .attr("class", "btn btn-sm")
    .attr("data-zoom", "in")
    .attr("aria-label", "Zoomer (+)")
    .text("+")
    .on("click", () => d3.select(svgEl).transition().duration(200).call(zoomBehavior.scaleBy, 1.35));

  zoomBar.append("button")
    .attr("type", "button")
    .attr("class", "btn btn-sm")
    .attr("data-zoom", "out")
    .attr("aria-label", "Dézoomer (−)")
    .text("−")
    .on("click", () => d3.select(svgEl).transition().duration(200).call(zoomBehavior.scaleBy, 1 / 1.35));

  zoomBar.append("button")
    .attr("type", "button")
    .attr("class", "btn btn-sm")
    .attr("data-zoom", "reset")
    .attr("aria-label", "Réinitialiser la vue")
    .text("⟲")
    .on("click", () => d3.select(svgEl).transition().duration(200).call(zoomBehavior.transform, d3.zoomIdentity));

  const svgWrap = box.append("div")
    .attr("class", "graph-svg-wrap")
    .style("border", "1px solid var(--line)")
    .style("border-radius", "8px")
    .style("overflow", "hidden")
    .style("background", "var(--panel)")
    .style("cursor", "grab");

  const svg = svgWrap.append("svg")
    .attr("id", "svg-similarity")
    .attr("role", "img")
    .attr("aria-label", "Graphe de similarité des profils d'élèves");

  svgEl = svg.node();

  zoomBehavior = d3.zoom()
    .scaleExtent([0.5, 8])
    .on("start", () => { svgWrap.style("cursor", "grabbing"); })
    .on("end", () => { svgWrap.style("cursor", "grab"); })
    .on("zoom", (ev) => {
      zoomT = ev.transform;
      d3.select(svgEl).select("g.world").attr("transform", zoomT);
    });

  svg.call(zoomBehavior);
  svg.on("dblclick.zoom", () => {
    svg.transition().duration(200).call(zoomBehavior.transform, d3.zoomIdentity);
  });

  if (!controlsWired) {
    wireControls();
    controlsWired = true;
  }
}

function wireControls() {
  // 1. Sélecteur de couleur (#gSeg)
  d3.selectAll("#gSeg button").on("click", function () {
    const val = this.dataset.v;
    setState({ colorBy: val });
  });

  // 2. Bouton d'ouverture / fermeture du formulaire de profil fictif (#fakeBtn)
  const fakeBtn = document.getElementById("fakeBtn");
  const fakeForm = document.getElementById("fakeForm");
  if (fakeBtn && fakeForm) {
    fakeBtn.addEventListener("click", () => {
      const isHidden = fakeForm.hasAttribute("hidden");
      if (isHidden) {
        fakeForm.removeAttribute("hidden");
        fakeBtn.setAttribute("aria-expanded", "true");
      } else {
        fakeForm.setAttribute("hidden", "");
        fakeBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  // 3. Bouton Retirer le profil fictif (#fakeClear)
  const fakeClear = document.getElementById("fakeClear");
  if (fakeClear) {
    fakeClear.addEventListener("click", () => {
      setState({ ghost: null });
    });
  }

  // 4. Soumission du profil fictif (#fakeForm)
  if (fakeForm) {
    fakeForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const prof = {};
      fakeForm.querySelectorAll("[data-dim]").forEach((input) => {
        const dim = input.dataset.dim;
        const val = input.value;
        prof[dim] = SIMILARITY_NOMINAL.includes(dim) ? val : Number(val);
      });
      setState({ ghost: prof });
    });
  }
}

function buildFakeFields(rows) {
  const container = document.getElementById("fakeFields");
  if (!container || container.children.length > 0) return;

  SIMILARITY_KEYS.forEach((k) => {
    const label = document.createElement("label");
    const span = document.createElement("span");
    span.textContent = dimLabel(k);
    label.appendChild(span);

    if (k === "absences") {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "75";
      input.dataset.dim = k;
      const vals = rows.map((r) => r.absences).filter(Number.isFinite);
      input.value = Math.round(d3.median(vals) || 4);
      label.appendChild(input);
    } else if (DIMS[k]) {
      const select = document.createElement("select");
      select.dataset.dim = k;
      const order = DIMS[k].order;
      order.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = valueName(k, v);
        select.appendChild(opt);
      });
      // Valeur médiane / modale
      const vals = rows.map((r) => r[k]);
      if (SIMILARITY_NOMINAL.includes(k)) {
        const counts = d3.rollup(vals, (v) => v.length, (d) => d);
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (top != null) select.value = top;
      } else {
        const med = d3.median(vals.map(Number));
        if (med != null) select.value = String(Math.round(med));
      }
      label.appendChild(select);
    } else {
      const input = document.createElement("input");
      input.type = "number";
      input.dataset.dim = k;
      label.appendChild(input);
    }

    container.appendChild(label);
  });
}

function layout(rows) {
  const ranges = gowerRanges(rows, SIMILARITY_KEYS, SIMILARITY_NOMINAL);
  const links = knn(rows, SIMILARITY_KEYS, NEIGHBORS, SIMILARITY_NOMINAL);

  // Table des 5 voisins de chaque élève pour surbrillance au survol
  const neighborsMap = rows.map(() => []);
  for (let i = 0; i < rows.length; i++) {
    const best = [];
    for (let j = 0; j < rows.length; j++) {
      if (i === j) continue;
      const d = gower(rows[i], rows[j], SIMILARITY_KEYS, ranges, SIMILARITY_NOMINAL);
      if (best.length < NEIGHBORS) { best.push([d, j]); best.sort((p, q) => p[0] - q[0]); }
      else if (d < best[NEIGHBORS - 1][0]) { best[NEIGHBORS - 1] = [d, j]; best.sort((p, q) => p[0] - q[0]); }
    }
    neighborsMap[i] = best;
  }

  // Initialisation déterministe en spirale
  const nodes = rows.map((r, i) => {
    const angle = i * 2.3999632;
    const rad = 16 * Math.sqrt(i);
    return {
      i,
      id: r.__i,
      x: Math.cos(angle) * rad,
      y: Math.sin(angle) * rad,
      ok: r.reussite === "oui",
      tendance: r.tendance || "stable",
      r,
    };
  });

  // Simulation D3 : forceLink + ManyBody + anti-collision
  const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).distance((l) => 16 + l.d * 24).strength(0.65))
    .force("charge", d3.forceManyBody().strength(-18).distanceMax(180))
    .force("collide", d3.forceCollide().radius(5.5).iterations(2))
    .force("x", d3.forceX(0).strength(0.045))
    .force("y", d3.forceY(0).strength(0.045))
    .stop();

  for (let t = 0; t < 280; t++) sim.tick();

  // Écart de note finale G3 entre voisins vs hasard
  const g = (i) => !rows[i].__nograde;
  let sN = 0, cN = 0, sR = 0, cR = 0;
  neighborsMap.forEach((l, i) => {
    if (g(i)) {
      l.forEach(([, j]) => {
        if (g(j)) { sN += Math.abs(rows[i].G3 - rows[j].G3); cN++; }
      });
    }
  });
  for (let i = 0; i < rows.length; i++) {
    if (g(i)) {
      for (let j = i + 1; j < rows.length; j++) {
        if (g(j)) { sR += Math.abs(rows[i].G3 - rows[j].G3); cR++; }
      }
    }
  }

  return {
    nodes,
    links,
    neighborsMap,
    ranges,
    near: cN ? sN / cN : NaN,
    rand: cR ? sR / cR : NaN,
  };
}

export function update(state, derived) {
  if (!host) return;

  const rows = derived.base;
  if (!rows || !rows.length) return;

  // Mise à jour de l'état du toggle de couleur (#gSeg)
  d3.selectAll("#gSeg button").attr("aria-pressed", function () {
    return String(this.dataset.v === state.colorBy);
  });

  buildFakeFields(rows);

  // Disposition mise en cache par (matière, inclNE) : 357 en maths, 634 en portugais
  const sig = `${state.ds}|${Boolean(state.inclNE)}`;
  if (sig !== cache.sig) {
    cache = { sig, ...layout(rows) };
    zoomT = d3.zoomIdentity;
    if (zoomBehavior && svgEl) {
      d3.select(svgEl).property("__zoom", d3.zoomIdentity);
    }
  }

  // Texte calculé voisins vs hasard (#dTake)
  const dTake = document.getElementById("dTake");
  if (dTake) {
    dTake.innerHTML = `Entre voisins de profil, la note finale diffère en moyenne de <b>${f2(cache.near)}</b> points, ` +
      `contre <b>${f2(cache.rand)}</b> points entre deux élèves pris au hasard : ` +
      `des profils ressemblants réussissent à peine plus pareil, le profil seul prédit mal la note finale.`;
  }

  // Profil fictif (#dFake)
  const dFake = document.getElementById("dFake");
  let ghostNeighbors = null;
  if (state.ghost && cache.ranges) {
    const pool = cache.nodes.filter((n) => !n.r.__nograde);
    ghostNeighbors = pool
      .map((n) => [gower(state.ghost, n.r, SIMILARITY_KEYS, cache.ranges, SIMILARITY_NOMINAL), n.i])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .slice(0, NEIGHBORS);

    if (dFake) {
      const vs = ghostNeighbors.map(([, i]) => cache.nodes[i].r);
      const ok = vs.filter((r) => r.G3 >= PASS_MARK).length;
      const grades = vs.map((r) => `${r.G3}/20`).sort((a, b) => parseFloat(a) - parseFloat(b));
      dFake.innerHTML = `Parmi les <b>${NEIGHBORS} élèves les plus proches</b> du profil fictif, <b>${ok} réussissent</b> ` +
        `(taux : <b>${pct(ok / NEIGHBORS)}</b> ; notes finales : ${grades.join(", ")}). ` +
        `<span style="color:var(--muted)">Effectif de référence : ${NEIGHBORS} élèves sur ${pool.length} — la position à l'écran n'a pas de valeur métrique.</span>`;
    }
  } else if (dFake) {
    dFake.innerHTML = `<span style="color:var(--muted)">Aucun profil fictif placé. Cliquez sur « Tester un profil » pour en simuler un.</span>`;
  }

  draw(state, derived, ghostNeighbors);
}

function nodeColor(state, r, C) {
  if (r.__nograde) return C.muted;
  if (state.colorBy === "tendance") {
    if (r.tendance === "hausse") return C.ok;
    if (r.tendance === "baisse") return C.ko;
    return C.mid;
  }
  return r.reussite === "oui" ? C.ok : C.ko;
}

function draw(state, derived, ghostNeighbors) {
  const W = widthOf(host);
  const { nodes, links, neighborsMap } = cache;
  if (!nodes.length) return;

  const xs = d3.extent(nodes, (n) => n.x);
  const ys = d3.extent(nodes, (n) => n.y);
  const pad = 24;
  const kw = (W - pad * 2) / Math.max(1, xs[1] - xs[0]);
  const kh = (H - pad * 2) / Math.max(1, ys[1] - ys[0]);
  const k = Math.min(kw, kh);
  const mx = (xs[0] + xs[1]) / 2;
  const my = (ys[0] + ys[1]) / 2;
  const px = (n) => (n.x - mx) * k + W / 2;
  const py = (n) => (n.y - my) * k + H / 2;

  const svg = d3.select(svgEl)
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("width", W)
    .attr("height", H);

  svg.selectAll("*").remove();

  const world = svg.append("g").attr("class", "world").attr("transform", zoomT);

  const selSet = new Set(derived.selection.map((r) => r.__i));
  const sid = state.selectedId;
  const C = colors();

  const selectedNode = nodes.find((n) => n.id === sid) || null;
  const selectedNeighborIndices = selectedNode ? new Set(neighborsMap[selectedNode.i].map(([, j]) => j)) : new Set();

  const hovNode = hoveredIndex != null ? nodes[hoveredIndex] : null;
  const hovNeighborIndices = hovNode ? new Set(neighborsMap[hovNode.i].map(([, j]) => j)) : new Set();

  const ghostNeighborIndices = ghostNeighbors ? new Set(ghostNeighbors.map(([, j]) => j)) : new Set();

  // 1. Liens du réseau
  world.append("g").attr("class", "layer-links")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "link")
    .attr("x1", (l) => px(nodes[l.source.index != null ? l.source.index : l.source]))
    .attr("y1", (l) => py(nodes[l.source.index != null ? l.source.index : l.source]))
    .attr("x2", (l) => px(nodes[l.target.index != null ? l.target.index : l.target]))
    .attr("y2", (l) => py(nodes[l.target.index != null ? l.target.index : l.target]))
    .style("stroke-opacity", (l) => {
      if (hovNode) return 0.05;
      const sIdx = l.source.index != null ? l.source.index : l.source;
      const tIdx = l.target.index != null ? l.target.index : l.target;
      return selSet.has(nodes[sIdx].id) && selSet.has(nodes[tIdx].id) ? 0.6 : 0.12;
    })
    .style("stroke-width", (l) => {
      const sIdx = l.source.index != null ? l.source.index : l.source;
      const tIdx = l.target.index != null ? l.target.index : l.target;
      return selSet.has(nodes[sIdx].id) && selSet.has(nodes[tIdx].id) ? 0.8 : 0.5;
    });

  // 2. Liens vers les voisins de l'élève sélectionné
  if (selectedNode) {
    const selLinks = neighborsMap[selectedNode.i].map(([dVal, j]) => ({ target: nodes[j], d: dVal }));
    world.append("g").attr("class", "layer-sel-links")
      .selectAll("line")
      .data(selLinks)
      .join("line")
      .attr("class", "link hi")
      .attr("x1", px(selectedNode))
      .attr("y1", py(selectedNode))
      .attr("x2", (l) => px(l.target))
      .attr("y2", (l) => py(l.target))
      .style("stroke", C.ink)
      .style("stroke-width", 2);
  }

  // 3. Liens vers les voisins du nœud survolé
  if (hovNode) {
    const hovLinks = neighborsMap[hovNode.i].map(([dVal, j]) => ({ target: nodes[j], d: dVal }));
    world.append("g").attr("class", "layer-hov-links")
      .selectAll("line")
      .data(hovLinks)
      .join("line")
      .attr("class", "link hi")
      .attr("x1", px(hovNode))
      .attr("y1", py(hovNode))
      .attr("x2", (l) => px(l.target))
      .attr("y2", (l) => py(l.target))
      .style("stroke", C.ok)
      .style("stroke-width", 2.4);
  }

  // 4. Liens et losange du profil fictif
  if (ghostNeighbors) {
    const pts = ghostNeighbors.map(([, j]) => nodes[j]);
    const gx = d3.mean(pts, px);
    const gy = d3.mean(pts, py);

    world.append("g").attr("class", "layer-ghost-links")
      .selectAll("line")
      .data(pts)
      .join("line")
      .attr("x1", gx).attr("y1", gy)
      .attr("x2", px).attr("y2", py)
      .style("stroke", C.ink)
      .style("stroke-width", 1.6)
      .style("stroke-dasharray", "4 3");

    const diamond = world.append("g").attr("class", "layer-ghost-diamond");
    diamond.append("path")
      .attr("d", `M${gx},${gy - 10} l10,10 l-10,10 l-10,-10 Z`)
      .style("fill", C.panel)
      .style("stroke", C.ink)
      .style("stroke-width", 2.5);

    diamond.append("text")
      .attr("x", gx + 14)
      .attr("y", gy + 4)
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("fill", C.ink)
      .text("profil fictif");
  }

  // 5. Nœuds élèves
  const nodeSel = world.append("g").attr("class", "layer-nodes")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("cx", px)
    .attr("cy", py)
    .attr("r", (n) => {
      if (n.id === sid) return 6.8;
      if (hoveredIndex === n.i) return 6.0;
      if (hovNeighborIndices.has(n.i) || selectedNeighborIndices.has(n.i) || ghostNeighborIndices.has(n.i)) return 4.8;
      return 3.6;
    })
    .attr("class", (n) => {
      let cls = "node";
      if (n.id === sid) cls += " me";
      else if (hoveredIndex === n.i || hovNeighborIndices.has(n.i)) cls += " hi";
      return cls;
    })
    .style("fill", (n) => nodeColor(state, n.r, C))
    .style("fill-opacity", (n) => {
      const inSel = selSet.has(n.id);
      if (hoveredIndex != null) {
        if (n.i === hoveredIndex || hovNeighborIndices.has(n.i)) return 1.0;
        return inSel ? 0.35 : 0.10;
      }
      return inSel ? 1.0 : 0.18;
    })
    .style("stroke", (n) => {
      if (n.id === sid) return C.ink;
      if (hoveredIndex === n.i) return C.ok;
      if (hovNeighborIndices.has(n.i) || selectedNeighborIndices.has(n.i) || ghostNeighborIndices.has(n.i)) return C.ink;
      return C.panel;
    })
    .style("stroke-width", (n) => {
      if (n.id === sid) return 2.6;
      if (hoveredIndex === n.i) return 2.2;
      if (hovNeighborIndices.has(n.i) || selectedNeighborIndices.has(n.i) || ghostNeighborIndices.has(n.i)) return 1.6;
      return 0.8;
    });

  // Interactions sur les nœuds
  const onNodeHover = (ev, n) => {
    hoveredIndex = n.i;
    draw(state, derived, ghostNeighbors);

    const vs = neighborsMap[n.i].map(([, j]) => nodes[j].r).filter((r) => !r.__nograde);
    const ok = vs.filter((r) => r.G3 >= PASS_MARK).length;
    const dists = neighborsMap[n.i].map(([dVal]) => f2(dVal));

    let html = `<b>Élève n° ${n.id + 1}</b><br>`;
    html += `${n.r.__nograde ? "Non évalué" : `Note finale G3 : ${n.r.G3}/20 (${n.ok ? "10 ou plus" : "moins de 10"})`}<br>`;
    html += `5 voisins les plus proches : <b>${ok} réussissent</b> sur ${vs.length}<br>`;
    html += `Notes des voisins : ${vs.map((r) => `${r.G3}/20`).join(", ")}<br>`;
    html += `Distances : ${dists.join(", ")}<br>`;
    html += `<span class="note" style="margin:4px 0 0">Cliquez pour ouvrir la fiche</span>`;

    showTip(ev, html);
  };

  const onNodeLeave = () => {
    hoveredIndex = null;
    hideTip();
    draw(state, derived, ghostNeighbors);
  };

  nodeSel
    .on("mouseenter", onNodeHover)
    .on("mousemove", (ev, n) => {
      if (hoveredIndex !== n.i) onNodeHover(ev, n);
      moveTip(ev);
    })
    .on("mouseleave", onNodeLeave)
    .on("click", (ev, n) => {
      setState({ selectedId: n.id });
    });

  makeActionable(
    nodeSel,
    (n) => setState({ selectedId: n.id }),
    (n) => `Élève ${n.id + 1}, note finale ${n.r.G3}/20. Ouvrir la fiche`
  );

  // 6. Légende (#dLegend)
  const dLegend = document.getElementById("dLegend");
  if (dLegend) {
    const nSel = nodes.filter((n) => selSet.has(n.id)).length;
    const items = state.colorBy === "tendance"
      ? [
        `<span class="item"><span class="swatch" style="background:${C.ok};width:10px;height:10px;border-radius:50%;display:inline-block"></span> Hausse (Δ ≥ +2)</span>`,
        `<span class="item"><span class="swatch" style="background:${C.mid};width:10px;height:10px;border-radius:50%;display:inline-block"></span> Stable</span>`,
        `<span class="item"><span class="swatch" style="background:${C.ko};width:10px;height:10px;border-radius:50%;display:inline-block"></span> Baisse (Δ ≤ −2)</span>`,
      ]
      : [
        `<span class="item"><span class="swatch" style="background:${C.ok};width:10px;height:10px;border-radius:50%;display:inline-block"></span> 10 ou plus</span>`,
        `<span class="item"><span class="swatch" style="background:${C.ko};width:10px;height:10px;border-radius:50%;display:inline-block"></span> Moins de 10</span>`,
      ];

    dLegend.innerHTML = items.join(" ") +
      `<span class="note" style="margin-left:auto">${nSel} élèves en clair sur ${nodes.length} · <em>La position à l'écran n'a pas de valeur métrique</em></span>`;
  }
}
