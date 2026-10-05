/* =====================================================================
   views/similarityGraph.js — Technique D (Gabriel) : graphe de similarité d'élèves
   ---------------------------------------------------------------------
   Tâches : U1-4, U2-2 (principale) ; U1-3, U1-5 (secondaire).
   Transformation : distance de Gower sur le profil (meta.SIMILARITY_KEYS : échecs, absences,
            temps d'étude, trajet, sorties, alcool, éducation parentale, école, sexe, domicile,
            projet d'études ; SANS les notes) ; chaque élève est relié à ses 5 plus proches
            voisins (k petit pour éviter la « pelote ») ; disposition par forces, calculée
            une fois par périmètre et mise en cache.
   Marques   : un nœud par élève, un lien par paire de voisins ; un losange pour le profil fictif.
   Canaux    : teinte = réussite (bleu ▲ / orange ▼ / gris ✕) ou tendance de l'année ;
               opacité = appartenance à la sélection des autres vues ; contour épais = élève
               ouvert dans la fiche, ses liens surlignés.
               La position n'a pas de sens métrique : deux nœuds proches à l'écran ne sont
               pas forcément proches dans les données (seuls les liens comptent).
   Interactions : clic sur un nœud = fiche ; survol = élève et ses voisins ; molette / glisser
               = zoom et déplacement ; profil fictif placé et relié à ses 5 voisins (U2-2).
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { SIMILARITY_KEYS, NEIGHBORS, PASS, SMALL_N } from "../meta.js";
import { gower, knn } from "../stats.js";
import { css, resultOf, resultSpec, labelOf, titleOf, showTip, hideTip, tipRow, widthOf, esc, fmt1, fmt2, pct } from "../utils.js";

const H = 440;
let root, headEl, ctlEl, svgEl, formEl, outEl, legendEl;
let cur = { state: null, derived: null };
let cache = { sig: "", nodes: [], links: [], nn: [], dist: null, near: NaN, rand: NaN };
let zoomT = d3.zoomIdentity;

export function init(container) {
  root = container;
  root.innerHTML = `
    <p class="headline" id="gr-head" aria-live="polite"></p>
    <div class="toolbar" id="gr-ctl"></div>
    <div class="legend" id="gr-legend"></div>
    <div class="graph"><svg id="gr-svg" role="img" aria-label="Graphe de similarité : chaque élève relié à ses 5 plus proches voisins de profil"></svg></div>
    <details class="ghost" open><summary>Placer un profil fictif dans le graphe (anonyme)</summary>
      <div class="simctl" id="gr-form"></div><p class="simtxt" id="gr-out"></p></details>`;
  headEl = root.querySelector("#gr-head"); ctlEl = root.querySelector("#gr-ctl"); svgEl = root.querySelector("#gr-svg");
  formEl = root.querySelector("#gr-form"); outEl = root.querySelector("#gr-out"); legendEl = root.querySelector("#gr-legend");
  ctlEl.addEventListener("change", e => { if (e.target.id === "gr-color") setState({ graphColor: e.target.value }, "graph"); });
  formEl.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.act === "clear") { setState({ ghost: null }, "graph"); return; }
    const ds = cur.derived.ds, prof = {};
    formEl.querySelectorAll("[data-k]").forEach(el => {
      const k = el.dataset.k, M = ds.meta[k];
      prof[k] = M.t === "nom" ? el.value : +el.value;
    });
    setState({ ghost: prof }, "graph");
  });
  d3.select(svgEl).call(d3.zoom().scaleExtent([0.6, 8]).on("zoom", ev => {
    zoomT = ev.transform; d3.select(svgEl).select("g.world").attr("transform", zoomT);
  }));
}

function layout(ds, rows) {
  const keys = SIMILARITY_KEYS.filter(k => ds.keys.includes(k));
  const types = Object.fromEntries(keys.map(k => [k, ds.meta[k].t]));
  const dist = gower(rows, keys, types);
  const nn = knn(rows, NEIGHBORS, dist);
  const nodes = rows.map((d, i) => ({ d, i, x: Math.cos(i) * 100 * Math.sqrt(i / rows.length), y: Math.sin(i) * 100 * Math.sqrt(i / rows.length) }));
  const seen = new Set(), links = [];
  nn.forEach((list, i) => list.forEach(([, j]) => {
    const key = i < j ? i + "|" + j : j + "|" + i;
    if (!seen.has(key)) { seen.add(key); links.push({ source: i, target: j }); }
  }));
  d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).distance(14).strength(0.7))
    .force("charge", d3.forceManyBody().strength(-9).distanceMax(120))
    .force("x", d3.forceX(0).strength(0.05)).force("y", d3.forceY(0).strength(0.05))
    .stop().tick(240);
  // écart moyen de note : voisins contre deux élèves au hasard (élèves évalués)
  const g = i => !rows[i].__nograde;
  let sN = 0, cN = 0, sR = 0, cR = 0;
  nn.forEach((l, i) => { if (g(i)) l.forEach(([, j]) => { if (g(j)) { sN += Math.abs(rows[i].G3 - rows[j].G3); cN++; } }); });
  for (let i = 0; i < rows.length; i++) if (g(i)) for (let j = i + 1; j < rows.length; j++) if (g(j)) { sR += Math.abs(rows[i].G3 - rows[j].G3); cR++; }
  return { nodes, links, nn, dist, keys, near: cN ? sN / cN : NaN, rand: cR ? sR / cR : NaN };
}

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) return;
  if (!ds.standard) { headEl.textContent = ""; ctlEl.innerHTML = ""; legendEl.innerHTML = ""; d3.select(svgEl).selectAll("*").remove();
    formEl.innerHTML = ""; outEl.innerHTML = `<p class="empty">Le graphe nécessite les colonnes du jeu d'origine.</p>`; return; }
  const rows = derived.scoped;
  const sig = ds.name + "|" + rows.map(d => d.__i).join(",");
  if (sig !== cache.sig) { cache = { sig, ...layout(ds, rows) }; zoomT = d3.zoomIdentity; d3.select(svgEl).property("__zoom", d3.zoomIdentity); }

  ctlEl.innerHTML = `<label class="lbl" for="gr-color">Couleur</label><select id="gr-color">
    <option value="reussite"${state.graphColor === "reussite" ? " selected" : ""}>réussite</option>
    <option value="tendance"${state.graphColor === "tendance" ? " selected" : ""}>tendance de l'année</option></select>
    <span class="muted">molette : zoom · glisser : déplacer · clic sur un élève : fiche</span>`;
  headEl.innerHTML = `Chaque élève est relié à ses ${NEIGHBORS} plus proches voisins de profil (sans les notes). ` +
    `Écart moyen de note finale entre voisins : <b>${fmt2(cache.near)}</b> point, contre <b>${fmt2(cache.rand)}</b> entre deux élèves au hasard : ` +
    `des profils proches réussissent à peine plus pareil, le profil seul prédit mal la note.`;
  drawForm(state, ds, rows);
  draw(state, derived, ds);
}

function colorOf(state, d) {
  const R = resultSpec();
  if (state.graphColor === "tendance") return d.tendance === "baisse" ? R.fail.color : d.tendance === "hausse" ? R.pass.color : d.tendance === "stable" ? css("--s1-soft") : R.none.color;
  return R[resultOf(d)].color;
}

function draw(state, derived, ds) {
  const W = widthOf(root, 700);
  const { nodes, links, nn } = cache;
  const xs = d3.extent(nodes, n => n.x), ys = d3.extent(nodes, n => n.y);
  const k = Math.min((W - 20) / Math.max(1, xs[1] - xs[0]), (H - 20) / Math.max(1, ys[1] - ys[0]));
  const px = n => (n.x - (xs[0] + xs[1]) / 2) * k + W / 2, py = n => (n.y - (ys[0] + ys[1]) / 2) * k + H / 2;
  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const world = svg.append("g").attr("class", "world").attr("transform", zoomT);
  const sel = derived.selectionIds, sid = state.selectedId;
  const R = resultSpec();
  world.append("g").selectAll("line").data(links).join("line")
    .attr("x1", l => px(l.source)).attr("y1", l => py(l.source)).attr("x2", l => px(l.target)).attr("y2", l => py(l.target))
    .attr("stroke", css("--axis")).attr("stroke-width", 0.6).attr("stroke-opacity", l => sel.has(l.source.d.__i) && sel.has(l.target.d.__i) ? 0.7 : 0.15);
  // élève sélectionné : liens vers ses voisins surlignés
  const sn = nodes.find(n => n.d.__i === sid);
  if (sn) world.append("g").selectAll("line").data(nn[sn.i]).join("line")
    .attr("x1", px(sn)).attr("y1", py(sn)).attr("x2", ([, j]) => px(nodes[j])).attr("y2", ([, j]) => py(nodes[j]))
    .attr("stroke", css("--text-1")).attr("stroke-width", 1.6);
  world.append("g").selectAll("circle").data(nodes).join("circle")
    .attr("cx", px).attr("cy", py).attr("r", n => n.d.__i === sid ? 6 : 3.6)
    .attr("fill", n => colorOf(state, n.d)).attr("fill-opacity", n => sel.has(n.d.__i) ? 1 : 0.18)
    .attr("stroke", n => n.d.__i === sid ? css("--text-1") : css("--surface-1")).attr("stroke-width", n => n.d.__i === sid ? 2 : 0.8)
    .style("cursor", "pointer")
    .on("mousemove", (ev, n) => {
      const vs = nn[n.i].map(([, j]) => nodes[j].d).filter(v => !v.__nograde);
      showTip(ev, `<b>Élève n° ${n.d.__i + 1}</b> · ${n.d.__nograde ? "✕ non évalué" : n.d.G3 >= PASS ? "▲ réussite" : "▼ échec"}` +
        tipRow("Note finale", `${n.d.G3}/20`) + tipRow("Ses " + NEIGHBORS + " voisins", `${vs.filter(v => v.G3 >= PASS).length} réussissent sur ${vs.length}`) +
        `<div class="hint">Clic : ouvrir la fiche</div>`);
    })
    .on("mouseleave", hideTip)
    .on("click", (ev, n) => setState({ selectedId: n.d.__i }, "graph"));
  // profil fictif : losange relié à ses 5 plus proches voisins (U2-2)
  const gh = ghostNeighbors(state, ds);
  if (gh) {
    const pts = gh.map(([, j]) => nodes[j]);
    const gx = d3.mean(pts, px), gy = d3.mean(pts, py);
    world.append("g").selectAll("line").data(pts).join("line").attr("x1", gx).attr("y1", gy).attr("x2", px).attr("y2", py)
      .attr("stroke", css("--text-1")).attr("stroke-width", 1.4).attr("stroke-dasharray", "4 3");
    world.append("path").attr("d", `M${gx},${gy - 9}l9,9l-9,9l-9,-9z`).attr("fill", css("--surface-1")).attr("stroke", css("--text-1")).attr("stroke-width", 2.4);
    world.append("text").attr("class", "halo").attr("x", gx + 12).attr("y", gy + 4).style("font-size", "11px").style("font-weight", 600)
      .style("fill", css("--text-1")).text("profil saisi");
  }
  const nSel = nodes.filter(n => sel.has(n.d.__i)).length;
  legendEl.innerHTML = (state.graphColor === "tendance"
    ? [["▼ baisse", R.fail.color], ["● stable", css("--s1-soft")], ["▲ hausse", R.pass.color]]
    : [["▲ réussite", R.pass.color], ["▼ échec", R.fail.color]].concat(state.excludeNoGrade ? [] : [["✕ non évalué", R.none.color]]))
    .map(([l, c]) => `<span class="item"><span class="dot" style="background:${c}"></span>${l}</span>`).join("") +
    `<span class="item muted">${nSel} élèves de la sélection en clair, ${nodes.length - nSel} estompés · la position n'a pas de sens métrique, seuls les liens comptent</span>`;
}

function ghostNeighbors(state, ds) {
  if (!state.ghost) return null;
  const pool = cache.nodes.map((n, i) => [n.d, i]).filter(([d]) => !d.__nograde);
  return pool.map(([d, i]) => [cache.dist(state.ghost, d), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, NEIGHBORS);
}

function drawForm(state, ds, rows) {
  const keys = SIMILARITY_KEYS.filter(k => ds.keys.includes(k));
  const g = state.ghost || {};
  const typical = k => {
    const M = ds.meta[k], vals = rows.filter(d => !d.__nograde).map(d => d[k]);
    if (M.t === "nom") return d3.greatest(d3.rollups(vals, v => v.length, v => v), x => x[1])?.[0];
    return d3.median(vals);
  };
  const keep = formEl.contains(document.activeElement) ? document.activeElement.dataset.k : null;
  formEl.innerHTML = keys.map(k => {
    const M = ds.meta[k], v = g[k] ?? typical(k);
    if (k === "absences") return `<div class="fgroup"><label class="flabel" for="gh-${k}">${esc(titleOf(ds.meta, k))}</label>
      <input id="gh-${k}" data-k="${k}" type="number" min="0" max="75" step="1" value="${Math.round(v)}"></div>`;
    const dom = M.d || Array.from(new Set(rows.map(d => d[k]))).sort(d3.ascending);
    return `<div class="fgroup"><label class="flabel" for="gh-${k}">${esc(titleOf(ds.meta, k))}</label><select id="gh-${k}" data-k="${k}">` +
      dom.map(x => `<option value="${x}"${String(x) === String(M.t === "nom" ? v : Math.round(v)) ? " selected" : ""}>${esc(labelOf(ds.meta, k, x))}</option>`).join("") + `</select></div>`;
  }).join("") + `<div class="fgroup"><span class="flabel">&nbsp;</span><span style="display:flex;gap:6px">
    <button type="button" class="btn" data-act="place">Placer ce profil</button>${state.ghost ? `<button type="button" class="btn" data-act="clear">Retirer</button>` : ""}</span></div>`;
  if (keep) { const el = formEl.querySelector(`[data-k="${keep}"]`); if (el) el.focus({ preventScroll: true }); }
  const gh = ghostNeighbors(state, ds);
  if (!gh) { outEl.innerHTML = `Choisissez des valeurs puis « Placer ce profil » : il apparaît comme un losange relié aux ${NEIGHBORS} élèves qui lui ressemblent le plus. Aucun élève n'est nommé.`; return; }
  const vs = gh.map(([, i]) => cache.nodes[i].d), ok = vs.filter(d => d.G3 >= PASS).length;
  outEl.innerHTML = `Parmi les <b>${NEIGHBORS} élèves les plus proches</b> de ce profil, <b>${ok} réussissent</b> (notes : ${vs.map(d => d.G3).sort((a, b) => a - b).join(", ")}). ` +
    `<span class="muted">Effectif de référence : ${NEIGHBORS} élèves sur ${cache.nodes.filter(n => !n.d.__nograde).length} — c'est très peu (⚠ moins de ${SMALL_N}). ` +
    `Des profils proches ont des notes à peine plus proches qu'au hasard (écart ${fmt2(cache.near)} contre ${fmt2(cache.rand)}) : à lire comme une indication, pas une prédiction.</span>`;
}
