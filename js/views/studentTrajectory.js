// Panneau 2 : trajectoire G1, G2, G3   [à répartir]
// Conteneur : #viz-student-trajectory   ·   Doc : docs/visualisations.md#panneaux-de-détail-liés
//
// COQUILLE À IMPLÉMENTER : cette vue ne dessine rien pour l'instant.
// Entrées : derived.selected et data.schoolPeers(derived.all, derived.selected) : médiane de G1, G2, G3 des élèves évalués de la même école
// Interactions : deux courbes à 3 points (élève, médiane de l'école), axe 0 à 20, seuil 10 ; rien à dessiner si aucun élève n'est sélectionné
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
