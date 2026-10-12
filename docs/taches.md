# Tâches, visualisations et choix de données

Ce document fixe la **spécification des tâches** de l'application et les attributs dérivés. Le détail de chaque visualisation, la couverture des tâches (tâches × visualisations) et les chiffres lus sur les données sont dans [`visualisations.md`](visualisations.md), qui fait foi. Les chiffres sont calculés sur les élèves évalués (357 en maths, 634 en portugais).

**Décisions en vigueur (12 octobre 2026) :**
- deux profils d'utilisateurs : **U1**, l'équipe pédagogique (enseignants, CPE, direction), et **U2**, les parents et élèves ;
- **quatre visualisations**, une par membre : A ensembles parallèles, B matrice de corrélation, C sunburst, D graphe de similarité d'élèves. Boxplot et trajectoire G1, G2, G3 sont des **panneaux de détail liés**, pas des techniques ;
- la sélection est partagée entre les vues (clic dans A, C ou D filtre ou surligne les mêmes élèves ailleurs) ;
- les deux matières ne sont jamais cumulées, les non-évalués sont exclus par défaut et visibles sur demande ;
- ces décisions remplacent celles du 5 octobre (grille d'élèves, classement des facteurs, histogrammes, diagramme alluvial) : voir l'historique Git pour l'ancienne version.

| Membre | Visualisation | Fichier |
|---|---|---|
| Quentin ELLEON | A, ensembles parallèles | `js/views/parallelSets.js` |
| Jim LAINEL | B, matrice de corrélation (Spearman) et nuage de points | `js/views/correlationMatrix.js`, `js/views/pairScatter.js` |
| Alexandre LARGUECH | C, sunburst | `js/views/sunburst.js` |
| Gabriel LOIRAT | D, graphe de similarité (Gower) | `js/views/similarityGraph.js` |

---

## 1. Attributs par visualisation

| Visualisation | Attributs |
|---|---|
| A | `school`, `sex`, `address`, `alc`, `absCat`, `risque`, `tendance`, `reussite` (par défaut) ; en option `studytime`, `traveltime`, `pedu`, `higher`, `failures`, `goout` |
| B | `G3`, `G2`, `G1`, `failures`, `absences`, `studytime`, `traveltime`, `goout`, `Dalc`, `Walc`, `Medu`, `Fedu` (G1 et G2 masqués par défaut) |
| C | `school`, `sex`, `address`, `risque`, `alc`, `higher`, `absCat`, `pedu` (3 niveaux au plus) |
| D | `failures`, `absences`, `studytime`, `traveltime`, `goout`, `alc`, `pedu`, `school`, `sex`, `address`, `higher` (sans les notes) |

Restent hors des vues, mais présents dans la fiche élève et dans les données : `age`, `famsize`, `Pstatus`, `nursery`, `famsup`, `activities`, `romantic`, `guardian`, `internet`, `famrel`, `health`, `freetime`, `Mjob`, `Fjob`, `reason`, `schoolsup`. L'attribut `paid` n'est jamais utilisé : il n'est pas comparable entre matières (46 % de « oui » en maths, 6 % en portugais).

---

## 2. Transformations de données

| Attribut dérivé | Définition | Type | Justification | Tâches |
|---|---|---|---|---|
| `reussite` | G3 ≥ 10 ; vide pour un non-évalué | nominal (oui / non) | Le seuil de 10/20 est ce que les deux profils comprennent : il colore toutes les vues (▲ bleu / ▼ orange). | U2-1, toutes |
| `risque` | Nombre de facteurs parmi : au moins 1 échec passé, plus de 10 absences, trajet de 30 min ou plus, ne vise pas le supérieur (0 à 4) ; vide pour un non-évalué | ordinal (0–4) ; pour comparer des groupes, 2 à 4 sont réunis en « 2 facteurs ou plus » | Un simple comptage, sans pondération : chacun peut vérifier pourquoi un élève a tel niveau. Risque ≥ 2 : 42 élèves en maths, 67 en portugais. | U1-3, U2-4 |
| `pedu` | max(Medu, Fedu), 0 réuni avec 1 : ≤ primaire / collège / lycée / supérieur | ordinal (4) | Medu et Fedu sont redondants ; supprime un groupe de 3 élèves. | U1-1 |
| `alc` | arrondi de (5·Dalc + 2·Walc) / 7, niveaux 3 à 5 réunis : faible / modéré / élevé | ordinal (3) | Dalc et Walc sont redondants ; aucun groupe sous 10 élèves ; association au moins aussi forte (ρ −0,21 / −0,21). | U1-1, U2-3 |
| `absCat` | 0 / 1–4 / 5–10 / plus de 10 créneaux ; « n. r. » pour un non-évalué réinclus | ordinal (4) | Les absences deviennent des groupes comparables ; un 0 artificiel n'est jamais pris pour une assiduité parfaite. | U1-1 |
| `prog` | G3 − G1 ; vide pour un non-évalué | quantitatif | Base de `tendance`. Un non-évalué n'a pas de progression, sinon son 0 final compterait comme un décrochage. | U1-5 |
| `tendance` | `baisse` si `prog ≤ −2`, `hausse` si `prog ≥ +2`, sinon `stable` | nominal (3) | Les ensembles parallèles ne travaillent que sur des catégories : `prog` y entre sous cette forme. 34 / 20 en baisse, 245 / 461 stables, 78 / 153 en hausse (maths / portugais). | U1-5 |




---

## 3. Spécification des tâches

Le gras indique l'utilisateur principal de chaque tâche. U1 est l'équipe pédagogique (enseignants, CPE, direction), U2 les parents et élèves.

| ID | Tâche | Action → cible | Attributs | Utilisateurs | Critère de réussite |
|---|---|---|---|---|---|
| U1-1 | Quels facteurs sont le plus associés à une note finale basse (G3 inférieure à 10) ? | Discover → correlation | G3, failures, absences, studytime, traveltime, goout, alc, pedu | **U1** | Cite les 3 premiers facteurs de la matière choisie, hors G1 et G2, avec le sens du lien |
| U1-2 | Comparer la distribution de G3 entre sous-groupes (sexe, école, milieu, matière) | Compare → distribution | G3, sex, school, address | **U1** | Lit la médiane et l'effectif de chaque groupe, sans jamais mélanger les deux matières |
| U1-3 | Isoler les élèves qui cumulent plusieurs facteurs de risque | Locate → outliers | failures, absences, traveltime, higher, risque | **U1** | Obtient en quelques manipulations les élèves à risque 2 et plus (42 en maths, 67 en portugais), avec l'effectif exact |
| U1-4 | Consulter le profil d'un élève et le situer par rapport à la moyenne de son école et de sa matière | Lookup → features | Tous les attributs retenus et dérivés | **U1** | Voit en un clic les valeurs de l'élève à côté de celles de son groupe |
| U1-5 | Suivre la trajectoire G1, G2, G3 pour détecter un décrochage | Identify → trend | G1, G2, G3, prog | **U1** | Isole les élèves en baisse d'au moins 2 points (34 en maths, 20 en portugais) et affiche leur trajectoire |
| U2-1 | Voir comment les notes sont réparties et ce qu'est une note habituelle | Summarize → distribution | G3, reussite | **U2**, U1 | Dit en moins de 10 secondes quelle part des élèves dépasse 10/20 (74 % en maths, 87 % en portugais) |
| U2-2 | Situer un profil saisi (fictif) parmi les élèves qui lui ressemblent, sans comparaison nominative | Locate → position | les attributs du profil saisi, G3 de ses voisins | **U2** | Voit le profil saisi comme un nœud fictif relié à ses 5 plus proches voisins, et combien d'entre eux réussissent |
| U2-3 | Comprendre le lien entre sorties, alcool et notes sans jargon | Discover → dependency | goout, alc, G3 | **U2**, U1 | Dit que la note baisse un peu quand les sorties ou l'alcool augmentent, et que cela ne prouve pas une cause |
| U2-4 | Comparer un profil à risque et un profil protégé | Compare → features | risque, G3, failures, absCat, higher, traveltime | **U2**, U1 | Voit l'écart de médiane de G3 entre risque 2 et plus et risque 0 (9 contre 12 en maths, 10 contre 13 en portugais), avec *n* |
| U2-5 | Faire varier un facteur (temps d'étude, sorties) et voir la note moyenne des élèves qui ont ce profil | Explore → trend | studytime, goout, G3 | **U2** | Voit la note moyenne et l'effectif se mettre à jour, avec un rappel que c'est une association |

Chaque tâche a au moins un utilisateur. Trois tâches de U2 servent aussi à U1 (U2-1, U2-3, U2-4), alors qu'aucune tâche de U1 ne sert U2, parce qu'elles manipulent des élèves identifiables ou des vues trop denses pour des non-experts.

---

## 4. Tâches × visualisations

La couverture (✔ technique principale, ○ secondaire, \* liaison entre vues), la manière dont les vues réalisent chaque tâche et ce qu'on y lit sont dans [`visualisations.md`](visualisations.md) :

| Tâche | Principale | Secondaires |
|---|---|---|
| U1-1 | B | A |
| U1-2 | C | A |
| U1-3 | A | C, D |
| U1-4 | D | A |
| U1-5 | A | D |
| U2-1 | C | A |
| U2-2 | D | C |
| U2-3 | A | B |
| U2-4 | A | C |
| U2-5 | A | C |

Les dix tâches ont une technique principale et chaque visualisation est la seule principale sur au moins une tâche.
