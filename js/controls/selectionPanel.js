// Panneau « Sélection » : puces de filtres, tuiles (n, % ≥ 10, médiane, moyenne), curseurs studytime et goout.
// Le boxplot (#viz-selection-boxplot) est dessiné par js/views/selectionBox.js.

import { DATASETS, SMALL_N, dimLabel, valueName } from "../meta.js";
import { setState, dropDrill, setSlide } from "../state.js";
import { rate, evaluated } from "../data.js";
import { f1, pct } from "../utils.js";
import { median, mean } from "../stats.js";

export function init() {
  // Curseurs : un seul niveau actif par facteur, « Tous » le retire
  document.querySelectorAll("[data-slider]").forEach((box) => {
    box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => setSlide(box.dataset.slider, b.dataset.value)));
  });
}

function chip(label, onClick, aria) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "chip";
  b.setAttribute("aria-label", aria);
  b.innerHTML = `${label} <span class="x" aria-hidden="true">×</span>`;
  b.addEventListener("click", onClick);
  return b;
}

export function update(st, derived) {
  const { base, selection } = derived;
  const name = DATASETS[st.ds].name;

  // Puces : zooms (drill) et curseurs (slide)
  const chips = document.getElementById("panel-chips");
  chips.replaceChildren();
  const active = st.drill.length + Object.keys(st.slide).length;
  if (!active) {
    const s = document.createElement("span");
    s.className = "note"; s.style.margin = "0";
    s.textContent = `Tous les élèves de ${name}. Cliquez dans une vue pour filtrer.`;
    chips.appendChild(s);
  }
  st.drill.forEach((f) => chips.appendChild(chip(`${dimLabel(f.dim)}, ${valueName(f.dim, f.value)}`, () => dropDrill(f.dim),
    `Retirer le filtre ${dimLabel(f.dim)}, ${valueName(f.dim, f.value)}`)));
  Object.entries(st.slide).forEach(([dim, v]) => chips.appendChild(chip(`${dimLabel(dim)}, ${valueName(dim, v)}`, () => setSlide(dim, null),
    `Retirer le filtre ${dimLabel(dim)}`)));
  if (active > 1) {
    const all = document.createElement("button");
    all.type = "button"; all.className = "chip"; all.textContent = "Tout effacer";
    all.addEventListener("click", () => setState({ drill: [], slide: {} }));
    chips.appendChild(all);
  }

  // Tuiles (parmi les élèves évalués de la sélection)
  const ev = evaluated(selection);
  const g3 = ev.map((r) => r.G3);
  const set = (k, v) => { document.querySelector(`#panel-stats [data-stat="${k}"]`).textContent = v; };
  set("n", String(selection.length));
  set("rate", pct(rate(selection)));
  set("median", g3.length ? f1(median(g3)) : "–");
  set("mean", g3.length ? f1(mean(g3)) : "–");

  const baseG3 = evaluated(base).map((r) => r.G3);
  document.getElementById("panel-context").textContent = active
    ? `Ensemble de la matière : ${pct(rate(base))} de réussite et ${f1(mean(baseG3))} de moyenne sur 20.`
    : "";
  document.getElementById("panel-small-n").hidden = !(selection.length > 0 && selection.length < SMALL_N);

  // Curseurs : état pressé et phrase de résultat
  document.querySelectorAll("[data-slider]").forEach((box) => {
    const cur = st.slide[box.dataset.slider];
    box.querySelectorAll("button").forEach((b) => {
      const on = cur === undefined ? b.dataset.value === "" : Number(b.dataset.value) === cur;
      b.setAttribute("aria-pressed", String(on));
    });
  });
  const res = document.getElementById("panel-whatif-result");
  const sliding = Object.keys(st.slide).length > 0;
  res.textContent = sliding && g3.length
    ? `Les ${g3.length} élèves qui ont ce profil ont en moyenne ${f1(mean(g3))} sur 20, contre ${f1(mean(baseG3))} pour l'ensemble. C'est une association, pas l'effet du facteur.${g3.length < SMALL_N ? " Moins de 10 élèves : chiffre fragile." : ""}`
    : "";
}
