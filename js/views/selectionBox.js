/* =====================================================================
   views/selectionBox.js — panneau de détail lié : distribution de G3 de la sélection
   ---------------------------------------------------------------------
   Pas une technique à part entière : un panneau qui se met à jour dès qu'une vue
   pose une sélection (catégorie zoomée, secteur, critères, curseurs, flux…).
   Marques   : deux boîtes à moustaches horizontales (sélection / tout le périmètre),
               médiane écrite, points pour les valeurs atypiques.
   Canaux    : position horizontale = note 0–20, seuil à 10 en pointillés.
   ===================================================================== */
/* global d3 */

import { PASS, SMALL_N } from "../meta.js";
import { boxStats } from "../stats.js";
import { css, widthOf, fmt1, pct, esc } from "../utils.js";

let root;
export function init(container) { root = container; }

export function update(state, derived) {
  const ds = derived.ds;
  if (!ds || !ds.keys.includes("G3")) { root.innerHTML = ""; return; }
  const g = rows => rows.filter(d => !d.__nograde).map(d => d.G3);
  const sel = g(derived.selection), all = g(derived.scoped);
  const S = boxStats(sel), A = boxStats(all);
  const rate = v => v.length ? v.filter(x => x >= PASS).length / v.length : NaN;
  if (!derived.filtered) {
    root.innerHTML = `<p class="note" style="margin:0 0 6px">Aucune sélection : ${all.length} élèves évalués, médiane ${A ? fmt1(A.med).replace(/,0$/, "") : "—"}, ` +
      `${pct(rate(all))} ont au moins 10. Zoomez une catégorie, un secteur ou cochez des critères pour comparer.</p>` + chart([["Tous", A, all]]);
    return;
  }
  root.innerHTML = `<p class="note" style="margin:0 0 6px"><b>Sélection : n = ${sel.length}</b>${sel.length < SMALL_N ? " ⚠" : ""} · médiane <b>${S ? fmt1(S.med).replace(/,0$/, "") : "—"}</b> · ` +
    `${pct(rate(sel))} ≥ 10, contre médiane ${A ? fmt1(A.med).replace(/,0$/, "") : "—"} et ${pct(rate(all))} pour les ${all.length} élèves du périmètre.</p>` +
    chart([["Sélection", S, sel], ["Tous", A, all]]);
}

function chart(list) {
  const w = Math.min(360, widthOf(root, 320)), rowH = 30, h = list.length * rowH + 22, m = { l: 62, r: 10 };
  const x = d3.scaleLinear().domain([0, 20]).range([m.l, w - m.r]);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;display:block" role="img" aria-label="Boîtes à moustaches de la note finale">`;
  s += `<line x1="${x(PASS)}" x2="${x(PASS)}" y1="2" y2="${h - 18}" class="passline"/>`;
  list.forEach(([lab, st, vals], i) => {
    const y = 6 + i * rowH + rowH / 2 - 4;
    s += `<text x="0" y="${y + 4}" style="font-size:11px;fill:${css("--text-1")};font-weight:${i ? 400 : 600}">${esc(lab)}</text>`;
    if (!st) return;
    const col = i ? css("--muted") : css("--s1");
    s += `<line x1="${x(st.lo)}" x2="${x(st.hi)}" y1="${y}" y2="${y}" stroke="${css("--text-2")}"/>` +
      `<rect x="${x(st.q1)}" y="${y - 8}" width="${Math.max(1.5, x(st.q3) - x(st.q1))}" height="16" rx="3" fill="${col}" fill-opacity="${i ? 0.25 : 0.35}" stroke="${col}"/>` +
      `<line x1="${x(st.med)}" x2="${x(st.med)}" y1="${y - 9}" y2="${y + 9}" stroke="${css("--text-1")}" stroke-width="2.4"/>` +
      vals.filter(v => v < st.lo || v > st.hi).filter((v, j, a) => a.indexOf(v) === j).map(v => `<circle cx="${x(v)}" cy="${y}" r="2.2" fill="${css("--text-2")}"/>`).join("");
  });
  s += [0, 5, 10, 15, 20].map(t => `<text x="${x(t)}" y="${h - 4}" text-anchor="middle" style="font-size:10px;fill:${css("--muted")}">${t}</text>`).join("");
  return s + `</svg>`;
}
