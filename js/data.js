// Données : chargement (d3.csv), typage, attributs dérivés, filtres. Contrat : docs/data-contracts.md.
// Seule loadDataset() utilise la variable globale `d3` ; le reste est pur (testable sous Node).

import {
  DATASETS, EXPECTED_COLUMNS, NUMERIC_COLUMNS, PASS_MARK, TREND_DELTA, RISK_FACTORS,
} from "./meta.js";

const cache = new Map();

// ---------- Chargement ----------

// Lit data/student-<ds>.csv avec D3. Gère la copie d'origine UCI (séparateur « ; ») et nettoie les en-têtes.
export async function loadDataset(ds) {
  if (cache.has(ds)) return cache.get(ds);
  const info = DATASETS[ds];
  if (!info) throw new Error(`Matière inconnue : ${ds}`);
  if (typeof d3 === "undefined") throw new Error("D3 n'est pas chargé.");
  let raw = await d3.csv(info.file);
  if (raw.columns && raw.columns.length === 1 && raw.columns[0].includes(";")) raw = await d3.dsv(";", info.file);
  const rows = typeRows(raw, ds);
  cache.set(ds, rows);
  return rows;
}

export const loadAll = () => Promise.all(Object.keys(DATASETS).map(async (ds) => [ds, await loadDataset(ds)]))
  .then((entries) => Object.fromEntries(entries));

// ---------- Typage et dérivés ----------

const clean = (s) => String(s).replace(/^﻿/, "").replace(/^"|"$/g, "").trim();

// raw : tableau d'objets { colonne: chaîne } (sortie de d3.csv). Retourne les élèves typés avec leurs dérivés.
export function typeRows(raw, ds = "") {
  const out = [];
  const first = raw[0] || {};
  const map = {};                       // nom nettoyé → clé réelle
  Object.keys(first).forEach((k) => { map[clean(k)] = k; });
  const missing = EXPECTED_COLUMNS.filter((c) => !(c in map));
  if (missing.length) throw new Error(`Colonnes manquantes : ${missing.join(", ")}`);
  raw.forEach((rec, i) => {
    const r = { __i: i, __ds: ds };
    EXPECTED_COLUMNS.forEach((c) => {
      const v = rec[map[c]];
      r[c] = NUMERIC_COLUMNS.includes(c) ? Number(v) : clean(v);
    });
    out.push(derive1(r));
  });
  return out;
}

// Ajoute les attributs dérivés (voir data-contracts.md). Les dérivés qui dépendent des notes valent null
// pour un dossier non renseigné (G3 = 0 et absences = 0).
export function derive1(r) {
  r.__nograde = r.G3 === 0 && r.absences === 0;
  r.pedu = Math.max(1, Math.max(r.Medu, r.Fedu));
  r.alc = Math.min(3, Math.round((5 * r.Dalc + 2 * r.Walc) / 7));
  if (r.__nograde) {
    r.reussite = r.risque = r.absCat = r.prog = r.tendance = null;
  } else {
    r.reussite = r.G3 >= PASS_MARK ? "oui" : "non";
    r.risque = Math.min(2, RISK_FACTORS.reduce((s, f) => s + (f.test(r) ? 1 : 0), 0));
    r.absCat = r.absences === 0 ? 0 : r.absences <= 4 ? 1 : r.absences <= 10 ? 2 : 3;
    r.prog = r.G3 - r.G1;
    r.tendance = r.prog <= -TREND_DELTA ? "baisse" : r.prog >= TREND_DELTA ? "hausse" : "stable";
  }
  return r;
}

// ---------- Agrégats ----------

export const okCount = (rows) => rows.reduce((s, r) => s + (r.reussite === "oui" ? 1 : 0), 0);
export const evaluated = (rows) => rows.filter((r) => !r.__nograde);
// Taux de réussite parmi les élèves évalués de `rows` (NaN si aucun)
export function rate(rows) {
  const ev = evaluated(rows);
  return ev.length ? okCount(ev) / ev.length : NaN;
}

// ---------- Filtres et sous-ensembles ----------

const same = (a, b) => String(a) === String(b);
const passDrill = (r, drill) => drill.every((f) => same(r[f.dim], f.value));
const passSlide = (r, slide) => Object.entries(slide || {}).every(([k, v]) => v === null || v === undefined || same(r[k], v));

// Calcule une seule fois par rendu les sous-ensembles utilisés par les vues.
//   base           matière active, non-évalués exclus sauf state.inclNE
//   selection      base filtrée par state.drill et state.slide
//   exceptSrc(src) selection sans les contraintes de drill posées par `src` ("pset" | "sun")
//   selected       l'élève de state.selectedId (ou null)
export function derive(rowsByDs, state) {
  const all = rowsByDs[state.ds] || [];
  const base = all.filter((r) => state.inclNE || !r.__nograde);
  const selection = base.filter((r) => passDrill(r, state.drill) && passSlide(r, state.slide));
  const exceptSrc = (src) => {
    const drill = state.drill.filter((f) => f.src !== src);
    return base.filter((r) => passDrill(r, drill) && passSlide(r, state.slide));
  };
  const selected = state.selectedId === null ? null : all.find((r) => r.__i === state.selectedId) || null;
  return { all, base, selection, exceptSrc, selected };
}

// Élèves de la même école dans la même matière que `student`, évalués seulement (référence de la fiche et de la trajectoire).
export const schoolPeers = (rows, student) => evaluated(rows).filter((r) => r.school === student.school);

// Valeur « typique » d'un attribut sur un groupe : médiane des quantitatifs, valeur la plus fréquente sinon.
export function typical(rows, attr, quantitative) {
  const vals = rows.map((r) => r[attr]).filter((v) => v !== null && v !== undefined);
  if (!vals.length) return null;
  if (quantitative) {
    const s = vals.slice().sort((a, b) => a - b), h = (s.length - 1) / 2;
    return (s[Math.floor(h)] + s[Math.ceil(h)]) / 2;
  }
  const counts = new Map();
  vals.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
