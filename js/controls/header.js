// En-tête : choix de la matière, case « non évalués », « Tout réinitialiser ».

import { DATASETS } from "../meta.js";
import { state, setState, resetAll } from "../state.js";

export function init() {
  document.querySelectorAll("#matSeg button").forEach((b) => {
    b.addEventListener("click", () => setState({ ds: b.dataset.v }));
  });
  document.getElementById("ne").addEventListener("change", (e) => setState({ inclNE: e.target.checked }));
  document.getElementById("reset").addEventListener("click", resetAll);
}

export function update(st, derived, rowsByDs) {
  document.querySelectorAll("#matSeg button").forEach((b) => {
    b.textContent = DATASETS[b.dataset.v].label;
    b.setAttribute("aria-pressed", String(b.dataset.v === st.ds));
  });
  const nb = (rowsByDs[st.ds] || []).filter((r) => r.__nograde).length;
  document.getElementById("neLbl").textContent = `Inclure les ${nb} élèves non évalués`;
  document.getElementById("ne").checked = st.inclNE;
}
