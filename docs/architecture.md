# Architecture de l'application

Ce document décrit comment le code est organisé pour que chaque visualisation soit développée dans son propre module, sans connaître les autres. La référence fonctionnelle (quoi afficher, pourquoi) est [`visualisations.md`](visualisations.md), qui fait foi en cas de conflit. Les formats de données sont dans [`data-contracts.md`](data-contracts.md) et les règles d'équipe dans [`conventions.md`](conventions.md).

## Principes

1. **Une page, aucune donnée dans le HTML.** `index.html` ne contient que la structure, les styles et des conteneurs. Les CSV sont lus dans `data/` avec `d3.csv()`.
2. **Une visualisation = un module = un conteneur.** Chaque conteneur `#viz-…` de `index.html` (vide au départ) est rempli par un seul fichier de `js/views/`.
3. **Un état unique.** Les vues ne s'appellent jamais entre elles. Elles écrivent dans l'état (`setState`) et `main.js` redessine tout à partir de cet état.
4. **Des fonctions pures pour les calculs.** Tout ce qui se calcule sans navigateur (Spearman, Gower, k plus proches voisins, découpage en classes) vit dans `js/stats.js` et `js/data.js` et se teste avec Node.
5. **D3 v7.9.0 en module ES**, chargé depuis le CDN avec version figée, sans bundler.

## Arborescence proposée

```
DrunkAndStudy/
├── index.html                   page : mise en page, commandes, conteneurs vides #viz-…
├── README.md                    présentation, lancement, structure
├── package.json                 scripts start et test, "type": "module"
├── css/
│   ├── tokens.css               variables (couleurs, thème clair / sombre), reset
│   ├── layout.css               .page, .layout, .views, .view, .panel, responsive
│   ├── components.css           .seg, .btn, .chip, .stats, .legend, .tip, .attr, .note…
│   └── views/                   un fichier par vue (classes SVG propres à la vue)
│       ├── parallel-sets.css
│       ├── correlation-matrix.css
│       ├── sunburst.css
│       ├── similarity-graph.css
│       └── detail-panels.css
├── data/
│   ├── student-mat.csv          357 évalués sur 395 lignes
│   └── student-por.csv          634 évalués sur 649 lignes
├── docs/
│   ├── visualisations.md        source de vérité : tâches × visualisations
│   ├── architecture.md          ce fichier
│   ├── data-contracts.md        formats de données entre modules
│   ├── conventions.md           règles pour les contributeurs
│   ├── taches.md                spécification des tâches U1 / U2
│   ├── pipeline.md              données brutes → variables visuelles
│   └── conception.md            choix de conception, conformité aux consignes
├── js/
│   ├── main.js                  chargement D3, initialisation, boucle de rendu
│   ├── guard.js                 script classique : message explicite en file://
│   ├── state.js                 état global + setState + événement « change »
│   ├── data.js                  chargement, typage, non-évalués, attributs dérivés, filtres (derive)
│   ├── meta.js                  libellés, domaines ordonnés, listes d'attributs par vue
│   ├── stats.js                 fonctions pures : rangs, Spearman, médiane, Gower, knn
│   ├── utils.js                 formats français, couleurs lues dans le CSS, info-bulle, accessibilité
│   ├── controls/
│   │   ├── header.js            matière, non-évalués, réinitialiser
│   │   ├── selectionPanel.js    puces de filtres, tuiles n / % / médiane / moyenne, curseurs studytime et goout
│   │   └── studentCard.js       fiche élève (tableau élève contre médiane de l'école)
│   └── views/
│       ├── parallelSets.js      VIZ A, #viz-parallel-sets
│       ├── correlationMatrix.js VIZ B, #viz-correlation-matrix
│       ├── sunburst.js          VIZ C, #viz-sunburst
│       ├── similarityGraph.js   VIZ D, #viz-similarity-graph
│       ├── selectionBox.js      panneau 1, #viz-selection-boxplot
│       ├── studentTrajectory.js panneau 2, #viz-student-trajectory
│       └── pairScatter.js       panneau 3, #viz-pair-scatter
└── tools/
    ├── extract_csv.py           existant
    └── test-stats.mjs           tests Node de js/stats.js et des dérivés
```

Les fichiers `rendu1.md`, `tasks.md` et `notes.md` à la racine sont des documents de travail antérieurs. Ils sont conservés tels quels et ne font plus référence.

## Interface d'un module de vue

Chaque fichier de `js/views/` exporte exactement deux fonctions :

```js
export function init(container) { /* crée le SVG / canvas dans container, branche les événements */ }
export function update(state, derived) { /* redessine à partir de state et derived, sans effet de bord */ }
```

- `container` est l'élément `#viz-…` correspondant. `init` reçoit un conteneur vide (`prepareContainer` de `utils.js` le vide et pose `data-ready`) et dessine dedans.
- `derived` contient les sous-ensembles calculés une seule fois par rendu (voir [`data-contracts.md`](data-contracts.md)).
- Une vue modifie l'état uniquement avec `setState({...})`. Elle ne touche ni au DOM d'une autre vue ni à `derived`.
- Une vue lit les couleurs dans les variables CSS (`getComputedStyle`) à chaque `update`, pour suivre le thème.

## Flux de données

```
data/*.csv ──d3.csv──▶ data.js (typage, dérivés) ──▶ rows
                                                     │
state.js (ds, inclNE, drill, slide, selectedId, mxPair, ghost, colorBy)
                                                     │
                      data.derive(rows, state) ──▶ derived { base, selection, exceptSrc(…) }
                                                     │
        main.js : requestAnimationFrame ──▶ update(state, derived) sur chaque vue et chaque panneau
                                                     │
        interactions ◀── setState({...}) ◀──────────┘
```

## Liaisons entre vues

| Action | Effet |
|---|---|
| Clic sur une catégorie (A) ou un secteur (C) | ajoute une contrainte `state.drill`, appliquée à toutes les vues et rappelée en puce |
| Curseurs `studytime` / `goout` (panneau) | posent `state.slide`, appliqué dans A et dans les tuiles |
| Clic sur un nœud (D), un point du nuage ou une ligne | renseigne `state.selectedId` : ouvre la fiche, trace le chemin de l'élève dans A, surligne l'élève dans C et D |
| Clic sur une cellule de B | renseigne `state.mxPair` : ouvre le nuage de points du panneau 3 |
| « Tester un profil » (D) | renseigne `state.ghost` : nœud fictif relié à ses 5 plus proches voisins |
| Changement de matière ou de « non évalués » | recharge la base, remet à zéro `drill`, `selectedId`, `mxPair`, `ghost` |

Les zooms de A et de C sont indépendants de leur propre rendu : chaque vue dessine `exceptSrc("pset")` ou `exceptSrc("sun")` (la sélection privée de ses propres contraintes) pour que le zoom ne vide pas la vue qui l'a posé.

## Découpage du travail

| Zone | Propriétaire | Fichiers |
|---|---|---|
| A, ensembles parallèles | Quentin ELLEON | `js/views/parallelSets.js`, `css/views/parallel-sets.css` |
| B, matrice de corrélation et nuage de points | Jim LAINEL | `js/views/correlationMatrix.js`, `js/views/pairScatter.js`, `css/views/correlation-matrix.css` |
| C, sunburst | Alexandre LARGUECH | `js/views/sunburst.js`, `css/views/sunburst.css` |
| D, graphe de similarité | Gabriel LOIRAT | `js/views/similarityGraph.js`, `stats.gower` et `stats.knn`, `css/views/similarity-graph.css` |
| Socle partagé | à répartir (voir issue « setup ») | `state.js`, `data.js`, `meta.js`, `stats.js`, `utils.js`, `main.js`, `css/tokens.css`, `css/layout.css`, `css/components.css`, `controls/*`, `selectionBox.js`, `studentTrajectory.js` |

Le socle (`state`, `data`, `meta`, `stats`, `utils`, `main`, `controls/*`, CSS) est en place et testé (`npm test`). Les sept modules de `js/views/` sont des coquilles vides branchées sur `main.js` : chacun peut être développé en parallèle sans toucher aux autres. Restent à écrire pour le socle : `selectionBox.js` et `studentTrajectory.js` (panneaux graphiques).
