// A. Ensembles parallèles   [Quentin ELLEON]
// Conteneur : #viz-parallel-sets   ·   Doc : docs/visualisations.md#a-ensembles-parallèles
//
// COQUILLE À IMPLÉMENTER : cette vue ne dessine rien pour l'instant.
// Entrées : derived.exceptSrc("pset"), state.psetAxes (3 à 5 axes, "reussite" en dernier), state.slide, derived.selected (chemin de l'élève)
// Interactions : zoom par clic → toggleDrill(dim, value, "pset") ; survol (n, % de réussite) ; axes ajoutables / déplaçables → setState({ psetAxes }) ; présélections #presetSeg (meta.PSET_PRESETS), ajout via #addAxis (meta.PSET_ADDABLE)
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
