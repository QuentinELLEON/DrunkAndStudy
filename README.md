# Student Performance Explorer

Application de visualisation D3.js (v7) liée, en quatre techniques, du jeu de données **Student Performance / Student Alcohol Consumption**.
Projet de visualisation de l'information de Quentin ELLEON, Jim LAINEL, Alexandre LARGUECH et Gabriel LOIRAT.

> **État du dépôt : squelette.** `index.html` contient la page complète sans aucune visualisation : chaque visualisation est un placeholder identifié, à implémenter module par module. Le prototype d'origine reste dans `VisuMaquetteData.html` (non modifié).

## Les 4 visualisations

| Visu | Technique | Membre | Placeholder dans `index.html` | Module cible |
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
| [`docs/visualisations.md`](docs/visualisations.md) | source de vérité : tâches × visualisations, ce qu'on lit, placeholders |
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

Les données seront lues dans `data/*.csv` avec **`d3.csv()`**. La page doit être servie en **`http://`**, et non ouverte par double-clic en `file://` (les modules ES et la lecture de fichiers sont bloqués par les navigateurs). Pour l'instant `index.html` ne charge aucun script et s'ouvre directement.

- **VS Code** : extension *Live Server*, clic droit sur `index.html` → **Open with Live Server**.
- **Node** :
  ```bash
  cd DrunkAndStudy
  npx serve .          # puis ouvrir l'URL affichée (http://localhost:3000)
  ```

D3 v7.9.0 sera chargé depuis `https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js` (version figée). Pour une soutenance sans Internet, installer `d3@7.9.0` avec npm et pointer vers `node_modules/d3/dist/d3.min.js`.

## Structure

Structure actuelle :

```
DrunkAndStudy/
├── index.html                 squelette de la page (placeholders, aucune donnée, aucun code D3)
├── VisuMaquetteData.html      prototype d'origine, non modifié
├── README.md
├── data/student-mat.csv       395 lignes (357 élèves évalués), séparateur ","
├── data/student-por.csv       649 lignes (634 élèves évalués), séparateur ","
├── docs/                      documentation (voir ci-dessus)
├── tools/extract_csv.py       régénère data/*.csv à partir de l'ancien prototype mono-fichier
└── tools/test-stats.mjs       tests Node des fonctions statistiques (importe js/stats.js, data.js et meta.js : à rétablir avec le socle)
```

Structure cible (modules `css/` et `js/` à créer) : voir [`docs/architecture.md`](docs/architecture.md).

## Contribuer

Une branche par issue, une pull request par issue, ids de placeholders stables, aucune donnée dans le HTML : voir [`docs/conventions.md`](docs/conventions.md).

## Crédits du jeu de données

P. Cortez & A. Silva (2008). *Using data mining to predict secondary school student performance.* Proceedings of the 5th Future Business Technology Conference, pp. 5-12.
UCI Machine Learning Repository, jeu n° 320, DOI [10.24432/C5TG7T](https://doi.org/10.24432/C5TG7T), licence **CC BY 4.0**.
Miroir Kaggle : [uciml/student-alcohol-consumption](https://www.kaggle.com/datasets/uciml/student-alcohol-consumption).

> Le script `student-merge.R` fourni sur Kaggle lit les fichiers avec `sep=";"` alors que notre copie utilise `","`. De plus, sa jointure sur 13 attributs n'est pas une clé : elle annonce 382 élèves pour au plus 366 combinaisons distinctes. L'application n'utilise donc pas cette jointure, et c'est ce qui garantit que les deux matières ne sont jamais cumulées.
