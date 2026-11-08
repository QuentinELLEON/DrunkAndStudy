// Métadonnées : fichiers, colonnes, libellés français, domaines ordonnés, réglages des vues.
// Aucune dépendance (importable depuis Node pour les tests). Contrat : docs/data-contracts.md.

export const DATASETS = {
  mat: { label: "Maths", file: "data/student-mat.csv", name: "maths", in: "en maths" },
  por: { label: "Portugais", file: "data/student-por.csv", name: "portugais", in: "en portugais" },
};

export const EXPECTED_COLUMNS = [
  "school", "sex", "age", "address", "famsize", "Pstatus", "Medu", "Fedu", "Mjob", "Fjob", "reason", "guardian",
  "traveltime", "studytime", "failures", "schoolsup", "famsup", "paid", "activities", "nursery", "higher",
  "internet", "romantic", "famrel", "freetime", "goout", "Dalc", "Walc", "health", "absences", "G1", "G2", "G3",
];

// Colonnes numériques (ordinaux et quantitatifs) ; les 17 autres restent des chaînes (codes d'origine).
export const NUMERIC_COLUMNS = [
  "age", "Medu", "Fedu", "traveltime", "studytime", "failures", "famrel", "freetime", "goout", "Dalc", "Walc",
  "health", "absences", "G1", "G2", "G3",
];

// ---------- Import d'un CSV (docs/data-contracts.md, section 6) ----------
// Schéma des 33 colonnes : type et domaine, utilisés pour valider un fichier importé et pour l'aide affichée à l'import.
// Codes nominaux = ceux du jeu d'origine (jamais modifiés). Bornes ordinales = celles des domaines de DIMS ; notes sur 0 à 20.
export const IMPORT_MAX_ROWS = 2000;              // au-delà, le graphe de similarité (O(n²)) devient trop lent
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;  // taille maximale du fichier lu dans le navigateur

const YN = ["yes", "no"];
const JOBS = ["teacher", "health", "services", "at_home", "other"];
const nom = (values, label) => ({ kind: "nominal", values, label });
const num = (min, max, label, kind = "ordinal") => ({ kind, min, max, label });
export const SCHEMA = {
  school: nom(["GP", "MS"], "École : GP Gabriel Pereira, MS Mousinho da Silveira"),
  sex: nom(["F", "M"], "Sexe"),
  age: num(10, 30, "Âge (15 à 22 dans le jeu d'origine)", "quantitative"),
  address: nom(["U", "R"], "Milieu : U urbain, R rural"),
  famsize: nom(["LE3", "GT3"], "Taille de la famille : LE3 trois personnes ou moins, GT3 plus de trois"),
  Pstatus: nom(["T", "A"], "Parents : T vivent ensemble, A séparés"),
  Medu: num(0, 4, "Études de la mère : 0 aucune, 1 primaire, 2 collège, 3 secondaire, 4 supérieur"),
  Fedu: num(0, 4, "Études du père : 0 aucune, 1 primaire, 2 collège, 3 secondaire, 4 supérieur"),
  Mjob: nom(JOBS, "Métier de la mère"),
  Fjob: nom(JOBS, "Métier du père"),
  reason: nom(["home", "reputation", "course", "other"], "Raison du choix de l'école"),
  guardian: nom(["mother", "father", "other"], "Tuteur légal"),
  traveltime: num(1, 4, "Trajet : 1 moins de 15 min, 2 de 15 à 30 min, 3 de 30 min à 1 h, 4 plus d'1 h"),
  studytime: num(1, 4, "Temps d'étude par semaine : 1 moins de 2 h, 2 de 2 à 5 h, 3 de 5 à 10 h, 4 plus de 10 h"),
  failures: num(0, 3, "Échecs passés (3 = trois ou plus)", "quantitative"),
  schoolsup: nom(YN, "Soutien scolaire de l'école"),
  famsup: nom(YN, "Soutien scolaire de la famille"),
  paid: nom(YN, "Cours payants dans la matière"),
  activities: nom(YN, "Activités extra-scolaires"),
  nursery: nom(YN, "A fréquenté l'école maternelle"),
  higher: nom(YN, "Veut faire des études supérieures"),
  internet: nom(YN, "Internet à la maison"),
  romantic: nom(YN, "En couple"),
  famrel: num(1, 5, "Relations familiales : 1 très mauvaises à 5 excellentes"),
  freetime: num(1, 5, "Temps libre après l'école : 1 très peu à 5 beaucoup"),
  goout: num(1, 5, "Sorties avec les amis : 1 très rares à 5 très fréquentes"),
  Dalc: num(1, 5, "Alcool en semaine : 1 très faible à 5 très élevé"),
  Walc: num(1, 5, "Alcool le week-end : 1 très faible à 5 très élevé"),
  health: num(1, 5, "État de santé : 1 très mauvais à 5 très bon"),
  absences: num(0, 200, "Nombre d'absences", "quantitative"),
  G1: num(0, 20, "Note de la 1re période, sur 20", "quantitative"),
  G2: num(0, 20, "Note de la 2e période, sur 20", "quantitative"),
  G3: num(0, 20, "Note finale, sur 20", "quantitative"),
};

// Seuils
export const PASS_MARK = 10;          // réussite : G3 >= 10
export const TREND_DELTA = 2;         // tendance : G3 - G1 <= -2 (baisse) ou >= +2 (hausse)
export const SMALL_N = 10;            // en dessous : groupe à signaler
export const NEIGHBORS = 5;           // graphe D : nombre de plus proches voisins
export const MIN_N_CORRELATION = 30;  // B : en dessous, pas de matrice

// Facteurs de risque (risque = nombre de facteurs vrais, 2 à 4 réunis en 2)
export const RISK_FACTORS = [
  { key: "failures", label: "Au moins 1 échec passé", test: (r) => r.failures >= 1 },
  { key: "absences", label: "Plus de 10 absences", test: (r) => r.absences > 10 },
  { key: "traveltime", label: "Trajet de 30 min ou plus", test: (r) => r.traveltime >= 3 },
  { key: "higher", label: "Ne vise pas le supérieur", test: (r) => r.higher === "no" },
];

// Dimensions catégorielles ou ordinales : libellé, ordre d'affichage, noms complets et courts.
// Les clés de `name` / `short` sont les valeurs stockées converties en chaîne.
export const DIMS = {
  school: { label: "École", order: ["GP", "MS"], name: { GP: "Gabriel Pereira", MS: "Mousinho da Silveira" }, short: { GP: "GP", MS: "MS" } },
  sex: { label: "Sexe", order: ["F", "M"], name: { F: "Filles", M: "Garçons" } },
  address: { label: "Milieu", order: ["U", "R"], name: { U: "Urbain", R: "Rural" } },
  higher: { label: "Projet d'études sup.", order: ["yes", "no"], name: { yes: "Vise le supérieur", no: "Ne vise pas le supérieur" }, short: { yes: "Oui", no: "Non" } },
  risque: { label: "Facteurs de risque", order: [0, 1, 2], name: { 0: "Aucun facteur", 1: "Un facteur", 2: "Deux ou plus" }, short: { 0: "0 facteur", 1: "1 facteur", 2: "2 ou +" } },
  tendance: { label: "Évolution de G1 à G3", order: ["hausse", "stable", "baisse"], name: { hausse: "En hausse", stable: "Stable", baisse: "En baisse" } },
  reussite: { label: "Note finale", order: ["oui", "non"], name: { oui: "10 ou plus", non: "Moins de 10" } },
  goout: { label: "Sorties", order: [1, 2, 3, 4, 5], name: { 1: "Très rares", 2: "Rares", 3: "Moyennes", 4: "Fréquentes", 5: "Très fréquentes" } },
  alc: { label: "Alcool", order: [1, 2, 3], name: { 1: "Faible", 2: "Modérée", 3: "Élevée" } },
  absCat: { label: "Absences", order: [0, 1, 2, 3], name: { 0: "Aucune", 1: "1 à 4", 2: "5 à 10", 3: "Plus de 10" } },
  studytime: { label: "Temps d'étude", order: [1, 2, 3, 4], name: { 1: "Moins de 2 h", 2: "2 à 5 h", 3: "5 à 10 h", 4: "Plus de 10 h" } },
  traveltime: { label: "Trajet", order: [1, 2, 3, 4], name: { 1: "Moins de 15 min", 2: "15 à 30 min", 3: "30 min à 1 h", 4: "Plus d'1 h" } },
  pedu: { label: "Éducation des parents", order: [1, 2, 3, 4], name: { 1: "Primaire ou moins", 2: "Collège", 3: "Secondaire", 4: "Supérieur" } },
  failures: { label: "Échecs passés", order: [0, 1, 2, 3], name: { 0: "Aucun", 1: "Un", 2: "Deux", 3: "Trois ou plus" } },
};

// Libellés des attributs numériques non catégoriels (matrice B, fiche élève)
export const ATTR_LABELS = {
  G3: "Note finale (G3)", G2: "Note 2e période (G2)", G1: "Note 1re période (G1)",
  failures: "Échecs passés", absences: "Absences", studytime: "Temps d'étude", traveltime: "Trajet", goout: "Sorties",
  Dalc: "Alcool en semaine", Walc: "Alcool le week-end", Medu: "Études de la mère", Fedu: "Études du père",
  alc: "Alcool", pedu: "Éducation des parents", risque: "Facteurs de risque", tendance: "Évolution", higher: "Études supérieures",
};

// Libellés des axes de la matrice B (plus courts que ATTR_LABELS)
export const ATTR_SHORT = {
  G3: "Note finale", G2: "Note G2", G1: "Note G1", failures: "Échecs passés", absences: "Absences", studytime: "Temps d'étude",
  traveltime: "Trajet", goout: "Sorties", Dalc: "Alcool semaine", Walc: "Alcool week-end", Medu: "Études mère", Fedu: "Études père",
};

// Comment dire « plus » et « moins » de chaque attribut dans une phrase (info-bulles de la matrice B)
export const ATTR_SENS = {
  G3: { plus: "une note finale plus haute", moins: "une note finale plus basse" },
  G2: { plus: "une note G2 plus haute", moins: "une note G2 plus basse" },
  G1: { plus: "une note G1 plus haute", moins: "une note G1 plus basse" },
  failures: { plus: "plus d'échecs passés", moins: "moins d'échecs passés" },
  absences: { plus: "plus d'absences", moins: "moins d'absences" },
  studytime: { plus: "plus de temps d'étude", moins: "moins de temps d'étude" },
  traveltime: { plus: "un trajet plus long", moins: "un trajet plus court" },
  goout: { plus: "plus de sorties", moins: "moins de sorties" },
  Dalc: { plus: "plus d'alcool en semaine", moins: "moins d'alcool en semaine" },
  Walc: { plus: "plus d'alcool le week-end", moins: "moins d'alcool le week-end" },
  Medu: { plus: "une mère plus diplômée", moins: "une mère moins diplômée" },
  Fedu: { plus: "un père plus diplômé", moins: "un père moins diplômé" },
};

// Réglages des vues
export const PSET_DEFAULT = ["school", "sex", "address", "alc", "absCat", "risque", "tendance", "reussite"];
export const PSET_PRESETS = {
  risque: { label: "Risque et décrochage", q: "Le cumul de facteurs de risque mène-t-il à l'échec et au décrochage ?", axes: ["risque", "tendance", "reussite"] },
  vie: { label: "Sorties et alcool", q: "Les sorties et l'alcool vont-ils avec de moins bonnes notes ?", axes: ["goout", "alc", "reussite"] },
  qui: { label: "Qui sont les élèves ?", q: "Qui sont les élèves, et lesquels réussissent ?", axes: ["school", "sex", "address", "reussite"] },
};
export const PSET_MIN_AXES = 2;   // un axe au moins + « reussite »
export const PSET_ADDABLE = ["absCat", "studytime", "traveltime", "pedu", "higher", "failures", "alc", "goout", "risque", "tendance", "school", "sex", "address"];
export const PSET_MAX_AXES = 5;
// Ordre d'affichage de la matrice B, fixe pour que les lignes ne bougent pas quand on change de matière ou de filtre :
// du plus au moins lié à G3 en moyenne sur les deux matières (|ρ| de Spearman, élèves évalués).
export const MATRIX_KEYS = ["G3", "G2", "G1", "failures", "Medu", "absences", "Fedu", "studytime", "Dalc", "Walc", "goout", "traveltime"];
export const SUN_DEFAULT = ["school", "sex", "risque"];
export const SUN_DIMS = ["school", "sex", "address", "risque", "alc", "higher", "absCat", "pedu"];
export const SUN_MAX_LEVELS = 3;
export const SIMILARITY_KEYS = ["failures", "absences", "studytime", "traveltime", "goout", "alc", "pedu", "school", "sex", "address", "higher"];
// Dans SIMILARITY_KEYS : les attributs nominaux (distance 0 ou 1), les autres sont normalisés par leur étendue.
export const SIMILARITY_NOMINAL = ["school", "sex", "address", "higher"];

// Curseurs du panneau (état slide)
export const SLIDERS = {
  studytime: { label: "Temps d'étude par semaine", values: [1, 2, 3, 4] },
  goout: { label: "Sorties avec les amis", values: [1, 2, 3, 4, 5] },
};

// Fiche élève : lignes affichées
export const CARD_ROWS = ["G3", "G2", "G1", "tendance", "risque", "failures", "absences", "studytime", "traveltime", "goout", "alc", "pedu", "higher"];

// Aides de libellé
export const dimLabel = (dim) => (DIMS[dim] ? DIMS[dim].label : ATTR_LABELS[dim] || dim);
export const valueName = (dim, v) => {
  const n = DIMS[dim] && DIMS[dim].name[String(v)];
  return n === undefined ? String(v) : n;
};
export const valueShort = (dim, v) => (DIMS[dim] && DIMS[dim].short && DIMS[dim].short[String(v)]) || valueName(dim, v);
