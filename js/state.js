// État global unique + bus d'événements. Les vues n'écrivent que par setState(). Contrat : docs/data-contracts.md.

import { PSET_PRESETS, SUN_DEFAULT } from "./meta.js";

const initial = () => ({
  ds: "mat",                // matière active : "mat" | "por"
  inclNE: false,            // inclure les non-évalués
  drill: [],                // [{ dim, value, src }] contraintes posées par un clic ; src ∈ "pset" | "sun"
  slide: {},                // { studytime?: 1..4, goout?: 1..5 }
  selectedId: null,         // __i de l'élève ouvert dans la fiche
  mxPair: null,             // [attrA, attrB] paire cliquée dans B
  ghost: null,              // profil fictif saisi dans D
  colorBy: "reussite",      // couleur des nœuds de D : "reussite" | "tendance"
  psetPreset: "risque",     // présélection d'axes de A
  psetAxes: PSET_PRESETS.risque.axes.slice(),
  sunLevels: SUN_DEFAULT.slice(),
  matrixShowG: false,       // afficher G1 et G2 dans B
});

export const state = initial();
const listeners = new Set();

// Écoute les changements : fn(state, patch). Retourne une fonction de désinscription.
export function on(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Fusionne `patch` dans l'état et notifie. Changer de matière ou de « non-évalués » remet la sélection à zéro.
export function setState(patch) {
  const resets = ("ds" in patch && patch.ds !== state.ds) || ("inclNE" in patch && patch.inclNE !== state.inclNE);
  Object.assign(state, patch);
  if (resets) Object.assign(state, { drill: [], slide: {}, selectedId: null, mxPair: null, ghost: null }, patch);
  listeners.forEach((fn) => fn(state, patch));
}

// Pose, remplace ou retire (même dimension, même valeur, même source) une contrainte de zoom.
export function toggleDrill(dim, value, src) {
  const has = state.drill.some((f) => f.dim === dim && String(f.value) === String(value));
  const rest = state.drill.filter((f) => f.dim !== dim);
  setState({ drill: has ? rest : rest.concat([{ dim, value, src }]) });
}
export const dropDrill = (dim) => setState({ drill: state.drill.filter((f) => f.dim !== dim) });
export const setSlide = (dim, value) => {
  const slide = { ...state.slide };
  if (value === null || value === undefined || value === "") delete slide[dim]; else slide[dim] = Number(value);
  setState({ slide });
};

export const resetAll = () => setState({ ...initial(), ds: state.ds });
