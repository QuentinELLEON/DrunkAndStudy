# Projet Visualisation de l'information, Données, utilisateurs et tâches
**Groupe.** Quentin ELLEON, Jim LAINEL, Alexandre LARGUECH, Gabriel LOIRAT

## 1. Jeu de données

**Student Alcohol Consumption** (Kaggle, miroir du dataset UCI *Student Performance*, Cortez & Silva, 2008). Questionnaires et bulletins de deux lycées portugais (Gabriel Pereira, Mousinho da Silveira), année 2005–2006.

Le jeu de données comprend deux tables de même structure, une pour les mathématiques (395 élèves) et une pour le portugais (649 élèves), 33 attributs, aucune valeur manquante. Dans la taxonomie de Munzner, c'est une table où chaque item est un élève dans une matière donnée.

Les 33 attributs se répartissent en trois types, 17 nominaux (sexe, école, milieu urbain/rural, métier des parents, soutien scolaire, projet d'études supérieures…), 10 ordinaux sur des échelles 1–5 ou 0–4 (éducation des parents, temps d'étude, sorties, consommation d'alcool, santé…), et 6 quantitatifs (âge, échecs passés, absences, notes G1, G2, G3 sur 20). Près de la moitié des attributs ne sont donc pas ordonnables, ce qui pèse directement sur le choix des techniques (§4).

Quelques limites à noter. 53 élèves ont G3 = 0 et 0 absence, mais ce sont en réalité des élèves non évalués codés par défaut, pas de vraies notes nulles, il faudra pouvoir les exclure de l'analyse. Alcool, sorties et temps d'étude sont auto-déclarés, donc sujets à un biais de déclaration. Les données étant observationnelles, on ne montre que des associations, jamais des causes. Et comme c'est un historique anonymisé, l'outil reste un démonstrateur pédagogique, pas un vrai outil de suivi d'élèves.

## 2. Utilisateurs

| Profil | Expertise du domaine | Littératie en visualisation | Besoin |
|---|---|---|---|
| **U1, Équipe pédagogique** (enseignants, CPE, direction) | Élevée | Moyenne | Repérer les profils à risque, décider où placer le soutien. Accepte des vues denses et interactives. |
| **U2, Parents / élèves** | Faible | Faible | Comprendre ce qui est associé à la réussite, dans une logique de prévention. Besoin de vues simples, d'un vocabulaire non technique et de l'effectif *n* toujours affiché. |

## 3. Tâches visuelles / analytiques (action → cible, Munzner)

### U1, Équipe pédagogique

| # | Action → cible | Tâche concrète | Idiome |
|---|---|---|---|
| 1 | Discover → correlation | Quels facteurs sont le plus associés à une note finale basse (G3 < 10) ? | Matrice de corrélation, coordonnées parallèles |
| 2 | Compare → distribution | Comparer la distribution de G3 entre sous-groupes (sexe, école, milieu, matière) | Boxplots en small multiples |
| 3 | Locate → outliers | Isoler les élèves cumulant plusieurs facteurs de risque (≥ 1 échec passé, absences élevées, trajet long, pas de projet d'études supérieures) | Coordonnées parallèles + brushing |
| 4 | Lookup → features | Consulter le profil complet d'un élève et le situer par rapport à la moyenne de son école et de sa matière | Panneau de détail, dumbbell chart |
| 5 | Identify → trend | Suivre la trajectoire G1 → G2 → G3 pour détecter un décrochage en cours d'année | Slope graph |

### U2, Parents / élèves

| # | Action → cible | Tâche concrète | Idiome |
|---|---|---|---|
| 1 | Summarize → distribution | Voir comment les notes sont réparties et ce qu'est une note « habituelle » | Histogramme avec seuil de réussite (10/20) |
| 2 | Locate → position | Situer un profil saisi (fictif) dans la distribution, sans comparaison nominative | Histogramme + marqueur |
| 3 | Discover → dependency | Comprendre le lien entre sorties, alcool et notes sans jargon | Barres de moyennes par niveau, *n* affiché |
| 4 | Compare → features | Comparer un profil « à risque » et un profil « protégé » | Deux fiches côte à côte / dumbbell |
| 5 | Explore → trend | Faire varier un facteur (temps d'étude, sorties) et voir la note moyenne des élèves qui ont ce profil (association, non causalité) | Sliders + graphique lié |

## 4. Techniques de visualisation par membre et compatibilité

| Membre | Technique (D3) | Types de données pris en charge | Tâches couvertes | Compatibilité / limites |
|---|---|---|---|---|
| **Quentin ELLEON** | **Coordonnées parallèles** + brushing | Quantitatifs et ordinaux en axes ; nominaux en couleur | U1-1, U1-3, U1-2 | Adaptée au multivarié. Limites, overplotting (≈ 650 lignes → transparence), axes ordinaux discrets (décalage aléatoire pour éviter la superposition, et étiquettes textuelles), nominaux non placés en axe. |
| **Jim LAINEL** | **Matrice de corrélation** | Quantitatifs et ordinaux (Spearman) | U1-1, U2-3 | Vue d'ensemble des 16 attributs ordonnables. Limite, les nominaux sont exclus, montre des associations, pas des causes. |
| **Alexandre LARGUECH** | **Small multiples de boxplots / strip plots** | G3 (quantitatif) par groupe nominal ou ordinal | U1-2, U2-1, U2-3, U2-4 | Compare des distributions et pas seulement des moyennes. *n* affiché obligatoire (certains groupes ont moins de 10 élèves). |
| **Gabriel LOIRAT** | **Slope graph** G1 → G2 → G3 + panneau de profil | Quantitatifs ordonnés dans le temps ; tous types dans le panneau | U1-4, U1-5, U2-2 | Niveau « détail » naturel. Limite, seulement 3 points temporels. |

L'organisation suit une logique overview + détail. La vue d'ensemble utilise les coordonnées parallèles ; un clic sur un élève ouvre le détail (panneau de profil). Deux filtres communs s'appliquent, la matière (changement de dataset) et l'inclusion ou l'exclusion des élèves non évalués. On garde aussi deux règles d'honnêteté, l'axe G3 reste toujours de 0 à 20, et les deux matières ne sont jamais cumulées dans une même vue.