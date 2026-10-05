# Tâches, techniques et choix de données

Ce document fixe la **spécification des tâches** de l'application, la manière dont les quatre techniques les couvrent, ce qui a été retiré de l'écran et les attributs dérivés. Les chiffres sont calculés sur les élèves évalués (357 en maths, 634 en portugais) et vérifiés par `tools/test-stats.mjs` et dans le navigateur.

**Décisions (5 octobre 2026) :**
- deux profils d'utilisateurs : **U1**, l'équipe pédagogique (enseignants, CPE, direction), et **U2**, les parents et élèves ;
- les quatre techniques ont été **remplacées par des représentations lisibles sans formation** : U2 a une littératie visuelle faible, U1 moyenne. Les coordonnées parallèles, la matrice de Spearman, les boxplots et le faisceau de trajectoires demandaient de savoir lire des lignes superposées, un coefficient ρ, des quartiles. Les nouvelles vues montrent des élèves comptés, des pourcentages de réussite et le seuil de 10/20 ;
- la page est organisée en **quatre questions**, une par technique, chacune ouverte par une phrase calculée sur les données ;
- les attributs écartés sont retirés des **vues**, mais restent dans la fiche élève (repliés) et dans l'export CSV.

| Membre | Technique | Question de la page | Fichier |
|---|---|---|---|
| Alexandre LARGUECH | Small multiples d'histogrammes de G3 + simulateur de profil | 1. Comment se répartissent les notes ? | `js/views/histograms.js` |
| Jim LAINEL | Classement des facteurs (dot plot du taux de réussite par modalité) | 2. Qu'est-ce qui est associé à l'échec ? | `js/views/factorRanking.js` |
| Quentin ELLEON | Grille d'élèves (unit chart, 1 carré = 1 élève) avec critères de risque | 3. Quels élèves cumulent les risques ? | `js/views/unitChart.js` |
| Gabriel LOIRAT | Diagramme alluvial des bandes de notes P1 → P2 → finale + fiche élève | 4. Comment évoluent les notes pendant l'année ? | `js/views/alluvial.js`, `js/views/detailPanel.js` |

---

## 1. Inventaire des suppressions

### 1a. Attributs retirés des vues

| Élément | Raison | Tâche(s) impactée(s) |
|---|---|---|
| `paid` | **Non comparable entre matières** : 45,8 % de « oui » en maths, 6,0 % en portugais. | aucune |
| `Dalc`, `Walc` | **Redondants** (ρ = 0,64 / 0,62) : remplacés par l'indice `alc`. | U2-3, servie par `alc` |
| `Medu`, `Fedu` | **Redondants** (ρ = 0,62 / 0,65) : remplacés par `pedu`, ce qui supprime le groupe `Medu = 0` (n = 3). | U1-1, servie par `pedu` |
| `age` | Reflète surtout le redoublement, déjà porté par `failures` (ρ +0,24 / +0,27). Aucune tâche. | aucune |
| `famsize`, `Pstatus`, `nursery`, `famsup`, `activities`, `romantic` | Écart de G3 entre modalités ≤ 0,45 point dans les deux matières. Aucune tâche. | aucune |
| `guardian`, `internet`, `famrel`, `health`, `freetime` | Association faible ou nulle avec G3. Aucune tâche. | aucune |
| `Mjob`, `Fjob`, `reason`, `schoolsup` | Aucune tâche de la spécification ; `schoolsup` présente en plus une association inversée (le soutien va aux élèves déjà en difficulté). | aucune |
| `G1`, `G2` en dehors de la question 4 | Ils écrasent les autres signaux (ρ ≈ 0,9 avec G3). Ils restent dans la vue de trajectoire, la fiche et la table. | U1-5, servie par la question 4 |

### 1b. Vues et contrôles retirés

| Élément | Raison | Remplacé par |
|---|---|---|
| Coordonnées parallèles, brushes, choix et réordonnancement des axes | 357 à 634 lignes superposées, geste de brush à apprendre : illisible pour U2, difficile pour U1. | Grille d'élèves + facteurs à cocher (Quentin) |
| Matrice de corrélation de Spearman (66 cellules, ρ, échelle rouge/bleu) | Demande de comprendre un coefficient de corrélation. | Classement des facteurs en % de réussite (Jim) |
| Boxplots (quartiles, moustaches, points superposés) | Quartiles et moustaches ne se lisent pas sans formation. | Histogrammes avec seuil à 10 et % de réussite écrit en gros (Alexandre) |
| Slope graph de toutes les trajectoires (173 faisceaux) | Lignes superposées, épaisseurs à comparer. | Diagramme alluvial par bandes + liste de trajectoires quand la sélection est petite (Gabriel) |
| Tuile « Absences moyennes » | Moyenne d'une variable très asymétrique (max. 75). | — |
| Mode d'emploi affiché en permanence | Surcharge. | Bloc repliable « Comment lire » par question |

Restent : la barre de filtres (matière, établissement, sexe, non-évalués), l'import CSV, les tuiles, la table (repliée), l'export CSV, le lien permanent et le thème clair / sombre.

---

## 2. Transformations de données

| Attribut dérivé | Définition | Type | Justification | Tâches |
|---|---|---|---|---|
| `reussite` | G3 ≥ 10 ; vide pour un non-évalué | nominal (oui / non) | Le seuil de 10/20 est ce que les deux profils comprennent : il colore toutes les vues (▲ bleu / ▼ orange). | U2-1, toutes |
| `risque` | Nombre de facteurs parmi : au moins 1 échec passé, plus de 10 absences, trajet de 30 min ou plus, ne vise pas le supérieur (0 à 4) ; vide pour un non-évalué | ordinal (0–4) ; pour comparer des groupes, 2 à 4 sont réunis en « 2 facteurs ou plus » | Un simple comptage, sans pondération : chacun peut vérifier pourquoi un élève a tel niveau. Risque ≥ 2 : 42 élèves en maths, 67 en portugais. | U1-3, U2-4 |
| `pedu` | max(Medu, Fedu), 0 réuni avec 1 : ≤ primaire / collège / lycée / supérieur | ordinal (4) | Medu et Fedu sont redondants ; supprime un groupe de 3 élèves. | U1-1 |
| `alc` | arrondi de (5·Dalc + 2·Walc) / 7, niveaux 3 à 5 réunis : faible / modéré / élevé | ordinal (3) | Dalc et Walc sont redondants ; aucun groupe sous 10 élèves ; association au moins aussi forte (ρ −0,21 / −0,21). | U1-1, U2-3 |
| `absCat` | 0 / 1–4 / 5–10 / plus de 10 créneaux ; « n. r. » pour un non-évalué réinclus | ordinal (4) | Les absences deviennent des groupes comparables ; un 0 artificiel n'est jamais pris pour une assiduité parfaite. | U1-1 |
| `prog` | G3 − G1 ; vide pour un non-évalué | quantitatif | Décrochage (U1-5) : baisse d'au moins 2 points. Un non-évalué n'a pas de tendance, sinon son 0 final compterait comme un décrochage. | U1-5 |

Abandonnés : `absC` et `g3band`, qui servaient aux coordonnées parallèles ; le sous-ensemble apparié maths × portugais (clé de jointure non fiable, matières jamais cumulées).

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
| U2-2 | Situer un profil saisi (fictif) dans la distribution, sans comparaison nominative | Locate → position | G3 et les attributs du profil saisi | **U2** | Voit son marqueur dans la distribution, avec l'effectif de référence |
| U2-3 | Comprendre le lien entre sorties, alcool et notes sans jargon | Discover → dependency | goout, alc, G3 | **U2**, U1 | Dit que la note baisse un peu quand les sorties ou l'alcool augmentent, et que cela ne prouve pas une cause |
| U2-4 | Comparer un profil à risque et un profil protégé | Compare → features | risque, G3, failures, absCat, higher, traveltime | **U2**, U1 | Voit l'écart de médiane de G3 entre risque 2 et plus et risque 0 (9 contre 12 en maths, 10 contre 13 en portugais), avec *n* |
| U2-5 | Faire varier un facteur (temps d'étude, sorties) et voir la note moyenne des élèves qui ont ce profil | Explore → trend | studytime, goout, G3 | **U2** | Voit la note moyenne et l'effectif se mettre à jour, avec un rappel que c'est une association |

Chaque tâche a au moins un utilisateur. Trois tâches de U2 servent aussi à U1 (U2-1, U2-3, U2-4), alors qu'aucune tâche de U1 ne sert U2, parce qu'elles manipulent des élèves identifiables ou des vues trop denses pour des non-experts.

---

## 4. Tâches × techniques

✔ = technique principale, ○ = technique secondaire.
**A** = grille d'élèves (Quentin), **B** = classement des facteurs (Jim), **C** = histogrammes + simulateur (Alexandre), **D** = alluvial + fiche (Gabriel).

| ID | Tâche (abrégée) | Action → cible | Attributs | A | B | C | D | Comment la combinaison la réalise |
|---|---|---|---|:-:|:-:|:-:|:-:|---|
| U1-1 | Facteurs associés à une note basse | Discover → correlation | failures, absCat, studytime, traveltime, goout, alc, pedu | | ✔ | ○ | | Facteurs triés par écart de réussite, sens du lien en une phrase ; un clic affiche leurs histogrammes |
| U1-2 | Distribution de G3 par sous-groupe | Compare → distribution | G3, sex, school, address | ○ | | ✔ | | « Comparer selon » sexe, établissement, domicile : médiane et n par panneau ; la grille regroupe aussi par établissement ou sexe |
| U1-3 | Élèves qui cumulent les risques | Locate → outliers | failures, absences, traveltime, higher, risque | ✔ | | | ○ | « Nombre de facteurs ≥ 2 » ou facteurs cochés : effectif exact, filtre propagé à toutes les vues ; trajectoires listées si la sélection est petite |
| U1-4 | Profil d'un élève face à son école | Lookup → features | attributs retenus et dérivés | ○ | | | ✔ | Clic sur un carré ou une trajectoire → fiche : élève à côté de la moyenne de son école dans la matière |
| U1-5 | Détecter un décrochage | Identify → trend | G1, G2, G3, prog | | | | ✔ | Bouton « ▼ en baisse d'au moins 2 points » ou clic sur un ruban → trajectoires des élèves |
| U2-1 | Répartition, note habituelle | Summarize → distribution | G3, reussite | | | ✔ | | Histogramme avec seuil à 10, % de réussite écrit en gros, médiane ; tuile « Ont au moins 10/20 » |
| U2-2 | Situer un profil fictif | Locate → position | G3 + profil saisi | | | ✔ | | Simulateur : critères + « ma note » → marqueur dans la distribution du profil, n, part des élèves sous cette note |
| U2-3 | Sorties, alcool et notes | Discover → dependency | goout, alc, G3 | | ✔ | ○ | | « plus de sorties : réussite un peu plus basse ▼ » ; rappel « association, pas cause » ; le simulateur fait varier sorties et alcool |
| U2-4 | Profil à risque contre profil protégé | Compare → features | risque, G3 | ○ | | ✔ | | Histogrammes « selon le niveau de risque » : aucun facteur / 1 / 2 ou plus, médiane et n ; la grille montre le % en échec par niveau |
| U2-5 | Faire varier un facteur | Explore → trend | studytime, goout, G3 | | | ✔ | | Simulateur : moyenne, médiane, % de réussite et n mis à jour à chaque clic |

**Synthèse**

| | A (Quentin) | B (Jim) | C (Alexandre) | D (Gabriel) |
|---|:-:|:-:|:-:|:-:|
| Tâches ✔ | 1 | 2 | 5 | 2 |
| Tâches ○ | 3 | 0 | 2 | 1 |
| Seule technique principale | U1-3 | U1-1, U2-3 | U1-2, U2-1, U2-2, U2-4, U2-5 | U1-4, U1-5 |

Les dix tâches ont une technique principale et chaque technique est la seule principale sur au moins une tâche : la combinaison couvre tout, sans redondance et sans cinquième vue. Les liaisons qui les relient : un clic sur un facteur (B) regroupe les histogrammes (C) ; les critères de la grille (A), un clic sur un histogramme (C) et un ruban ou la tendance (D) filtrent toutes les vues sauf le classement (B), qui garde ses propres comparaisons ; un clic sur un élève ouvre la fiche (D).

---

## 5. Checklist : comment réaliser chaque tâche dans l'interface

Vérifiée dans Chromium, en clair, en sombre et à 390 px : aucune erreur ni avertissement dans la console.

| Tâche | Dans l'interface | Résultat observé |
|---|---|---|
| **U1-1** | Question 2 : lire la phrase d'en-tête et les trois premières lignes ; chaque ligne dit le sens du lien | Maths : échecs passés (55 pts), absences (30 pts), sorties (27 pts). Portugais : échecs passés (53), absences (16), temps d'étude (15) |
| **U1-2** | Question 1 : « Comparer selon » → Sexe, Établissement ou Domicile ; basculer de matière dans la barre | Maths : filles médiane 11 (n = 185), garçons 12 (n = 172) ; GP 11 (315), MS 10 (42). Portugais : filles 12, garçons 11 ; GP 13, MS 11 |
| **U1-3** | Question 3 : « Nombre de facteurs » → « ≥ 2 » (ou cocher des facteurs) | 42 élèves en maths (24 en échec, 57 %), 67 en portugais (28, 42 %) ; tuiles, histogrammes, flux et table suivent |
| **U1-4** | Clic sur un carré de la grille, une trajectoire ou une ligne de table | Fiche : 13 attributs de l'élève à côté de la moyenne de son école (ex. Gabriel Pereira, maths, n = 315), ▲ ▼ selon l'écart |
| **U1-5** | Question 4 : « ▼ En baisse d'au moins 2 points » | 34 trajectoires en maths, 20 en portugais, listées du plus fort recul au plus faible |
| **U2-1** | Tuile « Ont au moins 10/20 » ou phrase de la question 1 | 74 % en maths, 87 % en portugais ; note habituelle 11/20 et 12/20 |
| **U2-2** | Simulateur : choisir des critères, saisir « Ma note » | Marqueur « ma note » dans l'histogramme du profil, n, « au-dessus de 44 % des élèves de ce profil » (maths, étude 5–10 h, note 12) |
| **U2-3** | Question 2 : lignes « Sorties entre amis » et « Alcool (indice) » | « plus de sorties : réussite un peu plus basse ▼ », « plus d'alcool déclaré : réussite un peu plus basse ▼ », « Association, pas cause » |
| **U2-4** | Question 1 : « Comparer selon » → Niveau de risque | Maths : 2 facteurs ou plus médiane 9 (n = 42), aucun facteur 12 (n = 235). Portugais : 10 (67) contre 13 (441) |
| **U2-5** | Simulateur : temps d'étude « < 2 h » puis « 5–10 h » | Maths : moyenne 11,5 (n = 92) → 12,6 (n = 59), avec « association observée, pas une cause » |
| Lien permanent | « 🔗 Copier le lien de cette vue » puis ouvrir l'adresse | Matière, filtres, critères, groupe, profil simulé et élève restaurés |
