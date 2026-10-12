// Fiche élève : tableau « élève | typique de l'école » pour l'élève de state.selectedId.
// La trajectoire G1, G2, G3 (#viz-student-trajectory) est dessinée par js/views/studentTrajectory.js.

import { CARD_ROWS, DATASETS, DIMS, valueName } from "../meta.js";
import { setState } from "../state.js";
import { schoolPeers, typical } from "../data.js";
import { f1 } from "../utils.js";

const QUANT = ["G1", "G2", "G3", "absences"];
const DEFAULT_INTRO = "Cliquez sur un nœud du graphe (D), un point du nuage ou une ligne pour ouvrir la fiche. Elle compare l'élève à la médiane de son école dans la même matière.";

export function init() {
  document.getElementById("panel-student-close").addEventListener("click", () => setState({ selectedId: null }));
}

const show = (attr, v) => (v === null || v === undefined ? "–" : QUANT.includes(attr) ? (attr === "absences" ? f1(v) : String(v)) : valueName(attr, v));

export function update(st, derived) {
  const stu = derived.selected;
  const title = document.getElementById("panel-student-title");
  document.getElementById("panel-student-close").hidden = !stu;
  const same = document.getElementById("panel-student-same");
  same.hidden = true; // « Même profil » : réservé à une vue qui regroupe plusieurs élèves par nœud (facultatif)

  const rows = document.querySelectorAll("#panel-student-table tbody tr");
  if (!stu) {
    title.textContent = "Fiche élève";
    const i0 = document.getElementById("panel-student-intro");
    i0.hidden = false; i0.textContent = DEFAULT_INTRO;
    rows.forEach((tr) => { tr.children[1].textContent = ""; tr.children[2].textContent = ""; });
    return;
  }
  const peers = schoolPeers(derived.all, stu);
  title.textContent = `Élève n° ${stu.__i + 1}`;
  const sex = stu.sex === "F" ? "fille" : "garçon";
  rows.forEach((tr) => {
    const attr = tr.dataset.attr;
    if (!CARD_ROWS.includes(attr)) return;
    tr.children[1].textContent = show(attr, stu[attr]);
    const quant = QUANT.includes(attr) || ["failures", "studytime", "traveltime", "goout"].includes(attr);
    const t = typical(peers, attr, quant);
    tr.children[2].textContent = t === null ? "–" : QUANT.includes(attr) ? f1(t) : valueName(attr, quant ? Math.round(t) : t);
  });
  // Phrase de contexte
  const intro = document.getElementById("panel-student-intro");
  intro.hidden = false;
  intro.textContent = `${sex[0].toUpperCase() + sex.slice(1)}, ${DIMS.school.name[stu.school]}, milieu ${DIMS.address.name[stu.address].toLowerCase()}. Comparaison avec les ${peers.length} élèves évalués de son école en ${DATASETS[st.ds].name}.`;
}
