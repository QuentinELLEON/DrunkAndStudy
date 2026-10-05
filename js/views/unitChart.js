/* =====================================================================
   views/unitChart.js — Technique de Quentin
   Grille d'élèves (unit chart) : 1 carré = 1 élève, critères de risque à cocher
   ---------------------------------------------------------------------
   Question de la page : « Quels élèves cumulent les risques ? »
   Tâche : U1-3 (isoler les élèves qui cumulent plusieurs facteurs de risque,
           avec l'effectif exact) ; point d'entrée vers la fiche (U1-4).
   Transformation : niveau de risque = nombre de facteurs cumulés parmi
           meta.RISK_FACTORS (attribut dérivé « risque ») ; regroupement des élèves
           par niveau de risque, établissement ou sexe ; dans chaque groupe,
           élèves en échec d'abord pour que la proportion se lise comme un bloc.
   Marques   : un carré par élève du périmètre (filtres de la barre).
   Canaux    : teinte = résultat (orange ▼ échec / bleu ▲ réussite / gris ✕ non évalué) ;
               opacité = appartenance à la sélection (les autres restent visibles, estompés) ;
               contour = élève ouvert dans la fiche.
   Interactions : facteurs à cocher (ET), niveau de risque minimal (≥ 1, ≥ 2, ≥ 3),
               regroupement, survol (élève et ses facteurs), clic (fiche élève).
               Les critères filtrent TOUTES les vues sauf le classement des facteurs.
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { RISK_FACTORS, SMALL_N } from "../meta.js";
import { css, resultOf, resultSpec, resultBadge, labelOf, titleOf, showTip, hideTip, tipRow, widthOf, esc, pct } from "../utils.js";

const SZ = 11, GAP = 2, HEAD = 22;
const GROUPINGS = [["risque", "niveau de risque"], ["none", "aucun"], ["school", "établissement"], ["sex", "sexe"]];
let root, headEl, critEl, svgEl, legendEl;
let cur = { state: null, derived: null };

export function init(container) {
  root = container;
  root.innerHTML = `
    <p class="headline" id="unit-head" aria-live="polite"></p>
    <div class="unitctl" id="unit-ctl"></div>
    <div class="legend" id="unit-legend"></div>
    <svg id="unit-svg" role="img" aria-label="Grille des élèves, un carré par élève"></svg>`;
  headEl = root.querySelector("#unit-head");
  critEl = root.querySelector("#unit-ctl");
  svgEl = root.querySelector("#unit-svg");
  legendEl = root.querySelector("#unit-legend");

  critEl.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const s = cur.state;
    if (b.dataset.crit) {
      const id = b.dataset.crit, c = s.criteria.includes(id) ? s.criteria.filter(x => x !== id) : s.criteria.concat(id);
      setState({ criteria: c }, "unit");
    } else if (b.dataset.risk != null) setState({ riskMin: +b.dataset.risk }, "unit");
    else if (b.dataset.group) setState({ unitGroup: b.dataset.group }, "unit");
  });
  svgEl.addEventListener("mousemove", onHover);
  svgEl.addEventListener("mouseleave", hideTip);
  svgEl.addEventListener("click", e => {
    const r = e.target.closest("rect.u"); if (!r) return;
    const id = +r.dataset.i;
    setState({ selectedId: cur.state.selectedId === id ? null : id }, "unit");
  });
}

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) return;
  const std = ds.standard;
  const focus = critEl.contains(document.activeElement) ? document.activeElement.outerHTML.match(/data-(crit|risk|group)="([^"]*)"/) : null;
  critEl.innerHTML = std ? `
    <div class="fgroup"><span class="flabel">Facteurs à cumuler (tous cochés)</span><div class="chips">` +
      RISK_FACTORS.map(f => `<button type="button" class="chip" data-crit="${f.id}" aria-pressed="${state.criteria.includes(f.id)}">${esc(f.label)}</button>`).join("") +
    `</div></div>
    <div class="fgroup"><span class="flabel">Nombre de facteurs</span><div class="seg" role="group">` +
      [[0, "peu importe"], [1, "≥ 1"], [2, "≥ 2"], [3, "≥ 3"]].map(([v, l]) => `<button type="button" data-risk="${v}" aria-pressed="${state.riskMin === v}">${l}</button>`).join("") +
    `</div></div>
    <div class="fgroup"><span class="flabel">Regrouper par</span><div class="seg" role="group">` +
      GROUPINGS.map(([v, l]) => `<button type="button" data-group="${v}" aria-pressed="${state.unitGroup === v}">${l}</button>`).join("") +
    `</div></div>` : `<p class="note">Les facteurs de risque nécessitent les colonnes du jeu d'origine : la grille montre seulement les résultats.</p>`;
  if (focus) { const b = critEl.querySelector(`[data-${focus[1]}="${focus[2]}"]`); if (b) b.focus({ preventScroll: true }); }

  const R = resultSpec();
  legendEl.innerHTML = ["fail", "pass"].concat(state.excludeNoGrade ? [] : ["none"]).map(k =>
    `<span class="item"><span class="sw sq" style="background:${R[k].color}"></span>${R[k].icon} ${R[k].label}</span>`).join("") +
    `<span class="item"><span class="sw sq faded" style="background:${R.pass.color}"></span>hors sélection</span>` +
    `<span class="item muted">1 carré = 1 élève</span>`;

  // en-tête : effectif exact de la sélection et part en échec, comparée au périmètre
  const sel = derived.selection, scope = derived.scoped;
  const failRate = rows => { const g = rows.filter(d => !d.__nograde); return g.length ? g.filter(d => d.G3 < 10).length / g.length : NaN; };
  const sg = sel.filter(d => !d.__nograde), nf = sg.filter(d => d.G3 < 10).length;
  const what = std && derived.nCrit ? describeCriteria(state) || "correspondent à la sélection" : derived.filtered ? "correspondent aux filtres" : "";
  headEl.innerHTML = !what
    ? `${scope.length} élèves dans le périmètre, dont <b>${pct(failRate(scope))}</b> en échec.` +
      (std ? ` Cochez des facteurs ou choisissez « ≥ 2 » pour isoler les élèves qui les cumulent.` : "")
    : `<b>${sel.length} élèves</b> ${what} ; <b>${nf}</b> sont en échec (<b>${sg.length ? pct(nf / sg.length) : "—"}</b>), ` +
      `contre ${pct(failRate(scope))} sur les ${scope.length} élèves du périmètre.` +
      (sel.length < SMALL_N ? ` ⚠ Moins de 10 élèves : à lire comme des cas, pas une tendance.` : "");

  draw(state, derived, ds);
}

function describeCriteria(state) {
  const parts = state.criteria.map(id => RISK_FACTORS.find(f => f.id === id)).filter(Boolean).map(f => f.label.toLowerCase());
  const risk = state.riskMin ? `cumulent au moins ${state.riskMin} facteur${state.riskMin > 1 ? "s" : ""}` : "";
  return [risk, parts.length ? `ont : ${parts.join(" + ")}` : ""].filter(Boolean).join(" et ");
}

function draw(state, derived, ds) {
  const R = resultSpec();
  const rows = derived.scoped;
  const g = state.unitGroup === "none" || !ds.keys.includes(state.unitGroup) ? null : state.unitGroup;
  const M = g ? ds.meta[g] : null;
  let groups;
  if (!g) groups = [{ v: "", label: "Tous les élèves", rows }];
  else {
    const present = new Set(rows.map(d => d[g]).filter(v => !(typeof v === "number" && isNaN(v))));
    const dom = M.d ? M.d.filter(v => present.has(v)) : Array.from(present).sort(d3.ascending);
    groups = dom.map(v => ({ v, label: `${titleOf(ds.meta, g)} : ${labelOf(ds.meta, g, v)}`, rows: rows.filter(d => d[g] === v) }));
    const nr = rows.filter(d => typeof d[g] === "number" && isNaN(d[g]));
    if (nr.length) groups.push({ v: "nr", label: "Non évalués (niveau de risque non calculé)", rows: nr });
  }
  const order = { fail: 0, none: 1, pass: 2 };
  groups.forEach(gr => gr.rows = gr.rows.slice().sort((a, b) =>
    (derived.selectionIds.has(b.__i) - derived.selectionIds.has(a.__i)) || (order[resultOf(a)] - order[resultOf(b)]) || a.__i - b.__i));

  const W = widthOf(root, 700), cols = Math.max(10, Math.floor((W + GAP) / (SZ + GAP)));
  let y = 0;
  groups.forEach(gr => { gr.y = y; gr.rowsN = Math.ceil(gr.rows.length / cols) || 1; y += HEAD + gr.rowsN * (SZ + GAP) + 10; });
  const H = Math.max(40, y);
  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
  const sid = state.selectedId;

  const gs = svg.selectAll("g.ugrp").data(groups, d => String(d.v));
  gs.exit().remove();
  const ge = gs.enter().append("g").attr("class", "ugrp");
  ge.append("text").attr("class", "ulab");
  const all = ge.merge(gs).attr("transform", d => `translate(0,${d.y})`);
  all.select("text.ulab").attr("x", 0).attr("y", 14).html(d => {
    const inSel = d.rows.filter(r => derived.selectionIds.has(r.__i));
    const gr = d.rows.filter(r => !r.__nograde), f = gr.filter(r => r.G3 < 10).length;
    return `<tspan class="ut">${esc(d.label)}</tspan><tspan class="us" dx="8">${d.rows.length} élève${d.rows.length > 1 ? "s" : ""}` +
      (gr.length ? ` · ${pct(f / gr.length)} en échec` : "") +
      (derived.filtered ? ` · ${inSel.length} dans la sélection` : "") + (d.rows.length < SMALL_N ? " ⚠" : "") + `</tspan>`;
  });
  all.each(function (d) {
    d3.select(this).selectAll("rect.u").data(d.rows, r => r.__i).join("rect").attr("class", "u")
      .attr("data-i", r => r.__i)
      .attr("x", (r, i) => (i % cols) * (SZ + GAP)).attr("y", (r, i) => HEAD + Math.floor(i / cols) * (SZ + GAP))
      .attr("width", SZ).attr("height", SZ).attr("rx", 2)
      .attr("fill", r => R[resultOf(r)].color)
      .attr("opacity", r => derived.selectionIds.has(r.__i) ? 1 : 0.22)
      .attr("stroke", r => r.__i === sid ? css("--text-1") : null).attr("stroke-width", r => r.__i === sid ? 2 : null);
  });
  // l'élève ouvert dans la fiche passe au premier plan
  svg.selectAll("rect.u").filter(r => r.__i === sid).raise();
}

function onHover(ev) {
  const r = ev.target.closest && ev.target.closest("rect.u");
  if (!r) { hideTip(); return; }
  const d = d3.select(r).datum(), ds = cur.derived.ds;
  const facs = ds.standard ? RISK_FACTORS.filter(f => f.test(d)).map(f => f.label) : [];
  showTip(ev, `<b>Élève n° ${d.__i + 1}</b> · ${resultBadge(d)}` + tipRow("Note finale", `${d.G3}/20`) +
    (ds.standard ? tipRow("Niveau de risque", isFinite(d.risque) ? `${d.risque} facteur${d.risque > 1 ? "s" : ""}` : "non calculé") : "") +
    (facs.length ? `<div class="hint">${facs.map(esc).join("<br>")}</div>` : "") + `<div class="hint">Clic : ouvrir la fiche</div>`);
}
