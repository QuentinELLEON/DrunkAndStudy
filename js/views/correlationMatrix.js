/* =====================================================================
   views/correlationMatrix.js — Technique 2 (Jim)
   Matrice de corrélation de Spearman (attributs quantitatifs et ordinaux)
   ---------------------------------------------------------------------
   Transformation : rangs moyens → Pearson sur les rangs = ρ de Spearman,
                    pour chaque paire (triangle inférieur, diagonale omise).
   Marques   : une cellule carrée par paire.
   Canaux    : teinte divergente (rouge ← gris → bleu) = signe et force de ρ ;
               valeur signée écrite dans la cellule (la couleur n'est jamais seule) ;
               contour aqua = paire d'axes adjacents dans les coordonnées parallèles ;
               contour épais = paire choisie.
   Données   : filtres de la barre + groupe + tendance, SANS les brushes
               (brosser restreint l'étendue d'une variable et atténue ρ).
   Attributs : 12 attributs ordonnables BRUTS (meta.MATRIX_KEYS) : la matrice est la vue
               où la redondance Dalc/Walc et Medu/Fedu se voit (U4.1), ce qui justifie
               leur fusion en alc et pedu dans les autres vues. G1/G2 sont retirés
               (ρ ≈ 0,9 avec G3 : ils écrasaient l'échelle), age et famrel aussi.
   Interactions : survol (ρ, n, force), clic / Entrée (ajoute les 2 axes côte à côte
               dans les coordonnées parallèles), flèches (navigation clavier), tri.
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { SMALL_N, AXIS_ALIAS } from "../meta.js";
import { numericKeys } from "../data.js";
import { spearmanMatrix } from "../stats.js";
import { css, divergingScale, rhoShort, strength, titleOf, truncate, showTip, hideTip, tipRow, widthOf, esc, fmt2 } from "../utils.js";

let root, svgEl, headEl, legendEl, feedbackEl, orderSel;
let cur = { state: null, derived: null };
let cacheSig = "", cacheMx = null;
let focusIdx = [1, 0];                               // cellule active pour la navigation clavier

export function init(container) {
  root = container;
  root.innerHTML = `
    <div class="toolbar">
      <label class="lbl" for="mx-order">Ordre</label>
      <select id="mx-order">
        <option value="meta">Thématique (famille, école, mode de vie, résultats)</option>
        <option value="g3">Par |ρ| avec la note finale</option>
      </select>
      <span id="mx-head"></span>
    </div>
    <div class="matrix"><svg role="grid" aria-label="Matrice de corrélation de Spearman"></svg></div>
    <div class="matrix-legend" id="mx-legend"></div>
    <p class="note" id="mx-feedback" aria-live="polite" style="margin:6px 0 0"></p>`;
  svgEl = root.querySelector("svg"); headEl = root.querySelector("#mx-head");
  legendEl = root.querySelector("#mx-legend"); feedbackEl = root.querySelector("#mx-feedback");
  orderSel = root.querySelector("#mx-order");
  orderSel.addEventListener("change", e => setState({ matrixOrder: e.target.value }, "matrix"));
  svgEl.addEventListener("keydown", onKey);
}

function orderedKeys(state, ds, mx) {
  const keys = numericKeys(ds);
  if (state.matrixOrder === "g3" && keys.includes("G3")) {
    const rest = keys.filter(k => k !== "G3")
      .sort((a, b) => Math.abs(mx.get(b, "G3") || 0) - Math.abs(mx.get(a, "G3") || 0));
    return ["G3"].concat(rest);
  }
  return keys;
}

/** Axe des coordonnées parallèles qui porte un attribut de la matrice (Dalc → alc, Medu → pedu…). */
function axisOf(k) {
  const ds = cur.derived.ds, a = ds.standard ? AXIS_ALIAS[k] : null;
  return a && ds.keys.includes(a) ? a : k;
}

/** Ajoute a et b dans les coordonnées parallèles, b immédiatement à droite de a. */
function pickPair(ra, rb) {
  const s = cur.state, ds = cur.derived.ds;
  const a = axisOf(ra), b = axisOf(rb);
  let axes = s.axes.slice();
  if (a === b) {                                            // paire fusionnée (Dalc × Walc, Medu × Fedu)
    if (!axes.includes(a)) axes.push(a);
    setState({ axes, highlightPair: [a] }, "matrix");
    feedbackEl.textContent = `→ « ${titleOf(ds.meta, ra)} » et « ${titleOf(ds.meta, rb)} » sont fusionnés en « ${titleOf(ds.meta, a)} » dans les autres vues (axe surligné).`;
    return;
  }
  axes = axes.filter(k => k !== b);
  if (!axes.includes(a)) axes.push(a);
  axes.splice(axes.indexOf(a) + 1, 0, b);
  setState({ axes, highlightPair: [a, b] }, "matrix");
  const alias = (r, k) => r !== k ? ` (via « ${titleOf(ds.meta, k)} »)` : "";
  feedbackEl.textContent = `→ « ${titleOf(ds.meta, ra)} »${alias(ra, a)} et « ${titleOf(ds.meta, rb)} »${alias(rb, b)} sont côte à côte dans les coordonnées parallèles.`;
}

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) return;
  orderSel.value = state.matrixOrder;
  const rows = derived.noBrush;
  const allKeys = numericKeys(ds);
  if (allKeys.length < 2) {
    svgEl.innerHTML = ""; legendEl.innerHTML = "";
    headEl.innerHTML = `<span class="empty">Ce fichier n'a pas deux attributs numériques.</span>`;
    return;
  }
  // recalcul seulement si le sous-ensemble a changé (le brush ne le modifie pas)
  const sig = ds.name + "|" + allKeys.join() + "|" + rows.map(d => d.__i).join(",");
  if (sig !== cacheSig) { cacheMx = spearmanMatrix(rows, allKeys); cacheSig = sig; }
  const mx = cacheMx;
  const keys = orderedKeys(state, ds, mx);
  const n = rows.length;
  headEl.innerHTML = `<span class="nbadge${n < SMALL_N ? " small" : ""}">n = ${n} élèves${n < SMALL_N ? " ⚠ trop peu pour conclure" : ""}</span>`;
  draw(state, ds, keys, mx);
}

function draw(state, ds, keys, mx) {
  const K = keys.length;
  const w = widthOf(root, 560);
  const labW = Math.min(150, Math.max(96, w * 0.24)), bottom = 92;
  const cell = Math.max(16, Math.min(36, Math.floor((w - labW - 8) / (K - 1))));
  const W = labW + cell * (K - 1) + 8, H = cell * (K - 1) + bottom + 4;
  const color = divergingScale();
  const light = css("--text-1"), dark = "#0b0b0b", white = "#ffffff";

  // paires adjacentes dans les coordonnées parallèles (lecture de ρ ⇄ lecture visuelle)
  const adj = new Set();
  state.axes.forEach((k, i) => { if (i) { adj.add(k + "|" + state.axes[i - 1]); adj.add(state.axes[i - 1] + "|" + k); } });
  const isAdj = d => adj.has(axisOf(d.a) + "|" + axisOf(d.b));
  const hl = state.highlightPair || [];
  const isPair = d => hl.length === 2 ? hl.includes(axisOf(d.a)) && hl.includes(axisOf(d.b)) && axisOf(d.a) !== axisOf(d.b)
    : hl.length === 1 && axisOf(d.a) === hl[0] && axisOf(d.b) === hl[0];

  const refocus = svgEl.contains(document.activeElement);
  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${labW},2)`);
  // effectif insuffisant : la matrice reste consultable mais visiblement estompée
  const small = mx.n < SMALL_N;

  const cells = [];
  for (let i = 1; i < K; i++) for (let j = 0; j < i; j++) cells.push({ i, j, a: keys[i], b: keys[j], rho: mx.get(keys[i], keys[j]) });

  if (focusIdx[0] >= K || focusIdx[1] >= focusIdx[0]) focusIdx = [1, 0];
  const hlKeys = keys.filter(k => hl.includes(axisOf(k)));

  const cg = g.selectAll("g.cell").data(cells).join("g")
    .attr("class", d => "cell" + (isAdj(d) ? " adj" : "") + (isPair(d) ? " pair" : ""))
    .attr("transform", d => `translate(${d.j * cell},${(d.i - 1) * cell})`)
    .attr("role", "gridcell")
    .attr("tabindex", d => d.i === focusIdx[0] && d.j === focusIdx[1] ? 0 : -1)
    .attr("aria-label", d => `${titleOf(ds.meta, d.a)} et ${titleOf(ds.meta, d.b)} : rho ${rhoShort(d.rho)}, ${strength(d.rho)}`);
  cg.append("rect").attr("class", "bg").attr("x", 1).attr("y", 1)
    .attr("width", cell - 2).attr("height", cell - 2).attr("rx", 3)
    .attr("fill", d => isFinite(d.rho) ? color(d.rho) : css("--chip"))
    .attr("fill-opacity", small ? 0.4 : 1);
  if (cell >= 22) {
    cg.append("text").attr("x", cell / 2).attr("y", cell / 2).attr("dy", "0.34em").attr("text-anchor", "middle")
      .style("fill", d => {
        if (!isFinite(d.rho) || Math.abs(d.rho) < 0.35) return light;     // fond proche du neutre
        return d3.lab(color(d.rho)).l > 60 ? dark : white;
      })
      .style("font-weight", d => Math.abs(d.rho) >= 0.3 ? 700 : 400)
      .text(d => rhoShort(d.rho));
  }

  cg.on("mousemove", (ev, d) => showTip(ev, tipHtml(ds, d)))
    .on("mouseleave", hideTip)
    .on("click", (ev, d) => { focusIdx = [d.i, d.j]; hideTip(); pickPair(d.b, d.a); })
    .on("focus", function (ev, d) { showTip(this.getBoundingClientRect(), tipHtml(ds, d)); })
    .on("blur", hideTip);

  // libellés de lignes (gauche) et de colonnes (bas, inclinés)
  g.selectAll("text.rowlab").data(keys.slice(1)).join("text")
    .attr("class", k => "rowlab" + (hlKeys.includes(k) ? " hl" : ""))
    .attr("x", -6).attr("y", (k, i) => i * cell + cell / 2).attr("dy", "0.34em").attr("text-anchor", "end")
    .text(k => truncate(titleOf(ds.meta, k), Math.floor(labW / 6.2)));
  g.selectAll("text.collab").data(keys.slice(0, -1)).join("text")
    .attr("class", k => "collab" + (hlKeys.includes(k) ? " hl" : ""))
    .attr("transform", (k, j) => `translate(${j * cell + cell / 2},${(K - 1) * cell + 8}) rotate(-45)`)
    .attr("text-anchor", "end").attr("dy", "0.34em")
    .text(k => truncate(titleOf(ds.meta, k), 18));

  if (refocus) { const f = svgEl.querySelector('g.cell[tabindex="0"]'); if (f) f.focus({ preventScroll: true }); }

  // légende : rampe continue −1 … 0 … +1
  const stops = d3.range(-1, 1.01, 0.25).map(v => color(v));
  legendEl.innerHTML =
    `<span>ρ</span><span>−1</span><span class="ramp" style="background:linear-gradient(90deg,${stops.join(",")})"></span><span>+1</span>` +
    `<span>rouge : quand l'un augmente, l'autre tend à diminuer · bleu : ils tendent à augmenter ensemble · gris : pas d'association monotone</span>` +
    `<span class="item"><svg width="14" height="14" aria-hidden="true"><rect x="1" y="1" width="12" height="12" rx="3" fill="none" stroke="${css("--s3")}" stroke-width="2"/></svg>&nbsp;paire d'axes adjacents dans les coordonnées parallèles</span>`;
}

function tipHtml(ds, d) {
  const dir = !isFinite(d.rho) ? "" : d.rho > 0 ? "positive" : d.rho < 0 ? "négative" : "";
  const ord = [d.a, d.b].some(k => ds.meta[k].t === "ord")
    ? `<div class="hint">Ordinal : seuls les rangs comptent, pas l'écart entre les codes.</div>` : "";
  const fused = ds.standard && AXIS_ALIAS[d.a] && AXIS_ALIAS[d.a] === AXIS_ALIAS[d.b]
    ? `<div class="hint">Paire redondante : fusionnée en « ${esc(titleOf(ds.meta, AXIS_ALIAS[d.a]))} » dans les autres vues.</div>` : "";
  return `<b>${esc(titleOf(ds.meta, d.a))} × ${esc(titleOf(ds.meta, d.b))}</b>` +
    tipRow("ρ de Spearman", isFinite(d.rho) ? fmt2(d.rho) : "non calculable (variance nulle)") +
    tipRow("Lecture", `${strength(d.rho)} ${dir}`) +
    tipRow("Effectif", `n = ${cacheMx ? cacheMx.n : "—"}`) + ord + fused +
    `<div class="hint">Association, pas causalité. Clic : placer ces deux axes côte à côte.</div>`;
}

function onKey(ev) {
  const K = cur.derived && cur.derived.ds ? numericKeys(cur.derived.ds).length : 0;
  if (!K) return;
  let [i, j] = focusIdx;
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (moves[ev.key]) {
    ev.preventDefault();
    i = Math.max(1, Math.min(K - 1, i + moves[ev.key][0]));
    j = Math.max(0, Math.min(i - 1, j + moves[ev.key][1]));
    focusIdx = [i, j];
    const node = [...svgEl.querySelectorAll("g.cell")].find(n => {
      const d = d3.select(n).datum(); return d.i === i && d.j === j;
    });
    svgEl.querySelectorAll("g.cell").forEach(n => n.setAttribute("tabindex", -1));
    if (node) { node.setAttribute("tabindex", 0); node.focus(); }
  } else if (ev.key === "Enter" || ev.key === " ") {
    const d = d3.select(ev.target.closest("g.cell")).datum();
    if (d) { ev.preventDefault(); pickPair(d.b, d.a); }
  }
}
