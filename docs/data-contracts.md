# Contrats de données

Ce document fixe les formats échangés entre `data.js`, `state.js`, `stats.js` et les vues. Les chiffres de référence sont ceux de [`visualisations.md`](visualisations.md) : élèves **évalués**, 357 en maths et 634 en portugais, dans cet ordre.

## 1. Élève (ligne de données typée)

Une ligne par élève dans une matière. Les 33 colonnes d'origine gardent leur code brut (`GP`, `at_home`, `yes`…). Les deux matières ne sont jamais fusionnées.

### Attributs dérivés ajoutés par `data.js`

Les valeurs ci-dessous sont les **codes stockés**. Les libellés français vivent dans `meta.js`. Un élève non évalué a `null` pour tous les dérivés qui dépendent des notes.

| Attribut | Type | Valeurs stockées | Définition |
|---|---|---|---|
| `__i` | nombre | 0, 1, … | index de ligne, identifiant stable (`state.selectedId`) |
| `__nograde` | booléen | `true` / `false` | `G3 = 0` et `absences = 0` : dossier non renseigné (38 en maths, 15 en portugais) |
| `reussite` | nominal | `"oui"` / `"non"` / `null` | `G3 ≥ 10` |
| `risque` | ordinal | `0`, `1`, `2` / `null` | nombre de facteurs parmi : au moins 1 échec passé, plus de 10 absences, trajet de 30 min ou plus, ne vise pas le supérieur ; 2, 3 et 4 sont réunis en `2` (« 2 ou plus ») |
| `pedu` | ordinal | `1`..`4` | `max(Medu, Fedu)`, 0 réuni avec 1 : primaire ou moins, collège, secondaire, supérieur |
| `alc` | ordinal | `1`, `2`, `3` | `round((5·Dalc + 2·Walc) / 7)`, niveaux 3 à 5 réunis : faible, modéré, élevé |
| `absCat` | ordinal | `0`..`3` / `null` | absences : 0, 1 à 4, 5 à 10, plus de 10 ; `null` pour un non-évalué (jamais un 0 artificiel) |
| `prog` | quantitatif | entier / `null` | `G3 − G1` |
| `tendance` | nominal | `"baisse"` / `"stable"` / `"hausse"` / `null` | `prog ≤ −2` baisse, `prog ≥ +2` hausse, sinon stable. Valeurs : 34 / 245 / 78 en maths, 20 / 461 / 153 en portugais |

> **À valider avec l'équipe.** Le prototype `VisuMaquetteData.html` stockait des libellés français (`"réussite"`, `"2 et plus"`, `"non renseigné"`). Le contrat ci-dessus préfère des codes stables sans accent, avec les libellés dans `meta.js`. Si l'équipe préfère garder les libellés, il suffit de modifier ce tableau avant de commencer le code.

### Domaines ordonnés (`meta.js`)

Chaque attribut catégoriel ou ordinal expose `meta.dims[attr] = { label, order, name, short? }` :

- `order` : modalités dans l'ordre d'affichage ;
- `name[value]` : libellé complet français ;
- `short[value]` : libellé court (facultatif).

Les dimensions utilisées par les vues :

| Vue | Constante de `meta.js` | Contenu |
|---|---|---|
| A | `PSET_DEFAULT`, `PSET_DIMS` | défaut `school, sex, address, alc, absCat, risque, tendance, reussite` ; ajoutables : `studytime, traveltime, pedu, higher, failures, goout` |
| B | `MATRIX_KEYS` | `G3, G2, G1, failures, absences, studytime, traveltime, goout, Dalc, Walc, Medu, Fedu` |
| C | `SUN_DEFAULT`, `SUN_DIMS` | défaut `school, sex, risque` ; possibles `school, sex, address, risque, alc, higher, absCat, pedu` |
| D | `SIMILARITY_KEYS`, `NEIGHBORS` | `failures, absences, studytime, traveltime, goout, alc, pedu, school, sex, address, higher` ; `NEIGHBORS = 5` |

## 2. État partagé (`state.js`)

```js
{
  ds: "mat" | "por",          // matière active
  inclNE: false,              // inclure les non-évalués
  drill: [{ dim, value, src }],   // contraintes posées par un clic ; src ∈ "pset" | "sun"
  slide: { studytime?: 1..4, goout?: 1..5 },  // curseurs du panneau
  selectedId: null | number,  // __i de l'élève ouvert dans la fiche
  mxPair: null | [attrA, attrB],  // paire cliquée dans B
  ghost: null | { failures, absences, studytime, traveltime, goout, alc, pedu, school, sex, address, higher },
  colorBy: "reussite" | "tendance",   // couleur des nœuds de D
  psetAxes: [dim, …],         // axes de A, dans l'ordre (le dernier est toujours "reussite")
  sunLevels: [dim, dim?, dim?],  // niveaux de C, 3 au plus
  matrixShowG: false          // afficher G1 et G2 dans B
}
```

`setState(patch)` fusionne le patch et émet `change`. Les filtres sont exprimés en **unités de données** (une dimension et une modalité), jamais en pixels, pour que toute vue puisse les appliquer.

## 3. Sous-ensembles dérivés (`derived`)

Calculés une fois par rendu par `data.derive(rows, state)` :

| Clé | Contenu | Utilisé par |
|---|---|---|
| `base` | élèves de la matière, non-évalués exclus sauf `inclNE` | tuiles (comparaison), fiche (médianes de l'école), D (disposition) |
| `selection` | `base` filtré par `drill` et `slide` | B, tuiles, panneau 1, panneau 3, opacité dans D |
| `exceptSrc(src)` | `selection` sans les contraintes de `drill` dont `src` vaut `src` | C (`"sun"`) ; disponible pour toute vue qui doit rester entière malgré son propre zoom |
| `selected` | l'élève de `state.selectedId`, ou `null` | fiche, panneau 2, chemin dans A |

## 4. Contrats par visualisation

Chaque contrat donne l'entrée, la structure à calculer et la sortie visuelle attendue. Les calculs sont dans `stats.js` ou dans le module de la vue.

### A. Ensembles parallèles · `#viz-parallel-sets`

- **Entrée** : `derived.selection` (les zooms posés par A y sont inclus : le diagramme est réétalonné sur les élèves gardés), `state.psetAxes`, `derived.selected`.
- **Structure** :
  ```js
  {
    axes: [dim, …],                         // 3 à 5 axes, "reussite" en dernier
    segments: { [dim]: [{ value, n, ok }] },   // n élèves, ok = nombre de réussites
    bands: [{ a, b, va, vb, reussite, n }]  // un ruban par (modalité a, modalité b, résultat)
  }
  ```
- **Visuel** : segment = catégorie (hauteur ∝ n), ruban de largeur ∝ n, bleu si `reussite = "oui"`, orange sinon.
- **Interactions** : clic segment → `setState({ drill })` avec `src: "pset"` ; survol → `n` et `% de réussite` ; ajout / retrait / ordre des axes → `psetAxes` ; chemin de l'élève `selected` en pointillés.
- **Limites** : 5 axes au maximum ; une catégorie vide est omise.

### B. Matrice de corrélation · `#viz-correlation-matrix`

- **Entrée** : `derived.selection`, `meta.MATRIX_KEYS`, `state.matrixShowG`.
- **Structure** : `cells: [{ a, b, rho, n }]` pour le triangle inférieur, `rho` de Spearman (rangs moyens pour les ex æquo), `NaN` si un attribut est constant. Ordre des lignes : valeur absolue de `rho` avec G3 décroissante.
- **Visuel** : échelle divergente centrée sur 0, bleu positif, rouge négatif, blanc proche de 0 ; légende de −1 à +1 ; valeur et signe écrits dans la cellule ; cellules sous le seuil de signification grisées (« pas de lien net »).
- **Seuil proposé** : `|ρ| < 1,96 / √(n − 1)` (celui du prototype) ; sous 30 élèves, la matrice n'est pas calculée et un message l'explique. *À confirmer : [`visualisations.md`](visualisations.md) dit seulement « très faibles grisées ».*
- **Interactions** : clic cellule → `setState({ mxPair: [a, b] })` ; info-bulle en phrase (« Quand X augmente, Y a tendance à augmenter »).

### C. Sunburst · `#viz-sunburst`

- **Entrée** : `derived.exceptSrc("sun")`, `state.sunLevels`.
- **Structure** : arbre `{ key, dim, n, ok, children }` construit avec `d3.group` puis `d3.hierarchy` et `d3.partition`. Tri des enfants selon `meta.dims[dim].order`.
- **Visuel** : angle ∝ `n` ; couleur = taux de réussite sur une échelle divergente centrée sur la moyenne de `base` ; secteurs `n < 10` hachurés.
- **Interactions** : clic secteur → `setState({ drill })` avec `src: "sun"` pour tous les ancêtres du secteur ; clic au centre → retire les contraintes `src: "sun"` ; survol → chemin complet, `n`, `% de réussite`.
- **Limites** : trois niveaux au plus ; un niveau déjà fixé par `drill` est retiré de l'anneau.

### D. Graphe de similarité · `#viz-similarity-graph`

- **Entrée** : `derived.base` (calcul du graphe et disposition), `derived.selection` (opacité), `state.colorBy`, `state.ghost`.
- **Structure** :
  ```js
  {
    nodes: [{ i, id, x, y, ok, tendance }],        // un nœud par élève
    links: [{ source, target, d }]                 // 5 plus proches voisins, sans doublon
  }
  ```
  Distance de Gower sur `meta.SIMILARITY_KEYS` : quantitatifs et ordinaux normalisés par leur étendue, nominaux à 0 ou 1, moyenne sur les attributs. Les notes n'entrent jamais dans la distance. Disposition `d3.forceSimulation` calculée une fois, mise en cache par (`ds`, `inclNE`).
- **Visuel** : nœud coloré par réussite ou tendance (au choix) ; nœud fictif en losange pour `ghost`, relié à ses 5 voisins.
- **Interactions** : clic nœud → `setState({ selectedId })` ; survol → voisins éclairés ; zoom et déplacement à la molette ; nœuds hors `selection` estompés.
- **Texte calculé** : « Entre voisins, la note finale diffère de X points, contre Y entre deux élèves pris au hasard » (voir `visualisations.md`, tâche U2-2).
- **Limites** : 357 ou 634 nœuds, 5 voisins seulement pour éviter la pelote. La position à l'écran n'a pas de valeur métrique.

### Panneau 1 · `#viz-selection-boxplot`

- **Entrée** : `derived.selection` et `derived.base`.
- **Structure** : `{ all: {n, q1, med, q3, min, max}, sel: {…} }` sur `G3` (`d3.quantile`).
- **Visuel** : boxplot horizontal, axe 0 à 20, seuil 10 en pointillés, médiane et `n` écrits ; deux boîtes si la sélection est un sous-ensemble.

### Panneau 2 · `#viz-student-trajectory`

- **Entrée** : `derived.selected` et la médiane de `G1`, `G2`, `G3` des élèves de `base` dans la même école.
- **Visuel** : deux courbes à trois points (élève, médiane de l'école), axe 0 à 20, seuil 10.

### Panneau 3 · `#viz-pair-scatter`

- **Entrée** : `derived.selection`, `state.mxPair`.
- **Visuel** : nuage de points (jitter léger pour les ordinaux), courbe des médianes de b par valeur ou classe de a, axes étiquetés ; `rho` et `n` dans le texte.

### Fiche élève · `js/controls/studentCard.js`

Tableau `attribut | élève | typique de l'école` pour G3, G2, G1, tendance, risque, échecs, absences, temps d'étude, trajet, sorties, alcool, éducation des parents, études supérieures. « Typique » = médiane pour les quantitatifs, valeur la plus fréquente pour les catégories, dans la même école et la même matière.

## 5. Règles transversales

- n est affiché partout où un agrégat apparaît ; tout groupe de moins de 10 élèves est signalé.
- Les phrases parlent d'association, jamais de cause.
- L'axe de G3 va toujours de 0 à 20 avec le seuil de 10.
