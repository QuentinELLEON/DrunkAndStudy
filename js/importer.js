// Import d'un fichier CSV fourni par l'utilisateur : modèle vide à télécharger, lecture, validation, typage.
// Aucune dépendance au DOM ni à D3 (importable depuis Node pour les tests). Contrat : docs/data-contracts.md, section 6.

import { EXPECTED_COLUMNS, SCHEMA, IMPORT_MAX_ROWS, NEIGHBORS, MIN_N_CORRELATION } from "./meta.js";
import { typeRows } from "./data.js";

export const TEMPLATE_FILENAME = "student-performance-modele.csv";
// Point-virgule : c'est le séparateur que Excel en français ouvre directement en colonnes.
export const TEMPLATE_SEPARATOR = ";";
// Au-delà, les erreurs de colonnes sont résumées en une ligne pour ne pas noyer l'utilisateur.
const MAX_REPORTED_COLUMNS = 8;

// Modèle vide : seulement la ligne d'en-tête, dans l'ordre des 33 colonnes attendues. BOM UTF-8 pour les tableurs.
export const templateCsv = () => "﻿" + EXPECTED_COLUMNS.join(TEMPLATE_SEPARATOR) + "\r\n";

let seq = 0;
// Clé unique par import : les caches des vues (clé = matière active) ne servent jamais les données d'un import précédent.
export const newImportKey = () => `import${++seq}`;

// Texte des valeurs acceptées pour une colonne (messages d'erreur et aide affichée à l'import).
export function describeColumn(col) {
  const s = SCHEMA[col];
  return s.kind === "nominal" ? s.values.join(", ") : `entier de ${s.min} à ${s.max}`;
}

// ---------- Lecture du CSV ----------

// Séparateur le plus fréquent sur la ligne d'en-tête : « ; » (tableur français), « , » ou tabulation.
export function detectSeparator(text) {
  const head = text.split(/\r\n|\n|\r/).find((l) => l.trim()) || "";
  const count = (ch) => head.split(ch).length - 1;
  const best = [";", ",", "\t"].map((s) => [s, count(s)]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ";";
}

// Analyseur CSV : guillemets (avec "" pour un guillemet), sauts de ligne CRLF / LF / CR. Retourne { records, unclosed }.
export function parseCsv(text, sep) {
  const records = [];
  let rec = [], cell = "", inQuotes = false;
  const endCell = () => { rec.push(cell); cell = ""; };
  const endRecord = () => { endCell(); records.push(rec); rec = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell.trim() === "") { cell = ""; inQuotes = true; }
    else if (ch === sep) endCell();
    else if (ch === "\r") { if (text[i + 1] === "\n") i++; endRecord(); }
    else if (ch === "\n") endRecord();
    else cell += ch;
  }
  if (cell !== "" || rec.length) endRecord();
  return { records, unclosed: inQuotes };
}

// ---------- Validation et typage ----------

// Lit et valide un CSV. Retourne { ok: false, errors, warnings } sans rien charger, ou
// { ok: true, key, rows, info, warnings } avec les élèves typés et leurs dérivés (mêmes que data.typeRows).
export function importCsv(text, key = newImportKey()) {
  const errors = [], warnings = [];
  const fail = () => ({ ok: false, errors, warnings });

  text = String(text == null ? "" : text).replace(/^﻿/, "");
  if (!text.trim()) { errors.push("Le fichier est vide."); return fail(); }

  const sep = detectSeparator(text);
  const { records, unclosed } = parseCsv(text, sep);
  if (unclosed) { errors.push("Un guillemet n'est jamais refermé : le fichier est mal formé."); return fail(); }

  // En-tête : noms reconnus sans tenir compte de la casse ni de l'ordre ; les colonnes inconnues sont ignorées.
  const canon = new Map(EXPECTED_COLUMNS.map((c) => [c.toLowerCase(), c]));
  const colIndex = {}, extras = [], dups = [];
  records[0].map((h) => h.trim()).forEach((h, i) => {
    const c = canon.get(h.toLowerCase());
    if (!c) { if (h) extras.push(h); return; }
    if (c in colIndex) dups.push(c); else colIndex[c] = i;
  });
  const missing = EXPECTED_COLUMNS.filter((c) => !(c in colIndex));
  if (missing.length === EXPECTED_COLUMNS.length) {
    errors.push("Aucune colonne reconnue sur la première ligne. Partez du modèle vide (bouton « Télécharger le modèle vide ») : il contient les 33 colonnes attendues.");
    return fail();
  }
  if (missing.length) errors.push(`Colonnes manquantes (${missing.length}) : ${missing.join(", ")}.`);
  if (dups.length) errors.push(`Colonnes en double : ${dups.join(", ")}.`);
  if (errors.length) return fail();
  if (extras.length) warnings.push(`Colonnes ignorées (${extras.length}) : ${extras.slice(0, 6).join(", ")}${extras.length > 6 ? ", …" : ""}.`);

  // Lignes de données : les lignes entièrement vides (fréquentes à la fin d'un export de tableur) sont sautées.
  const lines = [];
  records.slice(1).forEach((cells, k) => { if (cells.some((c) => c.trim() !== "")) lines.push({ line: k + 2, cells }); });
  if (!lines.length) {
    errors.push("Le fichier ne contient que l'en-tête : ajoutez une ligne par élève sous les noms de colonnes.");
    return fail();
  }
  if (lines.length > IMPORT_MAX_ROWS) {
    errors.push(`Le fichier contient ${lines.length} élèves ; la limite est de ${IMPORT_MAX_ROWS} (au-delà, le graphe de similarité devient trop lent).`);
    return fail();
  }

  // Chaque cellule est contrôlée contre le schéma. Les erreurs sont regroupées par colonne, avec quelques exemples.
  const problems = new Map();
  const flag = (col, line, shown) => {
    let p = problems.get(col);
    if (!p) { p = { n: 0, examples: [] }; problems.set(col, p); }
    p.n++;
    if (p.examples.length < 3) p.examples.push(shown === "" ? `ligne ${line}, vide` : `ligne ${line}, « ${shown} »`);
  };
  const raw = lines.map(({ line, cells }) => {
    const o = {};
    EXPECTED_COLUMNS.forEach((col) => {
      const spec = SCHEMA[col];
      const cell = (cells[colIndex[col]] === undefined ? "" : cells[colIndex[col]]).trim();
      if (cell === "") { flag(col, line, ""); o[col] = ""; return; }
      if (spec.kind === "nominal") {
        // « gp » ou « YES » sont ramenés au code d'origine ; toute autre valeur est refusée.
        const v = spec.values.find((x) => x.toLowerCase() === cell.toLowerCase());
        if (v === undefined) flag(col, line, cell);
        o[col] = v === undefined ? cell : v;
      } else {
        // Entier, « 15,0 » accepté (tableur français), « 15,5 » refusé.
        const ok = /^[+-]?\d+([.,]0+)?$/.test(cell);
        const n = ok ? Number(cell.replace(",", ".")) : NaN;
        if (!Number.isInteger(n) || n < spec.min || n > spec.max) flag(col, line, cell);
        o[col] = String(n);
      }
    });
    return o;
  });
  if (problems.size) {
    [...problems].slice(0, MAX_REPORTED_COLUMNS).forEach(([col, p]) => {
      const s = p.n > 1 ? "s" : "";
      errors.push(`Colonne « ${col} » : ${p.n} valeur${s} refusée${s} (${p.examples.join(" ; ")}${p.n > p.examples.length ? " ; …" : ""}). Attendu : ${describeColumn(col)}.`);
    });
    if (problems.size > MAX_REPORTED_COLUMNS) errors.push(`… et ${problems.size - MAX_REPORTED_COLUMNS} autres colonnes à corriger.`);
    return fail();
  }

  const rows = typeRows(raw, key);
  const nograde = rows.filter((r) => r.__nograde).length;
  const evaluated = rows.length - nograde;
  if (evaluated <= NEIGHBORS) {
    errors.push(`Il faut au moins ${NEIGHBORS + 1} élèves évalués : ${evaluated} trouvé${evaluated > 1 ? "s" : ""}. Les dossiers « non évalués » (note finale 0 et 0 absence) ne comptent pas.`);
    return fail();
  }
  if (evaluated < MIN_N_CORRELATION) warnings.push(`Moins de ${MIN_N_CORRELATION} élèves évalués : la matrice de corrélation ne sera pas calculée.`);

  return { ok: true, key, rows, errors, warnings, info: { rows: rows.length, evaluated, nograde, separator: sep, ignored: extras } };
}
