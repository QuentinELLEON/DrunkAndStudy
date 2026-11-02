// Métadonnées : fichiers, colonnes, libellés français, domaines ordonnés, réglages des vues.
// Aucune dépendance (importable depuis Node pour les tests). Contrat : docs/data-contracts.md.

export const DATASETS = {
  mat: { label: "Maths", file: "data/student-mat.csv", name: "maths" },
  por: { label: "Portugais", file: "data/student-por.csv", name: "portugais" },
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
export const MATRIX_KEYS = ["G3", "G2", "G1", "failures", "absences", "studytime", "traveltime", "goout", "Dalc", "Walc", "Medu", "Fedu"];
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
