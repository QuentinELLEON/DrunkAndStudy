# Student Performance Explorer

Application de visualisation D3.js (v7) liée, en quatre techniques, du jeu de données **Student Performance / Student Alcohol Consumption**.
Projet de visualisation de l'information de Quentin ELLEON, Jim LAINEL, Alexandre LARGUECH et Gabriel LOIRAT.

La page répond à quatre questions, une par membre, avec des représentations lisibles sans formation en visualisation :

| Question | Technique | Membre | Fichier |
|---|---|---|---|
| 1. Comment se répartissent les notes ? | Histogrammes de la note finale par groupe + simulateur de profil | Alexandre | `js/views/histograms.js` |
| 2. Qu'est-ce qui est associé à l'échec ? | Classement des facteurs (taux de réussite par modalité) | Jim | `js/views/factorRanking.js` |
| 3. Quels élèves cumulent les risques ? | Grille d'élèves (1 carré = 1 élève) avec critères de risque | Quentin | `js/views/unitChart.js` |
| 4. Comment évoluent les notes pendant l'année ? | Diagramme alluvial P1 → P2 → finale + fiche élève | Gabriel | `js/views/alluvial.js`, `js/views/detailPanel.js` |

Tout tient sur **une seule page** (`index.html`). Les utilisateurs (U1, équipe pédagogique ; U2, parents et élèves), les 10 tâches, leur couverture par les quatre techniques et la checklist « tâche → comment la réaliser » sont dans **[`docs/taches.md`](docs/taches.md)**.

### Ce qui est affiché, et ce qui ne l'est pas

- **Attributs retirés des vues** parce qu'aucune tâche ne les utilise : `age`, `famsize`, `Pstatus`, `guardian`, `famrel`, `nursery`, `famsup`, `activities`, `internet`, `romantic`, `health`, `freetime`, `reason`, `Mjob`, `Fjob`, `schoolsup`, et `paid` (non comparable entre matières : 46 % de « oui » en maths, 6 % en portugais). Ils restent dans la fiche élève (repliés) et dans l'export CSV.
- **Attributs dérivés** (`js/data.js`, `DERIVATIONS`) : `reussite` = G3 ≥ 10 ; `risque` = nombre de facteurs parmi « au moins 1 échec passé », « plus de 10 absences », « trajet de 30 min ou plus », « ne vise pas le supérieur » ; `pedu` = max(Medu, Fedu) ; `alc` = indice d'alcool (5·Dalc + 2·Walc) / 7 en 3 niveaux ; `absCat` = absences en classes ; `prog` = G3 − G1.

## Lancer la démonstration

Les données sont lues directement dans `data/*.csv` avec **`d3.csv()`**. Il n'y a pas de serveur applicatif ni de Python. En revanche, la page doit être servie en **`http://`**, et non ouverte par double-clic en `file://`. En `file://`, Chrome, Edge et Firefox bloquent à la fois les modules ES (`<script type="module">`, imposés par la consigne) et la lecture de fichiers par `d3.csv()` (sécurité CORS). N'importe quel serveur de fichiers statiques convient :

- **VS Code** : installer l'extension *Live Server* (Ritwick Dey), puis clic droit sur `index.html` → **Open with Live Server**.
- **Node** (déjà installé avec npm) :
  ```bash
  cd DrunkAndStudy
  npx serve .          # puis ouvrir l'URL affichée (http://localhost:3000)
  ```
- **WebStorm / IntelliJ** : ouvrir `index.html` puis cliquer sur l'icône de navigateur (serveur intégré).

Si la page est quand même ouverte en `file://`, un message explicite s'affiche en haut au lieu d'une page vide.

### D3.js et accès à Internet

D3 v7.9.0 est chargé depuis `https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js` (version figée pour garantir la reproductibilité). Il faut donc une connexion au premier lancement. **Pour une soutenance sans Internet** :

```bash
npm install d3@7.9.0
# dans index.html, remplacer l'URL du CDN par :
#   node_modules/d3/dist/d3.min.js
```

Le code utilise la variable globale `d3`, donc aucun autre changement n'est nécessaire. Si D3 ne se charge pas, un message l'indique en haut de la page.

### Tests des fonctions statistiques

```bash
node tools/test-stats.mjs
```

Ce script vérifie les rangs avec ex æquo, Spearman, les quartiles, le changement de signe de `absences × G3` selon que les non-évalués sont inclus ou non, et les chiffres de la spécification sur les vraies données : 42 / 67 élèves à risque ≥ 2, médianes 9 contre 12 et 10 contre 13, 74 % / 87 % de réussite, 34 / 20 trajectoires en baisse.

## Structure

```
DrunkAndStudy/
├── index.html                 structure de la page (conteneurs des vues), aucune donnée, aucun code D3
├── README.md
├── css/style.css              thème clair/sombre par variables CSS, palette accessible
├── data/student-mat.csv       395 élèves (mathématiques), séparateur ","
├── data/student-por.csv       649 élèves (portugais),     séparateur ","
├── docs/pipeline.md           pipeline données brutes → variables visuelles, par technique (pour le rapport)
├── docs/conception.md         choix de conception + checklist de conformité aux consignes
├── docs/taches.md             suppressions, dérivés, tableau des tâches, tâches × techniques, checklist
├── tools/extract_csv.py       régénère data/*.csv à partir de l'ancien prototype mono-fichier
├── tools/test-stats.mjs       tests Node des fonctions de js/stats.js
└── js/
    ├── main.js                initialisation, chargement asynchrone, orchestration du rendu
    ├── state.js               état global unique + bus d'événements (on / emit / setState)
    ├── data.js                chargement, détection du séparateur, typage, drapeau « non évalué », attributs dérivés, filtres, import CSV
    ├── meta.js                métadonnées des 33 attributs + 6 dérivés ; facteurs de risque ; attributs retenus par technique
    ├── permalink.js           état de l'analyse encodé dans l'URL (#…) : lien permanent
    ├── stats.js               fonctions pures : rangs, Spearman, quartiles, rang centile
    ├── utils.js               couleurs, formatage français, libellés, info-bulle
    └── views/
        ├── filterBar.js       barre de filtres unique + rappel des filtres posés par les vues
        ├── statTiles.js       indicateurs de synthèse (part ≥ 10/20, effectif, médiane)
        ├── histograms.js      question 1 — Alexandre
        ├── factorRanking.js   question 2 — Jim
        ├── unitChart.js       question 3 — Quentin
        ├── alluvial.js        question 4 — Gabriel (vue d'ensemble)
        ├── detailPanel.js     question 4 — Gabriel (niveau détail : fiche élève)
        └── table.js           table triable + export CSV de la sélection
```

**Écarts par rapport à la structure demandée :**
- `stats.js` sépare les calculs, qui sont testables sans navigateur, du rendu.
- `filterBar.js` garantit une seule barre de filtres pour toute l'application.
- `tools/` contient les scripts qui ne s'exécutent pas dans la page.

## Architecture en bref

1. Chaque vue exporte `init(container)` et `update(state, derived)`.
2. Une vue ne modifie jamais une autre vue. Elle appelle `setState({...})`, qui émet `change`.
3. `main.js` reçoit `change` et calcule une seule fois les sous-ensembles dérivés (`data.derive`) : `scoped`, `noBrush`, `selection`, etc. Il appelle ensuite `update` sur toutes les vues, dans le même `requestAnimationFrame`.
4. Les filtres sont stockés **en unités de données** (facteurs de risque cochés, modalité d'un groupe, passage de bande `{ s, a, b }`), ce qui permet à toutes les vues de les appliquer.

| Action | Effet sur les autres vues |
|---|---|
| Cocher des facteurs ou « ≥ 2 » dans la grille | filtre les tuiles, les histogrammes, le diagramme alluvial, la table et la fiche (pas le classement des facteurs, voir `docs/conception.md`) |
| Cliquer un facteur dans le classement | les histogrammes se regroupent selon ce facteur |
| Cliquer un histogramme | filtre global sur ce groupe, avec une puce supprimable dans la barre de filtres |
| « ▼ En baisse » ou clic sur un ruban | filtre global sur les élèves en baisse ou sur ce passage de bande ; leurs trajectoires sont listées |
| Clic sur un élève (carré, trajectoire, ligne de table) | ouvre la fiche, comparée à la moyenne de son école |
| « Copier le lien de cette vue » | l'adresse contient tout l'état : la rouvrir restaure la même vue |

## Changer de jeu de données

- **Mathématiques / Portugais** : les deux matières ne sont jamais cumulées dans une même vue.
- **Importer un CSV** : le séparateur `,`, `;` ou la tabulation est détecté automatiquement, et un BOM éventuel est supprimé.
  - Les 33 colonnes connues gardent leurs métadonnées ; si les colonnes sources sont présentes, les attributs dérivés sont recalculés et les listes d'attributs de `docs/taches.md` s'appliquent.
  - Le type des colonnes inconnues est inféré, et l'application le signale.
  - Les vues qui exigent `G1`, `G2` ou `G3` affichent un message au lieu de se casser.

## Crédits du jeu de données

P. Cortez & A. Silva (2008). *Using data mining to predict secondary school student performance.* Proceedings of the 5th Future Business Technology Conference, pp. 5-12.
UCI Machine Learning Repository, jeu n° 320, DOI [10.24432/C5TG7T](https://doi.org/10.24432/C5TG7T), licence **CC BY 4.0**.
Miroir Kaggle : [uciml/student-alcohol-consumption](https://www.kaggle.com/datasets/uciml/student-alcohol-consumption).

> Le script `student-merge.R` fourni sur Kaggle lit les fichiers avec `sep=";"` alors que notre copie utilise `","`. De plus, sa jointure sur 13 attributs n'est pas une clé : elle annonce 382 élèves pour au plus 366 combinaisons distinctes. L'application n'utilise donc pas cette jointure, et c'est ce qui garantit que les deux matières ne sont jamais cumulées.
