/* =====================================================================
   meta.js — métadonnées des 33 attributs du jeu "Student Performance"
   ---------------------------------------------------------------------
   Pour chaque attribut :
     l  : libellé long (affiché dans les titres, info-bulles, fiche)
     t  : type de donnée  "nom" (nominal) | "ord" (ordinal) | "quant" (quantitatif)
     g  : groupe thématique (regroupement des puces d'axes et de la fiche)
     d  : domaine ordonné (ordinaux et nominaux dont l'ordre est imposé)
     s  : libellés courts, alignés sur d (graduations d'axes, boxplots)
     v  : libellés longs des modalités (fiche élève, info-bulles)
     u  : unité (quantitatifs)
     fixed : domaine fixe pour une échelle quantitative (ex. notes 0–20)
     derived / def : attribut dérivé et sa définition (voir plus bas)
     note  : mise en garde (attribut non comparable, association inversée…)
   Les codes restent ceux du fichier source ; seuls les libellés changent.
   ===================================================================== */

const L15 = { 1: "1 très faible", 2: "2 faible", 3: "3 moyen", 4: "4 élevé", 5: "5 très élevé" };
const YESNO = { d: ["no", "yes"], s: ["non", "oui"], v: { no: "non", yes: "oui" } };
const EDU = {
  d: [0, 1, 2, 3, 4],
  s: ["aucune", "primaire", "collège", "lycée", "sup."],
  v: { 0: "aucune", 1: "primaire (4e année)", 2: "5e–9e année", 3: "secondaire", 4: "enseignement supérieur" }
};
const JOB = {
  d: ["at_home", "health", "other", "services", "teacher"],
  s: ["au foyer", "santé", "autre", "services", "enseign."],
  v: { at_home: "au foyer", health: "santé", other: "autre", services: "services (admin., police…)", teacher: "enseignant·e" }
};

export const META = {
  school:    { l: "Établissement", t: "nom", g: "Démographie", d: ["GP", "MS"], s: ["GP", "MS"],
               v: { GP: "Gabriel Pereira (GP)", MS: "Mousinho da Silveira (MS)" } },
  sex:       { l: "Sexe", t: "nom", g: "Démographie", d: ["F", "M"], s: ["F", "M"], v: { F: "fille", M: "garçon" } },
  age:       { l: "Âge", t: "quant", g: "Démographie", u: "ans" },
  address:   { l: "Domicile", t: "nom", g: "Démographie", d: ["U", "R"], s: ["urbain", "rural"],
               v: { U: "urbain", R: "rural" } },
  famsize:   { l: "Taille de la famille", t: "nom", g: "Famille", d: ["LE3", "GT3"], s: ["≤ 3", "> 3"],
               v: { LE3: "≤ 3 personnes", GT3: "> 3 personnes" } },
  Pstatus:   { l: "Parents", t: "nom", g: "Famille", d: ["T", "A"], s: ["ensemble", "séparés"],
               v: { T: "vivent ensemble", A: "vivent séparés" } },
  Medu:      { l: "Éducation de la mère", t: "ord", g: "Famille", ...EDU },
  Fedu:      { l: "Éducation du père", t: "ord", g: "Famille", ...EDU },
  Mjob:      { l: "Métier de la mère", t: "nom", g: "Famille", ...JOB },
  Fjob:      { l: "Métier du père", t: "nom", g: "Famille", ...JOB },
  guardian:  { l: "Responsable légal", t: "nom", g: "Famille", d: ["mother", "father", "other"],
               s: ["mère", "père", "autre"], v: { mother: "mère", father: "père", other: "autre" } },
  famrel:    { l: "Relations familiales", t: "ord", g: "Famille", d: [1, 2, 3, 4, 5], s: ["1", "2", "3", "4", "5"],
               v: { 1: "1 très mauvaises", 2: "2 mauvaises", 3: "3 moyennes", 4: "4 bonnes", 5: "5 excellentes" } },
  reason:    { l: "Motif du choix de l'école", t: "nom", g: "Contexte scolaire",
               d: ["course", "home", "reputation", "other"], s: ["cursus", "proximité", "réputation", "autre"],
               v: { course: "offre de cours", home: "proximité du domicile", reputation: "réputation", other: "autre" } },
  traveltime:{ l: "Temps de trajet", t: "ord", g: "Contexte scolaire", d: [1, 2, 3, 4],
               s: ["< 15 min", "15–30", "30–60", "> 1 h"],
               v: { 1: "< 15 min", 2: "15–30 min", 3: "30–60 min", 4: "> 1 heure" } },
  studytime: { l: "Temps d'étude hebdo.", t: "ord", g: "Contexte scolaire", d: [1, 2, 3, 4],
               s: ["< 2 h", "2–5 h", "5–10 h", "> 10 h"],
               v: { 1: "< 2 heures", 2: "2–5 heures", 3: "5–10 heures", 4: "> 10 heures" } },
  failures:  { l: "Échecs passés", t: "quant", g: "Contexte scolaire", u: "classes", fixed: [0, 3] },
  schoolsup: { l: "Soutien scolaire", t: "nom", g: "Contexte scolaire", ...YESNO },
  famsup:    { l: "Soutien familial", t: "nom", g: "Contexte scolaire", ...YESNO },
  paid:      { l: "Cours payants", t: "nom", g: "Contexte scolaire", ...YESNO },
  nursery:   { l: "École maternelle", t: "nom", g: "Contexte scolaire", ...YESNO },
  higher:    { l: "Vise le supérieur", t: "nom", g: "Contexte scolaire", ...YESNO },
  activities:{ l: "Activités extrascolaires", t: "nom", g: "Mode de vie", ...YESNO },
  internet:  { l: "Internet à la maison", t: "nom", g: "Mode de vie", ...YESNO },
  romantic:  { l: "En couple", t: "nom", g: "Mode de vie", ...YESNO },
  freetime:  { l: "Temps libre", t: "ord", g: "Mode de vie", d: [1, 2, 3, 4, 5], s: ["1", "2", "3", "4", "5"], v: L15 },
  goout:     { l: "Sorties entre amis", t: "ord", g: "Mode de vie", d: [1, 2, 3, 4, 5], s: ["1", "2", "3", "4", "5"], v: L15 },
  Dalc:      { l: "Alcool — semaine", t: "ord", g: "Mode de vie", d: [1, 2, 3, 4, 5], s: ["1", "2", "3", "4", "5"], v: L15 },
  Walc:      { l: "Alcool — week-end", t: "ord", g: "Mode de vie", d: [1, 2, 3, 4, 5], s: ["1", "2", "3", "4", "5"], v: L15 },
  health:    { l: "Santé", t: "ord", g: "Mode de vie", d: [1, 2, 3, 4, 5], s: ["1", "2", "3", "4", "5"],
               v: { 1: "1 très mauvaise", 2: "2 mauvaise", 3: "3 moyenne", 4: "4 bonne", 5: "5 très bonne" } },
  absences:  { l: "Absences", t: "quant", g: "Résultats", u: "créneaux de 2 h" },
  G1:        { l: "Note — période 1", t: "quant", g: "Résultats", u: "/20", fixed: [0, 20] },
  G2:        { l: "Note — période 2", t: "quant", g: "Résultats", u: "/20", fixed: [0, 20] },
  G3:        { l: "Note finale", t: "quant", g: "Résultats", u: "/20", fixed: [0, 20] }
};

/** Les 33 colonnes attendues dans un fichier "officiel" (avant ajout des dérivés). */
export const EXPECTED_COLUMNS = Object.keys(META);

/* ---------------------------------------------------------------------
   Attributs DÉRIVÉS (étape 2 de docs/taches.md, calculés dans data.js).
   Ils ne remplacent jamais les colonnes d'origine : la fiche et l'export
   CSV gardent les 33 valeurs brutes.
   def : définition affichée au survol (titres d'axes, puces, panneaux).
   --------------------------------------------------------------------- */
Object.assign(META, {
  pedu:   { l: "Éducation parentale (max.)", t: "ord", g: "Famille", derived: true,
            d: [1, 2, 3, 4], s: ["≤ primaire", "collège", "lycée", "sup."],
            v: { 1: "≤ primaire", 2: "5e–9e année", 3: "secondaire", 4: "enseignement supérieur" },
            def: "max(Medu, Fedu) ; « aucune » (3 à 6 élèves) fusionnée avec « primaire »" },
  alc:    { l: "Alcool (indice)", t: "ord", g: "Mode de vie", derived: true,
            d: [1, 2, 3], s: ["faible", "modéré", "élevé"],
            v: { 1: "faible", 2: "modéré", 3: "élevé (≥ 3 sur 5)" },
            def: "arrondi de (5·Dalc + 2·Walc) / 7, niveaux 3 à 5 fusionnés (aucun groupe < 10 élèves)" },
  absC:   { l: "Absences (corrigées)", t: "quant", g: "Résultats", derived: true, u: "créneaux de 2 h",
            def: "absences ; vide (n. r.) pour les non-évalués, dont le 0 n'est pas une assiduité parfaite" },
  absCat: { l: "Absences (classes)", t: "ord", g: "Résultats", derived: true,
            d: [0, 1, 2, 3, 9], s: ["0", "1–4", "5–10", "> 10", "n. r."],
            v: { 0: "aucune", 1: "1 à 4 créneaux", 2: "5 à 10 créneaux", 3: "plus de 10 créneaux", 9: "non renseigné (non évalué)" },
            def: "absences en 4 classes de créneaux de 2 h ; « n. r. » pour les non-évalués réinclus" },
  prog:   { l: "Progression G3 − G1", t: "quant", g: "Résultats", derived: true, u: "points", fixed: [-12, 12],
            def: "G3 − G1 ; vide (n. r.) pour les non-évalués, dont le 0 final n'est pas une chute réelle" },
  g3band: { l: "Bande de G3", t: "ord", g: "Résultats", derived: true,
            d: [1, 2, 3], s: ["< 10", "10–13", "≥ 14"],
            v: { 1: "▼ échec (< 10)", 2: "● juste (10–13)", 3: "▲ solide (≥ 14)" },
            def: "G3 en 3 bandes : < 10, 10–13, ≥ 14 (option de couleur ; G3 reste sur l'axe 0–20)" }
});

/** Mises en garde affichées avec certains attributs. */
META.paid.note = "Non comparable entre matières : 46 % de « oui » en maths, 6 % en portugais. Exclu des vues d'analyse.";
META.schoolsup.note = "Association inversée attendue : le soutien est attribué aux élèves déjà en difficulté.";

/** Ordre des groupes pour les puces d'axes et la fiche élève. */
export const GROUPS = ["Démographie", "Famille", "Contexte scolaire", "Mode de vie", "Résultats"];

/** Seuil de réussite (échelle portugaise 0–20). */
export const PASS = 10;

/* ---------------------------------------------------------------------
   Attributs retenus par technique (étape 1 de docs/taches.md).
   Retirés des vues d'analyse (gardés dans la fiche et l'export) :
   age, famsize, Pstatus, guardian, famrel, nursery, famsup, paid,
   activities, internet, romantic ; Dalc/Walc → alc ; Medu/Fedu → pedu ;
   G1/G2 → slope graph uniquement.
   --------------------------------------------------------------------- */

/** Axes proposés dans les coordonnées parallèles (quantitatifs, ordinaux, binaires). */
export const AXIS_KEYS = ["school", "sex", "address", "pedu", "traveltime", "studytime", "failures", "schoolsup", "higher",
  "freetime", "goout", "alc", "health", "absC", "prog", "G3"];

/** Attributs de la matrice de Spearman : bruts, pour que la redondance Dalc/Walc, Medu/Fedu reste visible (U4.1). */
export const MATRIX_KEYS = ["Medu", "Fedu", "traveltime", "studytime", "failures", "freetime", "goout", "Dalc", "Walc", "health", "absences", "G3"];

/** Attributs proposés comme facettes des boxplots. */
export const PANEL_KEYS = ["school", "sex", "address", "Mjob", "Fjob", "reason", "pedu", "traveltime", "studytime", "failures",
  "schoolsup", "higher", "freetime", "goout", "alc", "health", "absCat"];

/** Correspondance attribut brut de la matrice → axe des coordonnées parallèles. */
export const AXIS_ALIAS = { Medu: "pedu", Fedu: "pedu", Dalc: "alc", Walc: "alc", absences: "absC" };

/** Attributs qui définissent le « profil » d'un élève (tâche U2.5). G3 est comparé par bande. */
export const PROFILE_KEYS = ["failures", "studytime", "pedu", "alc", "higher", "G3"];

/** Colonnes de la table. */
export const TABLE_COLS = ["school", "sex", "failures", "studytime", "pedu", "alc", "absences", "G1", "G2", "G3", "prog"];

/** Attributs mis en avant dans la fiche ; les autres sont repliés. */
export const KEY_ATTRS = ["school", "sex", "address", "pedu", "Mjob", "Fjob", "reason", "traveltime", "studytime", "failures",
  "schoolsup", "higher", "freetime", "goout", "alc", "health", "absences", "G1", "G2", "G3", "prog"];

/** Axes par défaut des coordonnées parallèles. */
export const DEFAULT_AXES = ["pedu", "studytime", "failures", "goout", "alc", "absC", "G3"];

/** Panneaux par défaut des small multiples (attributs de regroupement). */
export const DEFAULT_PANELS = ["failures", "higher", "pedu", "studytime"];

/** Seuil d'effectif sous lequel un groupe est signalé comme anecdotique. */
export const SMALL_N = 10;

/** Nombre maximal de modalités pour qu'un nominal devienne un axe parallèle. */
export const MAX_NOMINAL_AXIS = 3;

/** Nombre maximal de modalités pour qu'un attribut serve de facette de boxplot. */
export const MAX_GROUPS = 8;
