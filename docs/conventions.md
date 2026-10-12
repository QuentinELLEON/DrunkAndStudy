# Conventions pour les contributeurs

## Flux de travail Git

- On ne travaille jamais sur `main`. Une branche par issue : `viz/<nom>` pour une visualisation (`viz/parallel-sets`), `setup/<sujet>` pour le socle.
- Un commit = une idée. Message court à l'impératif, préfixé d'un type : `feat:`, `fix:`, `docs:`, `refactor:`, `test:`.
- Une pull request par issue, qui cite l'issue (`Closes #N`). Relecture par un autre membre avant la fusion.
- On ne supprime et on n'écrase pas les fichiers d'origine (`VisuMaquetteData.html`, `rendu1.md`, `tasks.md`, `notes.md`).

## Conteneurs et identifiants

- Chaque visualisation a un conteneur vide à **id stable** `viz-<nom>` et un attribut `data-viz="<nom>"` dans `index.html`. On ne renomme pas un id sans mettre à jour `docs/visualisations.md`, `docs/architecture.md` et l'issue correspondante.
- Un module de vue dessine dans son conteneur (`init(container)`) et ne crée pas de conteneur concurrent.
- Les ids et classes d'un module commencent par le nom de la vue (`pset-`, `mx-`, `sun-`, `sim-`) pour éviter les collisions CSS.

## Code JavaScript

- Modules ES, D3 v7.9.0 via la variable globale `d3`. Pas de bundler, pas de dépendance de plus sans accord de l'équipe.
- Un module de vue exporte `init(container)` et `update(state, derived)` (voir [`architecture.md`](architecture.md)). `update` doit pouvoir être appelé à tout moment avec n'importe quel état.
- Une vue ne modifie que l'état, avec `setState`. Elle ne lit pas le DOM d'une autre vue.
- Les calculs sans dessin vont dans `stats.js` ou `data.js`, en fonctions pures, avec un test dans `tools/test-stats.mjs`.
- Pas de nombre magique : les listes d'attributs, le nombre de voisins et les seuils viennent de `meta.js`.
- Les données ne sont jamais écrites dans le HTML ni dans un fichier JS.

## Données et vocabulaire

- Les valeurs brutes (`GP`, `yes`) ne sont jamais modifiées. Les libellés français viennent de `meta.js`.
- Les deux matières ne sont **jamais cumulées** dans une même vue.
- Les élèves non évalués sont exclus par défaut, leur nombre est affiché et une case permet de les réinclure.
- Texte à l'écran en français, au vocabulaire d'association (« associé à », « réussite plus basse »), jamais « effet » ni « cause ».
- Effectif *n* visible sur tout agrégat ; groupe de moins de 10 élèves signalé (hachures, contour pointillé ou mention explicite).

## Style et accessibilité

- Les couleurs viennent des variables CSS de `css/tokens.css` (`--ok`, `--ko`, `--mid`, `--ink`, `--muted`…). Aucune couleur écrite en dur dans un module, pour que le mode sombre fonctionne.
- Bleu = réussite (G3 ≥ 10), orange = échec. La couleur n'est jamais le seul porteur d'information : valeur écrite, icône ou motif en plus.
- Tout élément cliquable est atteignable au clavier (`tabindex`, `Entrée` et `Espace`) et porte un `aria-label` explicite.
- Les graphiques SVG ont un `role="img"` et un `aria-label` qui résume leur contenu.
- Pas de défilement horizontal de la page à 390 px. Respecter `prefers-reduced-motion`.

## Critères d'acceptation communs à toute visualisation

1. Rend correctement pour les deux matières et avec ou sans non-évalués.
2. Réagit à la sélection partagée (filtres, élève ouvert) comme décrit dans `visualisations.md`.
3. Aucun message ni erreur dans la console.
4. Fonctionne en mode clair et sombre, et au clavier.
5. Lisible à 1280 px de large et à 390 px.
6. Les chiffres affichés correspondent à ceux de `visualisations.md` (voir ci-dessous).
7. La doc de la vue est à jour dans `visualisations.md` et `data-contracts.md`.

## Chiffres de contrôle (maths / portugais)

| Indicateur | Valeur |
|---|---|
| Élèves évalués | 357 / 634 |
| Non évalués | 38 / 15 |
| Risque 2 ou plus | 42 / 67 |
| Réussite risque 2+ contre 0 | 43 % / 58 % contre 81 % / 94 % |
| Tendance baisse / stable / hausse | 34 / 245 / 78 et 20 / 461 / 153 |
| Part des élèves à 10 ou plus | 74 % / 87 % |

Ces valeurs se vérifient avec `node tools/test-stats.mjs` une fois `js/stats.js`, `js/data.js` et `js/meta.js` recréés (le script les importe).
