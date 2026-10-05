/* =====================================================================
   data.js — chargement, typage, drapeau « non évalué », filtres, import
   ---------------------------------------------------------------------
   Pipeline (voir docs/pipeline.md) :
     fichier CSV brut → d3.csv() (ou d3.dsv(";") si le fichier est au format UCI) → lignes (chaînes)
     → typage via meta.js (nominal = chaîne, ordinal/quantitatif = nombre)
     → drapeaux internes (__i, __nograde, __delta, __trend)
     → attributs dérivés (pedu, alc, absC, absCat, prog, g3band) : DERIVATIONS
     → filtres : portée (école, sexe, non évalués) → groupe → tendance → brushes
   ===================================================================== */
/* global d3 */

import { META, EXPECTED_COLUMNS, MAX_NOMINAL_AXIS, MAX_GROUPS, DEFAULT_AXES,
  AXIS_KEYS, MATRIX_KEYS, PANEL_KEYS } from "./meta.js";

/**
 * Attributs dérivés (étape 2 de docs/taches.md). needs = colonnes sources ;
 * un dérivé n'est ajouté que si toutes ses sources sont présentes (CSV importé compris).
 * Les non-évalués (__nograde) reçoivent une valeur manquante (NaN) là où leur 0 serait un artefact.
 */
export const DERIVATIONS = {
  pedu:   { needs: ["Medu", "Fedu"], fn: d => Math.max(1, d.Medu, d.Fedu) },
  alc:    { needs: ["Dalc", "Walc"], fn: d => Math.min(3, Math.round((5 * d.Dalc + 2 * d.Walc) / 7)) },
  absC:   { needs: ["absences", "G3"], fn: d => d.__nograde ? NaN : d.absences },
  absCat: { needs: ["absences", "G3"], fn: d => d.__nograde ? 9 : !isFinite(d.absences) ? NaN
              : d.absences === 0 ? 0 : d.absences <= 4 ? 1 : d.absences <= 10 ? 2 : 3 },
  prog:   { needs: ["G1", "G3"], fn: d => d.__nograde ? NaN : d.G3 - d.G1 },
  g3band: { needs: ["G3"], fn: d => d.__nograde || !isFinite(d.G3) ? NaN : d.G3 < 10 ? 1 : d.G3 < 14 ? 2 : 3 }
};

/** Dérivés calculables pour un ensemble de colonnes brutes. */
export function derivedKeysFor(rawKeys) {
  return Object.keys(DERIVATIONS).filter(k => DERIVATIONS[k].needs.every(c => rawKeys.includes(c)));
}

export const DATASETS = {
  mat: { label: "Mathématiques", url: "data/student-mat.csv" },
  por: { label: "Portugais", url: "data/student-por.csv" }
};

/* ---------------- parsing ---------------- */

/** Détecte le séparateur sur la ligne d'en-tête : ";" (fichiers UCI d'origine), "," (Kaggle) ou tabulation. */
export function detectSeparator(text) {
  const nl = text.search(/\r?\n/);
  const head = nl < 0 ? text : text.slice(0, nl);
  const count = ch => head.split(ch).length - 1;
  const c = [[";", count(";")], [",", count(",")], ["\t", count("\t")]].sort((a, b) => b[1] - a[1]);
  return c[0][1] > 0 ? c[0][0] : ",";
}

/** Parse un texte CSV (séparateur auto) ; renvoie les lignes brutes (chaînes) avec .columns. */
export function parseText(text) {
  const clean = text.replace(/^﻿/, "").trim();          // BOM éventuel d'Excel
  if (!clean) throw new Error("le fichier est vide");
  const sep = detectSeparator(clean);
  const raw = d3.dsvFormat(sep).parse(clean);
  raw.columns = raw.columns.map(c => c.trim().replace(/^"|"$/g, ""));
  if (!raw.length) throw new Error("aucune ligne de données après l'en-tête");
  raw.separator = sep;
  return raw;
}

/* ---------------- typage ---------------- */

/**
 * Métadonnées de travail pour un ensemble de colonnes.
 * Colonnes connues → META ; colonnes inconnues → type inféré :
 *   tout numérique et ≤ 6 valeurs distinctes → ordinal, sinon quantitatif ;
 *   sinon nominal. (Le nominal/ordinal ne se devine pas de façon fiable :
 *   l'inférence est documentée comme une hypothèse.)
 */
export function buildMeta(columns, raw) {
  const meta = {};
  columns.forEach(k => {
    if (META[k]) { meta[k] = META[k]; return; }
    const vals = raw.map(r => (r[k] ?? "").trim()).filter(v => v !== "");
    const numeric = vals.length > 0 && vals.every(v => !isNaN(+v));
    const card = new Set(vals).size;
    const t = numeric ? (card <= 6 ? "ord" : "quant") : "nom";
    const m = { l: k, t, g: "Attributs importés", inferred: true };
    if (t === "ord") m.d = Array.from(new Set(vals.map(Number))).sort(d3.ascending);
    if (t === "nom") m.d = Array.from(new Set(vals)).sort(d3.ascending);
    meta[k] = m;
  });
  return meta;
}

export function trendOf(d) {
  if (!isFinite(d.__delta)) return null;
  return d.__delta <= -2 ? "down" : d.__delta >= 2 ? "up" : "flat";
}

/**
 * Convertit les chaînes selon le type et ajoute les attributs dérivés.
 * rawKeys : colonnes du fichier ; derivedKeys : dérivés à calculer (DERIVATIONS).
 */
export function typeRows(raw, meta, rawKeys, derivedKeys = []) {
  const hasGrades = ["G3", "absences"].every(k => rawKeys.includes(k));
  return raw.map((r, i) => {
    const o = { __i: i };
    rawKeys.forEach(k => {
      const v = (r[k] ?? "").trim();
      o[k] = meta[k].t === "nom" ? v : (v === "" ? NaN : +v);
    });
    // Dossier non renseigné : note finale nulle ET assiduité parfaite → donnée manquante, pas un zéro.
    o.__nograde = hasGrades ? (o.G3 === 0 && o.absences === 0) : false;
    derivedKeys.forEach(k => { o[k] = DERIVATIONS[k].fn(o); });
    // évolution sur l'année ; manquante pour un non-évalué (sinon il compterait comme un « décrochage »)
    o.__delta = rawKeys.includes("G1") && rawKeys.includes("G3") && !o.__nograde ? o.G3 - o.G1 : NaN;
    o.__trend = trendOf(o);
    return o;
  });
}

/** Assemble un jeu de données typé : colonnes brutes (export) + dérivés (vues). */
function makeDataset(fields, raw, meta, rawKeys) {
  const derivedKeys = derivedKeysFor(rawKeys);
  derivedKeys.forEach(k => { meta[k] = META[k]; });
  return {
    ...fields, meta,
    rawKeys,                                   // colonnes d'origine : export CSV, compatibilité
    keys: rawKeys.concat(derivedKeys),         // tout ce que les vues peuvent afficher
    derivedKeys,
    standard: EXPECTED_COLUMNS.every(c => rawKeys.includes(c)),   // schéma UCI complet → listes de docs/taches.md
    rows: typeRows(raw, meta, rawKeys, derivedKeys)
  };
}

/* ---------------- chargement ---------------- */

const cache = new Map();

/** Nettoie les noms de colonnes (BOM éventuel, espaces, guillemets). */
function cleanColumns(raw) {
  const map = raw.columns.map(c => [c, c.replace(/^﻿/, "").trim().replace(/^"|"$/g, "")]);
  if (map.some(([a, b]) => a !== b)) {
    raw.forEach(r => map.forEach(([a, b]) => { if (a !== b) { r[b] = r[a]; delete r[a]; } }));
  }
  raw.columns = map.map(m => m[1]);
  return raw;
}

/**
 * Charge (une fois) un jeu de données intégré avec d3.csv().
 * Si le fichier utilise « ; » (format UCI d'origine), d3.csv ne voit qu'une
 * seule colonne : on relit alors le même fichier avec d3.dsv(";").
 */
export function loadDataset(key) {
  if (!cache.has(key)) {
    const def = DATASETS[key];
    const p = d3.csv(def.url)
      .then(raw => (raw.columns.length === 1 && raw.columns[0].includes(";")) ? d3.dsv(";", def.url) : raw)
      .catch(err => {
        const local = location.protocol === "file:";
        throw new Error(local
          ? `Le navigateur interdit à d3.csv() de lire ${def.url} quand la page est ouverte en file://. ` +
            `Ouvrez le projet via un serveur statique (extension « Live Server » de VS Code, ou npx serve).`
          : `Impossible de charger ${def.url} (${err.message}). Vérifiez que le fichier existe dans data/.`);
      })
      .then(loaded => {
        const raw = cleanColumns(loaded);
        if (!raw.length) throw new Error(`${def.url} ne contient aucune ligne de données.`);
        const missing = EXPECTED_COLUMNS.filter(c => !raw.columns.includes(c));
        if (missing.length) throw new Error(`${def.url} : colonnes manquantes (${missing.join(", ")}).`);
        return makeDataset({ key, name: def.label, builtin: true }, raw, { ...META }, EXPECTED_COLUMNS.slice());
      });
    p.catch(() => cache.delete(key));            // permet de réessayer après une erreur
    cache.set(key, p);
  }
  return cache.get(key);
}

/** Lit un fichier CSV choisi par l'utilisateur (séparateur "," ou ";"). */
export function importFile(file) {
  return file.text().then(text => {
    const raw = parseText(text);
    const keys = raw.columns.filter(k => k !== "");
    if (keys.length < 2) throw new Error("il faut au moins deux colonnes (en-tête séparé par « , » ou « ; »)");
    const meta = buildMeta(keys, raw);
    return makeDataset({ key: "custom", name: file.name, builtin: false, separator: raw.separator }, raw, meta, keys);
  });
}

/* ---------------- listes d'attributs selon la technique ----------------
   Fichier au schéma UCI complet : listes retenues dans docs/taches.md (meta.js).
   Autre fichier : règles génériques fondées sur le type inféré.            */

/** Attributs éligibles comme axe parallèle. Générique : quantitatifs, ordinaux, nominaux à ≤ 3 modalités. */
export function axisKeys(ds) {
  if (ds.standard) return AXIS_KEYS.filter(k => ds.keys.includes(k));
  return ds.keys.filter(k => {
    const t = ds.meta[k].t;
    if (t !== "nom") return true;
    return new Set(ds.rows.map(d => d[k])).size <= MAX_NOMINAL_AXIS;
  });
}
/** Attributs pour la matrice de Spearman : quantitatifs et ordinaux bruts uniquement. */
export function numericKeys(ds) {
  if (ds.standard) return MATRIX_KEYS.filter(k => ds.keys.includes(k));
  return ds.rawKeys.filter(k => ds.meta[k].t !== "nom");
}
/** Attributs de regroupement pour les boxplots. Générique : ≤ 8 modalités, notes exclues. */
export function groupKeys(ds) {
  if (ds.standard) return PANEL_KEYS.filter(k => ds.keys.includes(k));
  return ds.keys.filter(k => {
    if (["G1", "G2", "G3", "g3band", "prog", "absC"].includes(k)) return false;   // notes et dérivés des notes : pas des groupes
    const card = new Set(ds.rows.map(d => d[k])).size;
    return card >= 2 && card <= MAX_GROUPS;
  });
}
/** Axes par défaut pour un jeu importé. */
export function defaultAxesFor(ds) {
  const eligible = axisKeys(ds);
  const std = DEFAULT_AXES.filter(k => eligible.includes(k));
  if (std.length >= 2) return std;
  return eligible.filter(k => ds.meta[k].t !== "nom").slice(0, 7).concat(eligible).slice(0, 7);
}

/* ---------------- filtres ---------------- */

/** Un brush en unités de données laisse-t-il passer cet élève ? */
export function passesBrush(d, key, b) {
  const v = d[key];
  if (b.kind === "range") return v >= b.lo && v <= b.hi;
  return b.values.includes(v);
}

/**
 * Calcule, une seule fois par rendu, les sous-ensembles dont chaque vue a besoin.
 *  scoped     : filtres de la barre (école, sexe, non évalués)
 *  noBrush    : scoped + groupe + tendance            → matrice (pas de restriction d'étendue)
 *  exceptGroup: scoped + tendance + brushes           → panneau boxplot du groupe filtré
 *  exceptTrend: scoped + groupe + brushes             → slope graph (montre les tendances masquées en fond)
 *  selection  : tout appliqué                          → tuiles, table, boxplots, slope, fiche
 */
export function derive(state, ds) {
  const base = ds ? ds.rows : [];
  const has = k => ds && ds.keys.includes(k);
  const scoped = base.filter(d =>
    (!state.excludeNoGrade || !d.__nograde) &&
    (!state.school || !has("school") || d.school === state.school) &&
    (!state.sex || !has("sex") || d.sex === state.sex));

  const gf = state.groupFilter && has(state.groupFilter.key) ? state.groupFilter : null;
  const byGroup = d => !gf || d[gf.key] === gf.value;
  const byTrend = d => state.trend === "all" || d.__trend === state.trend;
  const activeBrushes = Object.entries(state.brushes).filter(([k]) => state.axes.includes(k) && has(k));
  const byBrush = d => activeBrushes.every(([k, b]) => passesBrush(d, k, b));

  const noBrush = scoped.filter(d => byGroup(d) && byTrend(d));
  const selection = noBrush.filter(byBrush);
  return {
    ds, base, scoped, noBrush, selection,
    exceptGroup: gf ? scoped.filter(d => byTrend(d) && byBrush(d)) : selection,
    exceptTrend: state.trend !== "all" ? scoped.filter(d => byGroup(d) && byBrush(d)) : selection,
    selectionIds: new Set(selection.map(d => d.__i)),
    selected: state.selectedId == null ? null : base.find(d => d.__i === state.selectedId) || null,
    brushCount: activeBrushes.length
  };
}

/** Exporte des lignes (colonnes d'origine) au format CSV. */
export function toCSV(rows, keys) {
  return d3.csvFormat(rows.map(d => Object.fromEntries(keys.map(k => [k, d[k]]))), keys);
}
