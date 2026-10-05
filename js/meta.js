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
               s: ["< 15 min", "15–30 min", "30–60 min", "> 1 h"],
               v: { 1: "< 15 min", 2: "15–30 min", 3: "30–60 min", 4: "> 1 heure" } },
  studytime: { l: "Temps d'étude hebdo.", t: "ord", g: "Contexte scolaire", d: [1, 2, 3, 4],
               s: ["< 2 h", "2–5 h", "5–10 h", "> 10 h"],
               v: { 1: "< 2 heures", 2: "2–5 heures", 3: "5–10 heures", 4: "> 10 heures" } },
  failures:  { l: "Échecs passés", t: "quant", g: "Contexte scolaire", u: "classes", fixed: [0, 3],
               d: [0, 1, 2, 3], s: ["aucun", "1 échec", "2 échecs", "3 échecs"] },
  schoolsup: { l: "Soutien scolaire", t: "nom", g: "Contexte scolaire", ...YESNO },
  famsup:    { l: "Soutien familial", t: "nom", g: "Contexte scolaire", ...YESNO },
  paid:      { l: "Cours payants", t: "nom", g: "Contexte scolaire", ...YESNO },
  nursery:   { l: "École maternelle", t: "nom", g: "Contexte scolaire", ...YESNO },
  higher:    { l: "Vise le supérieur", t: "nom", g: "Contexte scolaire", ...YESNO },
  activities:{ l: "Activités extrascolaires", t: "nom", g: "Mode de vie", ...YESNO },
  internet:  { l: "Internet à la maison", t: "nom", g: "Mode de vie", ...YESNO },
  romantic:  { l: "En couple", t: "nom", g: "Mode de vie", ...YESNO },
  freetime:  { l: "Temps libre", t: "ord", g: "Mode de vie", d: [1, 2, 3, 4, 5], s: ["1", "2", "3", "4", "5"], v: L15 },
  goout:     { l: "Sorties entre amis", t: "ord", g: "Mode de vie", d: [1, 2, 3, 4, 5],
               s: ["très rares", "rares", "moyennes", "fréquentes", "très fréq."], v: L15 },
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
   def : définition affichée au survol.
   --------------------------------------------------------------------- */
Object.assign(META, {
  pedu:     { l: "Éducation parentale (max.)", t: "ord", g: "Famille", derived: true,
              d: [1, 2, 3, 4], s: ["≤ primaire", "collège", "lycée", "supérieur"],
              v: { 1: "≤ primaire", 2: "5e–9e année", 3: "secondaire", 4: "enseignement supérieur" },
              def: "max(Medu, Fedu) ; « aucune » (3 à 6 élèves) fusionnée avec « primaire »" },
  alc:      { l: "Alcool (indice)", t: "ord", g: "Mode de vie", derived: true,
              d: [1, 2, 3], s: ["faible", "modéré", "élevé"],
              v: { 1: "faible", 2: "modéré", 3: "élevé (≥ 3 sur 5)" },
              def: "arrondi de (5·Dalc + 2·Walc) / 7, niveaux 3 à 5 fusionnés (aucun groupe < 10 élèves)" },
  absCat:   { l: "Absences (classes)", t: "ord", g: "Résultats", derived: true,
              d: [0, 1, 2, 3, 9], s: ["aucune", "1–4", "5–10", "> 10", "n. r."],
              v: { 0: "aucune", 1: "1 à 4 créneaux", 2: "5 à 10 créneaux", 3: "plus de 10 créneaux", 9: "non renseigné (non évalué)" },
              def: "absences en 4 classes de créneaux de 2 h ; « n. r. » pour les non-évalués réinclus" },
  prog:     { l: "Progression G3 − G1", t: "quant", g: "Résultats", derived: true, u: "points",
              def: "G3 − G1 ; vide pour les non-évalués, dont le 0 final n'est pas une chute réelle" },
  risque:   { l: "Niveau de risque", t: "ord", g: "Contexte scolaire", derived: true,
              d: [0, 1, 2, 3, 4], s: ["0", "1", "2", "3", "4"],
              v: { 0: "0 facteur", 1: "1 facteur", 2: "2 facteurs", 3: "3 facteurs", 4: "4 facteurs" },
              def: "nombre de facteurs parmi : au moins 1 échec passé, plus de 10 absences, trajet de 30 min ou plus, ne vise pas le supérieur ; vide pour les non-évalués",
              // pour comparer des groupes (U2-4) : 2, 3 et 4 facteurs sont réunis (3 et 4 comptent moins de 10 élèves)
              bins: { d: [0, 1, 2], s: ["aucun facteur", "1 facteur", "2 facteurs ou plus"], of: v => isFinite(v) ? Math.min(2, v) : NaN } },
  tendance: { l: "Tendance de l'année", t: "nom", g: "Résultats", derived: true,
              d: ["baisse", "stable", "hausse"], s: ["▼ baisse", "● stable", "▲ hausse"],
              v: { baisse: "▼ baisse (G3 − G1 ≤ −2)", stable: "● stable", hausse: "▲ hausse (G3 − G1 ≥ +2)" },
              def: "G3 − G1 découpé en trois : baisse (au moins 2 points de moins), hausse (au moins 2 de plus), stable ; vide pour les non-évalués" },
  reussite: { l: "Réussite", t: "nom", g: "Résultats", derived: true,
              d: ["oui", "non"], s: ["réussite", "échec"], v: { oui: "▲ réussite (G3 ≥ 10)", non: "▼ échec (G3 < 10)" },
              def: "G3 ≥ 10 ; vide pour les non-évalués" }
});

/** Mises en garde affichées avec certains attributs. */
META.paid.note = "Non comparable entre matières : 46 % de « oui » en maths, 6 % en portugais. Exclu des vues.";
META.schoolsup.note = "Association inversée attendue : le soutien est attribué aux élèves déjà en difficulté.";

/** Ordre des groupes pour la fiche élève. */
export const GROUPS = ["Démographie", "Famille", "Contexte scolaire", "Mode de vie", "Résultats"];

/** Seuil de réussite (échelle portugaise 0–20). */
export const PASS = 10;

/** Seuil d'effectif sous lequel un groupe est signalé comme anecdotique. */
export const SMALL_N = 10;

/** Nombre maximal de modalités pour qu'un attribut serve de groupe (fichier importé). */
export const MAX_GROUPS = 8;

/* ---------------------------------------------------------------------
   Attributs retenus par technique (docs/taches.md).
   Retirés des vues (gardés dans la fiche et l'export) : age, famsize,
   Pstatus, guardian, famrel, nursery, famsup, paid, activities, internet,
   romantic, health, freetime, reason, Mjob, Fjob ; Dalc/Walc → alc ;
   Medu/Fedu → pedu.
   --------------------------------------------------------------------- */

/**
 * Facteurs de risque (tâches U1-3 et U2-4). Le niveau de risque d'un élève
 * est le nombre de facteurs qu'il cumule (attribut dérivé « risque »).
 */
export const RISK_FACTORS = [
  { id: "fail",   label: "Au moins 1 échec passé",   test: d => d.failures >= 1 },
  { id: "abs",    label: "Plus de 10 absences",       test: d => d.absences > 10 },
  { id: "travel", label: "Trajet de 30 min ou plus",  test: d => d.traveltime >= 3 },
  { id: "nohigh", label: "Ne vise pas le supérieur",  test: d => d.higher === "no" }
];

/** Facteurs classés par Jim (U1-1, U2-3). */
export const FACTOR_KEYS = ["failures", "absCat", "studytime", "traveltime", "goout", "alc", "pedu"];

/** Groupes proposés pour les histogrammes d'Alexandre (U1-2, U2-4). */
export const HIST_GROUPS = ["sex", "school", "address", "risque", "failures", "absCat", "studytime", "traveltime", "goout", "alc", "pedu", "higher"];

/** Critères du simulateur de profil (U2-2, U2-5). */
export const SIM_KEYS = ["studytime", "goout", "alc", "failures"];

/** Bandes de notes du diagramme alluvial (Gabriel, U1-5). */
export const BANDS = [
  { k: "S", label: "solide (≥ 14)", icon: "▲" },
  { k: "J", label: "juste (10–13)", icon: "●" },
  { k: "E", label: "échec (< 10)", icon: "▼" },
  { k: "N", label: "non évalué", icon: "✕" }
];
export const bandOf = v => !isFinite(v) ? "N" : v < PASS ? "E" : v < 14 ? "J" : "S";

/** Colonnes de la table. */
export const TABLE_COLS = ["school", "sex", "risque", "failures", "absences", "traveltime", "higher", "G1", "G2", "G3", "prog"];

/** Attributs comparés à la moyenne de l'école dans la fiche (U1-4) ; les autres sont repliés. */
export const KEY_ATTRS = ["failures", "absences", "traveltime", "higher", "studytime", "goout", "alc", "pedu", "risque", "G1", "G2", "G3", "prog"];

/* ---------------------------------------------------------------------
   Les quatre techniques de la 2e partie (docs/taches.md, « Techniques du projet »)
   --------------------------------------------------------------------- */

/** Dimensions proposées pour les ensembles parallèles (Quentin) ; reussite est toujours la dernière. */
export const PSET_KEYS = ["school", "sex", "address", "studytime", "goout", "alc", "absCat", "failures", "higher", "risque", "tendance", "reussite"];
export const PSET_DEFAULT = ["school", "sex", "address", "alc", "absCat", "risque", "tendance", "reussite"];

/** Attributs ordonnables de la matrice de corrélation (Jim). */
export const MATRIX_KEYS = ["G3", "failures", "absences", "studytime", "traveltime", "goout", "alc", "Dalc", "Walc", "pedu", "Medu", "Fedu"];

/** Niveaux proposés pour le sunburst (Alexandre), 3 au plus. */
export const SUN_KEYS = ["school", "sex", "address", "risque", "higher", "alc", "studytime", "tendance"];
export const SUN_DEFAULT = ["school", "sex", "risque"];

/** Profil utilisé par le graphe de similarité (Gabriel), sans les notes. */
export const SIMILARITY_KEYS = ["failures", "absences", "studytime", "traveltime", "goout", "alc", "pedu", "school", "sex", "address", "higher"];
export const NEIGHBORS = 5;
