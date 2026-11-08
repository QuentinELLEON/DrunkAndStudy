// Tests sans navigateur de l'import CSV : js/importer.js (modèle, lecture, validation) et le schéma de js/meta.js.
// Lancer : node tools/test-import.mjs   (échoue avec un code non nul au premier écart)

import { readFileSync } from "node:fs";
import { importCsv, templateCsv, parseCsv, detectSeparator, TEMPLATE_SEPARATOR, describeColumn } from "../js/importer.js";
import { typeRows, evaluated, okCount } from "../js/data.js";
import { EXPECTED_COLUMNS, NUMERIC_COLUMNS, SCHEMA, IMPORT_MAX_ROWS } from "../js/meta.js";

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.error("✗", msg); } };
const eq = (a, b, msg) => ok(Object.is(a, b) || a === b, `${msg} : attendu ${b}, obtenu ${a}`);

// ---------- Données réelles (copie du jeu d'origine, séparateur « , ») ----------
const readText = (f) => readFileSync(new URL(`../data/student-${f}.csv`, import.meta.url), "utf8");
const readRaw = (f) => {
  const [head, ...lines] = readText(f).trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
};
const lines = (f) => readText(f).trim().split(/\r?\n/);
const toSep = (text, sep) => text.trim().split(/\r?\n/).map((l) => l.split(",").join(sep)).join("\r\n");

// ---------- Schéma ----------
eq(Object.keys(SCHEMA).length, 33, "le schéma décrit 33 colonnes");
ok(EXPECTED_COLUMNS.every((c) => c in SCHEMA), "chaque colonne attendue est dans le schéma");
ok(NUMERIC_COLUMNS.every((c) => SCHEMA[c].kind !== "nominal") && Object.keys(SCHEMA).filter((c) => SCHEMA[c].kind !== "nominal").length === NUMERIC_COLUMNS.length,
  "colonnes numériques du schéma = NUMERIC_COLUMNS");
eq(describeColumn("sex"), "F, M", "aide d'une colonne nominale");
eq(describeColumn("G3"), "entier de 0 à 20", "aide d'une colonne numérique");

// ---------- Modèle vide ----------
const tpl = templateCsv();
ok(tpl.startsWith("﻿"), "le modèle commence par un BOM UTF-8");
eq(tpl.slice(1).trim().split(TEMPLATE_SEPARATOR).join(","), EXPECTED_COLUMNS.join(","), "le modèle contient les 33 colonnes dans l'ordre");
eq(tpl.trim().split(/\r?\n/).length, 1, "le modèle est vide : une seule ligne (l'en-tête)");
eq(detectSeparator(tpl), ";", "séparateur du modèle détecté");
const emptyTpl = importCsv(tpl, "t");
ok(!emptyTpl.ok && /que l'en-tête/.test(emptyTpl.errors.join(" ")), "le modèle vide est refusé avec un message clair");

// ---------- Import des vrais fichiers : mêmes lignes que data.typeRows ----------
for (const f of ["mat", "por"]) {
  const expected = typeRows(readRaw(f), "k");
  const r = importCsv(readText(f), "k");
  ok(r.ok, `import de student-${f}.csv`);
  eq(JSON.stringify(r.rows), JSON.stringify(expected), `student-${f}.csv : lignes identiques à typeRows`);
  eq(r.info.rows, f === "mat" ? 395 : 649, `student-${f}.csv : nombre de lignes`);
  eq(r.info.evaluated, f === "mat" ? 357 : 634, `student-${f}.csv : élèves évalués`);
  eq(r.info.nograde, f === "mat" ? 38 : 15, `student-${f}.csv : non évalués`);
  eq(okCount(evaluated(r.rows)), okCount(evaluated(expected)), `student-${f}.csv : réussites`);
  eq(r.rows[0].__ds, "k", "la clé de l'import est posée sur chaque ligne");
}

// Variantes de format du même fichier
const mat = readText("mat");
const same = (text, label) => {
  const r = importCsv(text, "k");
  ok(r.ok, `${label} : accepté`);
  if (r.ok) eq(JSON.stringify(r.rows), JSON.stringify(typeRows(readRaw("mat"), "k")), `${label} : mêmes données`);
};
same(toSep(mat, ";"), "séparateur point-virgule, CRLF");
same("﻿" + toSep(mat, ";"), "point-virgule avec BOM");
same(toSep(mat, "\t"), "séparateur tabulation");
same(mat.trim().split(/\r?\n/).map((l) => l.split(",").map((c) => `"${c}"`).join(",")).join("\n"), "toutes les cellules entre guillemets");
same(toSep(mat, ";") + "\r\n;;;;;;;;\r\n\r\n", "lignes vides en fin de fichier (export de tableur)");
same(mat.trim().replace(/\r?\n/g, "\r"), "fins de ligne CR seules");
{
  const [head, ...rest] = lines("mat");
  const cols = head.split(",");
  // Ordre des colonnes inversé, en-têtes en minuscules, une colonne en plus
  const order = cols.map((_, i) => i).reverse();
  const out = [[...order.map((i) => cols[i].toLowerCase()), "commentaire"].join(",")];
  rest.forEach((l) => { const c = l.split(","); out.push([...order.map((i) => c[i]), "x"].join(",")); });
  const r = importCsv(out.join("\n"), "k");
  ok(r.ok, "colonnes dans le désordre, en minuscules, avec une colonne en plus : accepté");
  if (r.ok) {
    eq(JSON.stringify(r.rows), JSON.stringify(typeRows(readRaw("mat"), "k")), "désordre : mêmes données");
    ok(r.warnings.some((w) => /commentaire/.test(w)), "la colonne en plus est signalée et ignorée");
  }
}

// ---------- Valeurs tolérées ----------
const base = lines("mat").slice(0, 61).join("\n");   // en-tête + 60 élèves
// Modifie des cellules de `base` (60 élèves) après l'avoir converti vers le séparateur voulu.
// Les décimales à virgule (« 11,0 ») ne se testent qu'avec « ; », comme dans un export de tableur français.
const edit = (fn, sep = ",") => {
  const [h, ...rest] = toSep(base, sep).split("\r\n");
  const cols = h.split(sep);
  return [h, ...rest.map((l, i) => fn(l.split(sep), cols, i).join(sep))].join("\r\n");
};
{
  const r = importCsv(edit((c, cols, i) => { if (i === 0) { c[cols.indexOf("school")] = "gp"; c[cols.indexOf("higher")] = "YES"; c[cols.indexOf("G1")] = "11,0"; } return c; }, ";"), "k");
  ok(r.ok, "casse des codes et « 11,0 » acceptés");
  if (r.ok) { eq(r.rows[0].school, "GP", "« gp » ramené à « GP »"); eq(r.rows[0].higher, "yes", "« YES » ramené à « yes »"); eq(r.rows[0].G1, 11, "« 11,0 » lu comme 11"); }
}

// ---------- Erreurs ----------
{
  const r = importCsv(edit((c, cols, i) => {
    if (i === 0) c[cols.indexOf("school")] = "XX";
    if (i === 1) c[cols.indexOf("G3")] = "25";
    if (i === 2) c[cols.indexOf("age")] = "abc";
    if (i === 3) c[cols.indexOf("G2")] = "";
    if (i === 4) c[cols.indexOf("absences")] = "3,5";
    return c;
  }, ";"), "k");
  ok(!r.ok, "valeurs hors domaine : refusé");
  const msg = r.errors.join("\n");
  ok(/Colonne « school » : 1 valeur refusée \(ligne 2, « XX »\)/.test(msg), "école inconnue signalée avec sa ligne");
  ok(/Colonne « G3 »[^\n]*ligne 3, « 25 »[^\n]*entier de 0 à 20/.test(msg), "note hors 0–20 signalée avec la plage attendue");
  ok(/Colonne « age »[^\n]*« abc »/.test(msg), "âge non numérique signalé");
  ok(/Colonne « G2 »[^\n]*ligne 5, vide/.test(msg), "cellule vide signalée");
  ok(/Colonne « absences »[^\n]*« 3,5 »/.test(msg), "décimal non entier refusé");
  eq(r.errors.length, 5, "une ligne d'erreur par colonne fautive");
}
{
  // Plusieurs lignes fautives dans la même colonne : un seul message, avec effectif et trois exemples
  const r = importCsv(edit((c, cols, i) => { if (i < 6) c[cols.indexOf("sex")] = "Z"; return c; }), "k");
  ok(!r.ok && r.errors.length === 1 && /6 valeurs refusées/.test(r.errors[0]) && /…/.test(r.errors[0]), "erreurs regroupées par colonne");
}
{
  const r = importCsv(edit((c) => c).split("\n").map((l, i) => (i === 0 ? l.replace(",G3", "").replace("G1,", "") : l)).join("\n"), "k");
  ok(!r.ok && /Colonnes manquantes \(2\) : G1, G3/.test(r.errors.join(" ")), "colonnes manquantes listées");
}
ok(!importCsv("", "k").ok && /vide/.test(importCsv("", "k").errors[0]), "fichier vide refusé");
ok(!importCsv("a;b;c\n1;2;3", "k").ok && /Aucune colonne reconnue/.test(importCsv("a;b;c\n1;2;3", "k").errors[0]), "en-tête inconnu refusé avec renvoi au modèle");
ok(!importCsv(base.replace('GP,F', '"GP,F'), "k").ok, "guillemet non fermé refusé");
{
  const dup = base.split("\n").map((l, i) => (i === 0 ? l + ",G3" : l + ",5")).join("\n");
  ok(!importCsv(dup, "k").ok && /double/.test(importCsv(dup, "k").errors.join(" ")), "colonne en double refusée");
}
{
  const big = lines("mat");
  const many = [big[0]].concat(Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => big[1 + (i % 300)])).join("\n");
  const r = importCsv(many, "k");
  ok(!r.ok && new RegExp(`${IMPORT_MAX_ROWS}`).test(r.errors[0]), "trop de lignes refusé");
}

// ---------- Effectifs ----------
{
  const small = lines("mat").filter((l, i) => i === 0 || /,0$/.test(l) === false).slice(0, 4).join("\n");   // 3 élèves
  const r = importCsv(small, "k");
  ok(!r.ok && /au moins 6 élèves évalués/.test(r.errors.join(" ")), "moins de 6 élèves évalués refusé");
}
{
  const few = lines("mat").filter((l, i) => i === 0 || !/,0$/.test(l)).slice(0, 21).join("\n");   // 20 élèves, tous avec G3 > 0 donc évalués
  const r = importCsv(few, "k");
  ok(r.ok && r.warnings.some((w) => /matrice de corrélation/.test(w)), "moins de 30 élèves évalués : accepté avec avertissement");
}
{
  // Que des dossiers non évalués (G3 = 0 et 0 absence)
  const ne = lines("mat").slice(0, 13);   // en-tête + 12 élèves, tous forcés à absences = 0 et G3 = 0
  const noGrade = [ne[0], ...ne.slice(1).map((l) => { const c = l.split(","); c[29] = "0"; c[32] = "0"; return c.join(","); })].join("\n");
  const r = importCsv(noGrade, "k");
  ok(!r.ok && /évalués/.test(r.errors.join(" ")), "fichier sans aucun élève évalué refusé");
}

// ---------- Analyseur ----------
eq(JSON.stringify(parseCsv('a;"b;c";"d""e"\n1;2;3', ";").records), JSON.stringify([["a", "b;c", 'd"e'], ["1", "2", "3"]]), "guillemets, séparateur et guillemet doublé");
eq(JSON.stringify(parseCsv('a;"x\ny"\r\nb;c', ";").records), JSON.stringify([["a", "x\ny"], ["b", "c"]]), "saut de ligne entre guillemets");

console.log(fails ? `\n${fails} échec(s) sur ${checks} vérifications.` : `${checks} vérifications d'import réussies.`);
process.exit(fails ? 1 : 0);
