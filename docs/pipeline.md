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

Les ordinaux sont stockés en entiers, mais **aucune vue n'utilise leur écart numérique** : ils passent par des échelles de points (`scalePoint`) ou par des rangs (Spearman).

### 0.4 Attributs dérivés (`typeRows`, `DERIVATIONS`)
Drapeaux internes :

| Attribut | Définition | Rôle |
|---|---|---|
| `__i` | index de ligne | identifiant stable de l'élève (sélection, liens entre vues) |
| `__nograde` | `G3 = 0 ET absences = 0` | **dossier non renseigné** : 38 en mathématiques, 15 en portugais. Dans 100 % des cas, une note nulle s'accompagne de 0 absence, ce qui en fait une donnée manquante codée 0 |
| `__delta` | `G3 − G1`, vide pour un non-évalué | évolution sur l'année |
| `__trend` | `down` si Δ ≤ −2, `up` si Δ ≥ +2, sinon `flat` ; aucune pour un non-évalué | filtre de tendance (slope graph) |

Attributs dérivés **affichés** (justification et tâches servies : `docs/taches.md`, §2). Ils s'ajoutent aux 33 colonnes, qui ne sont jamais modifiées ; l'export CSV ne contient que les colonnes d'origine.

| Attribut | Définition | Type | Utilisé par |
|---|---|---|---|
| `pedu` | max(Medu, Fedu), 0 fusionné avec 1 : ≤ primaire / collège / lycée / sup. | ordinal (4) | axe, facette, profil, table |
| `alc` | arrondi de (5·Dalc + 2·Walc) / 7, niveaux 3 à 5 fusionnés : faible / modéré / élevé | ordinal (3) | axe, facette, profil, table |
| `absC` | absences ; vide pour un non-évalué | quantitatif | axe (repère « n. r. ») |
| `absCat` | 0 / 1–4 / 5–10 / > 10 créneaux ; 9 = « n. r. » pour un non-évalué | ordinal (4 + n. r.) | facette |
| `prog` | G3 − G1 ; vide pour un non-évalué ; domaine fixe −12…+12 | quantitatif | axe, fiche, table |
| `g3band` | < 10 / 10–13 / ≥ 14 ; vide pour un non-évalué | ordinal (3) | couleur des lignes, fiche |

Un fichier importé qui contient les colonnes sources reçoit les mêmes dérivés (`derivedKeysFor`).

### 0.5 Filtrage (`data.js` : `derive`)
Une seule chaîne de filtres est calculée **une fois par rendu** :

```
base ─(non évalués exclus par défaut, établissement, sexe)→ scoped
     ─(groupe cliqué dans un boxplot, tendance du slope graph)→ noBrush   ← matrice
     ─(brushes des coordonnées parallèles, en unités de données)→ selection ← tuiles, boxplots, slope, fiche, table
```

Deux variantes servent au *cross-filtering* :
- `exceptGroup` alimente le panneau de boxplot qui porte le filtre de groupe. Les autres groupes restent visibles, estompés.
- `exceptTrend` alimente le slope graph. Les tendances masquées restent en fond gris.

Exclure les non-évalués change les conclusions. Sur 395 élèves de mathématiques, r(absences, G3) = **+0,034** avec eux et **−0,213** sans eux (vérifié par `tools/test-stats.mjs`). L'exclusion est donc activée par défaut et **affichée** ; la case permet de les réinclure.

---

## 1. Coordonnées parallèles avec brushing (Quentin) · `views/parallelCoords.js`

| Étape | Contenu |
|---|---|
| **Données utilisées** | `scoped` (contexte) et `selection` (premier plan) |
| **Attributs éligibles** | liste `meta.AXIS_KEYS` (16 attributs) : binaires (établissement, sexe, domicile, soutien, vise le supérieur), ordinaux (pedu, trajet, temps d'étude, temps libre, sorties, alc, santé), quantitatifs (échecs, absC, prog, G3). Par défaut : pedu · temps d'étude · échecs · sorties · alc · absC · G3. G1 et G2 sont dans le slope graph. Les nominaux à plus de 3 modalités sont exclus, car leur ordre sur un axe serait arbitraire. Fichier importé non standard : quantitatifs, ordinaux et nominaux à ≤ 3 modalités |
| **Transformation** | une échelle par axe. Quantitatif : `scaleLinear`, sur le domaine fixe 0–20 pour G1, G2 et G3, sinon l'étendue arrondie. Ordinal ou nominal : `scalePoint` sur le domaine ordonné de `meta.d`, graduations = libellés de modalité (« lycée », « 2–5 h ») et non les codes |
| **Marques** | une polyligne par élève, dessinée sur **canvas** : 649 lignes sans saturer le DOM. Axes, graduations et brushes en SVG, par-dessus |
| **Canaux** | *position verticale* sur chaque axe = valeur de l'attribut<br>*teinte* = au choix : résultat (bleu ▲ réussite / orange ▼ échec / gris ✕ non évalué), bande de G3 (▲ solide / ● juste / ▼ échec), sexe ou établissement<br>*repère « n. r. »* sous l'axe = valeur manquante (non-évalué sur absC ou prog), jamais confondue avec 0<br>*opacité* = appartenance à la sélection. Le contexte est estompé, pas supprimé. L'opacité diminue quand l'effectif augmente (0,6 → 0,12)<br>*épaisseur + liseré + points* = élève sélectionné<br>*ligne pointillée « seuil 10 »* sur les axes de notes |
| **Vue** | axes équidistants, largeur minimale de 118 px par axe (défilement horizontal plutôt qu'écrasement), titres tronqués, titre complet au survol |
| **Interactions** | *brush* vertical sur chaque axe, converti en intervalle de valeurs (`pixelsToBrush`) et combiné en ET logique, **filtre global**<br>*glisser un titre* : réordonner les axes, car seules les paires adjacentes sont lisibles<br>*puces* : choisir les axes (les dérivés sont marqués « dér. », définition au survol)<br>*survol* : ligne la plus proche, interpolée entre les deux axes encadrants, avec info-bulle<br>*clic* : fiche élève<br>*sélecteur* : attribut de couleur<br>les axes ajoutés depuis la matrice sont surlignés |

## 2. Matrice de corrélation de Spearman (Jim) · `views/correlationMatrix.js`

| Étape | Contenu |
|---|---|
| **Données utilisées** | `noBrush`, c'est-à-dire les filtres de la barre, du groupe et de la tendance, **mais pas les brushes**. Brosser un intervalle restreint l'étendue d'une variable et atténue mécaniquement ρ (biais de restriction d'étendue) |
| **Attributs** | 12 attributs ordonnables **bruts** (`meta.MATRIX_KEYS`) : Medu, Fedu, trajet, temps d'étude, échecs, temps libre, sorties, Dalc, Walc, santé, absences, G3. Les paires redondantes restent séparées pour que leur redondance se lise (U4.1) ; G1 et G2 (ρ ≈ 0,9 avec G3), age et famrel sont retirés. Les nominaux sont exclus : une corrélation de rang n'a pas de sens sans ordre. `absences` est brute : réinclure les non-évalués change donc la cellule absences × G3 (U3.5) |
| **Transformation** | `stats.ranks` (rangs moyens pour les ex æquo, très nombreux sur des échelles 1–5), puis Pearson sur les rangs, soit ρ de Spearman, pour les 66 paires (`spearmanMatrix`). Les rangs de chaque variable sont calculés une seule fois. Une variance nulle donne « non calculable ». Le résultat est mis en cache tant que le sous-ensemble ne change pas |
| **Ordre** | thématique (famille → école → mode de vie → résultats), ou trié par \|ρ\| avec G3 (tâche U1.3 : hiérarchiser les facteurs associés) |
| **Marques** | une cellule carrée par paire, dans le **triangle inférieur**. La diagonale (ρ = 1) et le triangle supérieur (symétrique) sont omis |
| **Canaux** | *teinte divergente* : rouge (ρ < 0) ← gris neutre (0) → bleu (ρ > 0), interpolée en Lab. Le milieu est un gris, jamais une teinte<br>*texte signé* dans la cellule, en gras si \|ρ\| ≥ 0,3 : la couleur n'est jamais le seul canal<br>*contour aqua* = paire d'axes adjacents dans les coordonnées parallèles<br>*contour épais* = paire choisie |
| **Vue** | libellés de lignes à gauche, de colonnes en bas (inclinés), légende en rampe −1…+1, effectif n affiché en tête (⚠ si n < 10) |
| **Interactions** | *survol* ou *focus* : ρ, force qualitative (négligeable / faible / modérée / forte), n, rappel « association, pas causalité »<br>*clic* ou *Entrée* : ajoute les deux attributs comme **axes adjacents** des coordonnées parallèles, via leur dérivé (Medu → pedu, Dalc → alc, absences → absC) ; une paire fusionnée (Dalc × Walc) surligne l'axe dérivé<br>*flèches* : navigation clavier dans la grille (tabindex itinérant)<br>*sélecteur d'ordre* |

## 3. Small multiples de boxplots et strip plots de G3 (Alexandre) · `views/boxplots.js`

| Étape | Contenu |
|---|---|
| **Données utilisées** | `selection`. Le panneau qui porte le filtre de groupe utilise `exceptGroup` |
| **Attributs de facette** | liste `meta.PANEL_KEYS` (17 attributs, dont pedu, alc et absCat ; `paid` exclu car non comparable entre matières). Par défaut : échecs, vise le supérieur, éducation parentale, temps d'étude. Fichier importé non standard : ≤ 8 valeurs distinctes, notes exclues |
| **Transformation** | pour chaque facette et chaque modalité, `stats.boxStats` : Q1, médiane, Q3 (quantile de type 7), moustaches à 1,5 × IQR, moyenne, IC 95 % (1,96·s/√n), taux de réussite, part de la sélection. Par panneau : **écart des médianes** = plus haute − plus basse médiane des groupes d'au moins 10 élèves |
| **Marques** | rectangle Q1–Q3, trait de médiane, moustaches avec butées, un point par élève |
| **Canaux** | *position verticale* = G3 sur une **échelle commune 0–20** dans tous les panneaux, avec la ligne pointillée du seuil 10<br>*position horizontale* = modalité, dans l'ordre de `meta.d`<br>*teinte des points* = résultat (bleu / orange / gris)<br>*décalage horizontal* déterministe (`hash01`) : la note reste exacte et un élève ne « saute » pas d'un rendu à l'autre<br>*hachures + contour pointillé + « n=… ⚠ »* = groupe de moins de 10 élèves<br>*opacité réduite* = groupes hors du filtre de groupe<br>*point cerclé* = élève sélectionné |
| **Vue** | grille responsive de panneaux (small multiples), n total en tête de panneau, n par modalité sous l'axe |
| **Interactions** | *survol* d'une colonne : statistiques du groupe ; *survol* d'un point : l'élève<br>*clic* ou *Entrée* sur une colonne : **filtre global sur ce groupe**, rappelé dans la barre de filtres<br>*clic sur un point* : fiche élève<br>ajout et retrait de panneaux, affichage ou masquage des points<br>*ordre* : ordre d'ajout ou écart des médianes décroissant (hiérarchiser les facteurs, U1.3)<br>ⓘ dans le titre : définition d'un dérivé ou mise en garde (soutien scolaire : association inversée) |

## 4. Slope graph G1 → G2 → G3 et fiche élève (Gabriel) · `views/slopeGraph.js`, `views/detailPanel.js`

### 4a. Slope graph (vue d'ensemble)
| Étape | Contenu |
|---|---|
| **Données utilisées** | `exceptTrend` : les tendances non retenues sont dessinées en fond gris |
| **Transformation** | **agrégation** des trajectoires identiques : un faisceau par triplet (G1, G2, G3), avec son effectif. Par exemple 357 élèves de maths donnent 173 trajectoires distinctes. S'y ajoutent la trajectoire médiane de la sélection et la répartition baisse / stable / hausse |
| **Marques** | une polyligne à 3 points par faisceau, plus la ligne médiane en tirets |
| **Canaux** | *position verticale* = note, même échelle 0–20 sur les trois axes, seuil 10<br>*pente* = évolution<br>*épaisseur* = effectif du faisceau, en échelle racine carrée de 1 à 9 px<br>*teinte* = résultat final (même code que partout)<br>*opacité* = appartenance au filtre de tendance<br>*tirets* = non évalué<br>*trait épais cerné + valeurs écrites* = élève sélectionné |
| **Interactions** | boutons **Toutes / ▼ En baisse / ● Stables / ▲ En hausse**, avec les effectifs, **filtre global** (tâche U2.1)<br>*survol* d'un faisceau : trajectoire, n, numéros d'élèves<br>*clic* : fiche élève ; les clics successifs parcourent les élèves du faisceau |

### 4b. Fiche élève (niveau détail)
| Étape | Contenu |
|---|---|
| **Données utilisées** | l'élève sélectionné (`selectedId`), comparé à la `selection` |
| **Transformation** | quartiles de G1, G2 et G3 de la sélection (évalués seulement), rang centile de G3, nombre d'élèves de même trajectoire, Δ = G3 − G1 ; **profil** = mêmes valeurs d'échecs, temps d'étude, pedu, alc, vise le supérieur et même bande de G3 (`meta.PROFILE_KEYS`), compté dans le périmètre des filtres de la barre |
| **Marques** | bande Q1–Q3, ligne médiane en tirets, ligne et points de l'élève, liste des 33 attributs groupés par thème et libellés en clair |
| **Canaux** | *position verticale* = note 0–20, seuil 10 ; *teinte* = résultat de l'élève ; icônes ▲ ▼ ✕ ; bandeau d'avertissement si l'élève est non évalué ou hors sélection |
| **Interactions** | clic sur un élève dans **n'importe quelle vue** : ouvre la fiche ; ← / → : élève précédent ou suivant de la sélection ; ✕ : fermer<br>**Isoler ces élèves dans toutes les vues** : pose un brush par attribut du profil dans les coordonnées parallèles (U2.5)<br>*Autres attributs du fichier* : les 15 attributs non analysés, repliés (les 33 restent accessibles, U2.2) |

---

## 5. Vues de support
- **Tuiles** (`statTiles.js`) : n affiché, **médiane** de G3 (moyenne en sous-texte), taux de réussite (k / n), calculés sur la sélection et limités aux élèves évalués.
- **Table** (`table.js`), repliée par défaut : 11 colonnes (`meta.TABLE_COLS`), valeurs exactes, tri par colonne, navigation au clavier (Tab, ↑ ↓, Entrée), export CSV de la sélection (33 colonnes d'origine). Liste nominative de U2.4.
- **Lien permanent** (`permalink.js`) : l'état (matière, filtres, brushes, axes, couleur, panneaux, ordre, élève) est écrit dans le fragment de l'URL et relu au chargement ; bouton « Copier le lien de cette vue ». Couvre U4.5 avec l'export CSV.

## 6. Couleurs
| Rôle | Clair | Sombre | Règle |
|---|---|---|---|
| Réussite ▲ | `#2a78d6` | `#3987e5` | teinte catégorielle 1, toujours avec une icône |
| Échec ▼ | `#eb6834` | `#d95926` | teinte catégorielle 2 (bleu/orange lisible par les daltoniens, contrairement à rouge/vert) |
| Bande « juste » ● (10–13) | `#93b8e3` | `#4f6f96` | bleu atténué, entre ▲ et ▼ (option « Bande de G3 », toujours avec icône) |
| Non évalué ✕ | `#7a7872` | `#95938c` | gris neutre |
| ρ < 0 / 0 / ρ > 0 | `#c43d3d` / `#f0efec` / `#1c5cab` | `#e66767` / `#383835` / `#5598e7` | divergente à milieu gris, interpolation Lab |

Toutes les couleurs sont des variables CSS relues à chaque rendu, si bien que canvas et SVG suivent le thème (auto / clair / sombre).
