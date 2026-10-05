/* =====================================================================
   views/correlationMatrix.js — Technique B (Jim) : matrice de corrélation
   ---------------------------------------------------------------------
   Tâches : U1-1 (principale) ; U2-3 (secondaire, lecture réduite).
   Transformation : ρ de Spearman (rangs moyens, ex æquo gérés) pour chaque paire
            d'attributs ordonnables (meta.MATRIX_KEYS), calculé sur la sélection
            partagée ; ordre par |ρ| avec G3 (classement des facteurs) ou thématique.
   Marques   : une cellule par paire (triangle inférieur).
   Canaux    : teinte divergente centrée sur 0 (bleu = ils montent ensemble, rouge = l'un
               monte quand l'autre baisse, blanc = proche de 0) ; valeur signée écrite dans
               la cellule ; cellule grisée si |ρ| < 0,1 (« pas de lien net »).
   Interactions : survol (phrase simple + n), clic / Entrée : nuage de points de la paire
               sous la matrice, où le sens du lien se voit à l'œil ; choix de l'ordre.
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { MATRIX_KEYS, SMALL_N, PASS } from "../meta.js";
import { spearmanMatrix, hash01 } from "../stats.js";
import { css, resultOf, resultSpec, labelOf, titleOf, showTip, hideTip, tipRow, widthOf, esc, fmt2 } from "../utils.js";

const WEAK = 0.1;
let root, headEl, svgEl, legendEl, scatterEl, orderSel;
let cur = { state: null, derived: null };
let cacheSig = "", cacheMx = null;

export function init(container) {
  root = container;
  root.innerHTML = `
    <p class="headline" id="mx-head" aria-live="polite"></p>
    <div class="toolbar"><label class="lbl" for="mx-order">Ordre</label>
      <select id="mx-order"><option value="g3">par force du lien avec la note finale</option><option value="meta">thématique</option></select>
      <span id="mx-n" class="nbadge"></span></div>
    <div class="matrix"><svg id="mx-svg" role="grid" aria-label="Matrice de corrélation de Spearman"></svg></div>
    <div class="matrix-legend" id="mx-legend"></div>
    <div id="mx-scatter"></div>`;
  headEl = root.querySelector("#mx-head"); svgEl = root.querySelector("#mx-svg");
  legendEl = root.querySelector("#mx-legend"); scatterEl = root.querySelector("#mx-scatter");
  orderSel = root.querySelector("#mx-order");
  orderSel.addEventListener("change", e => setState({ mxOrder: e.target.value }, "matrix"));
  svgEl.addEventListener("click", e => { const c = e.target.closest("g.cell"); if (c) pick(c); });
  svgEl.addEventListener("keydown", e => {
    const c = e.target.closest("g.cell"); if (!c) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(c); }
  });
  scatterEl.addEventListener("click", e => { if (e.target.closest("[data-close]")) setState({ mxPair: null }, "matrix"); });
}

function pick(node) {
  const d = d3.select(node).datum(), p = cur.state.mxPair;
  setState({ mxPair: p && p[0] === d.a && p[1] === d.b ? null : [d.a, d.b] }, "matrix");
}

/** Phrase simple pour un ρ. */
function sentence(ds, a, b, r) {
  if (!isFinite(r)) return "non calculable (une des deux valeurs ne varie pas dans la sélection)";
  const A = titleOf(ds.meta, a).toLowerCase(), B = titleOf(ds.meta, b).toLowerCase(), x = Math.abs(r);
  if (x < WEAK) return `pas de lien net entre ${A} et ${B}`;
  const f = x < 0.3 ? "faible" : x < 0.5 ? "modéré" : "fort";
  return r > 0 ? `quand ${A} augmente, ${B} tend aussi à augmenter (lien ${f})` : `quand ${A} augmente, ${B} tend à diminuer (lien ${f})`;
}

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) return;
  orderSel.value = state.mxOrder;
  const keys0 = ds.standard ? MATRIX_KEYS.filter(k => ds.keys.includes(k)) : ds.rawKeys.filter(k => ds.meta[k].t !== "nom");
  const rows = derived.selection.filter(d => keys0.every(k => isFinite(d[k])));
  if (keys0.length < 2) { headEl.textContent = ""; d3.select(svgEl).selectAll("*").remove(); legendEl.innerHTML = `<p class="empty">Pas deux attributs ordonnables dans ce fichier.</p>`; scatterEl.innerHTML = ""; return; }
  const sig = ds.name + keys0.join() + rows.map(d => d.__i).join(",");
  if (sig !== cacheSig) { cacheMx = spearmanMatrix(rows, keys0); cacheSig = sig; }
  const mx = cacheMx;
  let keys = keys0;
  if (state.mxOrder === "g3" && keys0.includes("G3"))
    keys = ["G3"].concat(keys0.filter(k => k !== "G3").sort((a, b) => Math.abs(mx.get(b, "G3") || 0) - Math.abs(mx.get(a, "G3") || 0)));
  root.querySelector("#mx-n").textContent = `n = ${rows.length} élèves${rows.length < SMALL_N ? " ⚠ trop peu pour conclure" : ""} · calculée sur la sélection`;

  if (keys0.includes("G3")) {
    const top = keys0.filter(k => k !== "G3" && !["G1", "G2"].includes(k)).map(k => [k, mx.get(k, "G3")]).filter(x => isFinite(x[1]))
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
    headEl.innerHTML = top.length ? `Liens les plus forts avec la note finale : ` + top.map(([k, r], i) =>
      `<b>${i + 1}. ${esc(titleOf(ds.meta, k).toLowerCase())}</b> (ρ ${r > 0 ? "+" : "−"}${fmt2(Math.abs(r))}, ${r < 0 ? "réussite plus basse quand il augmente" : "réussite plus haute quand il augmente"})`).join(", ") +
      `. Association, pas cause.` : "";
  } else headEl.textContent = "";
  draw(state, ds, keys, mx);
  drawScatter(state, derived, ds, rows, mx);
}

function draw(state, ds, keys, mx) {
  const K = keys.length, w = widthOf(root, 560);
  const labW = Math.min(150, Math.max(90, w * 0.24)), bottom = 90;
  const cell = Math.max(18, Math.min(40, Math.floor((w - labW - 8) / (K - 1))));
  const W = labW + cell * (K - 1) + 8, H = cell * (K - 1) + bottom;
  const color = d3.scaleLinear().domain([-1, 0, 1]).range([css("--div-neg"), css("--div-mid"), css("--div-pos")]).interpolate(d3.interpolateLab).clamp(true);
  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
  const refocus = svgEl.contains(document.activeElement) ? document.activeElement.getAttribute("aria-label") : null;
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${labW},2)`);
  const cells = [];
  for (let i = 1; i < K; i++) for (let j = 0; j < i; j++) cells.push({ i, j, a: keys[i], b: keys[j], r: mx.get(keys[i], keys[j]) });
  const pair = state.mxPair || [];
  const cg = g.selectAll("g.cell").data(cells).join("g")
    .attr("class", d => "cell" + ((pair[0] === d.a && pair[1] === d.b) ? " pair" : ""))
    .attr("transform", d => `translate(${d.j * cell},${(d.i - 1) * cell})`)
    .attr("tabindex", 0).attr("role", "gridcell")
    .attr("aria-label", d => `${titleOf(ds.meta, d.a)} et ${titleOf(ds.meta, d.b)} : ${sentence(ds, d.a, d.b, d.r)}. Entrée pour voir le nuage de points.`);
  const weak = d => !isFinite(d.r) || Math.abs(d.r) < WEAK;
  cg.append("rect").attr("class", "bg").attr("x", 1).attr("y", 1).attr("width", cell - 2).attr("height", cell - 2).attr("rx", 3)
    .attr("fill", d => weak(d) ? css("--chip") : color(d.r));
  if (cell >= 22) cg.append("text").attr("x", cell / 2).attr("y", cell / 2).attr("dy", "0.34em").attr("text-anchor", "middle")
    .style("font-size", "9.5px").style("font-weight", d => !weak(d) && Math.abs(d.r) >= 0.3 ? 700 : 400)
    .style("fill", d => weak(d) ? css("--muted") : Math.abs(d.r) < 0.35 ? css("--text-1") : d3.lab(color(d.r)).l > 60 ? "#0b0b0b" : "#ffffff")
    .text(d => !isFinite(d.r) ? "–" : (d.r < 0 ? "−" : "+") + fmt2(Math.abs(d.r)).replace(/^0/, ""));
  cg.on("mousemove", (ev, d) => showTip(ev, `<b>${esc(titleOf(ds.meta, d.a))} × ${esc(titleOf(ds.meta, d.b))}</b>` +
      tipRow("ρ de Spearman", isFinite(d.r) ? fmt2(d.r) : "—") + `<div class="hint">${esc(sentence(ds, d.a, d.b, d.r))}</div>` +
      tipRow("Élèves", `n = ${mx.n}`) + `<div class="hint">Association, pas cause. Clic : nuage de points.</div>`))
    .on("mouseleave", hideTip);
  g.selectAll("text.rowlab").data(keys.slice(1)).join("text").attr("class", "rowlab").attr("x", -6)
    .attr("y", (k, i) => i * cell + cell / 2).attr("dy", "0.34em").attr("text-anchor", "end").style("font-size", "10.5px")
    .style("font-weight", k => k === "G3" ? 700 : 400).text(k => titleOf(ds.meta, k).slice(0, Math.floor(labW / 6.2)));
  g.selectAll("text.collab").data(keys.slice(0, -1)).join("text").attr("class", "collab")
    .attr("transform", (k, j) => `translate(${j * cell + cell / 2},${(K - 1) * cell + 8}) rotate(-45)`)
    .attr("text-anchor", "end").attr("dy", "0.34em").style("font-size", "10.5px").style("font-weight", k => k === "G3" ? 700 : 400)
    .text(k => titleOf(ds.meta, k).slice(0, 18));
  if (refocus) { const n = [...svgEl.querySelectorAll("g.cell")].find(c => c.getAttribute("aria-label") === refocus); if (n) n.focus({ preventScroll: true }); }
  const stops = d3.range(-1, 1.01, 0.25).map(v => color(v));
  legendEl.innerHTML = `<span>ρ</span><span>−1</span><span class="ramp" style="background:linear-gradient(90deg,${stops.join(",")})"></span><span>+1</span>` +
    `<span>rouge : quand l'un augmente, l'autre tend à diminuer · bleu : ils augmentent ensemble · gris : pas de lien net (|ρ| &lt; ${String(WEAK).replace(".", ",")})</span>`;
}

/** Nuage de points de la paire choisie (valeurs entières : léger décalage déterministe pour voir les ex æquo). */
function drawScatter(state, derived, ds, rows, mx) {
  const p = state.mxPair;
  if (!p || !p.every(k => ds.keys.includes(k))) { scatterEl.innerHTML = `<p class="note">Cliquez une cellule pour voir le nuage de points de la paire.</p>`; return; }
  const [a, b] = p, r = mx.get(a, b);
  const w = Math.min(560, widthOf(root, 520)), h = 260, m = { t: 12, r: 12, b: 40, l: 46 };
  const ext = k => k === "G3" || k === "G1" || k === "G2" ? [0, 20] : d3.extent(rows, d => d[k]);
  const x = d3.scaleLinear().domain(ext(a)).nice().range([m.l, w - m.r]), y = d3.scaleLinear().domain(ext(b)).nice().range([h - m.b, m.t]);
  const jx = (x(1) - x(0)) * 0.35, jy = Math.abs(y(1) - y(0)) * 0.35;
  const R = resultSpec();
  const sx = d => x(d[a]) + (hash01(d.__i) - 0.5) * Math.min(jx, 18), sy = d => y(d[b]) + (hash01(d.__i + 7919) - 0.5) * Math.min(jy, 18);
  scatterEl.innerHTML = `<div class="scatterhead"><b>${esc(titleOf(ds.meta, a))} × ${esc(titleOf(ds.meta, b))}</b> · ${esc(sentence(ds, a, b, r))} · n = ${rows.length}
    <button type="button" class="btn small" data-close aria-label="Fermer le nuage de points">✕</button></div><svg></svg>`;
  const svg = d3.select(scatterEl.querySelector("svg")).attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
    .attr("role", "img").attr("aria-label", `Nuage de points ${titleOf(ds.meta, a)} contre ${titleOf(ds.meta, b)}`);
  svg.append("g").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("~d")));
  svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat(d3.format("~d")));
  svg.selectAll(".domain, .tick line").attr("stroke", css("--axis"));
  svg.append("text").attr("x", (m.l + w - m.r) / 2).attr("y", h - 6).attr("text-anchor", "middle").style("font-size", "11px").text(titleOf(ds.meta, a));
  svg.append("text").attr("transform", `translate(12,${(m.t + h - m.b) / 2}) rotate(-90)`).attr("text-anchor", "middle").style("font-size", "11px").text(titleOf(ds.meta, b));
  if (b === "G3" || a === "G3") {
    const t = b === "G3" ? `M${m.l},${y(PASS)}H${w - m.r}` : `M${x(PASS)},${m.t}V${h - m.b}`;
    svg.append("path").attr("d", t).attr("class", "passline");
  }
  svg.append("g").selectAll("circle").data(rows).join("circle").attr("cx", sx).attr("cy", sy).attr("r", 3)
    .attr("fill", d => R[resultOf(d)].color).attr("fill-opacity", rows.length > 300 ? 0.45 : 0.7)
    .on("mousemove", (ev, d) => showTip(ev, `<b>Élève n° ${d.__i + 1}</b>` + tipRow(titleOf(ds.meta, a), esc(labelOf(ds.meta, a, d[a]))) +
      tipRow(titleOf(ds.meta, b), esc(labelOf(ds.meta, b, d[b]))) + `<div class="hint">Clic : ouvrir la fiche</div>`))
    .on("mouseleave", hideTip)
    .on("click", (ev, d) => setState({ selectedId: d.__i }, "matrix"));
}
