# Tâches, techniques et choix de données

Ce document fixe la **spécification des tâches** de l'application et la manière dont les quatre techniques les couvrent. Il justifie aussi ce qui a été retiré de l'écran et les attributs dérivés. Les chiffres sont des **ρ de Spearman calculés sans les non-évalués** (maths / portugais), sauf mention contraire ; ils sont recalculés par `tools/test-stats.mjs`.

**Décisions prises (5 octobre 2026) :**
- les profils utilisateurs sont les quatre de `specification-projet.md` : U1 direction, U2 professeur principal, U3 vie scolaire / orientation, U4 chercheur ;
- U4.3 est reformulée : on compare une même association **dans chaque matière**, par la bascule, sans appariement des deux fichiers (clé de jointure non fiable, et règle « matières jamais cumulées ») ;
- les attributs écartés sont retirés des **vues d'analyse** mais restent dans la fiche élève (repliés) et dans l'export CSV ;
- les techniques du §4 de la spécification (ensembles parallèles, sunburst, graphe) ont été remplacées par celles de `rendu1.md` ; les tâches qu'elles couvraient seules (U3.3, U2.5) sont reprises ci-dessous.

Où c'est codé : listes d'attributs dans `js/meta.js` (`AXIS_KEYS`, `MATRIX_KEYS`, `PANEL_KEYS`, `TABLE_COLS`, `KEY_ATTRS`, `PROFILE_KEYS`), dérivés dans `js/data.js` (`DERIVATIONS`), lien permanent dans `js/permalink.js`.

---

## 1. Inventaire des suppressions

**Principe : on retire des vues d'analyse, pas des données.** Les 33 attributs bruts restent dans la fiche élève et dans l'export CSV, parce que U2.2 exige « les 33 valeurs en un clic » et que l'export doit rester compatible avec le fichier source.

### 1a. Attributs

| Élément | Raison | Tâche(s) impactée(s) |
|---|---|---|
| `paid` | **Pas comparable entre les deux matières** : 45,8 % de « oui » en maths contre 6,0 % en portugais. L'attribut ne mesure pas la même chose d'une matière à l'autre. Il est retiré de toutes les vues ; la fiche l'affiche avec la mention « non comparable ». | aucune |
| `Dalc`, `Walc` | **Redondants** (ρ = 0,64 / 0,62). Ils sont remplacés par `alc` (étape 2) dans les coordonnées parallèles, les boxplots et la table. Ils **restent dans la matrice**, car c'est là que la redondance se voit (U4.1). | U3.1 et U4.1 sont conservées |
| `Medu`, `Fedu` | **Redondants** (ρ = 0,62 / 0,65). Ils sont remplacés par `pedu`, avec le même traitement que ci-dessus. Cela supprime aussi le groupe `Medu = 0` (n = 3) qui faussait les comparaisons. | U1.2, U3.3 et U4.1 sont conservées |
| `G1`, `G2` dans les coordonnées parallèles et la matrice | Ils écrasent les autres signaux et font doublon avec le slope graph. Ils restent dans le slope graph, la fiche et la table. | U2.1, servie par le slope graph |
| `age` | Il reflète surtout le redoublement, déjà porté par `failures` (ρ +0,24 / +0,27), et son lien avec G3 est faible (−0,15 / −0,03). Aucune tâche ne l'utilise. | aucune |
| `famsize`, `Pstatus`, `nursery`, `famsup`, `activities`, `romantic` | L'écart de G3 entre modalités est ≤ 0,45 point dans les deux matières, sur de gros effectifs. Aucune tâche ne les utilise. | aucune ; documentés comme « testés, association négligeable » (U1.3) |
| `guardian`, `internet` | Écart de 0,8 à 1,3 point, sur un petit groupe pour `guardian` (« autre » : 27 / 40 élèves). Aucune tâche ne les utilise, et `internet` recoupe `pedu`. | aucune |
| `famrel` | Lien quasi nul avec G3 (+0,05 / +0,06). Il ne fait partie d'aucune paire attendue en U4.1. | aucune |

**Attributs conservés sans être affichés par défaut** : `freetime`, `health` (U3.1), `Mjob`, `Fjob`, `reason` (U3.3), `schoolsup` (U1.3). Pour `schoolsup`, une info-bulle rappellera que l'association est inversée : le soutien va aux élèves en difficulté.

### 1b. Vues, contrôles et informations affichées

| Élément | Raison | Tâche(s) impactée(s) |
|---|---|---|
| Coordonnées parallèles : 9 axes par défaut, réduits à 7 | Sans G1 et G2, les axes deviennent pedu · studytime · failures · goout · alc · absences · G3. Les paires adjacentes restent lisibles sans défilement. | aucune perdue |
| Coordonnées parallèles : sous-titre de type sous chaque axe (« quantitatif · /20 ») | Surcharge l'écran ; le type figure déjà sur les puces d'axes. | aucune |
| Coordonnées parallèles : couleur au choix parmi ~13 nominaux | On passe à 4 options : résultat, bande de G3, sexe, établissement. | U1.2 et U3.2 conservées |
| Coordonnées parallèles : règle automatique « nominal ≤ 3 modalités » | Remplacée par une liste explicite d'axes autorisés, qui retire automatiquement les attributs supprimés. | aucune |
| Matrice : 16 attributs, réduits à 12 | On retire age, famrel, G1 et G2, ce qui fait passer de 120 à 66 cellules. Les paires attendues en U4.1 restent toutes. | U4.1 conservée |
| Boxplots : 6 panneaux par défaut, réduits à 4 | Les 4 panneaux sont failures, higher, pedu et studytime. La liste « ajouter un panneau » passe d'environ 25 à 17 attributs. | aucune |
| Boxplots : ligne « valeurs atypiques » dans l'info-bulle | Aucune tâche ne l'utilise. | aucune |
| Tuile « Absences moyennes » | C'est la moyenne d'une variable très asymétrique (maximum 75). U3.5 est mieux servie par le boxplot par classes d'absences. | U3.5, servie par les boxplots |
| Tuile « Moyenne de G3 » | La **médiane** devient la valeur principale, la moyenne passe en sous-texte. Le critère de U1.1 porte sur la médiane. | U1.1, mieux servie |
| Table : 14 colonnes, réduites à 11, et repliée par défaut | Elle reste nécessaire pour la liste nominative (U2.4), le parcours au clavier et l'export. | aucune perdue |
| Fiche : 33 attributs à plat | Les attributs utilisés par les vues s'affichent d'abord, les autres dans un bloc repliable « Autres attributs ». | U2.2 conservée |
| Notes d'en-tête des cartes, sous-titre de page, note du slope graph | Une ligne par carte, et le mode d'emploi dans un bloc repliable « Comment lire ». | aucune |
| Fichiers `pipeline.md`, `conception.md` et `evaluation.md` à la racine | Ce sont d'anciennes copies de `docs/` et de la consigne. | aucune |

**Éléments gardés, bien qu'ils puissent sembler superflus :**
- la mention du membre sur chaque carte, parce que la consigne demande une technique par étudiant ;
- l'import CSV et la bascule de matière, exigés par la consigne ;
- la table, nécessaire pour U2.4 et la navigation au clavier.

---

## 2. Transformations de données

| Attribut dérivé | Définition | Type | Justification (données) | Tâches | Verdict |
|---|---|---|---|---|---|
| `alc`, indice d'alcool | `round((5·Dalc + 2·Walc) / 7)`, pondéré par 5 jours de semaine et 2 de week-end. Les valeurs 3 à 5 sont ensuite fusionnées, ce qui donne **faible / modérée / élevée**. | Ordinal (3 niveaux) | ρ avec G3 = −0,21 / −0,21, au moins aussi fort que Dalc ou Walc seuls. Plus aucun groupe sous 10 élèves (maths 190 / 101 / 66 ; portugais 350 / 171 / 113). Un seul axe remplace deux axes redondants. | U3.1, U1.3, U2.5 | ✔ retenu |
| `pedu`, éducation parentale maximale | `max(Medu, Fedu)`, avec 0 fusionné dans 1, ce qui donne **≤ primaire / 5e–9e / secondaire / supérieur**. | Ordinal (4 niveaux) | ρ +0,22 / +0,27, à peu près comme Medu seul. Supprime le groupe `Medu = 0` (n = 3). | U1.2, U1.3, U3.3, U4.2 | ✔ retenu |
| `prog`, progression | `G3 − G1`, laissée vide (NaN) pour les non-évalués, dont le 0 final n'est pas une vraie chute. | Quantitatif (−3…+4 en maths, −9…+11 en portugais) | Elle existe déjà dans le code (`__delta`) mais n'est pas proposée comme axe. Elle devient un axe des coordonnées parallèles et apparaît dans la fiche. Elle est **exclue de la matrice**, car elle est calculée à partir de G3 et G1 et leur serait mécaniquement corrélée. | U2.1, U2.4, U4.4 | ✔ retenu |
| `g3band`, bandes de G3 | **< 10 ▼ échec / 10–13 ● juste / ≥ 14 ▲ solide** | Ordinal (3 niveaux) | Effectifs : maths 92 / 165 / 100, portugais 85 / 355 / 194. Elle sert uniquement d'option de couleur dans les coordonnées parallèles et de mention dans la fiche ; G3 reste sur les axes 0–20. Elle fait ressortir les élèves « juste au-dessus du seuil ». | U2.4, U2.5 | ✔ comme option de couleur |
| `absC` / `absCat`, absences corrigées | `absC` = absences, laissée vide (NaN) pour les non-évalués, dont le 0 n'est pas une assiduité parfaite. `absCat` regroupe en classes **0 / 1–4 / 5–10 / > 10 créneaux**, avec une classe « n. r. » (code 9) si on réinclut les non-évalués. | Quantitatif + ordinal (4 classes) | La médiane de G3 baisse d'une classe à l'autre (maths 12 → 11 → 11 → 10 ; portugais 13 → 12 → 11 → 11) et chaque classe compte au moins 49 élèves. Le regroupement permet de faire des absences une facette de boxplot, ce qui est impossible aujourd'hui avec plus de 8 valeurs distinctes. | U3.5, U1.4, U1.5 | ✔ retenu |
| Indice de risque composite (spec U4.4) | Combinaison pondérée de failures, absences, studytime, higher | — | Les poids seraient arbitraires et l'indice cacherait ses composantes. La combinaison de brushes fait le même travail de façon transparente. | — | ✘ rejeté |
| Sous-ensemble apparié maths × portugais (≤ 366 élèves) | Jointure sur 13 attributs | — | Ces 13 attributs ne forment pas une clé fiable, et la jointure contredit la règle « matières jamais cumulées ». | — | ✘ rejeté |

---

## 3. Tableau des tâches (spécification)

Dans la colonne « Utilisateurs », le profil en **gras** est le profil principal. Rappel des profils : U1 direction, U2 professeur principal, U3 vie scolaire / orientation, U4 chercheur.

| ID | Tâche | Action (Munzner) | Cible | Portée | Attributs mobilisés | Utilisateurs | Critère de réussite |
|---|---|---|---|---|---|---|---|
| U1.1 | Connaître la répartition de G3 et le taux de réussite, par matière et par établissement | Consommer › Découvrir · Résumer | Distribution | Tous | G3, school, matière | **U1**, U3, U4 | Lit la médiane, le taux de réussite et n en moins de 10 s |
| U1.2 | Comparer GP et MS à éducation parentale égale | Découvrir · Comparer | Dépendance | Tous | school × pedu (ou address) × G3 | **U1**, U4 | Dit si l'écart GP–MS persiste à chaque niveau de pedu, avec n par groupe |
| U1.3 | Hiérarchiser les facteurs associés à G3 | Découvrir · Comparer | Corrélation | Tous | attributs retenus × G3 | **U1**, U4 | Cite les 3 premiers facteurs et leur force qualitative |
| U1.4 | Chiffrer la population d'un dispositif (≥ 1 échec et > 10 absences) | Localiser · Filtrer › Résumer | Items | Quelques | failures, absC | **U1**, U3 | Obtient un effectif exact et exportable |
| U1.5 | Contrôler la qualité des données (non-évalués) | Parcourir · Identifier | Valeurs extrêmes | Quelques | G3, absences, G1, G2 | **U1**, U4 | Repère les 38 / 15 dossiers et peut les exclure ou les réinclure |
| U2.1 | Repérer les élèves qui décrochent entre P1, P2 et la note finale | Explorer · Identifier | Tendance | Quelques | G1, G2, G3, prog | **U2**, U1 | Isole les trajectoires ▼ (34 en maths, 20 en portugais) |
| U2.2 | Consulter la fiche complète d'un élève | Rechercher (lookup) · Identifier | Attributs | Un | 33 attributs bruts + dérivés | **U2**, U3 | Accède aux 33 valeurs en un clic |
| U2.3 | Situer un élève par rapport à sa sélection | Rechercher · Comparer | Distribution | Un contre tous | G1, G2, G3 + attributs choisis | **U2**, U3 | Voit l'élève dans la distribution (rang centile, bande Q1–Q3) |
| U2.4 | Lister les élèves partageant un profil de risque | Localiser · Filtrer | Items | Quelques | failures, absC, studytime, higher, prog, g3band | **U2**, U1, U3 | Obtient une liste nominative lisible et exportable |
| U2.5 | Dire si un élève est atypique ou représentatif | Rechercher · Identifier | Similarité / extrêmes | Un | failures, studytime, pedu, alc, higher, g3band | **U2**, U3 | Sait dire « cas isolé » ou « ils sont 12 comme lui » |
| U3.1 | Examiner le lien entre mode de vie et résultats | Explorer · Comparer | Corrélation | Tous | goout, alc (Dalc, Walc), freetime, health × G3 | **U3**, U4 | Distingue une relation monotone d'un bruit sur petit effectif |
| U3.2 | Comparer filles et garçons, matière par matière | Explorer · Comparer | Dépendance | Tous | sex × matière × G3 | **U3**, U4 | Voit l'inversion (maths : G > F ; portugais : F > G) sans cumuler les matières |
| U3.3 | Caractériser les élèves qui ne visent pas le supérieur | Localiser · Comparer › Résumer | Attributs | Quelques | higher, pedu, Mjob, Fjob, reason | **U3**, U1 | Décrit leur profil familial dominant, avec n par modalité |
| U3.4 | Mesurer le lien avec le trajet et le lieu de résidence | Explorer · Comparer | Tendance | Tous | traveltime, address × G3 | **U3**, U1 | Constate la décroissance, avec le groupe > 1 h signalé n < 10 |
| U3.5 | Relier l'assiduité à la réussite | Explorer · Identifier | Distribution + corrélation | Tous | absC, absCat × G3 | **U3**, U1 | Obtient la relation corrigée (−0,24 / −0,21) et voit qu'elle disparaît si on réinclut les non-évalués |
| U4.1 | Explorer la structure de corrélation | Explorer · Comparer | Corrélation | Tous | 12 attributs ordonnables bruts | **U4** | Retrouve les paires redondantes Dalc↔Walc, Medu↔Fedu, Walc↔goout |
| U4.2 | Tester la robustesse d'une association en contrôlant une variable tierce | Explorer · Comparer | Dépendance | Tous | 3 attributs (ex. studytime × G3 selon school) | **U4**, U1 | Voit si l'association tient dans chaque groupe (effet de Simpson) |
| U4.3 *(reformulée)* | Comparer une même association dans les deux matières | Rechercher · Comparer | Corrélation | Tous, une matière à la fois | une paire d'attributs, en maths puis en portugais | **U4**, U3 | Lit ρ et n dans chaque matière, sur des échelles identiques |
| U4.4 | Exploiter des attributs dérivés | Produire › Dériver | Attributs | Tous | alc, pedu, prog, absCat, g3band | **U4** | Chaque dérivé sert d'axe, de facette ou de filtre, avec sa définition au survol |
| U4.5 | Exporter une sélection et la retrouver plus tard | Produire › Enregistrer | État | Quelques | filtres, brushes, axes, panneaux, élève | **U4**, U1 | Un lien restaure la même sélection, et le CSV contient ses lignes |

Couverture : U1 a 5 tâches principales (+8 secondaires), U2 en a 5 (+2), U3 en a 5 (+7), U4 en a 5 (+6). Aucune tâche n'est sans utilisateur.

---

## 4. Tableau tâches × techniques

Légende des techniques :
- **A** = coordonnées parallèles + brushing (Quentin)
- **B** = matrice de Spearman (Jim)
- **C** = small multiples de boxplots / strip plots (Alexandre)
- **D** = slope graph + fiche élève (Gabriel)

✔ = technique principale, ○ = technique secondaire, **\*** = interaction de liaison ajoutée dans cette version (détaillée sous le tableau). L'action, la cible, la portée, les attributs et le critère sont ceux du tableau 3.

| ID | Tâche (abrégée) | A | B | C | D | Comment la combinaison réalise la tâche |
|---|---|:-:|:-:|:-:|:-:|---|
| U1.1 | Distribution de G3, réussite | ○ | | ✔ | ○ | Panneau `school` sur l'axe 0–20 (médiane, n, taux de réussite) ; les tuiles donnent la médiane et le taux |
| U1.2 | GP / MS à pedu égal | ○ | | ✔ | | Clic sur pedu = k, ce qui filtre le panneau `school` ; ou brush sur l'axe pedu avec couleur = établissement |
| U1.3 | Hiérarchiser les facteurs | ○ | ✔ | ✔ | | Matrice triée par \|ρ\| avec G3 (ordinaux) ; panneaux triés par écart de médiane pour les nominaux **\*** |
| U1.4 | Chiffrer un dispositif | ✔ | | ○ | | Brushes failures ≥ 1 et absences > 10, n affiché, puis export |
| U1.5 | Non-évalués | ✔ | | ○ | ○ | Une fois réinclus, ils apparaissent en ✕ gris à G3 = 0 et absences = 0 ; faisceaux en tirets dans le slope graph |
| U2.1 | Décrochage P1 → finale | ○ | | | ✔ | Filtre ▼ du slope graph ; ou brush sur l'axe `prog` |
| U2.2 | Fiche élève | | | | ✔ | Clic dans n'importe quelle vue, ce qui ouvre la fiche |
| U2.3 | Situer un élève | ○ | | ✔ | ✔ | Point cerclé dans chaque panneau ; trajectoire dans la bande Q1–Q3 et rang centile dans la fiche |
| U2.4 | Liste de profil de risque | ✔ | | ○ | ○ | Brushes combinés, puis table (liste nominative) et export |
| U2.5 | Atypique ou représentatif | ○ | | | ✔ **\*** | Bouton de la fiche « Élèves au même profil » qui pose des brushes aux valeurs de l'élève, puis n |
| U3.1 | Mode de vie × G3 | ○ | ✔ | ✔ | | ρ de goout, alc, freetime et health ; boxplots par niveau avec n < 10 hachuré |
| U3.2 | Filles / garçons par matière | ○ | | ✔ | | Panneau `sex`, puis bascule Maths ⇄ Portugais : l'inversion apparaît |
| U3.3 | Profil des élèves sans projet de supérieur | ○ | | ✔ | | Clic sur higher = non, puis lecture des n et % par modalité des panneaux pedu / Mjob / Fjob / reason (% à ajouter dans l'info-bulle) |
| U3.4 | Trajet, résidence | ○ | ○ | ✔ | | Panneaux traveltime et address ; ρ de traveltime dans la matrice |
| U3.5 | Assiduité | ○ | ✔ | ✔ | | Panneau `absCat` ; la cellule ρ absences × G3 change quand on coche ou décoche la case des non-évalués |
| U4.1 | Structure de corrélation | | ✔ | | | Matrice en ordre thématique |
| U4.2 | Variable tierce | ✔ | ○ | ✔ | | Filtre de groupe ou brush sur la 3e variable ; la matrice et les panneaux se recalculent dans ce groupe |
| U4.3 | Une association, deux matières | | ✔ | ✔ | | Bascule de matière, même cellule ρ et même panneau, échelles identiques |
| U4.4 | Attributs dérivés | ✔ | | ✔ | ○ | Axes alc, pedu, prog ; facettes alc, pedu, absCat ; tendance ▼●▲ |
| U4.5 | Exporter, retrouver | | | | | **Aucune technique** : comblée par une liaison **\*** (lien permanent et export) |

**Synthèse :**

| | A | B | C | D |
|---|:-:|:-:|:-:|:-:|
| Tâches ✔ | 5 | 5 | 12 | 4 |
| Tâches ○ | 11 | 2 | 3 | 4 |
| Total couvert | 16 | 7 | 15 | 8 |
| Exclusivité stricte (seule technique présente) | — | U4.1 | — | U2.2 |
| Seule technique principale | U1.4, U1.5, U2.4 | U4.1 | U1.1, U1.2, U3.2, U3.3, U3.4 | U2.1, U2.2, U2.5 |

**Ce que montre la synthèse :** 19 tâches sur 20 ont au moins une technique principale, et chaque technique est la seule principale sur au moins une tâche, donc aucune n'est redondante. Les deux trous restants sont comblés par des **liaisons, sans 5e technique** :
- **U2.5** (couverte au départ par le graphe de similarité, abandonné) : un bouton dans la fiche D pose dans A des brushes aux valeurs clés de l'élève (failures, studytime, pedu, alc, higher, g3band), puis affiche « n élèves partagent ce profil ».
- **U4.5** : l'état (matière, filtres, brushes, axes, panneaux, élève) est encodé dans l'URL, avec un bouton « Copier le lien ». L'export CSV de la sélection est conservé.
- Deux ajouts dans C : tri des panneaux par écart des médianes (U1.3) et part de la sélection dans l'info-bulle (U3.3).

---

## 5. Checklist : comment réaliser chaque tâche dans l'interface

Vérifiée dans Chromium (clair, sombre, 390 px) : aucune erreur ni avertissement dans la console.

| Tâche | Dans l'interface | Résultat observé (maths, sauf mention) |
|---|---|---|
| **U1.1** répartition et réussite | Lire les tuiles « Médiane de G3 » et « Taux de réussite » ; ajouter le panneau **Établissement** dans les boxplots ; basculer Maths ⇄ Portugais | Médiane 11, 74 % de réussite, n = 357 |
| **U1.2** GP / MS à éducation égale | Boxplots : cliquer une boîte du panneau **Éducation parentale (max.)**, puis lire le panneau **Établissement** (n par boîte) | L'écart GP–MS se lit dans chaque niveau, avec n |
| **U1.3** hiérarchiser les facteurs | Matrice : **Ordre → Par \|ρ\| avec la note finale** ; boxplots : **Ordre → écart des médianes** | Matrice : échecs, absences, éducation de la mère… ; panneaux : échecs (3,5 pts) > éducation parentale (3 pts) > … |
| **U1.4** chiffrer un dispositif | Coordonnées parallèles : brosser **Échecs passés** de 1 à 3, puis **Absences (corrigées)** au-dessus de 10 ; lire n ; ouvrir la table et **Exporter la sélection (CSV)** | 5 élèves, export de 33 colonnes d'origine |
| **U1.5** non-évalués | Décocher **Exclure les non évalués** : ils apparaissent en gris ✕, à G3 = 0 et sur le repère **n. r.** de l'axe Absences (corrigées) ; tirets dans le slope graph | 38 en maths, 15 en portugais |
| **U2.1** décrochage | Slope graph : bouton **▼ En baisse** (filtre global) ; ou brosser l'axe **Progression G3 − G1** | 34 en maths, 20 en portugais |
| **U2.2** fiche élève | Clic sur une ligne, un point, une trajectoire ou une ligne de table ; **Autres attributs du fichier** pour les 15 restants | 33 attributs bruts + dérivés |
| **U2.3** situer un élève | Fiche : rang centile, mini-trajectoire sur la bande Q1–Q3 ; point cerclé dans chaque panneau de boxplot | — |
| **U2.4** liste de profil de risque | Combiner des brushes (échecs, absences, temps d'étude, vise le supérieur) ; couleur **Bande de G3** pour voir les « justes » ; ouvrir la **table** (liste nominative), exporter | — |
| **U2.5** atypique ou représentatif | Fiche : encadré **profil** (cas isolé / rare / représentatif, n) ; **Isoler ces élèves dans toutes les vues** pose six brushes | Le nombre d'élèves isolés égale le n annoncé |
| **U3.1** mode de vie | Matrice : cellules Sorties, Alcool, Temps libre, Santé × Note finale ; boxplots **Alcool (indice)**, **Sorties entre amis** (hachures si n < 10) | — |
| **U3.2** filles / garçons | Ajouter le panneau **Sexe** ; basculer Maths ⇄ Portugais | Maths : G 11,87 > F 11,21 ; portugais : F 12,48 > G 11,76 |
| **U3.3** sans projet de supérieur | Cliquer la boîte **non** du panneau **Vise le supérieur** ; ajouter **Métier de la mère**, **Motif**…, lire n et « part de la sélection » au survol | 14 élèves en maths |
| **U3.4** trajet et domicile | Panneaux **Temps de trajet** et **Domicile** ; cellule Temps de trajet × Note finale | Groupe > 1 h signalé ⚠ en maths (n = 7) |
| **U3.5** assiduité | Panneau **Absences (classes)** ; cellule Absences × Note finale, en cochant puis décochant les non-évalués | ρ = −0,24 sans eux, +0,02 avec eux |
| **U4.1** structure de corrélation | Matrice en ordre thématique ; survol de Alcool semaine × week-end : « paire redondante, fusionnée » | Dalc↔Walc +0,64, Medu↔Fedu +0,62, Walc↔Sorties +0,42 |
| **U4.2** variable tierce | Cliquer une boîte (ex. Établissement = GP) : la matrice et les autres panneaux se recalculent dans ce groupe ; ou brosser la 3e variable | — |
| **U4.3** une association, deux matières | Noter une cellule ou un panneau, basculer de matière : mêmes échelles, n affiché | — |
| **U4.4** attributs dérivés | Puces d'axes marquées « dér. », survol d'un titre d'axe, d'un ⓘ de panneau ou d'un en-tête de table : définition | 6 dérivés |
| **U4.5** retrouver une sélection | **🔗 Copier le lien de cette vue** ; coller l'adresse dans un autre onglet | Matière, filtres, brushes, axes, panneaux et élève restaurés à l'identique |
