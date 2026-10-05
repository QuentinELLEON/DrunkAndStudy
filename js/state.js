/* =====================================================================
   state.js — état global unique + bus d'événements
   ---------------------------------------------------------------------
   Les vues ne se parlent jamais directement : elles écrivent dans l'état
   avec setState(), et main.js redessine toutes les vues à partir de ce
   même état. C'est ce qui garantit la cohérence des vues liées
   (un filtre, un brush ou une sélection se propagent partout).

   Les brushes sont stockés en UNITÉS DE DONNÉES, pas en pixels :
     { kind: "range", lo, hi }      pour un axe quantitatif
     { kind: "set",   values: [] }  pour un axe ordinal ou nominal
   Ainsi n'importe quelle vue peut appliquer le filtre sans connaître
   les échelles des coordonnées parallèles.
   ===================================================================== */

import { DEFAULT_AXES, DEFAULT_PANELS } from "./meta.js";

export function initialState() {
  return {
    ds: "mat",             // "mat" | "por" | "custom" — jamais les deux matières ensemble
    status: "loading",     // "loading" | "ready" | "error"
    error: null,
    school: "",            // "" | "GP" | "MS"
    sex: "",               // "" | "F" | "M"
    excludeNoGrade: true,  // exclut par défaut G3 = 0 ET absences = 0
    groupFilter: null,     // { key, value } — posé par un clic sur un boxplot
    trend: "all",          // "all" | "down" | "flat" | "up" — posé par le slope graph
    brushes: {},           // clé d'attribut -> brush en unités de données
    axes: DEFAULT_AXES.slice(),
    colorBy: "result",
    panels: DEFAULT_PANELS.slice(),
    panelSort: "manual",   // "manual" | "gap" — ordre des panneaux de boxplots (U1.3)
    matrixOrder: "meta",   // "meta" | "g3"
    highlightPair: null,   // [a, b] — dernière cellule cliquée dans la matrice
    selectedId: null,      // __i de l'élève sélectionné (niveau détail)
    interacting: false,    // true pendant un geste de brush : les vues coûteuses attendent la fin
    custom: null           // { name, rows, meta, keys } si un CSV a été importé
  };
}

export const state = initialState();

/* ---------------- bus minimal ---------------- */
const listeners = new Map();

/** Abonne fn à l'événement evt ; renvoie une fonction de désabonnement. */
export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
}

export function emit(evt, payload) {
  (listeners.get(evt) || []).forEach(fn => fn(payload));
}

/**
 * Fusionne patch dans l'état puis émet "change".
 * source : nom de la vue émettrice (utile pour le débogage et pour
 * qu'une vue évite de réagir à sa propre modification si nécessaire).
 */
export function setState(patch, source = "app") {
  const keys = Object.keys(patch).filter(k => state[k] !== patch[k]);
  if (!keys.length) return;
  Object.assign(state, patch);
  emit("change", { keys, source });
}

/** Réinitialise filtres et sélection sans changer de jeu de données. */
export function resetFilters() {
  const fresh = initialState();
  setState({
    school: "", sex: "", excludeNoGrade: true, groupFilter: null, trend: "all",
    brushes: {}, axes: state.ds === "custom" ? state.axes : fresh.axes,
    colorBy: "result", highlightPair: null, selectedId: null, interacting: false,
    panels: state.ds === "custom" ? state.panels : fresh.panels, panelSort: "manual"
  }, "reset");
}
