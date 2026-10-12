// D. Graphe de similarité   [Gabriel LOIRAT]
// Conteneur : #viz-similarity-graph   ·   Doc : docs/visualisations.md#d-graphe-de-similarité
//
// COQUILLE À IMPLÉMENTER : cette vue ne dessine rien pour l'instant.
// Entrées : derived.base (graphe, disposition à mettre en cache par matière et inclNE), derived.selection (opacité) ; stats.knn(rows, meta.SIMILARITY_KEYS, meta.NEIGHBORS, meta.SIMILARITY_NOMINAL) ; state.colorBy, state.ghost
// Interactions : clic sur un nœud → setState({ selectedId: row.__i }) ; couleur via #gSeg → setState({ colorBy }) ; profil fictif via #fakeForm → setState({ ghost }) ; légende #dLegend, lecture du profil #dFake, comparaison voisins / hasard #dTake
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
