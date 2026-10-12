// B. Matrice de corrélation   [Jim LAINEL]
// Conteneur : #viz-correlation-matrix   ·   Doc : docs/visualisations.md#b-matrice-de-corrélation
//
// COQUILLE À IMPLÉMENTER : cette vue ne dessine rien pour l'instant.
// Entrées : derived.selection, meta.MATRIX_KEYS (G1 et G2 si state.matrixShowG) ; stats.spearmanMatrix(rows, keys), stats.significanceThreshold(n) ; sous meta.MIN_N_CORRELATION élèves, afficher un message
// Interactions : clic sur une cellule → setState({ mxPair: [a, b] }) ; case #showG → setState({ matrixShowG }) ; légende dans #bLegend, effectif et rappel « un lien n'est pas une cause » dans #bInfo
// Contrat de données : docs/data-contracts.md · conventions : docs/conventions.md

import { prepareContainer } from "../utils.js";

let host = null;

// Appelée une fois après le chargement des données. Crée le SVG / canvas dans `container`.
export function init(container) {
  host = prepareContainer(container);
}

// Appelée à chaque changement d'état. Doit pouvoir être appelée à tout moment, sans effet de bord hors de `host`.
// Les écritures dans l'état passent uniquement par setState / toggleDrill (js/state.js).
export function update(state, derived) {
  if (!host) return;
  // TODO : redessiner à partir de state et derived
}
