/* =====================================================================
   views/factorRanking.js — Technique de Jim
   Classement des facteurs : taux de réussite par modalité (dot plot / dumbbell)
   ---------------------------------------------------------------------
   Question de la page : « Qu'est-ce qui est associé à l'échec ? »
   Tâches : U1-1 (les 3 facteurs les plus associés à une note basse, avec le sens),
            U2-3 (sorties, alcool et notes, sans jargon).
   Transformation : pour chaque facteur (meta.FACTOR_KEYS) et chaque modalité,
            taux de réussite (G3 ≥ 10) des élèves évalués ; ÉCART = meilleur − moins bon
            taux parmi les modalités d'au moins 10 élèves ; SENS = signe du ρ de Spearman
            entre le facteur et G3 (ordinaux : seul l'ordre compte).
            Les facteurs sont triés par écart décroissant.
   Marques   : une ligne par facteur ; un point par modalité sur une échelle 0–100 % ;
               un trait gris entre le moins bon et le meilleur taux.
   Canaux    : position horizontale = taux de réussite ; teinte = moins bon (orange ▼)
               / meilleur (bleu ▲) / autres modalités (gris) ; point creux = moins de 10 élèves ;
               l'écart est écrit en points de pourcentage, le sens en une phrase.
   Données   : périmètre de la barre de filtres (matière, école, sexe), SANS les critères
               de la grille ni le flux : filtrer sur un facteur viderait sa propre comparaison.
   Interactions : survol d'un point (taux, n, moyenne), clic ou Entrée sur un facteur :
               les histogrammes se regroupent selon ce facteur (vues liées).
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { PASS, SMALL_N } from "../meta.js";
import { factorKeys } from "../data.js";
import { spearman } from "../stats.js";
import { css, labelOf, shortOf, titleOf, showTip, hideTip, tipRow, widthOf, esc, fmt1, pct } from "../utils.js";

/** Phrase « plus de X » pour énoncer le sens du lien sans jargon. */
const MORE = {
  failures: "plus d'échecs passés", absCat: "plus d'absences", studytime: "plus de temps d'étude",
  traveltime: "un trajet plus long", goout: "plus de sorties", alc: "plus d'alcool déclaré",
  pedu: "des parents plus diplômés"
};
const ROW_H = 46;
let root, headEl, listEl, noteEl;
let cur = { state: null, derived: null };

export function init(container) {
  root = container;
  root.innerHTML = `
    <p class="headline" id="rank-head" aria-live="polite"></p>
    <div class="legend" id="rank-legend"></div>
    <div class="rank" id="rank-list" role="list"></div>
    <p class="note" id="rank-note" style="margin:6px 0 0"></p>`;
  headEl = root.querySelector("#rank-head");
  listEl = root.querySelector("#rank-list");
  noteEl = root.querySelector("#rank-note");
  const pick = row => { if (row) setState({ groupBy: row.dataset.k, groupFilter: null }, "rank"); };
  listEl.addEventListener("click", e => pick(e.target.closest(".rrow")));
  listEl.addEventListener("keydown", e => {
    const row = e.target.closest(".rrow"); if (!row) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(row); }
    else if (e.key === "ArrowDown" && row.nextElementSibling) { e.preventDefault(); row.nextElementSibling.focus(); }
    else if (e.key === "ArrowUp" && row.previousElementSibling) { e.preventDefault(); row.previousElementSibling.focus(); }
  });
}

/** Statistiques d'un facteur sur les élèves évalués. */
function factorStats(ds, key, rows) {
  const M = ds.meta[key];
  const usable = rows.filter(d => isFinite(d.G3) && d[key] !== "" && !(typeof d[key] === "number" && (isNaN(d[key]) || (key === "absCat" && d[key] === 9))));
  const present = new Set(usable.map(d => d[key]));
  const dom = (M.d ? M.d.filter(v => present.has(v)) : Array.from(present).sort(d3.ascending));
  const levels = dom.map(v => {
    const a = usable.filter(d => d[key] === v);
    return { v, n: a.length, rate: a.length ? a.filter(d => d.G3 >= PASS).length / a.length : NaN, mean: d3.mean(a, d => d.G3) };
  });
  const big = levels.filter(l => l.n >= SMALL_N);
  const lo = big.length >= 2 ? big.reduce((a, b) => b.rate < a.rate ? b : a) : null;
  const hi = big.length >= 2 ? big.reduce((a, b) => b.rate > a.rate ? b : a) : null;
  const rho = M.t !== "nom" && usable.length > 2 ? spearman(usable.map(d => +d[key]), usable.map(d => d.G3)) : NaN;
  return { key, levels, lo, hi, gap: lo ? hi.rate - lo.rate : NaN, rho, n: usable.length };
}

/** Sens du lien, en une phrase sans jargon. */
function direction(ds, f) {
  if (!isFinite(f.rho)) return "";
  const a = Math.abs(f.rho);
  if (a < 0.1) return "pas de lien net avec la réussite";
  const more = MORE[f.key] || `une valeur plus haute de « ${titleOf(ds.meta, f.key)} »`;
  const force = a < 0.25 ? "un peu" : a < 0.4 ? "nettement" : "fortement";
  return `${more} : réussite ${force} ${f.rho < 0 ? "plus basse ▼" : "plus haute ▲"}`;
}

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) return;
  if (!ds.keys.includes("G3")) { headEl.textContent = ""; listEl.innerHTML = `<p class="empty">Ce fichier n'a pas de colonne G3.</p>`; return; }
  const rows = derived.scoped.filter(d => !d.__nograde);
  const base = rows.length ? rows.filter(d => d.G3 >= PASS).length / rows.length : NaN;
  const stats = factorKeys(ds).map(k => factorStats(ds, k, rows)).filter(f => f.levels.length >= 2)
    .sort((a, b) => (isFinite(b.gap) ? b.gap : -1) - (isFinite(a.gap) ? a.gap : -1));
  if (!stats.length) { headEl.textContent = ""; listEl.innerHTML = `<p class="empty">Aucun facteur comparable dans ce fichier.</p>`; return; }

  const top = stats.filter(f => isFinite(f.gap)).slice(0, 3);
  headEl.innerHTML = rows.length < SMALL_N ? `⚠ Moins de 10 élèves évalués : pas de classement possible.` :
    `${ds.builtin ? "En " + esc(ds.name.toLowerCase()) : "Dans « " + esc(ds.name) + " »"}, les facteurs les plus associés à une note basse sont ` +
    top.map((f, i) => `<b>${i + 1}. ${esc(titleOf(ds.meta, f.key).toLowerCase())}</b> (${Math.round(f.gap * 100)} points d'écart)`).join(", ") +
    `. Association, pas cause.`;
  root.querySelector("#rank-legend").innerHTML =
    `<span class="item"><span class="dot" style="background:${css("--s2")}"></span>▼ groupe qui réussit le moins</span>` +
    `<span class="item"><span class="dot" style="background:${css("--s1")}"></span>▲ groupe qui réussit le plus</span>` +
    `<span class="item"><span class="dot hollow"></span>moins de ${SMALL_N} élèves</span>` +
    `<span class="item"><span class="vline"></span>moyenne : ${pct(base)}</span>`;

  const w = widthOf(listEl, 640), labW = Math.min(230, Math.max(150, w * 0.34)), gapW = 70;
  const tw = Math.max(160, w - labW - gapW - 16);
  const minRate = d3.min(stats, f => d3.min(f.levels, l => l.rate));
  const x = d3.scaleLinear().domain([Math.max(0, Math.floor((minRate - 0.12) * 10) / 10), 1]).range([8, tw - 8]);
  const ticks = d3.range(Math.ceil(x.domain()[0] * 10) / 10, 1.0001, x.domain()[0] < 0.4 ? 0.2 : 0.1);

  const focused = listEl.contains(document.activeElement) ? document.activeElement.dataset.k : null;
  listEl.innerHTML = `<div class="raxis" style="margin-left:${labW}px;width:${tw}px">` +
    ticks.map(t => `<span style="left:${x(t)}px">${Math.round(t * 100)} %</span>`).join("") + `</div>` +
    stats.map((f, i) => {
      const pickd = state.groupBy === f.key;
      return `<div class="rrow${pickd ? " on" : ""}" role="listitem button" tabindex="0" data-k="${f.key}"
        aria-label="${i + 1}. ${esc(titleOf(ds.meta, f.key))} : ${isFinite(f.gap) ? Math.round(f.gap * 100) + " points d'écart" : "écart non calculable"}, ${esc(direction(ds, f))}. Entrée pour voir les histogrammes.">
        <div class="rlab" style="width:${labW}px"><b>${i + 1}. ${esc(titleOf(ds.meta, f.key))}</b><span>${esc(direction(ds, f))}</span></div>
        <svg width="${tw}" height="${ROW_H}" aria-hidden="true"></svg>
        <div class="rgap" style="width:${gapW}px">${isFinite(f.gap) ? Math.round(f.gap * 100) + " pts" : "—"}</div>
      </div>`;
    }).join("");
  listEl.querySelectorAll(".rrow").forEach((row, i) => drawRow(row.querySelector("svg"), stats[i], x, base, tw, ds));
  if (focused) { const r = listEl.querySelector(`.rrow[data-k="${focused}"]`); if (r) r.focus({ preventScroll: true }); }
  noteEl.innerHTML = `Calculé sur ${rows.length} élèves évalués (filtres de la barre, sans les critères de la grille). ` +
    `Cliquez un facteur pour voir la répartition détaillée des notes dans « Comment se répartissent les notes ? ».` +
    (state.groupBy && stats.some(f => f.key === state.groupBy) ? ` <a href="#q1">↑ Voir les histogrammes par « ${esc(titleOf(ds.meta, state.groupBy).toLowerCase())} »</a>` : "");
}

function drawRow(svgEl, f, x, base, tw, ds) {
  const y = ROW_H / 2;
  const svg = d3.select(svgEl);
  svg.append("line").attr("class", "gridline").attr("x1", x.range()[0]).attr("x2", x.range()[1]).attr("y1", y).attr("y2", y);
  svg.append("line").attr("x1", x(base)).attr("x2", x(base)).attr("y1", 6).attr("y2", ROW_H - 6)
    .attr("stroke", css("--muted")).attr("stroke-width", 1);
  if (f.lo && f.hi) svg.append("line").attr("x1", x(f.lo.rate)).attr("x2", x(f.hi.rate)).attr("y1", y).attr("y2", y)
    .attr("stroke", css("--axis")).attr("stroke-width", 4).attr("stroke-linecap", "round");
  const role = l => l === f.lo ? "lo" : l === f.hi ? "hi" : "mid";
  const fill = l => l.n < SMALL_N ? css("--surface-1") : role(l) === "lo" ? css("--s2") : role(l) === "hi" ? css("--s1") : css("--muted");
  const stroke = l => l.n < SMALL_N ? css("--text-2") : css("--surface-1");
  svg.selectAll("circle").data(f.levels.filter(l => isFinite(l.rate))).join("circle")
    .attr("cx", l => x(l.rate)).attr("cy", y).attr("r", l => role(l) === "mid" ? 5 : 7)
    .attr("fill", fill).attr("stroke", stroke).attr("stroke-width", 2)
    .on("mousemove", (ev, l) => showTip(ev, `<b>${esc(titleOf(ds.meta, f.key))} : ${esc(labelOf(ds.meta, f.key, l.v))}</b>` +
      tipRow("Réussite (G3 ≥ 10)", pct(l.rate)) + tipRow("Note moyenne", fmt1(l.mean) + "/20") +
      tipRow("Élèves", `n = ${l.n}${l.n < SMALL_N ? " ⚠" : ""}`) +
      (l.n < SMALL_N ? `<div class="hint">Moins de ${SMALL_N} élèves : non retenu pour l'écart.</div>` : "") +
      `<div class="hint">Association, pas cause.</div>`))
    .on("mouseleave", hideTip);
  // étiquettes des deux extrêmes seulement (pas un nombre sur chaque point)
  // à gauche du moins bon, à droite du meilleur ; retournées vers l'intérieur si elles sortiraient du cadre
  [f.lo, f.hi].filter(Boolean).forEach(l => {
    const isLo = l === f.lo, xl = x(l.rate);
    const t = svg.append("text").attr("class", "halo").attr("y", y + 4).style("font-size", "11px").style("fill", css("--text-1"))
      .text(`${shortOf(ds.meta, f.key, l.v)} · ${Math.round(l.rate * 100)} %`);
    const len = t.node().getComputedTextLength ? t.node().getComputedTextLength() : 60;
    let left = isLo;
    if (left && xl - 10 - len < 0) left = false;
    if (!left && xl + 10 + len > tw) left = true;
    t.attr("x", xl + (left ? -10 : 10)).attr("text-anchor", left ? "end" : "start")
      .attr("y", (isLo && !left) || (!isLo && left) ? y - 10 : y + 4);
  });
}
