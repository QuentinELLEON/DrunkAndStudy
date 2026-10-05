# Pipeline de visualisation : des données brutes aux variables visuelles

Ce document décrit, étape par étape, comment chaque valeur affichée est produite. Les noms de fonctions renvoient au code (`js/…`).

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
| `__delta` | `G3 − G1`, vide pour un non-évalué | évolution sur l'année |
| `__trend` | `down` si Δ ≤ −2, `up` si Δ ≥ +2, sinon `flat` ; aucune pour un non-évalué | filtre « en baisse » (question 4) |

Attributs dérivés **affichés** (justification et tâches : `docs/taches.md`, §2). Ils s'ajoutent aux 33 colonnes, qui ne sont jamais modifiées ; l'export CSV ne contient que les colonnes d'origine.

| Attribut | Définition | Type | Utilisé par |
|---|---|---|---|
| `reussite` | G3 ≥ 10 (oui / non) ; vide pour un non-évalué | nominal | couleur de toutes les vues, tuiles |
| `risque` | nombre de facteurs parmi `meta.RISK_FACTORS` : au moins 1 échec passé, plus de 10 absences, trajet ≥ 30 min, ne vise pas le supérieur ; vide pour un non-évalué. Pour comparer des groupes, `meta.risque.bins` réunit 2, 3 et 4 en « 2 facteurs ou plus » | ordinal (0–4) | grille, histogrammes, fiche, table |
| `pedu` | max(Medu, Fedu), 0 réuni avec 1 | ordinal (4) | classement, histogrammes, fiche |
| `alc` | arrondi de (5·Dalc + 2·Walc) / 7, niveaux 3 à 5 réunis | ordinal (3) | classement, histogrammes, simulateur, fiche |
| `absCat` | 0 / 1–4 / 5–10 / > 10 créneaux ; 9 = « n. r. » pour un non-évalué | ordinal (4 + n. r.) | classement, histogrammes |
| `prog` | G3 − G1 ; vide pour un non-évalué | quantitatif | question 4, fiche, table |

Un fichier importé qui contient les colonnes sources reçoit les mêmes dérivés (`derivedKeysFor`).

### 0.5 Filtrage (`data.js` : `derive`)
Une seule chaîne de filtres est calculée **une fois par rendu** :

```
base ─(non évalués exclus par défaut, établissement, sexe)→ scoped           ← classement des facteurs, fond de la grille, simulateur
     ─(critères de risque de la grille, groupe cliqué)→ exceptFlow             ← diagramme alluvial (les autres flux en fond)
     ─(tendance « en baisse », ruban cliqué)→ selection                         ← tuiles, histogrammes, grille (premier plan), table, fiche
```

`exceptGroup` (la sélection sans le filtre de groupe) alimente les histogrammes : quand on clique un groupe, les autres restent visibles, estompés.

Le **classement des facteurs** n'utilise que `scoped` : filtrer sur un facteur (par exemple « au moins 1 échec ») viderait sa propre comparaison. Le **simulateur** n'utilise que `scoped` lui aussi : un parent ou un élève compare un profil à tous les élèves, pas à la sélection de l'équipe.

Exclure les non-évalués change les conclusions : sur 395 élèves de mathématiques, r(absences, G3) = **+0,034** avec eux et **−0,213** sans eux (vérifié par `tools/test-stats.mjs`). L'exclusion est donc activée par défaut et **affichée** ; la case permet de les réinclure. Réinclus, ils apparaissent en gris ✕ dans les histogrammes et la grille, et en bande « non évalué » à droite du diagramme alluvial.

---

## 1. Histogrammes de la note finale et simulateur de profil (Alexandre) · `views/histograms.js`

Question 1 : « Comment se répartissent les notes ? » — tâches U2-1, U1-2, U2-4, U2-2, U2-5.

| Étape | Contenu |
|---|---|
| **Données utilisées** | `selection` ; `exceptGroup` quand un groupe est cliqué ; `scoped` pour le simulateur |
| **Groupes** | « Comparer selon » : aucun (un seul histogramme), sexe, établissement, domicile, niveau de risque (0 / 1 / 2 et plus), échecs passés, absences, temps d'étude, trajet, sorties, alcool, éducation parentale, vise le supérieur (`meta.HIST_GROUPS`) |
| **Transformation** | pour chaque groupe : effectif par note entière de 0 à 20, rapporté à l'effectif du groupe ; médiane ; taux de réussite (élèves évalués) |
| **Marques** | une barre par note, à extrémité arrondie ; un triangle sous l'axe pour la médiane ; un repère « élève n° … » au-dessus de la note de l'élève ouvert dans la fiche |
| **Canaux** | *position horizontale* = note, toujours 0–20 ; *ligne pointillée* = seuil 10<br>*hauteur* = part du groupe, sur une échelle commune à tous les panneaux (les groupes de tailles différentes se comparent)<br>*teinte* = résultat : orange ▼ échec, bleu ▲ réussite, gris ✕ non évalué<br>le **% de réussite est écrit en gros** dans chaque panneau : on ne demande pas d'estimer une aire<br>*contour pointillé + « ⚠ moins de 10 »* = petit groupe |
| **Interactions** | choix du groupe ; *clic* ou *Entrée* sur un panneau : filtre toutes les vues sur ce groupe ; *survol* d'une barre : effectif exact et part du groupe |
| **Simulateur** | critères « peu importe » ou une valeur pour temps d'étude, sorties, alcool, échecs passés (`meta.SIM_KEYS`) et note facultative. Affiche n, moyenne, médiane, % ≥ 10 des élèves qui ont ce profil, leur histogramme sur la silhouette de tous les élèves, le marqueur « ma note » et la part des élèves du profil sous cette note. Aucun élève n'est nommé. Rappel permanent : « association observée, pas une cause » |

## 2. Classement des facteurs (Jim) · `views/factorRanking.js`

Question 2 : « Qu'est-ce qui est associé à l'échec ? » — tâches U1-1, U2-3.

| Étape | Contenu |
|---|---|
| **Données utilisées** | `scoped`, élèves évalués seulement |
| **Facteurs** | échecs passés, absences (classes), temps d'étude, trajet, sorties, alcool, éducation parentale (`meta.FACTOR_KEYS`) |
| **Transformation** | pour chaque modalité : taux de réussite (G3 ≥ 10), moyenne, n. **Écart** = meilleur − moins bon taux parmi les modalités d'au moins 10 élèves. **Sens** = signe du ρ de Spearman entre le facteur et G3 (rangs moyens, `stats.spearman`) ; force en mots : « un peu » (|ρ| < 0,25), « nettement » (< 0,4), « fortement ». Tri par écart décroissant |
| **Marques** | une ligne par facteur ; un point par modalité ; un trait entre le moins bon et le meilleur taux ; un trait vertical pour la moyenne |
| **Canaux** | *position horizontale* = taux de réussite ; *teinte* = groupe qui réussit le moins (orange ▼) / le plus (bleu ▲) / autres (gris) ; *point creux* = moins de 10 élèves (exclu de l'écart)<br>texte : rang, phrase de sens (« plus de sorties : réussite un peu plus basse ▼ »), écart en points ; étiquettes des deux extrêmes seulement |
| **Interactions** | *survol* d'un point : taux, moyenne, n ; *clic* ou *Entrée* sur un facteur : la question 1 se regroupe selon ce facteur ; ↑ ↓ entre les facteurs |

## 3. Grille d'élèves (Quentin) · `views/unitChart.js`

Question 3 : « Quels élèves cumulent les risques ? » — tâche U1-3, point d'entrée vers la fiche (U1-4).

| Étape | Contenu |
|---|---|
| **Données utilisées** | `scoped` (tous les carrés) et `selection` (carrés pleins) |
| **Transformation** | niveau de risque de chaque élève (`risque`) ; regroupement par niveau de risque, établissement, sexe ou aucun ; dans chaque groupe, élèves sélectionnés d'abord, puis en échec, puis en réussite, pour que les proportions se lisent comme des blocs |
| **Marques** | un carré de 11 px par élève ; un titre par groupe (effectif, % en échec, nombre dans la sélection) |
| **Canaux** | *teinte* = résultat (orange ▼ / bleu ▲ / gris ✕) ; *opacité* = appartenance à la sélection (les autres restent visibles, estompés) ; *contour* = élève ouvert dans la fiche |
| **Interactions** | facteurs à cocher (ET logique) ; « Nombre de facteurs » : peu importe, ≥ 1, ≥ 2, ≥ 3 ; regroupement ; *survol* : élève, note, facteurs ; *clic* : fiche. Les critères filtrent toutes les vues sauf le classement des facteurs, et sont rappelés en puce dans la barre de filtres |

## 4. Diagramme alluvial et fiche élève (Gabriel) · `views/alluvial.js`, `views/detailPanel.js`

Question 4 : « Comment évoluent les notes pendant l'année ? » — tâches U1-5, U1-4.

### 4a. Diagramme alluvial (vue d'ensemble)
| Étape | Contenu |
|---|---|
| **Données utilisées** | `exceptFlow` ; la part de la `selection` est surlignée quand la tendance ou un ruban est actif |
| **Transformation** | chaque note est rangée dans une bande (`meta.BANDS`) : solide ≥ 14, juste 10–13, échec < 10, non évalué ; effectif de chaque passage de bande entre P1 et P2, puis entre P2 et la note finale |
| **Marques** | un rectangle par bande et par période, un ruban par passage |
| **Canaux** | *hauteur* du rectangle et *épaisseur* du ruban = nombre d'élèves ; *teinte* = bande de départ (bleu ▲ / bleu clair ● / orange ▼ / gris ✕) ; rubans de la sélection foncés, les autres en fond |
| **Interactions** | bouton « ▼ En baisse d'au moins 2 points » (avec son effectif) ; *clic* ou *Entrée* sur un ruban : filtre toutes les vues sur ce passage ; *survol* : effectif. Quand la sélection compte au plus 60 élèves, leurs trajectoires sont listées (mini-courbe P1 → P2 → finale, notes, écart), du plus fort recul au plus faible ; un clic ouvre la fiche |

### 4b. Fiche élève (niveau détail)
| Étape | Contenu |
|---|---|
| **Données utilisées** | l'élève sélectionné ; groupe de référence = élèves évalués du **même établissement dans la même matière** |
| **Transformation** | moyenne du groupe (ou part de « oui ») pour 13 attributs (`meta.KEY_ATTRS`) ; quartiles et médiane de G1, G2, G3 du groupe |
| **Marques** | tableau élève / son école ; mini-trajectoire sur la bande Q1–Q3 de l'école ; autres attributs repliés |
| **Canaux** | ▲ / ▼ = valeur plus ou moins favorable que la moyenne de l'école ; *position verticale* = note 0–20, seuil 10 |
| **Interactions** | ouverte par un clic dans la grille, la liste des trajectoires ou la table ; ← / → : élève précédent ou suivant de la sélection ; ✕ : fermer |

---

## 4 bis. Techniques du projet (2e partie de la page)

| Visu | Données | Transformation | Marques et canaux | Interactions |
|---|---|---|---|---|
| A Ensembles parallèles (Quentin) | `selection` | catégorie de chaque élève par dimension (`groupValue` : risque réuni en 0 / 1 / 2 et plus, `tendance`, `absCat`) ; effectifs par passage entre dimensions voisines, séparés par `reussite` | segments (largeur = n), bandes (largeur = n, teinte = réussite) ; chemin de l'élève sélectionné | zoom → `state.drill` (src `pset`), fil d'Ariane, ▲ ▼, choix des dimensions, curseurs → `state.slide` |
| B Matrice (Jim) | `selection` | ρ de Spearman (`stats.spearmanMatrix`) sur `meta.MATRIX_KEYS` | cellule, teinte divergente centrée sur 0, valeur écrite, gris si |ρ| < 0,1 | ordre, clic → nuage de points (`state.mxPair`) |
| C Sunburst (Alexandre) | `exceptSun` (sélection sans ses propres zooms) | hiérarchie dérivée sur 3 attributs, `d3.partition` | angle = n, teinte divergente = taux de réussite centré sur la moyenne, hachures n < 10 | zoom → `state.drill` (src `sun`), clic au centre = remonter |
| D Graphe (Gabriel) | `scoped` (disposition), `selection` (opacité) | distance de Gower (`stats.gower`), 5 plus proches voisins (`stats.knn`), `d3.forceSimulation` 240 itérations, mis en cache | nœud par élève, lien par voisin, teinte = réussite ou tendance | clic → fiche, zoom / déplacement, profil fictif (`state.ghost`) relié à ses 5 voisins |

## 5. Vues de support
- **Tuiles** (`statTiles.js`) : part des élèves qui ont au moins 10/20 (en premier, U2-1), élèves affichés, note moyenne de la sélection (U2-5), note habituelle (médiane).
- **Distribution de la sélection** (`selectionBox.js`) : boîtes à moustaches de G3, sélection contre périmètre, médiane et n.
- **Table** (`table.js`), repliée par défaut : 11 colonnes (`meta.TABLE_COLS`), tri, clavier (Tab, ↑ ↓, Entrée), export CSV de la sélection (33 colonnes d'origine). Liste nominative pour U1.
- **Lien permanent** (`permalink.js`) : matière, filtres, critères, groupe, profil simulé, tendance, ruban et élève sont écrits dans le fragment de l'URL et relus au chargement ; bouton « Copier le lien de cette vue ».

## 6. Couleurs
| Rôle | Clair | Sombre | Règle |
|---|---|---|---|
| Réussite ▲ / bande solide | `#2a78d6` | `#3987e5` | teinte catégorielle 1, toujours avec une icône |
| Bande juste ● | `#93b8e3` | `#4f6f96` | bleu atténué, entre ▲ et ▼ |
| Échec ▼ | `#eb6834` | `#d95926` | teinte catégorielle 2 ; bleu / orange lisible par les daltoniens (validé : ΔE 24,7 en protanopie) |
| Non évalué ✕ | `#7a7872` | `#95938c` | gris neutre |

Toutes les couleurs sont des variables CSS relues à chaque rendu : les vues suivent le thème (auto / clair / sombre). Le texte n'est jamais coloré par la donnée : les valeurs sont en encre de texte, la couleur est portée par la marque voisine.
