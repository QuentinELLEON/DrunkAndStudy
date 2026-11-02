# Student Performance Explorer

Application de visualisation D3.js (v7) liée, en quatre techniques, du jeu de données **Student Performance / Student Alcohol Consumption**.
Projet de visualisation de l'information de Quentin ELLEON, Jim LAINEL, Alexandre LARGUECH et Gabriel LOIRAT.

> **État du dépôt : socle fonctionnel, visualisations à coder.** La page charge les CSV avec D3, calcule les attributs dérivés et la sélection partagée, et alimente l'en-tête, le panneau de sélection et la fiche élève. Les 4 visualisations et les 3 panneaux graphiques sont des coquilles vides (`js/views/*.js`) à implémenter. Le prototype d'origine reste dans `VisuMaquetteData.html` (non modifié).

## Les 4 visualisations

| Visu | Technique | Membre | Conteneur dans `index.html` | Module cible |
|---|---|---|---|---|
| A | Ensembles parallèles (Parallel Sets) | Quentin ELLEON | `#viz-parallel-sets` | `js/views/parallelSets.js` |
| B | Matrice de corrélation de Spearman (heatmap) | Jim LAINEL | `#viz-correlation-matrix` | `js/views/correlationMatrix.js` |
| C | Sunburst | Alexandre LARGUECH | `#viz-sunburst` | `js/views/sunburst.js` |
| D | Graphe de similarité d'élèves (Gower, 5 voisins) | Gabriel LOIRAT | `#viz-similarity-graph` | `js/views/similarityGraph.js` |

Panneaux de détail liés : distribution de G3 de la sélection (`#viz-selection-boxplot`), trajectoire G1, G2, G3 (`#viz-student-trajectory`), fiche élève, nuage de points d'une paire de B (`#viz-pair-scatter`).

Tout tient sur **une seule page**. Les utilisateurs (U1, équipe pédagogique ; U2, parents et élèves), les 10 tâches et leur couverture par les quatre techniques sont dans **[`docs/visualisations.md`](docs/visualisations.md)** (source de vérité) et **[`docs/taches.md`](docs/taches.md)**.

## Documentation

| Document | Contenu |
|---|---|
| [`docs/visualisations.md`](docs/visualisations.md) | source de vérité : tâches × visualisations, ce qu'on lit, conteneurs |
| [`docs/architecture.md`](docs/architecture.md) | arborescence cible, interface d'un module de vue, flux de données, liaisons |
| [`docs/data-contracts.md`](docs/data-contracts.md) | formats de données : élève, état partagé, sous-ensembles dérivés, contrat de chaque vue |
| [`docs/conventions.md`](docs/conventions.md) | règles Git, code, vocabulaire, accessibilité, critères d'acceptation |
| [`docs/taches.md`](docs/taches.md) | spécification des tâches, attributs par vue, attributs dérivés |
| [`docs/pipeline.md`](docs/pipeline.md) | pipeline des données brutes aux variables visuelles |
| [`docs/conception.md`](docs/conception.md) | choix de conception et checklist de conformité |

Les fichiers `rendu1.md`, `tasks.md` et `notes.md` sont des documents de travail antérieurs, conservés tels quels.

### Ce qui est affiché, et ce qui ne l'est pas

- **Attributs retirés des vues** parce qu'aucune tâche ne les utilise : `age`, `famsize`, `Pstatus`, `guardian`, `famrel`, `nursery`, `famsup`, `activities`, `internet`, `romantic`, `health`, `freetime`, `reason`, `Mjob`, `Fjob`, `schoolsup`, et `paid` (non comparable entre matières : 46 % de « oui » en maths, 6 % en portugais). Ils restent dans la fiche élève et dans les données.
- **Attributs dérivés** : `reussite` = G3 ≥ 10 ; `risque` = nombre de facteurs parmi « au moins 1 échec passé », « plus de 10 absences », « trajet de 30 min ou plus », « ne vise pas le supérieur » ; `pedu` = max(Medu, Fedu) ; `alc` = indice d'alcool (5·Dalc + 2·Walc) / 7 en 3 niveaux ; `absCat` = absences en classes ; `prog` = G3 − G1 ; `tendance` = baisse, stable ou hausse selon `prog` (seuil de 2 points).

## Lancer la page

Les données sont lues dans `data/*.csv` avec **`d3.csv()`** au chargement de la page. La page doit être servie en **`http://`**, et non ouverte par double-clic en `file://` (les modules ES et la lecture de fichiers sont bloqués par les navigateurs) ; un message l'explique si c'est le cas.

- **VS Code** : extension *Live Server*, clic droit sur `index.html` → **Open with Live Server**.
- **Node** :
  ```bash
  cd DrunkAndStudy
  npm start            # = npx serve . ; ouvrir l'URL affichée (http://localhost:3000)
  ```

D3 v7.9.0 est chargé depuis `https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js` (version figée) ; un message s'affiche s'il n'a pas pu l'être. Pour une soutenance sans Internet : `npm install d3@7.9.0`, puis remplacer l'URL du CDN dans `index.html` par `node_modules/d3/dist/d3.min.js`.

### Tests

```bash
npm test             # = node tools/test-stats.mjs
```

Le script vérifie les fonctions statistiques (rangs, Spearman, quantiles, Gower, plus proches voisins), le typage et les attributs dérivés sur les vrais CSV, les filtres et l'état, et les chiffres de référence de `docs/visualisations.md` : 357 / 634 élèves évalués, 42 / 67 à risque 2 ou plus, 34 / 20 en baisse, 74 % / 87 % de réussite, changement de signe de `absences × G3` selon les non-évalués.

## Structure

```
DrunkAndStudy/
├── index.html                 page : conteneurs vides #viz-…, aucune donnée, aucun code de visualisation
├── VisuMaquetteData.html      prototype d'origine, non modifié
├── package.json               scripts start et test (modules ES)
├── css/                       tokens, layout, components + un fichier par vue (css/views/)
├── data/                      student-mat.csv (395 lignes, 357 évalués), student-por.csv (649 lignes, 634 évalués)
├── docs/                      documentation (voir ci-dessus)
├── js/
│   ├── main.js                chargement D3, initialisation, rendu à chaque changement d'état
│   ├── guard.js               message explicite en file://
│   ├── state.js               état unique + setState + toggleDrill / setSlide
│   ├── data.js                d3.csv, typage, attributs dérivés, derive() : base, selection, exceptSrc, selected
│   ├── meta.js                libellés, domaines ordonnés, seuils, listes d'attributs par vue
│   ├── stats.js               fonctions pures : rangs, Spearman, quantiles, Gower, plus proches voisins
│   ├── utils.js               formats français, couleurs du thème, info-bulle, accessibilité, message d'état
│   ├── controls/              header, selectionPanel, studentCard (fonctionnels)
│   └── views/                 parallelSets, correlationMatrix, sunburst, similarityGraph,
│                              selectionBox, studentTrajectory, pairScatter (coquilles à implémenter)
└── tools/                     extract_csv.py, test-stats.mjs
```

Détail et interface des modules : [`docs/architecture.md`](docs/architecture.md).

## Contribuer

Une branche par issue, une pull request par issue, ids de conteneurs stables, aucune donnée dans le HTML : voir [`docs/conventions.md`](docs/conventions.md).

## Crédits du jeu de données

P. Cortez & A. Silva (2008). *Using data mining to predict secondary school student performance.* Proceedings of the 5th Future Business Technology Conference, pp. 5-12.
UCI Machine Learning Repository, jeu n° 320, DOI [10.24432/C5TG7T](https://doi.org/10.24432/C5TG7T), licence **CC BY 4.0**.
Miroir Kaggle : [uciml/student-alcohol-consumption](https://www.kaggle.com/datasets/uciml/student-alcohol-consumption).

> Le script `student-merge.R` fourni sur Kaggle lit les fichiers avec `sep=";"` alors que notre copie utilise `","`. De plus, sa jointure sur 13 attributs n'est pas une clé : elle annonce 382 élèves pour au plus 366 combinaisons distinctes. L'application n'utilise donc pas cette jointure, et c'est ce qui garantit que les deux matières ne sont jamais cumulées.
