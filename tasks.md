# Student Performance Explorer — Étapes 1 à 4 (avant implémentation)

Je n'ai rien modifié dans le dossier. J'ai lu tout le code (`index.html`, les 6 modules de `js/`, les 7 vues de `js/views/`, `docs/`), la spécification, l'analyse du jeu et les consignes. J'ai aussi recalculé les statistiques sur les deux CSV pour justifier chaque choix. Sauf mention contraire, les chiffres sont des **ρ de Spearman calculés sans les non-évalués** (maths / portugais).

## Ce que j'ai compris (10 lignes)

1. Il y a deux tables de même schéma : Maths (395 élèves) et Portugais (649). Elles comptent 33 attributs : 17 nominaux, 10 ordinaux et 6 quantitatifs. Un item correspond à un élève dans une matière.
2. 53 élèves ont G3 = 0 et 0 absence (38 en maths, 15 en portugais). Ce sont des dossiers non renseignés. S'ils sont inclus, le lien entre absences et G3 passe de −0,24 à +0,02 en maths.
3. L'application est une page unique avec un état global. Les vues communiquent par un bus (`setState`), et `derive()` calcule une seule fois par rendu les sous-ensembles scoped → noBrush → selection.
4. Les 4 techniques en place sont celles de `rendu1.md`, pas celles du §4 de la spec (ensembles parallèles, sunburst, graphe). La couverture des tâches est donc à refaire.
5. Les coordonnées parallèles (Quentin) sont en canvas avec brushes stockés en unités de données. Elles ont 9 axes par défaut, dont G1/G2, et la couleur se choisit parmi environ 13 nominaux.
6. La matrice (Jim) contient 16 attributs, soit 120 cellules. Elle ignore les brushes. G1 et G2 y dominent (+0,89 et +0,96 avec G3).
7. Les boxplots (Alexandre) ont 6 panneaux par défaut, et environ 25 attributs peuvent servir de facette, dont `paid`.
8. Le slope graph regroupe les trajectoires identiques et filtre par tendance (Gabriel). La fiche élève affiche les 33 attributs à plat.
9. Les vues de support sont la barre de filtres, 4 tuiles et une table de 14 colonnes avec export CSV. Les fichiers `pipeline.md` et `conception.md` à la racine sont d'anciens doublons de `docs/`.
10. Deux incohérences sont à trancher : `rendu1.md` ne définit que 2 profils alors que la spec en a 4, et la tâche U4.3 (élèves présents dans les deux matières) contredit la règle « matières jamais cumulées ».

---

## Étape 1 — Inventaire de ce qu'il faut supprimer

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

## Étape 2 — Transformations de données

| Attribut dérivé | Définition | Type | Justification (données) | Tâches | Verdict |
|---|---|---|---|---|---|
| `alc`, indice d'alcool | `round((5·Dalc + 2·Walc) / 7)`, pondéré par 5 jours de semaine et 2 de week-end. Les valeurs 3 à 5 sont ensuite fusionnées, ce qui donne **faible / modérée / élevée**. | Ordinal (3 niveaux) | ρ avec G3 = −0,21 / −0,21, au moins aussi fort que Dalc ou Walc seuls. Plus aucun groupe sous 10 élèves (maths 190 / 101 / 66 ; portugais 350 / 171 / 113). Un seul axe remplace deux axes redondants. | U3.1, U1.3, U2.5 | ✔ retenu |
| `pedu`, éducation parentale maximale | `max(Medu, Fedu)`, avec 0 fusionné dans 1, ce qui donne **≤ primaire / 5e–9e / secondaire / supérieur**. | Ordinal (4 niveaux) | ρ +0,22 / +0,27, à peu près comme Medu seul. Supprime le groupe `Medu = 0` (n = 3). | U1.2, U1.3, U3.3, U4.2 | ✔ retenu |
| `prog`, progression | `G3 − G1`, laissée vide (NaN) pour les non-évalués, dont le 0 final n'est pas une vraie chute. | Quantitatif (−3…+4 en maths, −9…+11 en portugais) | Elle existe déjà dans le code (`__delta`) mais n'est pas proposée comme axe. Elle devient un axe des coordonnées parallèles et apparaît dans la fiche. Elle est **exclue de la matrice**, car elle est calculée à partir de G3 et G1 et leur serait mécaniquement corrélée. | U2.1, U2.4, U4.4 | ✔ retenu |
| `g3band`, bandes de G3 | **< 10 ▼ échec / 10–13 ● juste / ≥ 14 ▲ solide** | Ordinal (3 niveaux) | Effectifs : maths 92 / 165 / 100, portugais 85 / 355 / 194. Elle sert uniquement d'option de couleur dans les coordonnées parallèles et de mention dans la fiche ; G3 reste sur les axes 0–20. Elle fait ressortir les élèves « juste au-dessus du seuil ». | U2.4, U2.5 | ✔ comme option de couleur |
| `absC` / `absCat`, absences corrigées | `absC` = absences, laissée vide (NaN) pour les non-évalués, dont le 0 n'est pas une assiduité parfaite. `absCat` regroupe en classes **0 / 1–4 / 5–10 / > 10 créneaux**, avec une classe « non renseigné » si on réinclut les non-évalués. | Quantitatif + ordinal (4 classes) | La médiane de G3 baisse d'une classe à l'autre (maths 12 → 11 → 11 → 10 ; portugais 13 → 12 → 11 → 11) et chaque classe compte au moins 49 élèves. Le regroupement permet de faire des absences une facette de boxplot, ce qui est impossible aujourd'hui avec plus de 8 valeurs distinctes. | U3.5, U1.4, U1.5 | ✔ retenu |
| Indice de risque composite (spec U4.4) | Combinaison pondérée de failures, absences, studytime, higher | — | Les poids seraient arbitraires et l'indice cacherait ses composantes. La combinaison de brushes fait le même travail de façon transparente. | — | ✘ rejeté |
| Sous-ensemble apparié maths × portugais (≤ 366 élèves) | Jointure sur 13 attributs | — | Ces 13 attributs ne forment pas une clé fiable, et la jointure contredit la règle « matières jamais cumulées ». | — | ✘ rejeté |

---

## Étape 3 — Tableau des tâches (SPEC)

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

## Étape 4 — Tableau tâches × techniques

Légende des techniques :
- **A** = coordonnées parallèles + brushing (Quentin)
- **B** = matrice de Spearman (Jim)
- **C** = small multiples de boxplots / strip plots (Alexandre)
- **D** = slope graph + fiche élève (Gabriel)

✔ = technique principale, ○ = technique secondaire, **\*** = demande une interaction de liaison nouvelle (détaillée sous le tableau). L'action, la cible, la portée, les attributs et le critère sont ceux du tableau de l'étape 3.

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

**Ce que montre la synthèse :** 19 tâches sur 20 ont au moins une technique principale, et chaque technique est la seule principale sur au moins une tâche, donc aucune n'est redondante. Il reste deux trous, comblés par des **liaisons, sans 5e technique** :
- **U2.5** (couverte au départ par le graphe de similarité, abandonné) : un bouton dans la fiche D pose dans A des brushes aux valeurs clés de l'élève (failures, studytime, pedu, alc, higher, g3band), puis affiche « n élèves partagent ce profil ».
- **U4.5** : l'état (matière, filtres, brushes, axes, panneaux, élève) est encodé dans l'URL, avec un bouton « Copier le lien ». L'export CSV de la sélection est conservé.
- Deux petits ajouts dans C : trier les panneaux par écart de médiane (U1.3) et afficher le % de la sélection dans l'info-bulle (U3.3).

---

## À valider avant implémentation

1. **Utilisateurs.** J'ai pris les profils U1–U4 de la spec, pas les deux profils de `rendu1.md` (équipe pédagogique, parents/élèves). Il faudra harmoniser le rapport.
2. **U4.3.** Je la reformule en « même association dans chaque matière », sans appariement des deux fichiers. Le sous-ensemble ≤ 366 élèves serait seulement mentionné comme écarté.
3. **Attributs retirés des vues** (étape 1a) mais gardés dans la fiche et l'export.
4. **Les 5 transformations retenues**, en particulier `alc` en 3 niveaux et `g3band` limitée à une option de couleur.
5. **Fichiers en double à la racine** (`pipeline.md`, `conception.md`, `evaluation.md`) : supprimer ou déplacer dans `_to_delete/` ? `notes.md` resterait tel quel.