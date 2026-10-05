# Projet Visualisation de l'information, Données, utilisateurs et tâches
**Groupe.** Quentin ELLEON, Jim LAINEL, Alexandre LARGUECH, Gabriel LOIRAT

## 1. Jeu de données

**Student Alcohol Consumption** (Kaggle, miroir du dataset UCI *Student Performance*, Cortez & Silva, 2008). Questionnaires et bulletins de deux lycées portugais (Gabriel Pereira, Mousinho da Silveira), année 2005–2006.

Le jeu de données comprend deux tables de même structure, une pour les mathématiques (395 élèves) et une pour le portugais (649 élèves), 33 attributs, aucune valeur manquante. Dans la taxonomie de Munzner, c'est une table où chaque item est un élève dans une matière donnée.

Les 33 attributs se répartissent en trois types, 17 nominaux (sexe, école, milieu urbain/rural, métier des parents, soutien scolaire, projet d'études supérieures…), 10 ordinaux sur des échelles 1–5 ou 0–4 (éducation des parents, temps d'étude, sorties, consommation d'alcool, santé…), et 6 quantitatifs (âge, échecs passés, absences, notes G1, G2, G3 sur 20). Près de la moitié des attributs ne sont donc pas ordonnables, ce qui pèse directement sur le choix des techniques (§4).

Quelques limites à noter. 53 élèves ont G3 = 0 et 0 absence, mais ce sont en réalité des élèves non évalués codés par défaut, pas de vraies notes nulles, il faudra pouvoir les exclure de l'analyse. Alcool, sorties et temps d'étude sont auto-déclarés, donc sujets à un biais de déclaration. Les données étant observationnelles, on ne montre que des associations, jamais des causes. Et comme c'est un historique anonymisé, l'outil reste un démonstrateur pédagogique, pas un vrai outil de suivi d'élèves.

Pour ne pas surcharger l'écran, les vues n'affichent que les attributs utiles à une tâche ; les autres restent consultables dans la fiche élève. Six attributs sont dérivés : `reussite` (G3 ≥ 10), `risque` (nombre de facteurs parmi « au moins 1 échec passé », « plus de 10 absences », « trajet de 30 min ou plus », « ne vise pas le supérieur »), `pedu` (éducation parentale maximale), `alc` (indice d'alcool en 3 niveaux), `absCat` (absences en classes) et `prog` (G3 − G1). Le détail est dans `docs/taches.md`.

## 2. Utilisateurs

| Profil | Expertise du domaine | Littératie en visualisation | Besoin |
|---|---|---|---|
| **U1, Équipe pédagogique** (enseignants, CPE, direction) | Élevée | Moyenne | Repérer les profils à risque, décider où placer le soutien. Travaille sur des élèves identifiables. |
| **U2, Parents / élèves** | Faible | Faible | Comprendre ce qui est associé à la réussite, dans une logique de prévention. Besoin de vues simples, d'un vocabulaire non technique, de l'effectif *n* toujours affiché, et d'aucune comparaison nominative. |

## 3. Tâches visuelles / analytiques (action → cible, Munzner)

Le gras indique l'utilisateur principal de chaque tâche. Les chiffres sont calculés sur les élèves évalués (357 en maths, 634 en portugais).

| ID | Tâche | Action → cible | Attributs | Utilisateurs | Critère de réussite |
|---|---|---|---|---|---|
| U1-1 | Quels facteurs sont le plus associés à une note finale basse (G3 inférieure à 10) ? | Discover → correlation | G3, failures, absences, studytime, traveltime, goout, alc, pedu | **U1** | Cite les 3 premiers facteurs de la matière choisie, hors G1 et G2, avec le sens du lien |
| U1-2 | Comparer la distribution de G3 entre sous-groupes (sexe, école, milieu, matière) | Compare → distribution | G3, sex, school, address | **U1** | Lit la médiane et l'effectif de chaque groupe, sans jamais mélanger les deux matières |
| U1-3 | Isoler les élèves qui cumulent plusieurs facteurs de risque | Locate → outliers | failures, absences, traveltime, higher, risque | **U1** | Obtient en quelques manipulations les élèves à risque 2 et plus (42 en maths, 67 en portugais), avec l'effectif exact |
| U1-4 | Consulter le profil d'un élève et le situer par rapport à la moyenne de son école et de sa matière | Lookup → features | Tous les attributs retenus et dérivés | **U1** | Voit en un clic les valeurs de l'élève à côté de celles de son groupe |
| U1-5 | Suivre la trajectoire G1, G2, G3 pour détecter un décrochage | Identify → trend | G1, G2, G3, prog | **U1** | Isole les élèves en baisse d'au moins 2 points (34 en maths, 20 en portugais) et affiche leur trajectoire |
| U2-1 | Voir comment les notes sont réparties et ce qu'est une note habituelle | Summarize → distribution | G3, reussite | **U2**, U1 | Dit en moins de 10 secondes quelle part des élèves dépasse 10/20 (74 % en maths, 87 % en portugais) |
| U2-2 | Situer un profil saisi (fictif) dans la distribution, sans comparaison nominative | Locate → position | G3 et les attributs du profil saisi | **U2** | Voit son marqueur dans la distribution, avec l'effectif de référence |
| U2-3 | Comprendre le lien entre sorties, alcool et notes sans jargon | Discover → dependency | goout, alc, G3 | **U2**, U1 | Dit que la note baisse un peu quand les sorties ou l'alcool augmentent, et que cela ne prouve pas une cause |
| U2-4 | Comparer un profil à risque et un profil protégé | Compare → features | risque, G3, failures, absCat, higher, traveltime | **U2**, U1 | Voit l'écart de médiane de G3 entre risque 2 et plus et risque 0 (9 contre 12 en maths, 10 contre 13 en portugais), avec *n* |
| U2-5 | Faire varier un facteur (temps d'étude, sorties) et voir la note moyenne des élèves qui ont ce profil | Explore → trend | studytime, goout, G3 | **U2** | Voit la note moyenne et l'effectif se mettre à jour, avec un rappel que c'est une association |

Chaque tâche a au moins un utilisateur. Trois tâches de U2 servent aussi à U1 (U2-1, U2-3, U2-4), alors qu'aucune tâche de U1 ne sert U2, parce qu'elles manipulent des élèves identifiables ou des vues trop denses pour des non-experts.

## 4. Techniques de visualisation par membre et compatibilité

Les techniques sont choisies pour être lisibles par des utilisateurs à faible littératie visuelle : elles montrent des nombres d'élèves, des pourcentages de réussite et le seuil de 10/20, jamais un coefficient ou un quartile à interpréter. La page est organisée en quatre questions, une par technique.

| Membre | Technique (D3) | Question de la page | Types de données pris en charge | Tâches principales | Compatibilité / limites |
|---|---|---|---|---|---|
| **Alexandre LARGUECH** | **Small multiples d'histogrammes** de G3 + simulateur de profil | Comment se répartissent les notes ? | G3 (quantitatif) par groupe nominal ou ordinal | U1-2, U2-1, U2-2, U2-4, U2-5 | Montre la distribution entière et le % de réussite écrit en gros. *n* affiché, groupes de moins de 10 élèves signalés. Le simulateur est anonyme. |
| **Jim LAINEL** | **Classement des facteurs** (taux de réussite par modalité, dot plot) | Qu'est-ce qui est associé à l'échec ? | Ordinaux et quantitatifs à peu de valeurs, contre G3 | U1-1, U2-3 | Remplace un coefficient par des % lisibles et une phrase de sens. Limite : une seule variable à la fois, association et non cause. |
| **Quentin ELLEON** | **Grille d'élèves** (unit chart, 1 carré = 1 élève) avec critères de risque | Quels élèves cumulent les risques ? | Facteurs binaires, niveau de risque ordinal, résultat | U1-3 | Effectif exact visible d'un coup d'œil. Limite : vue nominative, réservée à U1. |
| **Gabriel LOIRAT** | **Diagramme alluvial** (bandes de notes P1 → P2 → finale) + panneau de profil | Comment évoluent les notes pendant l'année ? | G1, G2, G3 discrétisés en bandes ; tous types dans le panneau | U1-4, U1-5 | Variante « ensembles parallèles » de la famille multivariée. Limite : 3 points temporels, bandes à seuils fixes. |

Les dix tâches ont une technique principale et chaque technique est la seule principale sur au moins une tâche. L'organisation suit une logique overview + détail : les quatre questions forment la vue d'ensemble, et un clic sur un élève (grille, trajectoires, table) ouvre la fiche, qui le compare à la moyenne de son école dans sa matière. Les vues sont liées : les critères de risque, un histogramme cliqué ou un ruban de l'alluvial filtrent toutes les vues ; un facteur cliqué regroupe les histogrammes. Une barre de filtres commune s'applique partout : matière (changement de dataset ou import d'un CSV), établissement, sexe, inclusion ou exclusion des élèves non évalués. On garde aussi deux règles d'honnêteté : l'axe G3 reste toujours de 0 à 20, et les deux matières ne sont jamais cumulées dans une même vue.
