// Panneau 1 : boxplot de G3 de la sélection   [à répartir]
// Conteneur : #viz-selection-boxplot   ·   Doc : docs/visualisations.md#panneaux-de-détail-liés
//
// COQUILLE À IMPLÉMENTER : cette vue ne dessine rien pour l'instant.
// Entrées : derived.selection et derived.base (élèves évalués) ; stats.boxStats(values)
// Interactions : axe G3 de 0 à 20, seuil 10 en pointillés, médiane et n écrits ; deux boîtes quand la sélection est un sous-ensemble
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
