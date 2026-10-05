// Tests des fonctions pures de js/stats.js — lancer : node tools/test-stats.mjs
import { readFileSync } from "node:fs";
import { ranks, spearman, pearson, boxStats, percentBelow } from "../js/stats.js";

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fails++; };
const near = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;

ok(JSON.stringify(ranks([10, 20, 20, 30])) === JSON.stringify([1, 2.5, 2.5, 4]), "rangs moyens des ex æquo");
ok(near(spearman([1, 2, 3, 4], [10, 100, 1000, 10000]), 1), "Spearman = 1 pour une relation monotone non linéaire");
ok(near(spearman([1, 2, 3, 4], [4, 3, 2, 1]), -1), "Spearman = −1 pour une relation décroissante");
ok(isNaN(pearson([1, 1, 1], [1, 2, 3])), "variance nulle → NaN (non calculable)");
const b = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 100]);
ok(b.med === 5 && b.q1 === 3 && b.q3 === 7 && b.hi === 8 && b.outliers === 1, "boxStats : quartiles type 7 et valeur atypique");
ok(near(percentBelow([1, 2, 3, 4], 3), 0.5), "rang centile");

// Contrôle sur les vraies données : effet du drapeau « non évalué » (spécification §1.6 a)
const txt = readFileSync(new URL("../data/student-mat.csv", import.meta.url), "utf8").trim().split(/\r?\n/);
const head = txt[0].split(","), rows = txt.slice(1).map(l => Object.fromEntries(l.split(",").map((v, i) => [head[i], v])));
const all = rows.map(r => ({ a: +r.absences, g: +r.G3 }));
const graded = all.filter(d => !(d.g === 0 && d.a === 0));
ok(all.length === 395 && all.length - graded.length === 38, `395 élèves en maths, 38 non évalués (trouvé : ${all.length - graded.length})`);
const rAll = pearson(all.map(d => d.a), all.map(d => d.g)), rGr = pearson(graded.map(d => d.a), graded.map(d => d.g));
ok(rAll > 0 && rGr < 0, `absences × G3 change de signe : r = ${rAll.toFixed(3)} (tous) → ${rGr.toFixed(3)} (évalués)`);
console.log(`ρ Spearman absences × G3 (évalués) = ${spearman(graded.map(d => d.a), graded.map(d => d.g)).toFixed(3)}`);

// Attributs dérivés (docs/taches.md, étape 2) : calculés par data.js sur les vraies données
const { typeRows, derivedKeysFor } = await import("../js/data.js");
const { META, EXPECTED_COLUMNS } = await import("../js/meta.js");
const med = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
for (const [f, nDown, nRisk, medHi, medZero, passPct] of [["mat", 34, 42, 9, 12, 74], ["por", 20, 67, 10, 13, 87]]) {
  const t = readFileSync(new URL(`../data/student-${f}.csv`, import.meta.url), "utf8").trim().split(/\r?\n/);
  const h = t[0].split(","), raw = t.slice(1).map(l => Object.fromEntries(l.split(",").map((v, i) => [h[i], v])));
  const dk = derivedKeysFor(EXPECTED_COLUMNS);
  const R = typeRows(raw, META, EXPECTED_COLUMNS, dk), G = R.filter(d => !d.__nograde);
  const count = (rows, k) => rows.reduce((m, d) => m.set(d[k], (m.get(d[k]) || 0) + 1), new Map());
  ok(dk.length === 6, `${f} : 6 dérivés (${dk.join(", ")})`);
  ok([...count(G, "alc").values()].every(n => n >= 10), `${f} : indice alcool sans groupe < 10 (${[...count(G, "alc")].sort().map(e => e.join("→")).join(", ")})`);
  ok(!count(G, "pedu").has(0), `${f} : éducation parentale sans modalité 0`);
  ok(R.filter(d => d.__nograde).every(d => isNaN(d.prog) && isNaN(d.risque) && d.absCat === 9 && d.reussite === ""), `${f} : non-évalués → prog, risque et réussite manquants, absCat « n. r. »`);
  const hi = G.filter(d => d.risque >= 2), zero = G.filter(d => d.risque === 0);
  ok(hi.length === nRisk, `${f} : ${nRisk} élèves à risque ≥ 2 (U1-3, trouvé ${hi.length})`);
  ok(med(hi.map(d => d.G3)) === medHi && med(zero.map(d => d.G3)) === medZero, `${f} : médiane de G3 ${medHi} (risque ≥ 2) contre ${medZero} (risque 0) (U2-4)`);
  ok(Math.round(100 * G.filter(d => d.reussite === "oui").length / G.length) === passPct, `${f} : ${passPct} % des élèves évalués ont G3 ≥ 10 (U2-1)`);
  ok(G.filter(d => d.__trend === "down").length === nDown, `${f} : ${nDown} trajectoires en baisse (G3 − G1 ≤ −2)`);
}

process.exit(fails ? 1 : 0);
