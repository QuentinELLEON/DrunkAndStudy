// C. Sunburst   [Alexandre LARGUECH]
// Conteneur : #viz-sunburst   ·   Doc : docs/visualisations.md#c-sunburst
//
// COQUILLE À IMPLÉMENTER : cette vue ne dessine rien pour l'instant.
// Entrées : derived.exceptSrc("sun"), state.sunLevels (3 niveaux au plus, meta.SUN_DIMS) ; d3.group → d3.hierarchy → d3.partition
// Interactions : clic sur un secteur → toggleDrill(dim, value, "sun") pour chaque ancêtre ; clic au centre → retirer les contraintes src "sun" ; anneaux choisis via #sb0, #sb1, #sb2 ; légende dans #cLegend ; hachures si n < meta.SMALL_N
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
