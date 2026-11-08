# Pipeline de visualisation : des données brutes aux variables visuelles

Ce document décrit, étape par étape, comment chaque valeur affichée est produite. Les noms de fonctions renvoient au code cible décrit dans [`architecture.md`](architecture.md) (`js/…`). Les visualisations sont celles de [`visualisations.md`](visualisations.md), qui fait foi.

Le pipeline suit le modèle de référence de Card, Mackinlay et Shneiderman :

**données brutes → table de données → structures visuelles → vues**

Les interactions de l'utilisateur rétroagissent sur les étapes de filtrage, de transformation et de vue.

---

## 0. Tronc commun (toutes les techniques)

### 0.1 Données brutes
| | Mathématiques | Portugais |
|---|---|---|
| Fichier | `data/student-mat.csv` | `data/student-por.csv` |
| Lignes × colonnes | 395 × 33 | 649 × 33 |
| Séparateur | `,` (copie Kaggle ; l'original UCI utilise `;`) | idem |
| Valeurs manquantes | 0 déclarée | 0 déclarée |

L'unité d'observation est **un élève inscrit dans une matière**. Les deux fichiers ne sont **jamais fusionnés** : la jointure de `student-merge.R` n'est pas une clé fiable.

### 0.2 Chargement et parsing (`data.js` : `loadDataset`)
1. `d3.csv(url)` est asynchrone. Pendant le chargement, un indicateur est affiché et les vues sont grisées. En cas d'échec, un message clair explique la cause : fichier absent, ou page ouverte en `file://` sans serveur statique.
2. Si le fichier est au format UCI d'origine (séparateur `;`), `d3.csv` ne voit qu'une colonne : le fichier est alors relu avec `d3.dsv(";", url)`. Les noms de colonnes sont nettoyés (BOM, espaces, guillemets).
3. Les 33 colonnes attendues sont vérifiées. S'il en manque, une erreur liste lesquelles.
4. Un fichier importé par l'utilisateur passe par `FileReader` (`file.text()`) : le séparateur (`,`, `;` ou tabulation) est détecté sur l'en-tête, puis `d3.dsvFormat(sep).parse`.

### 0.3 Nettoyage et typage (`meta.js`, `data.js` : `typeRows`)
| Nature | Nombre | Attributs | Représentation en mémoire |
|---|---|---|---|
| **Nominal** | 17 | school, sex, address, famsize, Pstatus, Mjob, Fjob, reason, guardian, schoolsup, famsup, paid, nursery, higher, activities, internet, romantic | chaîne (code d'origine), libellé français via `meta.v` |
| **Ordinal** | 10 | Medu, Fedu (0–4) ; traveltime, studytime (1–4) ; famrel, freetime, goout, Dalc, Walc, health (1–5) | nombre ; **domaine ordonné explicite** `meta.d` et libellés de modalité `meta.s` / `meta.v` |
| **Quantitatif** | 6 | age, failures (0–3, censuré), absences (créneaux de 2 h), G1, G2, G3 (0–20) | nombre ; domaine fixe `meta.fixed` = [0, 20] pour les notes |

Les ordinaux sont stockés en entiers, mais **aucune vue n'utilise leur écart numérique** : ils servent de groupes, ordonnés selon `meta.d` et nommés en clair (« 2–5 h », « lycée »), ou de rangs pour le sens du lien (Spearman).

### 0.4 Attributs dérivés (`typeRows`, `DERIVATIONS`)
Drapeaux internes :

| Attribut | Définition | Rôle |
|---|---|---|
| `__i` | index de ligne | identifiant stable de l'élève (sélection, liens entre vues) |
| `__nograde` | `G3 = 0 ET absences = 0` | **dossier non renseigné** : 38 en mathématiques, 15 en portugais. Dans 100 % des cas, une note nulle s'accompagne de 0 absence : c'est une donnée manquante codée 0 |

Attributs dérivés **affichés** (justification et tâches : `docs/taches.md`, §2). Ils s'ajoutent aux 33 colonnes, qui ne sont jamais modifiées ; l'export CSV ne contient que les colonnes d'origine.

| Attribut | Définition | Type | Utilisé par |
|---|---|---|---|
| `reussite` | G3 ≥ 10 (oui / non) ; vide pour un non-évalué | nominal | couleur de A, C, D, tuiles |
| `risque` | nombre de facteurs parmi `meta.RISK_FACTORS` : au moins 1 échec passé, plus de 10 absences, trajet ≥ 30 min, ne vise pas le supérieur ; vide pour un non-évalué. Pour comparer des groupes, `meta.risque.bins` réunit 2, 3 et 4 en « 2 facteurs ou plus » | ordinal (0–2 une fois réuni) | A, C, D (couleur), fiche |
| `pedu` | max(Medu, Fedu), 0 réuni avec 1 | ordinal (4) | C, D, fiche |
| `alc` | arrondi de (5·Dalc + 2·Walc) / 7, niveaux 3 à 5 réunis | ordinal (3) | A, C, D, fiche |
| `absCat` | 0 / 1–4 / 5–10 / > 10 créneaux ; vide pour un non-évalué | ordinal (4) ; vide pour un non-évalué | A, C |
| `prog` | G3 − G1 ; vide pour un non-évalué | quantitatif | découpé en `tendance` ; fiche |
| `tendance` | `baisse` si `prog ≤ −2`, `hausse` si `prog ≥ +2`, sinon `stable` ; vide pour un non-évalué | nominal (3) | A, D (couleur), fiche |

Un fichier importé qui contient les colonnes sources reçoit les mêmes dérivés (`derivedKeysFor`).

### 0.5 Filtrage (`data.js` : `derive`)

Une seule chaîne de filtres est calculée **une fois par rendu** :

```
rows ─(matière, non-évalués exclus par défaut)→ base
     ─(state.drill, state.slide)→ selection
     ─(selection sans les contraintes d'une source)→ exceptSrc("sun")
```

- `base` sert aux comparaisons (moyenne de la matière, médiane de l'école) et à la disposition du graphe D.
- `selection` alimente B, les tuiles, les panneaux de détail et l'opacité dans D.
- `exceptSrc(src)` alimente C : le sunburst reste entier quand on y zoome. A, elle, dessine `selection` : son zoom réduit le diagramme.

Exclure les non-évalués change les conclusions : sur 395 élèves de mathématiques, r(absences, G3) = **+0,034** avec eux et **−0,213** sans eux (vérifié par `tools/test-stats.mjs`). L'exclusion est donc activée par défaut et **affichée** ; la case permet de les réinclure.

---

## 1. A, ensembles parallèles · `js/views/parallelSets.js`

Tâches : U1-3, U1-5, U2-3, U2-4, U2-5 (principale) ; U1-1, U1-2, U1-4, U2-1 (secondaire).

| Étape | Contenu |
|---|---|
| **Données utilisées** | `selection` (zooms de A inclus) |
| **Transformation** | catégorie de chaque élève pour chaque axe de `state.psetAxes` (`school`, `sex`, `address`, `alc`, `absCat`, `risque` réuni en 0 / 1 / 2 ou plus, `tendance`, `reussite`) ; effectif par catégorie ; effectif par passage entre deux axes voisins, séparé par `reussite` |
| **Marques** | un segment par catégorie et par axe ; un ruban par croisement |
| **Canaux** | *hauteur du segment* et *épaisseur du ruban* = nombre d'élèves ; *teinte* = réussite (bleu) ou échec (orange) ; *pointillés* = chemin de l'élève sélectionné |
| **Interactions** | clic sur un segment : zoom (`state.drill`, `src: "pset"`) avec fil d'Ariane ; survol : *n* et % de réussite ; ajout, retrait et déplacement des axes ; curseurs `studytime` et `goout` (`state.slide`) |

## 2. B, matrice de corrélation · `js/views/correlationMatrix.js`, `js/views/pairScatter.js`

Tâches : U1-1 (principale) ; U2-3 (secondaire).

| Étape | Contenu |
|---|---|
| **Données utilisées** | `selection`, 12 attributs de `meta.MATRIX_KEYS` |
| **Transformation** | rangs moyens (ex æquo), puis ρ de Spearman pour chaque paire (`stats.spearmanMatrix`) ; tri par |ρ| avec G3 |
| **Marques** | une cellule par paire du triangle inférieur ; texte ρ dans la cellule |
| **Canaux** | *teinte divergente centrée sur 0* (bleu positif, rouge négatif, blanc proche de 0) ; *gris* = pas de lien net ; légende de −1 à +1 |
| **Interactions** | survol : phrase en langage simple ; clic : `state.mxPair` et nuage de points du panneau 3 (points avec jitter léger, courbe des médianes) |

## 3. C, sunburst · `js/views/sunburst.js`

Tâches : U1-2, U2-1 (principale) ; U1-3, U2-4, U2-5 (secondaire).

| Étape | Contenu |
|---|---|
| **Données utilisées** | `exceptSrc("sun")` |
| **Transformation** | hiérarchie sur `state.sunLevels` (3 niveaux au plus, défaut `school`, `sex`, `risque`) avec `d3.group`, `d3.hierarchy`, `d3.partition` ; *n* et nombre de réussites par nœud |
| **Marques** | un secteur par nœud, un disque central avec *n* et % de réussite |
| **Canaux** | *angle* = *n* ; *teinte divergente* = taux de réussite centré sur celui de `base` ; *hachures* = moins de 10 élèves |
| **Interactions** | clic sur un secteur : zoom (`state.drill`, `src: "sun"`) ; clic au centre : retour ; choix et ordre des anneaux ; survol : chemin, *n*, % |

## 4. D, graphe de similarité · `js/views/similarityGraph.js`, `stats.gower`, `stats.knn`

Tâches : U1-4, U2-2 (principale) ; U1-3, U1-5 (secondaire).

| Étape | Contenu |
|---|---|
| **Données utilisées** | `base` (graphe et disposition), `selection` (opacité) |
| **Transformation** | distance de Gower sur `meta.SIMILARITY_KEYS` (11 attributs, sans les notes) ; 5 plus proches voisins de chaque élève (`stats.knn`) ; disposition par forces calculée une fois et mise en cache |
| **Marques** | un nœud par élève, un lien par voisin, un losange pour le profil saisi |
| **Canaux** | *teinte* = réussite ou tendance (choix de l'utilisateur) ; *opacité* = appartenance à la sélection ; *lien en surbrillance* = voisins du nœud survolé |
| **Interactions** | clic sur un nœud : fiche (`state.selectedId`) ; zoom et déplacement ; « Tester un profil » (`state.ghost`) : nœud fictif relié à ses 5 voisins et phrase de lecture |

## 5. Panneaux de détail

| Panneau | Données | Transformation | Visuel |
|---|---|---|---|
| Boxplot de G3 · `selectionBox.js` | `selection` et `base` | quartiles, médiane, min, max de G3 | boîtes sur axe 0–20, seuil 10, *n* écrit |
| Trajectoire · `studentTrajectory.js` | élève sélectionné, médianes de l'école | médiane de G1, G2, G3 des élèves de `base` dans la même école | deux courbes à 3 points, axe 0–20 |
| Fiche · `studentCard.js` | élève sélectionné, `base` | médiane ou valeur la plus fréquente dans l'école et la matière | tableau |
| Tuiles · `selectionPanel.js` | `selection`, `base` | *n*, part ≥ 10/20, médiane, moyenne | quatre tuiles |

## 6. Couleurs

Les couleurs sont des variables CSS définies dans `index.html` (puis `css/tokens.css`) et relues à chaque rendu : les vues suivent le thème (auto, clair, sombre).

| Rôle | Variable | Clair | Sombre |
|---|---|---|---|
| Réussite | `--ok` | `#1F4FA3` | `#6E9BEA` |
| Échec | `--ko` | `#D9822B` | `#F0A65A` |
| Neutre, milieu d'échelle | `--mid` | `#E4E8EF` | `#3A4256` |
| Texte | `--ink` | `#1B2333` | `#E6E9F0` |

Le bleu et l'orange restent distinguables par les daltoniens. La couleur n'est jamais le seul porteur d'information, et le texte n'est jamais coloré par la donnée. Dans B, l'échelle divergente est bleu positif, rouge négatif (voir `visualisations.md`).
