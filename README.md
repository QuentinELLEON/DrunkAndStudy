# Student Performance Explorer

Application de visualisation D3.js (v7) liée, en quatre techniques, du jeu de données **Student Performance / Student Alcohol Consumption**.
Projet de visualisation de l'information de Quentin ELLEON, Jim LAINEL, Alexandre LARGUECH et Gabriel LOIRAT.

| Technique | Membre | Fichier |
|---|---|---|
| Coordonnées parallèles + brushing + réordonnancement | Quentin | `js/views/parallelCoords.js` |
| Matrice de corrélation de Spearman | Jim | `js/views/correlationMatrix.js` |
| Small multiples de boxplots / strip plots de G3 | Alexandre | `js/views/boxplots.js` |
| Slope graph G1 → G2 → G3 + fiche élève | Gabriel | `js/views/slopeGraph.js`, `js/views/detailPanel.js` |

Tout tient sur **une seule page** (`index.html`). Les 20 tâches de la spécification (profils U1–U4), leur couverture par les quatre techniques et la checklist « tâche → comment la réaliser » sont dans **[`docs/taches.md`](docs/taches.md)**.

### Ce qui est affiché, et ce qui ne l'est pas

- **Attributs retirés des vues d'analyse** parce qu'aucune tâche ne les utilise ou qu'ils surchargent l'écran : `age`, `famsize`, `Pstatus`, `guardian`, `famrel`, `nursery`, `famsup`, `activities`, `internet`, `romantic`, et `paid` (non comparable entre matières : 46 % de « oui » en maths, 6 % en portugais). Ils restent dans la fiche élève (repliés) et dans l'export CSV.
- **Attributs dérivés** (`js/data.js`, `DERIVATIONS`) : `pedu` = max(Medu, Fedu) ; `alc` = indice d'alcool (5·Dalc + 2·Walc) / 7 en 3 niveaux ; `prog` = G3 − G1 ; `g3band` = G3 en 3 bandes (option de couleur) ; `absC` et `absCat` = absences corrigées des non-évalués, et en classes. Les paires redondantes Dalc/Walc et Medu/Fedu restent séparées dans la matrice, qui montre leur redondance.
- **G1 et G2** ne sont plus que dans le slope graph, la fiche et la table : ils écrasaient la matrice (ρ ≈ 0,9 avec G3).
## Lancer la démonstration

Les données sont lues directement dans `data/*.csv` avec **`d3.csv()`**. Il n'y a pas de serveur applicatif ni de Python. En revanche, la page doit être servie en **`http://`**, et non ouverte par double-clic en `file://`. En `file://`, Chrome, Edge et Firefox bloquent à la fois les modules ES (`<script type="module">`, imposés par la consigne) et la lecture de fichiers par `d3.csv()` (sécurité CORS). N'importe quel serveur de fichiers statiques convient :

- **VS Code** : installer l'extension *Live Server* (Ritwick Dey), puis clic droit sur `index.html` → **Open with Live Server**.
- **Node** (déjà installé avec npm) :
  ```bash
  cd student-performance-explorer
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

Ce script vérifie les rangs avec ex æquo, Spearman, les quartiles, le changement de signe de `absences × G3` selon que les non-évalués sont inclus ou non, et les attributs dérivés sur les vraies données (aucun groupe d'alcool sous 10 élèves, 34 / 20 trajectoires en baisse, non-évalués sans progression).

## Structure

```
student-performance-explorer/
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
    ├── meta.js                métadonnées des 33 attributs + 6 dérivés ; attributs retenus par technique
    ├── permalink.js           état de l'analyse encodé dans l'URL (#…) : retrouver une sélection (U4.5)
    ├── stats.js               (ajout) fonctions pures : rangs, Spearman, quartiles, IC 95 %
    ├── utils.js               couleurs, formatage français, libellés, info-bulle
    └── views/
        ├── filterBar.js       (ajout) barre de filtres unique + rappel des filtres posés par les vues
        ├── statTiles.js       indicateurs de synthèse
        ├── parallelCoords.js  technique 1
        ├── correlationMatrix.js technique 2
        ├── boxplots.js        technique 3
        ├── slopeGraph.js      technique 4 (vue d'ensemble)
        ├── detailPanel.js     technique 4 (niveau détail : fiche élève)
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
4. Les brushes sont stockés **en unités de données** (`{kind:"range", lo, hi}` ou `{kind:"set", values}`), ce qui permet à toutes les vues de les appliquer.

| Action | Effet sur les autres vues |
|---|---|
| Brush sur un axe parallèle | filtre les tuiles, les boxplots, le slope graph, la table et la fiche (pas la matrice, voir `docs/conception.md`) |
| Clic sur une cellule de la matrice | ajoute les deux attributs comme axes adjacents dans les coordonnées parallèles, qui les mettent en évidence |
| Clic sur une boîte (boxplot) | filtre global sur ce groupe, avec une puce supprimable dans la barre de filtres |
| Filtre de tendance (slope graph) | filtre global baisse / stable / hausse |
| Clic sur un élève (ligne, point, trajectoire, ligne de table) | ouvre la fiche élève et le met en évidence dans toutes les vues |
| « Isoler ces élèves » dans la fiche | pose dans les coordonnées parallèles un brush par attribut du profil de l'élève : toutes les vues montrent les élèves qui lui ressemblent |
| « Copier le lien de cette vue » | l'adresse de la page contient tout l'état (matière, filtres, brushes, axes, panneaux, élève) : la rouvrir restaure la même vue |

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
