/* =====================================================================
   state.js — état global unique + bus d'événements
   ---------------------------------------------------------------------
   Les vues ne se parlent jamais directement : elles écrivent dans l'état
   avec setState(), et main.js redessine toutes les vues à partir de ce
   même état. C'est ce qui garantit la cohérence des vues liées
   (un filtre, un critère ou une sélection se propagent partout).

   Tous les filtres sont exprimés en UNITÉS DE DONNÉES (critères, modalité,
   bande de notes), jamais en pixels : n'importe quelle vue peut les appliquer.
   ===================================================================== */

export function initialState() {
  return {
    ds: "mat",             // "mat" | "por" | "custom" — jamais les deux matières ensemble
    status: "loading",     // "loading" | "ready" | "error"
    error: null,
    school: "",            // "" | "GP" | "MS"
    sex: "",               // "" | "F" | "M"
    excludeNoGrade: true,  // exclut par défaut G3 = 0 ET absences = 0
    criteria: [],          // facteurs de risque cochés dans la grille (meta.RISK_FACTORS, ET logique)
    riskMin: 0,            // niveau de risque minimal (0 = pas de filtre) — grille de Quentin
    unitGroup: "risque",   // regroupement des carrés de la grille : "risque" | "none" | "school" | "sex"
    groupBy: "",           // groupe des histogrammes d'Alexandre ("" = tous les élèves)
    groupFilter: null,     // { key, value } — posé par un clic sur un histogramme
    sim: {},               // simulateur de profil : { studytime, goout, alc, failures, note }
    trend: "all",          // "all" | "down" — posé par la vue de Gabriel
    flow: null,            // { s, a, b } — flux de notes cliqué dans le diagramme alluvial
    selectedId: null,      // __i de l'élève sélectionné (niveau détail)
    custom: null           // jeu importé, si un CSV a été chargé
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
  setState({
    school: "", sex: "", excludeNoGrade: true, criteria: [], riskMin: 0, unitGroup: "risque",
    groupBy: "", groupFilter: null, sim: {}, trend: "all", flow: null, selectedId: null
  }, "reset");
}
