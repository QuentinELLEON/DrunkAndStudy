/* =====================================================================
   data.js — chargement, typage, drapeau « non évalué », filtres, import
   ---------------------------------------------------------------------
   Pipeline (voir docs/pipeline.md) :
     fichier CSV brut → d3.csv() (ou d3.dsv(";") si le fichier est au format UCI) → lignes (chaînes)
     → typage via meta.js (nominal = chaîne, ordinal/quantitatif = nombre)
     → drapeaux internes (__i, __nograde, __delta, __trend)
     → attributs dérivés (pedu, alc, absCat, prog, risque, reussite) : DERIVATIONS
     → filtres : portée (école, sexe, non évalués) → critères de risque → groupe
                 → tendance / flux de notes  (derive)
   ===================================================================== */
/* global d3 */

import { META, EXPECTED_COLUMNS, MAX_GROUPS, RISK_FACTORS, FACTOR_KEYS, HIST_GROUPS, bandOf } from "./meta.js";

/**
 * Attributs dérivés (étape 2 de docs/taches.md). needs = colonnes sources ;
 * un dérivé n'est ajouté que si toutes ses sources sont présentes (CSV importé compris).
 * Les non-évalués (__nograde) reçoivent une valeur manquante (NaN) là où leur 0 serait un artefact.
 */
export const DERIVATIONS = {
  pedu:   { needs: ["Medu", "Fedu"], fn: d => Math.max(1, d.Medu, d.Fedu) },
  alc:    { needs: ["Dalc", "Walc"], fn: d => Math.min(3, Math.round((5 * d.Dalc + 2 * d.Walc) / 7)) },
  absCat: { needs: ["absences", "G3"], fn: d => d.__nograde ? 9 : !isFinite(d.absences) ? NaN
              : d.absences === 0 ? 0 : d.absences <= 4 ? 1 : d.absences <= 10 ? 2 : 3 },
  prog:   { needs: ["G1", "G3"], fn: d => d.__nograde ? NaN : d.G3 - d.G1 },
  // nombre de facteurs de risque cumulés (meta.RISK_FACTORS) ; un non-évalué n'a pas d'absences fiables
  risque: { needs: ["failures", "absences", "traveltime", "higher", "G3"],
            fn: d => d.__nograde ? NaN : RISK_FACTORS.filter(f => f.test(d)).length },
  reussite: { needs: ["G3"], fn: d => d.__nograde || !isFinite(d.G3) ? "" : d.G3 >= 10 ? "oui" : "non" },
  // prog découpé pour les ensembles parallèles (catégories seulement)
  tendance: { needs: ["G1", "G3"], fn: d => d.__nograde || !isFinite(d.G1) || !isFinite(d.G3) ? ""
              : d.G3 - d.G1 <= -2 ? "baisse" : d.G3 - d.G1 >= 2 ? "hausse" : "stable" }
};

/** Valeur d'un attribut telle qu'on la groupe : modalités réunies si meta.bins (ex. risque 2, 3, 4 → « 2 ou plus »). */
export function groupValue(meta, key, d) {
  const B = meta[key] && meta[key].bins, v = d[key];
  return B ? B.of(v) : v;
}

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

const GRADES = ["G1", "G2", "G3", "prog", "reussite"];
const fewValues = (ds, k) => { const c = new Set(ds.rows.map(d => d[k])).size; return c >= 2 && c <= MAX_GROUPS; };

/** Facteurs classés par Jim. Générique : ordinaux / quantitatifs à ≤ 8 valeurs, notes exclues. */
export function factorKeys(ds) {
  if (ds.standard) return FACTOR_KEYS.filter(k => ds.keys.includes(k));
  return ds.keys.filter(k => ds.meta[k].t !== "nom" && !GRADES.includes(k) && fewValues(ds, k));
}
/** Groupes des histogrammes d'Alexandre. Générique : ≤ 8 modalités, notes exclues. */
export function histGroupKeys(ds) {
  if (ds.standard) return HIST_GROUPS.filter(k => ds.keys.includes(k));
  return ds.keys.filter(k => !GRADES.includes(k) && fewValues(ds, k));
}

/* ---------------- filtres ---------------- */

/** Un élève satisfait-il les critères de la grille (facteurs cochés ET niveau de risque minimal) ? */
export function passesCriteria(d, state) {
  if (state.riskMin > 0 && !(d.risque >= state.riskMin)) return false;
  return state.criteria.every(id => { const f = RISK_FACTORS.find(r => r.id === id); return !f || f.test(d); });
}

/** Un élève appartient-il au flux de notes cliqué dans le diagramme alluvial ? */
export function passesFlow(d, flow) {
  if (!flow) return true;
  const st = ["G1", "G2", "G3"];
  const b = k => k === "G3" && d.__nograde ? "N" : bandOf(d[k]);
  return b(st[flow.s]) === flow.a && b(st[flow.s + 1]) === flow.b;
}

/**
 * Calcule, une seule fois par rendu, les sous-ensembles dont chaque vue a besoin.
 *  scoped    : filtres de la barre (matière, école, sexe, non évalués)   → classement des facteurs, grille (fond)
 *  selection : scoped + critères de risque + groupe + tendance + flux   → tuiles, histogrammes, alluvial, table, fiche
 *  exceptFlow: selection sans le flux ni la tendance                     → alluvial (les autres flux restent en fond)
 *  exceptGroup: selection sans le filtre de groupe                        → histogrammes (les autres groupes restent estompés)
 */
export function derive(state, ds) {
  const base = ds ? ds.rows : [];
  const has = k => ds && ds.keys.includes(k);
  const scoped = base.filter(d =>
    (!state.excludeNoGrade || !d.__nograde) &&
    (!state.school || !has("school") || d.school === state.school) &&
    (!state.sex || !has("sex") || d.sex === state.sex));
  const std = ds && ds.standard;
  const gf = state.groupFilter && has(state.groupFilter.key) ? state.groupFilter : null;
  const byCrit = d => !std || passesCriteria(d, state);
  const bins = gf && ds.meta[gf.key] && ds.meta[gf.key].bins;          // groupes réunis (ex. risque ≥ 2)
  const byGroup = d => !gf || (bins ? bins.of(d[gf.key]) : d[gf.key]) === gf.value;
  const byTrend = d => state.trend === "all" || d.__trend === state.trend;
  const byFlow = d => passesFlow(d, state.flow);
  // sélection partagée des techniques de la 2e partie : catégories zoomées (A, C) et curseurs (U2-5)
  const drill = (state.drill || []).filter(c => has(c.key));
  const bySlide = d => Object.entries(state.slide || {}).every(([k, v]) => v == null || !has(k) || d[k] === v);
  const byDrillExcept = src => d => drill.every(c => c.src === src || groupValue(ds.meta, c.key, d) === c.value);
  const byDrill = byDrillExcept(null);
  const others = d => byCrit(d) && bySlide(d);
  const exceptFlow = scoped.filter(d => others(d) && byGroup(d) && byDrill(d));
  const selection = exceptFlow.filter(d => byTrend(d) && byFlow(d));
  const exceptGroup = gf ? scoped.filter(d => others(d) && byDrill(d) && byTrend(d) && byFlow(d)) : selection;
  // sunburst : tout sauf ses propres zooms (le zoom choisit la racine affichée)
  const exceptSun = drill.some(c => c.src === "sun")
    ? scoped.filter(d => others(d) && byGroup(d) && byDrillExcept("sun")(d) && byTrend(d) && byFlow(d)) : selection;
  const nCrit = std ? state.criteria.length + (state.riskMin > 0 ? 1 : 0) + drill.length
    + Object.values(state.slide || {}).filter(v => v != null).length : 0;
  return {
    ds, base, scoped, exceptFlow, exceptGroup, exceptSun, selection, drill,
    selectionIds: new Set(selection.map(d => d.__i)),
    selected: state.selectedId == null ? null : base.find(d => d.__i === state.selectedId) || null,
    filtered: selection.length !== scoped.length,
    nCrit
  };
}

/** Exporte des lignes (colonnes d'origine) au format CSV. */
export function toCSV(rows, keys) {
  return d3.csvFormat(rows.map(d => Object.fromEntries(keys.map(k => [k, d[k]]))), keys);
}
