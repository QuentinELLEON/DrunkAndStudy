// A. Ensembles parallèles (Parallel Sets)   [Quentin ELLEON]
// Conteneur : #viz-parallel-sets   ·   Doc : docs/visualisations.md#a-ensembles-parallèles
//
// Un segment par catégorie et par axe (hauteur proportionnelle au nombre d'élèves), des rubans entre axes voisins
// (largeur proportionnelle au nombre d'élèves), bleu = réussite, orange = échec. Le dernier axe est toujours « reussite ».
//
// Entrées   : derived.selection (inclut les zooms posés ici : le diagramme est réétalonné sur les élèves gardés),
//             state.psetAxes, state.psetPreset, derived.selected (chemin de l'élève).
// Écritures : toggleDrill(dim, value, "pset") au clic sur un segment ; setState({ psetAxes, psetPreset }) pour les axes ;
//             le fil d'Ariane retire les zooms « pset » les plus récents.

import {
  DIMS, PSET_PRESETS, PSET_ADDABLE, PSET_MAX_AXES, PSET_MIN_AXES, SMALL_N, DATASETS, dimLabel, valueName,
} from "../meta.js";
import { setState, toggleDrill } from "../state.js";
import { pct, plural, showTip, moveTip, hideTip, makeActionable, widthOf, prepareContainer } from "../utils.js";

const LAST = "reussite";
const BAR = 12;      // largeur d'un segment (px)
const GAP = 10;      // espace entre deux catégories d'un même axe (px)

let crumbs = null, chartEl = null, noteEl = null, tableEl = null, built = false, lastState = null;

export function init(container) {
  const host = prepareContainer(container);
  crumbs = document.createElement("nav");
  crumbs.className = "pset-crumbs";
  crumbs.setAttribute("aria-label", "Fil d'Ariane des zooms");
  chartEl = document.createElement("div");
  chartEl.className = "pset-chart";
  noteEl = document.createElement("p");
  noteEl.className = "note";
  tableEl = document.createElement("details");
  tableEl.className = "pset-table";
  host.append(crumbs, chartEl, noteEl, tableEl);
  built = true;
  wireControls();
}

// ---------- Commandes de la carte (présélections et « Ajouter un axe ») ----------

function wireControls() {
  document.querySelectorAll("#presetSeg button").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.preset;
    setState({ psetPreset: k, psetAxes: PSET_PRESETS[k].axes.slice() });
  }));
  document.getElementById("addAxis").addEventListener("change", (e) => {
    const dim = e.target.value;
    e.target.value = "";
    if (!dim) return;
    const axes = normalizeAxes(lastState.psetAxes);
    if (axes.length >= PSET_MAX_AXES || axes.includes(dim)) return;
    setState({ psetAxes: axes.slice(0, -1).concat([dim, LAST]) });
  });
}

// Axes affichés : dimensions connues, sans doublon, « reussite » toujours en dernier, 5 au maximum
export function normalizeAxes(axes) {
  const head = axes.filter((a, i) => a !== LAST && DIMS[a] && axes.indexOf(a) === i).slice(0, PSET_MAX_AXES - 1);
  return head.concat([LAST]);
}
const sameAxes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function syncControls(st, axes) {
  const preset = PSET_PRESETS[st.psetPreset];
  document.getElementById("a-q").textContent = preset ? preset.q : "Comment les élèves se répartissent-ils selon ces catégories ?";
  document.querySelectorAll("#presetSeg button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.preset === st.psetPreset && sameAxes(axes, PSET_PRESETS[b.dataset.preset].axes)));
  });
  const full = axes.length >= PSET_MAX_AXES;
  const sel = document.getElementById("addAxis");
  const opts = [""].concat(full ? [] : PSET_ADDABLE.filter((a) => !axes.includes(a)));
  sel.replaceChildren(...opts.map((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v ? dimLabel(v) : full ? `${PSET_MAX_AXES} axes au maximum` : "Choisir";
    return o;
  }));
  sel.value = "";
  sel.disabled = full;
}

// ---------- Fil d'Ariane ----------

function renderCrumbs(st, nTotal, nNow) {
  crumbs.replaceChildren();
  const mine = st.drill.filter((f) => f.src === "pset");
  crumbs.hidden = !mine.length;
  if (!mine.length) return;
  const keep = (k) => st.drill.filter((f) => f.src !== "pset").concat(mine.slice(0, k));
  const crumb = (label, k, current) => {
    const el = document.createElement(current ? "span" : "button");
    el.className = "chip" + (current ? " pset-crumb-current" : "");
    el.textContent = label;
    if (current) el.setAttribute("aria-current", "true");
    else { el.type = "button"; el.addEventListener("click", () => setState({ drill: keep(k) })); }
    return el;
  };
  crumbs.appendChild(crumb(`Tous (${nTotal})`, 0, false));
  mine.forEach((f, i) => {
    const sep = document.createElement("span");
    sep.className = "pset-sep"; sep.setAttribute("aria-hidden", "true"); sep.textContent = "›";
    const last = i === mine.length - 1;
    const label = `${dimLabel(f.dim)} : ${valueName(f.dim, f.value)}`;
    crumbs.append(sep, crumb(last ? `${label} (${nNow})` : label, i + 1, last));
  });
}

// ---------- Calcul : segments et rubans (pur, testable) ----------

// rows : élèves ; axes : dimensions. Les élèves sans valeur sur un axe (non évalués) sont écartés (dropped).
// Retourne { axes, N, segments: {dim: [{value, n, ok}]}, bands: [{a, b, va, vb, res, n}], dropped }.
export function computeParallelSets(rows, axes) {
  const usable = rows.filter((r) => axes.every((a) => r[a] !== null && r[a] !== undefined));
  const segments = {};
  axes.forEach((a) => {
    const m = new Map();
    usable.forEach((r) => {
      const k = String(r[a]);
      const o = m.get(k) || { value: k, n: 0, ok: 0 };
      o.n++;
      if (r.reussite === "oui") o.ok++;
      m.set(k, o);
    });
    segments[a] = DIMS[a].order.map(String).filter((v) => m.has(v)).map((v) => m.get(v));
  });
  const bands = [];
  for (let i = 0; i < axes.length - 1; i++) {
    const a = axes[i], b = axes[i + 1], m = new Map();
    usable.forEach((r) => {
      const k = `${r[a]}|${r[b]}|${r.reussite}`;
      const o = m.get(k) || { a, b, va: String(r[a]), vb: String(r[b]), res: r.reussite, n: 0 };
      o.n++;
      m.set(k, o);
    });
    bands.push(...m.values());
  }
  return { axes, N: usable.length, segments, bands, dropped: rows.length - usable.length };
}

// ---------- Rendu ----------

export function update(st, derived) {
  if (!built) return;
  lastState = st;
  const axes = normalizeAxes(st.psetAxes);
  syncControls(st, axes);

  const rows = derived.selection;
  const model = computeParallelSets(rows, axes);
  renderCrumbs(st, derived.base.length, rows.length);
  noteEl.textContent = model.dropped
    ? `${plural(model.dropped, "élève non placé", "élèves non placés")} : dossier non évalué, sans valeur pour un des axes.`
    : "";
  renderTable(model, st);

  chartEl.replaceChildren();
  if (!model.N) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Aucun élève ne correspond à cette sélection. Retirez un zoom ou un filtre dans le panneau Sélection.";
    chartEl.appendChild(p);
    return;
  }
  draw(model, st, derived);
}

function draw(model, st, derived) {
  const { axes, N, segments, bands } = model;
  const W = widthOf(chartEl);
  const H = Math.round(Math.max(330, Math.min(470, W * 0.4)));
  const m = { t: 34, r: Math.min(170, Math.round(W * 0.17)), b: 8, l: 4 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const x = d3.scalePoint().domain(axes).range([0, iw]);

  // Même échelle (px par élève) pour tous les axes, pour que les largeurs se comparent d'un axe à l'autre
  const kk = d3.min(axes, (a) => (ih - GAP * (segments[a].length - 1)) / N);
  const blocks = {};
  axes.forEach((a) => {
    const segs = segments[a], total = N * kk + GAP * (segs.length - 1);
    let y = (ih - total) / 2;
    const map = new Map();
    segs.forEach((sg) => { map.set(sg.value, { ...sg, y0: y, y1: y + sg.n * kk }); y += sg.n * kk + GAP; });
    blocks[a] = { order: segs.map((s) => s.value), map };
  });

  // Position des rubans : empilés à la sortie du segment de gauche et à l'entrée du segment de droite
  const RES = ["oui", "non"];
  const ord = (a, v) => blocks[a].order.indexOf(v);
  for (let i = 0; i < axes.length - 1; i++) {
    const a = axes[i], b = axes[i + 1];
    const list = bands.filter((d) => d.a === a && d.b === b);
    const out = new Map(), inn = new Map();
    list.slice().sort((p, q) => ord(a, p.va) - ord(a, q.va) || ord(b, p.vb) - ord(b, q.vb) || RES.indexOf(p.res) - RES.indexOf(q.res))
      .forEach((p) => { const bl = blocks[a].map.get(p.va), o = out.get(p.va) || 0; p.sy0 = bl.y0 + o; p.sy1 = p.sy0 + p.n * kk; out.set(p.va, o + p.n * kk); });
    list.slice().sort((p, q) => ord(b, p.vb) - ord(b, q.vb) || ord(a, p.va) - ord(a, q.va) || RES.indexOf(p.res) - RES.indexOf(q.res))
      .forEach((p) => { const bl = blocks[b].map.get(p.vb), o = inn.get(p.vb) || 0; p.ty0 = bl.y0 + o; p.ty1 = p.ty0 + p.n * kk; inn.set(p.vb, o + p.n * kk); });
  }
  const ribbon = (d) => {
    const x0 = x(d.a) + BAR, x1 = x(d.b), xm = (x0 + x1) / 2;
    return `M${x0},${d.sy0}C${xm},${d.sy0} ${xm},${d.ty0} ${x1},${d.ty0}L${x1},${d.ty1}C${xm},${d.ty1} ${xm},${d.sy1} ${x0},${d.sy1}Z`;
  };

  const svg = d3.select(chartEl).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H)
    .attr("role", "group").attr("aria-label", `Ensembles parallèles, axes ${axes.map(dimLabel).join(", ")}, ${N} élèves`);
  const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

  const tipRibbon = (d) => `<b>${plural(d.n, "élève", "élèves")}</b><br>${dimLabel(d.a)} : ${valueName(d.a, d.va)}<br>${dimLabel(d.b)} : ${valueName(d.b, d.vb)}<br>Note finale ${d.res === "oui" ? "de 10 ou plus" : "sous 10"}`;
  const rp = g.append("g").selectAll("path").data(bands).join("path")
    .attr("class", (d) => "rib " + (d.res === "oui" ? "ok" : "ko")).attr("d", ribbon)
    .on("mouseenter", (e, d) => { rp.style("opacity", (r) => (r === d ? 0.95 : 0.12)); showTip(e, tipRibbon(d)); })
    .on("mousemove", moveTip)
    .on("mouseleave", () => { rp.style("opacity", null); hideTip(); });

  // Axes : titre, boutons ◂ ▸ ×, segments cliquables, étiquettes (nom et effectif)
  axes.forEach((a, ai) => {
    const ag = g.append("g").attr("transform", `translate(${x(a)},0)`);
    const title = ag.append("text").attr("class", "axt").attr("y", -14).text(dimLabel(a));
    if (a !== LAST) {
      const tw = title.node().getComputedTextLength ? title.node().getComputedTextLength() : dimLabel(a).length * 7.4;
      let bx = tw + 6;
      const btn = (glyph, label, fn) => {
        const t = ag.append("text").attr("class", "axbtn").attr("x", bx).attr("y", -14).text(glyph);
        makeActionable(t, fn, label);
        bx += 15;
      };
      if (ai > 0) btn("◂", `Déplacer l'axe ${dimLabel(a)} vers la gauche`, () => moveAxis(axes, ai, -1));
      if (ai < axes.length - 2) btn("▸", `Déplacer l'axe ${dimLabel(a)} vers la droite`, () => moveAxis(axes, ai, +1));
      if (axes.length > PSET_MIN_AXES) btn("×", `Retirer l'axe ${dimLabel(a)}`, () => setState({ psetAxes: axes.filter((z) => z !== a) }));
    }
    const data = [...blocks[a].map.values()];
    const bl = ag.selectAll("rect").data(data).join("rect").attr("class", "blk")
      .attr("y", (d) => d.y0).attr("width", BAR).attr("height", (d) => Math.max(1.5, d.y1 - d.y0)).attr("rx", 2)
      .classed("small", (d) => d.n < SMALL_N);
    makeActionable(bl, (d) => toggleDrill(a, d.value, "pset"),
      (d) => `${dimLabel(a)}, ${valueName(a, d.value)}, ${plural(d.n, "élève", "élèves")}, ${pct(d.ok / d.n)} de réussite. Zoomer`);
    bl.on("mouseenter", (e, d) => {
      rp.style("opacity", (r) => ((r.a === a && r.va === d.value) || (r.b === a && r.vb === d.value) ? 0.9 : 0.12));
      showTip(e, `<b>${valueName(a, d.value)}</b><br>${plural(d.n, "élève", "élèves")}, ${pct(d.ok / d.n)} de réussite${d.n < SMALL_N ? "<br>Moins de 10 élèves, à lire avec prudence" : ""}<br>Cliquez pour zoomer`);
    }).on("mousemove", moveTip).on("mouseleave", () => { rp.style("opacity", null); hideTip(); });
    ag.selectAll("text.lbl").data(data.filter((d) => d.y1 - d.y0 >= 11)).join("text").attr("class", "lbl")
      .attr("x", BAR + 6).attr("y", (d) => (d.y0 + d.y1) / 2).attr("dy", "0.35em")
      .text((d) => `${valueName(a, d.value)} (${d.n})`);
  });

  // Chemin de l'élève sélectionné, s'il fait partie du diagramme
  const stu = derived.selected;
  if (stu) {
    const pts = axes.map((a) => { const b = blocks[a].map.get(String(stu[a])); return b ? [x(a) + BAR / 2, (b.y0 + b.y1) / 2] : null; });
    if (pts.every(Boolean)) {
      g.append("path").attr("class", "pset-path").attr("d", d3.line().curve(d3.curveMonotoneX)(pts));
      g.selectAll("circle.pset-stu").data(pts).join("circle").attr("class", "pset-stu").attr("cx", (d) => d[0]).attr("cy", (d) => d[1]).attr("r", 5);
    }
  }
}

function moveAxis(axes, i, dir) {
  const next = axes.slice();
  [next[i], next[i + dir]] = [next[i + dir], next[i]];
  setState({ psetAxes: next });
}

// ---------- Tableau équivalent (alternative non visuelle au diagramme) ----------

function renderTable(model, st) {
  const open = tableEl.open;
  tableEl.replaceChildren();
  const sum = document.createElement("summary");
  sum.textContent = "Voir les données en tableau";
  tableEl.appendChild(sum);
  if (!model.N) return;
  const t = document.createElement("table");
  t.className = "attr";
  t.innerHTML = "<thead><tr><th>Axe</th><th>Catégorie</th><th>Élèves</th><th>Réussite</th></tr></thead>";
  const tb = document.createElement("tbody");
  model.axes.filter((a) => a !== LAST).forEach((a) => model.segments[a].forEach((sg) => {
    const tr = document.createElement("tr");
    [dimLabel(a), valueName(a, sg.value), String(sg.n), pct(sg.ok / sg.n)].forEach((txt) => {
      const td = document.createElement("td");
      td.textContent = txt;
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  }));
  t.appendChild(tb);
  tableEl.appendChild(t);
  const ok = (model.segments[LAST].find((s) => s.value === "oui") || { n: 0 }).n;
  const cap = document.createElement("p");
  cap.className = "note";
  cap.textContent = `${model.N} élèves de ${DATASETS[st.ds].name}, ${pct(ok / model.N)} ont 10 ou plus.`;
  tableEl.appendChild(cap);
  tableEl.open = open;
}
