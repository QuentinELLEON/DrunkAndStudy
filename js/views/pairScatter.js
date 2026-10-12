// Panneau 3 : nuage de points d'une paire   [Jim LAINEL (lié à B)]
// Conteneur : #viz-pair-scatter   ·   Doc : docs/visualisations.md#b-matrice-de-corrélation
//
// COQUILLE À IMPLÉMENTER : cette vue ne dessine rien pour l'instant.
// Entrées : derived.selection et state.mxPair = [a, b] ; stats.spearman(rows, a, b)
// Interactions : points avec jitter léger pour les ordinaux, courbe des médianes de b par valeur ou classe de a ; texte (phrase simple, ρ, n) dans #panel-pair-text ; #panel-pair-close remet state.mxPair à null
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
