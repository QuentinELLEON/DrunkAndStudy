# Student Alcohol Consumption, tâches et visualisations

Ce document relie les 10 tâches de la spécification aux 4 visualisations du projet, en disant pour chacune ce qu'elle cherche à représenter, ce qu'elle permet de comprendre et ce qu'on y lit sur les données. Par rapport à `rendu1`, les coordonnées parallèles deviennent des ensembles parallèles, et les small multiples de boxplots et le slope graph laissent la place à un sunburst et à un graphe de similarité. Boxplot et trajectoire G1, G2, G3 restent présents sous forme de panneaux de détail liés aux vues. Les chiffres sont calculés sur les élèves évalués (357 en maths, 634 en portugais), donnés dans l'ordre maths puis portugais.

## Les 4 visualisations

| Visu | Technique | Membre | Données prises en charge |
|---|---|---|---|
| A | Ensembles parallèles (Parallel Sets) | Quentin ELLEON | Attributs catégoriels et ordinaux, les quantitatifs étant découpés en classes |
| B | Matrice de corrélation (heatmap) | Jim LAINEL | Quantitatifs et ordinaux (Spearman) |
| C | Sunburst | Alexandre LARGUECH | Hiérarchie de catégories, avec effectif et taux de réussite |
| D | Graphe de similarité d'élèves | Gabriel LOIRAT | Tous types d'attributs, via une distance de Gower |

## Ce que chaque visualisation cherche à montrer

| Visu | Ce qu'on cherche à représenter | Ce qu'on cherche à comprendre | Lisibilité prévue |
|---|---|---|---|
| A Ensembles parallèles | La répartition des élèves à travers plusieurs attributs catégoriels à la suite (école, sexe, milieu, `alc`, `absCat`, `risque`, `tendance`, `reussite`), avec des bandes dont la largeur est proportionnelle au nombre d'élèves | Quels enchaînements de catégories concentrent l'échec et le décrochage | Zoom par clic sur une catégorie (on ne garde que ces élèves, le diagramme est réétalonné, un fil d'Ariane permet de revenir). Survol avec *n* et % de réussite, axes déplaçables |
| B Matrice de corrélation | La force et le sens du lien entre chaque paire d'attributs ordonnables | Quels facteurs montent ou baissent avec G3, et lesquels se répètent entre eux | Échelle divergente centrée sur 0 (bleu positif, rouge négatif, blanc proche de 0) avec légende de −1 à +1. Valeur et signe écrits dans chaque cellule, cellules très faibles grisées (« pas de lien net »), info-bulle en phrase simple, clic sur une cellule pour voir le nuage de points de la paire |
| C Sunburst | La population emboîtée en trois niveaux au plus (par défaut école, sexe, risque, ordre modifiable), taille = nombre d'élèves, couleur = taux de réussite | Où se concentre l'échec et quel poids a chaque groupe | Zoom par clic sur un secteur, *n* affiché, secteurs de moins de 10 élèves hachurés |
| D Graphe de similarité | Un nœud par élève, relié à ses 5 plus proches voisins sur le profil (`failures`, `absences`, `studytime`, `traveltime`, `goout`, `alc`, `pedu`, `school`, `sex`, `address`, `higher`, sans les notes), couleur = réussite ou tendance au choix | Si des élèves qui se ressemblent par leur profil réussissent pareil, et où sont les élèves à risque ou atypiques | 5 voisins seulement pour éviter la pelote, clic sur un nœud pour ouvrir la fiche, filtrage par la sélection des autres vues |

**Panneaux de détail liés.** Ils ne comptent pas comme une technique et s'ouvrent quand on sélectionne quelque chose dans une des 4 vues. Le premier montre la distribution de G3 de la sélection (boxplot, médiane, *n*). Le deuxième montre la trajectoire G1, G2, G3 de l'élève sélectionné. Le troisième est la fiche élève, avec tous ses attributs à côté de la médiane de son école et de sa matière.

**Attribut ajouté.** Les ensembles parallèles ne travaillent que sur des catégories, donc `prog` (G3 moins G1) est découpé en `tendance` avec trois valeurs, baisse (au moins 2 points de moins), hausse (au moins 2 points de plus) et stable. Cela donne 34 / 20 élèves en baisse, 245 / 461 stables et 78 / 153 en hausse.

## Tâches × visualisations

✔ désigne la technique principale de la tâche, ○ une technique secondaire, et \* une liaison entre vues à ajouter (détaillée plus bas).

| Tâche | A Ensembles parallèles | B Matrice de corrélation | C Sunburst | D Graphe de similarité | Comment les visus réalisent la tâche |
|---|:-:|:-:|:-:|:-:|---|
| U1-1 facteurs liés à G3 bas | ○ | ✔ | | | Matrice triée par valeur absolue de ρ avec G3 pour le classement, et bandes vers `reussite` dans A pour voir où se concentre l'échec |
| U1-2 comparer G3 entre sous-groupes | ○ | | ✔ | | Secteurs par école, sexe et milieu avec taux de réussite et *n*, bascule maths et portugais. Le panneau de détail donne la distribution de G3 du groupe |
| U1-3 élèves à facteurs de risque cumulés | ✔ | | ○ | ○ | Zoom sur la catégorie `risque` 2 et plus dans A avec l'effectif affiché. Les mêmes élèves sont surlignés dans C et dans D |
| U1-4 profil d'un élève | ○ \* | | | ✔ | Clic sur un nœud de D ouvre la fiche, qui compare l'élève à son école et sa matière. Son chemin est surligné dans A |
| U1-5 décrochage G1, G2, G3 | ✔ | | | ○ | Axe `tendance` dans A relié à `risque`, nœuds de D colorés par tendance. Le panneau de trajectoire montre la courbe de chaque élève |
| U2-1 répartition des notes | ○ | | ✔ | | Le sunburst entier montre le poids de chaque groupe et son taux de réussite. Le panneau de détail donne la médiane et la distribution |
| U2-2 situer un profil saisi | | | ○ | ✔ \* | Le profil saisi apparaît comme un nœud fictif relié à ses 5 plus proches voisins, on voit combien d'entre eux réussissent |
| U2-3 sorties, alcool et notes | ✔ | ○ | | | Axes `goout` et `alc` reliés à `reussite` dans A, avec *n* par bande. La matrice n'est lisible par U2 que très réduite |
| U2-4 profil à risque contre protégé | ✔ | | ○ | | Bandes `risque` 0 contre 2 et plus vers `reussite` dans A. Les secteurs correspondants sont colorés dans C |
| U2-5 faire varier un facteur | ✔ \* | | ○ | | Des curseurs sur `studytime` et `goout` posent des filtres dans A, et une tuile affiche la note moyenne et *n* de la sélection |

## Ce qu'on lit, tâche par tâche

| Tâche | Ce que la visualisation permet de voir |
|---|---|
| U1-1 | Hors G1 et G2, le premier facteur est `failures` (ρ −0,30 / −0,43), puis `absences` (−0,24) en maths, et l'éducation de la mère (+0,29) puis `studytime` (+0,26) en portugais. Dans A, 35 % / 47 % des élèves sous 10 ont déjà échoué au moins une fois, contre 12 % / 9 % des autres |
| U1-2 | Le taux de réussite de GP est de 75 % contre 69 % pour MS en maths (MS ne compte que 42 élèves), et de 93 % contre 75 % en portugais. Les garçons réussissent plus en maths (77 % contre 72 %) et moins en portugais (84 % contre 89 %), ce qui disparaît si on mélange les matières. Le milieu rural est 4 à 7 points en dessous (71 % contre 75 %, 82 % contre 89 %) |
| U1-3 | Les élèves à 2 facteurs de risque ou plus sont 42 en maths et 67 en portugais. Leur taux de réussite est de 43 % / 58 % contre 81 % / 94 % pour ceux qui n'en ont aucun, et leur médiane de G3 de 9 / 10 contre 12 / 13 |
| U1-4 | Si un élève s'écarte de la médiane de son groupe (13 pour GP en portugais contre 11 pour MS), et quels élèves lui ressemblent |
| U1-5 | Le décrochage touche 9,5 % / 3,2 % des élèves. En maths il est plus de trois fois plus fréquent chez les élèves à risque 2 et plus (19 % contre 5,5 %), alors qu'en portugais l'écart est faible (6 % contre 3 %) |
| U2-1 | La note habituelle est de 11 en maths et 12 en portugais, et 74 % / 87 % des élèves dépassent 10/20 |
| U2-2 | Combien des 5 élèves les plus proches du profil saisi réussissent. À garder en tête, des élèves au profil proche ont des notes à peine plus proches que des élèves tirés au hasard (écart de G3 de 3,3 contre 3,6 en maths, 2,5 contre 3,1 en portugais) |
| U2-3 | Le taux de réussite baisse avec l'alcool (78 %, 74 %, 62 % en maths, 90 %, 84 %, 80 % en portugais) et avec les sorties, nettement en maths (84 % à 2 sorties, 62 % à 4 et 5) et plus faiblement en portugais (de 90 % à 78 %) |
| U2-4 | Un taux de réussite de 43 % / 58 % pour risque 2 et plus contre 81 % / 94 % pour risque 0, avec des médianes de G3 de 9 contre 12 en maths et de 10 contre 13 en portugais |
| U2-5 | En portugais la note moyenne passe de 11,3 à 13,2 entre le niveau 1 et le niveau 3 de `studytime`. En maths le lien est irrégulier (11,5, 11,1, 12,6) et le niveau 4 ne compte que 24 élèves |

## Synthèse

| | A | B | C | D |
|---|:-:|:-:|:-:|:-:|
| Tâches ✔ | 5 | 1 | 2 | 2 |
| Tâches ○ | 4 | 1 | 4 | 2 |
| Seule technique principale sur | U1-3, U1-5, U2-3, U2-4, U2-5 | U1-1 | U1-2, U2-1 | U1-4, U2-2 |

Les 10 tâches ont une technique principale, et chaque visu est la seule principale sur au moins une tâche, donc aucune n'est redondante.

## Liaisons à ajouter entre les vues

Quatre liaisons relient les vues entre elles. La sélection est partagée, ce qui veut dire qu'un clic dans A, C ou D filtre ou surligne les mêmes élèves dans les autres vues et alimente les panneaux de détail (U1-3, U1-4). Des curseurs sur `studytime` et `goout` posent des filtres dans A (U2-5). La saisie d'un profil ajoute un nœud fictif dans D, relié à ses 5 plus proches voisins (U2-2). Enfin le clic sur une cellule de B ouvre le nuage de points de la paire, où le signe du lien se voit à l'œil.

## Points à surveiller

A porte 5 tâches principales, c'est la visu la plus chargée, et la qualité du zoom y est décisive. B ne porte qu'une tâche principale. Ça suffit pour la consigne, mais c'est la plus fragile, et on peut la renforcer en la faisant recalculer sur la sélection de A.

Dans C, trois niveaux au maximum. Avec école, sexe et risque on obtient 11 groupes dont 3 sous 10 élèves en maths (le plus petit en compte 3), d'où les secteurs hachurés. Le sunburst recoupe en partie A, la différence étant la hiérarchie emboîtée et la lecture des proportions.

Dans D, le résultat est honnête mais peu spectaculaire, puisque le profil seul prédit mal la note. Les groupes de profils ont tout de même des médianes de G3 qui vont de 10 à 13 en maths et de 10 à 14 en portugais. À 357 ou 634 nœuds, il faut limiter le nombre de liens pour éviter une pelote illisible.

Les données sont observationnelles et en partie auto-déclarées, donc ce que les visus montrent reste une association et jamais une cause. Les groupes de moins de 10 élèves doivent toujours être signalés.

---

## Conteneurs de la page (`index.html`)

Chaque visualisation a un conteneur vide dans `index.html`, dessiné par son module. Les identifiants sont stables : on ne les renomme pas sans mettre à jour ce tableau, [`architecture.md`](architecture.md) et l'issue correspondante.

| Visu | Conteneur (`id`) | `data-viz` | Type de graphique | Module | Membre |
|---|---|---|---|---|---|
| A | `viz-parallel-sets` | `parallel-sets` | ensembles parallèles | `js/views/parallelSets.js` | Quentin ELLEON |
| B | `viz-correlation-matrix` | `correlation-matrix` | heatmap (triangle inférieur) | `js/views/correlationMatrix.js` | Jim LAINEL |
| C | `viz-sunburst` | `sunburst` | sunburst | `js/views/sunburst.js` | Alexandre LARGUECH |
| D | `viz-similarity-graph` | `similarity-graph` | graphe nœuds-liens | `js/views/similarityGraph.js` | Gabriel LOIRAT |
| Panneau 1 | `viz-selection-boxplot` | `selection-boxplot` | boxplot | `js/views/selectionBox.js` | à répartir |
| Panneau 2 | `viz-student-trajectory` | `student-trajectory` | courbe à 3 points | `js/views/studentTrajectory.js` | à répartir |
| Panneau 3 | `viz-pair-scatter` | `pair-scatter` | nuage de points | `js/views/pairScatter.js` | Jim LAINEL (lié à B) |

La fiche élève (tableau) n'est pas une visualisation : elle est dans `js/controls/studentCard.js`.

Formats de données : [`data-contracts.md`](data-contracts.md). Règles de travail : [`conventions.md`](conventions.md).

## A. Ensembles parallèles

- **Conteneur** : `#viz-parallel-sets`.
- **Données** : élèves de la sélection privée de ses propres zooms ; dimensions catégorielles `school`, `sex`, `address`, `alc`, `absCat`, `risque`, `tendance`, `reussite` (dernier axe fixe) ; quantitatifs déjà découpés en classes.
- **Encodage** : segment = catégorie, hauteur proportionnelle à *n* ; ruban = croisement de deux catégories voisines, largeur proportionnelle à *n* ; teinte = réussite ou échec.
- **Interactions** : zoom par clic avec fil d'Ariane, survol (*n*, % de réussite), axes ajoutables, retirables et déplaçables, chemin de l'élève sélectionné, curseurs `studytime` et `goout` du panneau.
- **Tâches** : ✔ U1-3, U1-5, U2-3, U2-4, U2-5 ; ○ U1-1, U1-2, U1-4, U2-1.
- **Points de vigilance** : c'est la visu la plus chargée, la qualité du zoom y est décisive ; au plus 5 axes.

## B. Matrice de corrélation

- **Conteneur** : `#viz-correlation-matrix` (et `#viz-pair-scatter` pour le nuage de points).
- **Données** : ρ de Spearman entre 12 attributs ordonnables, recalculé sur la sélection ; G1 et G2 masqués par défaut.
- **Encodage** : cellule colorée sur une échelle divergente centrée sur 0 (bleu positif, rouge négatif), valeur écrite, cellules très faibles grisées.
- **Interactions** : clic sur une cellule → nuage de points de la paire ; info-bulle en phrase simple.
- **Tâches** : ✔ U1-1 ; ○ U2-3.
- **Points de vigilance** : une seule tâche principale, c'est la vue la plus fragile ; la renforcer en la recalculant sur la sélection de A.

## C. Sunburst

- **Conteneur** : `#viz-sunburst`.
- **Données** : hiérarchie dérivée de 3 attributs au plus (défaut `school`, `sex`, `risque`, ordre modifiable), avec *n* et nombre de réussites par nœud.
- **Encodage** : angle = *n*, couleur = taux de réussite centré sur la moyenne, hachures si *n* < 10.
- **Interactions** : zoom par clic, retour par le centre, survol (chemin, *n*, % de réussite).
- **Tâches** : ✔ U1-2, U2-1 ; ○ U1-3, U2-4, U2-5.
- **Points de vigilance** : trois niveaux au maximum ; recoupe en partie A, la différence étant la hiérarchie emboîtée.

## D. Graphe de similarité

- **Conteneur** : `#viz-similarity-graph`.
- **Données** : un nœud par élève, relié à ses 5 plus proches voisins (distance de Gower) sur `failures`, `absences`, `studytime`, `traveltime`, `goout`, `alc`, `pedu`, `school`, `sex`, `address`, `higher`, sans les notes.
- **Encodage** : couleur = réussite ou tendance au choix ; profil saisi = nœud fictif relié à ses 5 voisins.
- **Interactions** : clic sur un nœud = fiche ; survol = voisins ; filtrage par la sélection des autres vues.
- **Tâches** : ✔ U1-4, U2-2 ; ○ U1-3, U1-5.
- **Points de vigilance** : résultat honnête mais peu spectaculaire (le profil seul prédit mal la note) ; à 357 ou 634 nœuds, limiter les liens.

## Panneaux de détail liés

Ils s'ouvrent quand on sélectionne quelque chose dans une des 4 vues. Ils ne comptent pas comme une technique.

| Panneau | Conteneur | Contenu |
|---|---|---|
| Distribution de G3 de la sélection | `#viz-selection-boxplot` | boxplot, médiane, *n* |
| Trajectoire G1, G2, G3 | `#viz-student-trajectory` | courbe de l'élève sélectionné contre la médiane de son école |
| Fiche élève | `js/controls/studentCard.js` | tous les attributs à côté de la médiane de son école et de sa matière |
| Nuage de points de la paire | `#viz-pair-scatter` | ouvert par un clic dans B |

## Liaisons entre vues (état partagé)

| Liaison | État | Détail |
|---|---|---|
| Zoom de A ou de C | `state.drill` | contrainte appliquée à toutes les vues, puce dans le panneau de sélection |
| Curseurs `studytime`, `goout` | `state.slide` | filtres dans A, tuile avec note moyenne et *n* |
| Nœud de D, point, ligne | `state.selectedId` | fiche et trajectoire, chemin tracé dans A |
| Cellule de B | `state.mxPair` | nuage de points |
| Profil saisi | `state.ghost` | nœud fictif dans D |

## Chiffres de contrôle

Maths / portugais : 35 % / 47 % des élèves sous 10 ont déjà échoué contre 12 % / 9 % ; risque 2 et plus 42 / 67 élèves, 43 % / 58 % de réussite, médiane de G3 9 / 10 ; tendance baisse / stable / hausse 34 / 245 / 78 et 20 / 461 / 153 ; temps d'étude 1 → 3 : moyenne 11,5 → 12,6 et 11,3 → 13,2.

> **À revérifier.** Écart de G3 entre voisins et entre élèves au hasard : le document de référence (ci-dessus) donne 3,3 contre 3,6 en maths et 2,5 contre 3,1 en portugais. Le calcul de l'ancien `tools/test-stats.mjs` donnait 3,34 contre 3,65 et 2,47 contre 3,03. Le document de référence fait foi ; relancer le calcul avec les 5 voisins avant d'afficher ces chiffres.
