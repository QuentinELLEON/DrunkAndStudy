/* =====================================================================
   views/parallelSets.js — Technique A (Quentin) : ensembles parallèles
   ---------------------------------------------------------------------
   Tâches : U1-3, U1-5, U2-3, U2-4, U2-5 (principale) ; U1-1, U1-2, U1-4, U2-1 (secondaire).
   Transformation : chaque élève suit un chemin à travers des attributs catégoriels
            (quantitatifs découpés : absCat, risque, tendance) ; on compte les élèves
            par catégorie et par passage d'une dimension à la suivante, en séparant
            ceux qui réussissent de ceux qui échouent.
   Marques   : un segment par catégorie (largeur = nombre d'élèves) sur chaque ligne,
               une bande par passage entre deux lignes voisines.
   Canaux    : largeur = effectif ; teinte des bandes = réussite (bleu ▲) / échec (orange ▼) /
               non évalué (gris ✕) ; trait noir = chemin de l'élève ouvert dans la fiche.
   Interactions : clic sur une catégorie = zoom (on ne garde que ces élèves, partout : sélection
               partagée), fil d'Ariane pour revenir ; ▲ ▼ pour déplacer une dimension ;
               choix des dimensions ; survol (n, % de réussite) ; curseurs temps d'étude et
               sorties (U2-5) qui filtrent toutes les vues.
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { PSET_KEYS, PSET_DEFAULT, SMALL_N } from "../meta.js";
import { groupValue } from "../data.js";
import { css, resultSpec, labelOf, titleOf, showTip, hideTip, tipRow, widthOf, esc, fmt1, pct } from "../utils.js";

const ROW = 66, BAR = 12, TOP = 20, LAB = 150, GAP = 4;
const RORDER = ["non", "oui", ""];
let root, headEl, crumbEl, ctlEl, svgEl, chipsEl;
let cur = { state: null, derived: null };

export function init(container) {
  root = container;
  root.innerHTML = `
    <p class="headline" id="ps-head" aria-live="polite"></p>
    <div class="toolbar" id="ps-ctl"></div>
    <nav class="crumbs" id="ps-crumbs" aria-label="Zoom des ensembles parallèles"></nav>
    <div class="legend" id="ps-legend"></div>
    <div class="psbox"><svg id="ps-svg" role="img" aria-label="Ensembles parallèles : répartition des élèves à travers plusieurs attributs"></svg></div>
    <details class="axes"><summary>Choisir les dimensions</summary><div class="chips" id="ps-chips"></div></details>`;
  headEl = root.querySelector("#ps-head"); crumbEl = root.querySelector("#ps-crumbs");
  ctlEl = root.querySelector("#ps-ctl"); svgEl = root.querySelector("#ps-svg"); chipsEl = root.querySelector("#ps-chips");

  crumbEl.addEventListener("click", e => {
    const b = e.target.closest("button[data-depth]"); if (!b) return;
    const keep = +b.dataset.depth, ps = cur.state.drill.filter(c => c.src === "pset");
    const kept = new Set(ps.slice(0, keep));
    setState({ drill: cur.state.drill.filter(c => c.src !== "pset" || kept.has(c)) }, "pset");
  });
  ctlEl.addEventListener("input", e => {
    const k = e.target.dataset.slide; if (!k) return;
    const slide = { ...cur.state.slide }, v = +e.target.value;
    if (v) slide[k] = v; else delete slide[k];
    setState({ slide }, "pset");
  });
  chipsEl.addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    const keys = dims(cur.state, cur.derived.ds).slice(), k = c.dataset.k, i = keys.indexOf(k);
    if (i >= 0) { if (keys.length <= 2 || k === "reussite") return; keys.splice(i, 1); } else keys.splice(keys.length - 1, 0, k);
    setState({ psetKeys: keys }, "pset");
  });
  svgEl.addEventListener("click", e => {
    const mv = e.target.closest("[data-move]");
    if (mv) { move(mv.dataset.k, +mv.dataset.move); return; }
    const seg = e.target.closest("[data-seg]");
    if (seg) zoom(seg.dataset.k, seg.dataset.v);
  });
  svgEl.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const mv = e.target.closest("[data-move]"), seg = e.target.closest("[data-seg]");
    if (mv) { e.preventDefault(); move(mv.dataset.k, +mv.dataset.move); }
    else if (seg) { e.preventDefault(); zoom(seg.dataset.k, seg.dataset.v); }
  });
}

function dims(state, ds) {
  const keys = (state.psetKeys || PSET_DEFAULT).filter(k => ds.keys.includes(k) && PSET_KEYS.includes(k));
  const r = keys.filter(k => k !== "reussite");
  return ds.keys.includes("reussite") ? r.concat("reussite") : r;
}
function move(k, dir) {
  const keys = dims(cur.state, cur.derived.ds).slice(), i = keys.indexOf(k), j = i + dir;
  if (i < 0 || j < 0 || j >= keys.length) return;
  [keys[i], keys[j]] = [keys[j], keys[i]];
  setState({ psetKeys: keys }, "pset");
}
function parseVal(ds, k, raw) {
  if (raw === "__nr") return "__nr";
  const M = ds.meta[k];
  return (M.bins || M.t !== "nom") ? +raw : raw;
}
function zoom(k, raw) {
  const ds = cur.derived.ds, value = parseVal(ds, k, raw);
  if (value === "__nr") return;                               // pas de zoom sur « non évalué »
  const drill = cur.state.drill.filter(c => !(c.src === "pset" && c.key === k)).concat({ key: k, value, src: "pset" });
  setState({ drill }, "pset");
}

/** Catégorie d'un élève sur une dimension ; "__nr" pour une valeur manquante. */
function catOf(ds, k, d) {
  const v = groupValue(ds.meta, k, d);
  return v === "" || v == null || (typeof v === "number" && isNaN(v)) ? "__nr" : v;
}
function catLabel(ds, k, v) {
  if (v === "__nr") return "non évalué";
  const M = ds.meta[k];
  if (M.bins) return M.bins.s[M.bins.d.indexOf(v)];
  return k === "reussite" ? (v === "oui" ? "▲ réussite" : "▼ échec") : (M.s && M.d ? M.s[M.d.indexOf(v)] ?? labelOf(ds.meta, k, v) : labelOf(ds.meta, k, v));
}

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) return;
  if (!ds.standard) { headEl.textContent = ""; ctlEl.innerHTML = ""; crumbEl.innerHTML = ""; d3.select(svgEl).selectAll("*").remove();
    root.querySelector("#ps-legend").innerHTML = `<p class="empty">Les ensembles parallèles nécessitent les colonnes du jeu d'origine.</p>`; chipsEl.innerHTML = ""; return; }
  const keys = dims(state, ds), rows = derived.selection;

  // curseurs U2-5 (posent des filtres partagés par toutes les vues)
  const focus = ctlEl.contains(document.activeElement) ? document.activeElement.dataset.slide : null;
  const slider = (k, max) => {
    const v = state.slide[k] || 0, M = ds.meta[k];
    return `<label class="slide"><span class="flabel">${esc(titleOf(ds.meta, k))}</span>
      <input type="range" min="0" max="${max}" step="1" value="${v}" data-slide="${k}" aria-valuetext="${v ? esc(labelOf(ds.meta, k, v)) : "tous"}">
      <b>${v ? esc(M.s[M.d.indexOf(v)]) : "tous"}</b></label>`;
  };
  const graded = rows.filter(d => !d.__nograde);
  ctlEl.innerHTML = slider("studytime", 4) + slider("goout", 5) +
    `<span class="slideout">Sélection : <b>n = ${rows.length}</b> · note moyenne <b>${graded.length ? fmt1(d3.mean(graded, d => d.G3)) : "—"}/20</b>` +
    `${rows.length < SMALL_N ? " ⚠" : ""} <span class="muted">(association, pas cause)</span></span>`;
  if (focus) { const i = ctlEl.querySelector(`[data-slide="${focus}"]`); if (i) i.focus({ preventScroll: true }); }

  // fil d'Ariane du zoom
  const ps = state.drill.filter(c => c.src === "pset");
  crumbEl.innerHTML = `<button type="button" class="crumb" data-depth="0">Tous les élèves</button>` +
    ps.map((c, i) => ` › <button type="button" class="crumb" data-depth="${i + 1}"${i === ps.length - 1 ? ' aria-current="true"' : ""}>${esc(titleOf(ds.meta, c.key))} : ${esc(catLabel(ds, c.key, c.value))}</button>`).join("") +
    ` <span class="muted">(${rows.length} élèves)</span>`;

  const R = resultSpec();
  root.querySelector("#ps-legend").innerHTML = [["non", "fail"], ["oui", "pass"]].concat(state.excludeNoGrade ? [] : [["", "none"]]).map(([, k]) =>
    `<span class="item"><span class="sw sq" style="background:${R[k].color}"></span>${R[k].icon} ${R[k].label}</span>`).join("") +
    `<span class="item muted">largeur = nombre d'élèves · clic sur une catégorie = zoom</span>`;
  chipsEl.innerHTML = PSET_KEYS.filter(k => ds.keys.includes(k)).map(k =>
    `<button type="button" class="chip" data-k="${k}" aria-pressed="${keys.includes(k)}"${k === "reussite" ? " disabled" : ""}>${esc(titleOf(ds.meta, k))}</button>`).join("");

  headEl.innerHTML = headline(ds, rows);
  draw(state, derived, ds, keys, rows);
}

function headline(ds, rows) {
  const g = rows.filter(d => !d.__nograde);
  if (!g.length) return "Aucun élève évalué dans la sélection.";
  const fail = g.filter(d => d.G3 < 10), ok = g.filter(d => d.G3 >= 10);
  const share = a => a.length ? a.filter(d => d.failures >= 1).length / a.length : NaN;
  return `<b>${g.length} élèves</b> évalués, <b>${pct(ok.length / g.length)}</b> réussissent.` +
    (fail.length >= SMALL_N && ok.length >= SMALL_N
      ? ` Parmi ceux sous 10, <b>${pct(share(fail))}</b> ont déjà échoué au moins une fois, contre ${pct(share(ok))} des autres.` : "") +
    (g.length < SMALL_N ? " ⚠ Moins de 10 élèves : à lire comme des cas." : "");
}

function draw(state, derived, ds, keys, rows) {
  const W = Math.max(320, widthOf(root, 700)), lab = W < 520 ? 96 : LAB, avail = W - lab - 8;
  const H = TOP + (keys.length - 1) * ROW + BAR + 16;
  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  if (!rows.length) { svg.append("text").attr("x", lab).attr("y", 30).text("Aucun élève dans la sélection."); return; }
  const R = resultSpec(), col = r => r === "oui" ? R.pass.color : r === "non" ? R.fail.color : R.none.color;
  const resOf = d => d.reussite || "";

  // segments de chaque dimension
  const layer = keys.map((k, i) => {
    const counts = d3.rollup(rows, v => v.length, d => catOf(ds, k, d));
    const M = ds.meta[k], D = M.bins ? M.bins.d : M.d || Array.from(counts.keys()).filter(v => v !== "__nr").sort(d3.ascending);
    const cats = D.filter(v => counts.has(v)).concat(counts.has("__nr") ? ["__nr"] : []);
    const scale = (avail - GAP * (cats.length - 1)) / rows.length;
    let x = lab; const seg = {};
    cats.forEach(v => { const n = counts.get(v); seg[v] = { v, n, x, w: n * scale, out: x, in: x }; x += n * scale + GAP; });
    return { k, y: TOP + i * ROW, cats, seg, scale };
  });

  // bandes entre dimensions voisines, séparées par réussite
  const g = svg.append("g");
  for (let i = 0; i < layer.length - 1; i++) {
    const A = layer[i], B = layer[i + 1];
    const flows = d3.rollup(rows, v => v.length, d => catOf(ds, A.k, d), d => catOf(ds, B.k, d), resOf);
    const list = [];
    A.cats.forEach(a => B.cats.forEach(b => RORDER.forEach(r => {
      const n = flows.get(a)?.get(b)?.get(r); if (n) list.push({ a, b, r, n });
    })));
    // positions : sortie ordonnée par cible puis réussite, entrée par source puis réussite
    const outPos = new Map(), inPos = new Map();
    A.cats.forEach(a => list.filter(l => l.a === a).forEach(l => { const s = A.seg[a]; outPos.set(l, s.out); s.out += l.n * A.scale; }));
    B.cats.forEach(b => list.filter(l => l.b === b).forEach(l => { const s = B.seg[b]; inPos.set(l, s.in); s.in += l.n * B.scale; }));
    const y0 = A.y + BAR, y1 = B.y, ym = (y0 + y1) / 2;
    list.forEach(l => {
      const xa = outPos.get(l), xb = inPos.get(l), wa = l.n * A.scale, wb = l.n * B.scale;
      g.append("path").attr("class", "ribbon")
        .attr("d", `M${xa},${y0}C${xa},${ym} ${xb},${ym} ${xb},${y1}L${xb + wb},${y1}C${xb + wb},${ym} ${xa + wa},${ym} ${xa + wa},${y0}Z`)
        .attr("fill", col(l.r)).attr("fill-opacity", 0.42)
        .on("mousemove", ev => showTip(ev, `<b>${esc(catLabel(ds, A.k, l.a))} → ${esc(catLabel(ds, B.k, l.b))}</b>` +
          tipRow("Élèves", `n = ${l.n}`) + tipRow("Résultat", l.r === "oui" ? "▲ réussite" : l.r === "non" ? "▼ échec" : "✕ non évalué")))
        .on("mouseleave", hideTip);
    });
  }

  // chemin de l'élève ouvert dans la fiche (U1-4)
  const sd = derived.selected;
  if (sd && rows.some(d => d.__i === sd.__i)) {
    const pts = layer.map(L => { const s = L.seg[catOf(ds, L.k, sd)]; return s ? [s.x + s.w / 2, L.y + BAR / 2] : null; }).filter(Boolean);
    svg.append("path").attr("d", d3.line().curve(d3.curveMonotoneY)(pts)).attr("fill", "none")
      .attr("stroke", css("--surface-1")).attr("stroke-width", 5).attr("pointer-events", "none");
    svg.append("path").attr("d", d3.line().curve(d3.curveMonotoneY)(pts)).attr("fill", "none")
      .attr("stroke", css("--text-1")).attr("stroke-width", 2).attr("pointer-events", "none");
  }

  // segments et libellés
  layer.forEach((L, i) => {
    const gl = svg.append("g");
    gl.append("text").attr("x", 0).attr("y", L.y + BAR - 1).style("font-size", "11.5px").style("font-weight", 600).style("fill", css("--text-1"))
      .text(titleOf(ds.meta, L.k).length > (lab < 120 ? 13 : 20) ? titleOf(ds.meta, L.k).slice(0, lab < 120 ? 12 : 19) + "…" : titleOf(ds.meta, L.k))
      .append("title").text(titleOf(ds.meta, L.k) + (ds.meta[L.k].def ? " — " + ds.meta[L.k].def : ""));
    if (L.k !== "reussite") {
      [[-1, "▲", i > 0], [1, "▼", i < layer.length - 2]].forEach(([dir, ic, okMove], j) => {
        if (!okMove) return;
        gl.append("text").attr("class", "psmove").attr("x", lab - 30 + j * 14).attr("y", L.y + BAR + 13).attr("data-move", dir).attr("data-k", L.k)
          .attr("tabindex", 0).attr("role", "button").attr("aria-label", `Déplacer « ${titleOf(ds.meta, L.k)} » ${dir < 0 ? "vers le haut" : "vers le bas"}`)
          .style("font-size", "11px").text(ic);
      });
    }
    L.cats.forEach(v => {
      const s = L.seg[v], sub = rows.filter(d => catOf(ds, L.k, d) === v), gr = sub.filter(d => !d.__nograde);
      const rate = gr.length ? gr.filter(d => d.G3 >= 10).length / gr.length : NaN;
      const zoomable = v !== "__nr" && L.cats.length > 1;
      const rect = gl.append("rect").attr("x", s.x).attr("y", L.y).attr("width", Math.max(1, s.w)).attr("height", BAR).attr("rx", 2)
        .attr("fill", css("--text-2")).attr("fill-opacity", s.n < SMALL_N ? 0.35 : 0.8)
        .attr("stroke", s.n < SMALL_N ? css("--text-2") : "none").attr("stroke-dasharray", s.n < SMALL_N ? "2 2" : null)
        .attr("class", zoomable ? "psseg" : null)
        .on("mousemove", ev => showTip(ev, `<b>${esc(titleOf(ds.meta, L.k))} : ${esc(catLabel(ds, L.k, v))}</b>` +
          tipRow("Élèves", `n = ${s.n}${s.n < SMALL_N ? " ⚠" : ""}`) + tipRow("Réussite (G3 ≥ 10)", isFinite(rate) ? pct(rate) : "—") +
          (zoomable ? `<div class="hint">Clic : ne garder que ces élèves (toutes les vues)</div>` : "")))
        .on("mouseleave", hideTip);
      if (zoomable) rect.attr("data-seg", "").attr("data-k", L.k).attr("data-v", v).attr("tabindex", 0).attr("role", "button")
        .attr("aria-label", `${titleOf(ds.meta, L.k)} : ${catLabel(ds, L.k, v)}, ${s.n} élèves, ${isFinite(rate) ? pct(rate) + " de réussite" : ""}. Entrée pour zoomer.`);
      const txt = `${catLabel(ds, L.k, v)} ${s.n}`;
      if (s.w > txt.length * 6 + 4) gl.append("text").attr("class", "halo").attr("x", s.x + 2).attr("y", L.y - 3)
        .style("font-size", "10.5px").style("fill", css("--text-2")).attr("pointer-events", "none").text(txt);
    });
  });
}
