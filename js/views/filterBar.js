/* =====================================================================
   views/filterBar.js — barre de filtres unique (partagée par toutes les vues)
   ---------------------------------------------------------------------
   Changer de jeu de données passe par le bus ("dataset", "import") car
   c'est main.js qui orchestre le chargement asynchrone.
   Les filtres posés par les vues (critères de risque, groupe, tendance, flux) sont
   rappelés ici sous forme de puces supprimables : l'utilisateur voit
   toujours l'état complet de la sélection.
   « Copier le lien » copie l'URL qui encode tout l'état (tâche U4.5).
   ===================================================================== */

import { state, setState, emit, resetFilters } from "../state.js";
import { DATASETS } from "../data.js";
import { RISK_FACTORS, BANDS } from "../meta.js";
import { writeHash } from "../permalink.js";
import { titleOf, shortOf, labelOf, esc } from "../utils.js";

const TREND_LABEL = { down: "▼ en baisse d'au moins 2 points (G3 − G1 ≤ −2)" };
const STEP = ["P1", "P2", "finale"];
const BAND = Object.fromEntries(BANDS.map(b => [b.k, b]));

let root, els = {};

export function init(container) {
  root = container;
  root.innerHTML = `
    <div class="fgroup"><span class="flabel" id="lb-ds">Jeu de données</span>
      <div class="seg" id="f-ds" role="group" aria-labelledby="lb-ds">
        ${Object.entries(DATASETS).map(([k, d]) => `<button type="button" data-v="${k}">${d.label}</button>`).join("")}
        <button type="button" data-v="custom" id="f-ds-custom" hidden></button>
      </div>
    </div>
    <div class="fgroup"><label class="flabel" for="f-file">Importer un CSV (« , » ou « ; »)</label>
      <input type="file" id="f-file" accept=".csv,.txt,text/csv">
    </div>
    <div class="fgroup"><span class="flabel" id="lb-school">Établissement</span>
      <div class="seg" id="f-school" role="group" aria-labelledby="lb-school">
        <button type="button" data-v="">Tous</button><button type="button" data-v="GP">GP</button><button type="button" data-v="MS">MS</button>
      </div>
    </div>
    <div class="fgroup"><span class="flabel" id="lb-sex">Sexe</span>
      <div class="seg" id="f-sex" role="group" aria-labelledby="lb-sex">
        <button type="button" data-v="">Tous</button><button type="button" data-v="F">F</button><button type="button" data-v="M">M</button>
      </div>
    </div>
    <label class="check" title="G3 = 0 avec 0 absence : dossier non renseigné (abandon, absent à l'épreuve), pas une vraie note de 0.">
      <input type="checkbox" id="f-zero"> Exclure les non évalués <span id="f-zero-n" class="nbadge"></span>
    </label>
    <div class="active-filters" id="f-active" aria-live="polite"></div>
    <div class="factions">
      <button class="btn" type="button" id="f-link" title="L'adresse de la page contient matière, filtres, critères, groupes, profil simulé et élève : la copier permet de retrouver exactement cette vue.">🔗 Copier le lien de cette vue</button>
      <button class="btn" type="button" id="f-reset">Tout réinitialiser</button>
    </div>`;

  els = {
    ds: root.querySelector("#f-ds"), custom: root.querySelector("#f-ds-custom"),
    file: root.querySelector("#f-file"), school: root.querySelector("#f-school"), sex: root.querySelector("#f-sex"),
    zero: root.querySelector("#f-zero"), zeroN: root.querySelector("#f-zero-n"),
    active: root.querySelector("#f-active"), reset: root.querySelector("#f-reset"), link: root.querySelector("#f-link")
  };

  els.ds.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    emit("dataset", b.dataset.v);
  });
  els.file.addEventListener("change", e => {
    const f = e.target.files[0]; if (f) emit("import", f);
    e.target.value = "";                                   // permet de réimporter le même fichier
  });
  els.school.addEventListener("click", e => {
    const b = e.target.closest("button"); if (b && !b.disabled) setState({ school: b.dataset.v }, "filters");
  });
  els.sex.addEventListener("click", e => {
    const b = e.target.closest("button"); if (b && !b.disabled) setState({ sex: b.dataset.v }, "filters");
  });
  els.zero.addEventListener("change", e => setState({ excludeNoGrade: e.target.checked }, "filters"));
  els.reset.addEventListener("click", () => resetFilters());
  els.link.addEventListener("click", () => {
    writeHash(state);                                      // sans attendre l'écriture différée
    const done = msg => {
      els.link.textContent = msg;
      setTimeout(() => { els.link.textContent = "🔗 Copier le lien de cette vue"; }, 2200);
    };
    if (state.ds === "custom") { done("Un CSV importé ne peut pas être mis en lien"); return; }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(location.href).then(() => done("✓ Lien copié"), () => done("Lien dans la barre d'adresse"));
    } else done("Lien dans la barre d'adresse");
  });
  els.active.addEventListener("click", e => {
    const b = e.target.closest("button[data-clear]"); if (!b) return;
    const what = b.dataset.clear;
    if (what === "group") setState({ groupFilter: null }, "filters");
    else if (what === "trend") setState({ trend: "all" }, "filters");
    else if (what === "flow") setState({ flow: null }, "filters");
    else if (what === "criteria") setState({ criteria: [], riskMin: 0 }, "filters");
    else if (what === "drill") setState({ drill: [] }, "filters");
    else if (what === "slide") setState({ slide: {} }, "filters");
  });
}

function press(seg, value) {
  [...seg.querySelectorAll("button")].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === value)));
}

export function update(state, derived) {
  const ds = derived.ds;
  press(els.ds, state.ds);
  els.custom.hidden = !state.custom;
  if (state.custom) els.custom.textContent = "Importé : " + state.custom.name;

  const has = k => ds && ds.keys.includes(k);
  [["school", els.school], ["sex", els.sex]].forEach(([k, seg]) => {
    press(seg, state[k]);
    seg.querySelectorAll("button").forEach(b => { b.disabled = !has(k); });
  });
  els.zero.checked = state.excludeNoGrade;
  els.zero.disabled = !(has("G3") && has("absences"));
  const nz = derived.base.filter(d => d.__nograde).length;
  els.zeroN.textContent = has("G3") ? `(${nz} dans le fichier)` : "";

  // Rappel des filtres posés depuis les vues
  const chips = [];
  if (state.groupFilter && ds && has(state.groupFilter.key)) {
    const { key, value } = state.groupFilter;
    const B = ds.meta[key].bins, shown = B ? B.s[B.d.indexOf(value)] : shortOf(ds.meta, key, value);
    chips.push(`<span class="fchip">Groupe : ${esc(titleOf(ds.meta, key))} = ${esc(shown)}
      <button type="button" data-clear="group" aria-label="Retirer le filtre de groupe ${esc(labelOf(ds.meta, key, value))}">✕</button></span>`);
  }
  if (derived.drill && derived.drill.length) {
    const lab = c => { const M = ds.meta[c.key]; return M.bins ? M.bins.s[M.bins.d.indexOf(c.value)] : shortOf(ds.meta, c.key, c.value); };
    chips.push(`<span class="fchip">Sélection : ${esc(derived.drill.map(c => titleOf(ds.meta, c.key) + " = " + lab(c)).join(" › "))}
      <button type="button" data-clear="drill" aria-label="Retirer la sélection partagée">✕</button></span>`);
  }
  const sl = Object.entries(state.slide || {}).filter(([, v]) => v != null);
  if (sl.length) {
    chips.push(`<span class="fchip">Curseurs : ${esc(sl.map(([k, v]) => titleOf(ds.meta, k) + " = " + shortOf(ds.meta, k, v)).join(", "))}
      <button type="button" data-clear="slide" aria-label="Retirer les curseurs">✕</button></span>`);
  }
  if (state.criteria.length || state.riskMin) {
    const parts = state.criteria.map(id => (RISK_FACTORS.find(f => f.id === id) || {}).label).filter(Boolean);
    if (state.riskMin) parts.unshift(`au moins ${state.riskMin} facteur${state.riskMin > 1 ? "s" : ""} de risque`);
    chips.push(`<span class="fchip">Critères : ${esc(parts.join(" + "))}
      <button type="button" data-clear="criteria" aria-label="Retirer les critères de risque">✕</button></span>`);
  }
  if (state.trend !== "all") {
    chips.push(`<span class="fchip">Tendance : ${TREND_LABEL[state.trend]}
      <button type="button" data-clear="trend" aria-label="Retirer le filtre de tendance">✕</button></span>`);
  }
  if (state.flow && BAND[state.flow.a] && BAND[state.flow.b]) {
    const f = state.flow;
    chips.push(`<span class="fchip">Passage ${STEP[f.s]} → ${STEP[f.s + 1]} : ${BAND[f.a].icon} ${BAND[f.a].label} → ${BAND[f.b].icon} ${BAND[f.b].label}
      <button type="button" data-clear="flow" aria-label="Retirer le filtre de passage">✕</button></span>`);
  }
  els.active.innerHTML = chips.join("");
}
