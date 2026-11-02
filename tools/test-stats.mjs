// Tests sans navigateur : fonctions pures de js/stats.js, typage et dérivés de js/data.js, filtres, état.
// Lancer : node tools/test-stats.mjs   (échoue avec un code non nul au premier écart)
// Les chiffres de référence viennent de docs/visualisations.md (élèves évalués, maths puis portugais).

import { readFileSync } from "node:fs";
import { ranks, pearson, spearman, spearmanMatrix, quantile, median, boxStats, gower, gowerRanges, knn, significanceThreshold } from "../js/stats.js";
import { typeRows, derive, rate, evaluated, okCount } from "../js/data.js";
import { SIMILARITY_KEYS, SIMILARITY_NOMINAL, NEIGHBORS, MATRIX_KEYS, EXPECTED_COLUMNS } from "../js/meta.js";
import { pct, f1, signed } from "../js/utils.js";
import { describe } from "../js/views/correlationMatrix.js";

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.error("✗", msg); } };
const eq = (a, b, msg) => ok(Object.is(a, b) || a === b, `${msg} : attendu ${b}, obtenu ${a}`);
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg} : attendu ${b} ± ${tol}, obtenu ${a}`);

// ---------- stats.js ----------
eq(JSON.stringify(ranks([10, 20, 20, 30])), JSON.stringify([1, 2.5, 2.5, 4]), "rangs avec ex æquo");
near(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1, 1e-12, "pearson parfait");
near(spearman([{ a: 1, b: 1 }, { a: 2, b: 8 }, { a: 3, b: 27 }, { a: 4, b: 64 }], "a", "b"), 1, 1e-12, "spearman monotone non linéaire");
ok(Number.isNaN(spearman([{ a: 1, b: 2 }, { a: 1, b: 3 }, { a: 1, b: 4 }], "a", "b")), "spearman NaN si attribut constant");
eq(quantile([1, 2, 3, 4], 0.5), 2.5, "médiane paire");
eq(median([3, 1, 2]), 2, "médiane impaire");
eq(boxStats([1, 2, 3, 4, 5]).q1, 2, "q1");
eq(spearmanMatrix([{ x: 1, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 0 }], ["x", "y"]).length, 1, "matrice 2 attributs : 1 cellule");
near(significanceThreshold(357), 0.1038, 1e-3, "seuil de signification n = 357");
eq(pct(0.744), "74 %", "format pourcentage");
eq(f1(11.5), "11,5", "format décimal français");
eq(signed(-0.3), "−0,30", "signe typographique");

// ---------- Données réelles ----------
const read = (f) => {
  const [head, ...lines] = readFileSync(new URL(`../data/student-${f}.csv`, import.meta.url), "utf8").trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
};
const ds = { mat: typeRows(read("mat"), "mat"), por: typeRows(read("por"), "por") };

eq(ds.mat.length, 395, "lignes maths"); eq(ds.por.length, 649, "lignes portugais");
eq(EXPECTED_COLUMNS.length, 33, "33 colonnes attendues");
try { typeRows([{ school: "GP" }]); ok(false, "colonnes manquantes : erreur attendue"); } catch { ok(true, ""); }

const EXPECT = {
  mat: { nograde: 38, evaluated: 357, risk2: 42, drop: 34, flat: 245, up: 78, passRate: 0.74, riskRate: [0.43, 0.81], riskMed: [9, 12] },
  por: { nograde: 15, evaluated: 634, risk2: 67, drop: 20, flat: 461, up: 153, passRate: 0.87, riskRate: [0.58, 0.94], riskMed: [10, 13] },
};
for (const k of ["mat", "por"]) {
  const rows = ds[k], E = EXPECT[k], ev = evaluated(rows);
  eq(rows.filter((r) => r.__nograde).length, E.nograde, `${k} : non évalués`);
  eq(ev.length, E.evaluated, `${k} : évalués`);
  ok(rows.filter((r) => r.__nograde).every((r) => r.reussite === null && r.risque === null && r.tendance === null && r.absCat === null && r.prog === null), `${k} : dérivés nuls pour un non-évalué`);
  const r2 = ev.filter((r) => r.risque === 2), r0 = ev.filter((r) => r.risque === 0);
  eq(r2.length, E.risk2, `${k} : risque 2 ou plus`);
  near(rate(r2), E.riskRate[0], 0.006, `${k} : réussite risque 2+`);
  near(rate(r0), E.riskRate[1], 0.006, `${k} : réussite risque 0`);
  eq(median(r2.map((r) => r.G3)), E.riskMed[0], `${k} : médiane G3 risque 2+`);
  eq(median(r0.map((r) => r.G3)), E.riskMed[1], `${k} : médiane G3 risque 0`);
  eq(ev.filter((r) => r.tendance === "baisse").length, E.drop, `${k} : tendance baisse`);
  eq(ev.filter((r) => r.tendance === "stable").length, E.flat, `${k} : tendance stable`);
  eq(ev.filter((r) => r.tendance === "hausse").length, E.up, `${k} : tendance hausse`);
  near(rate(rows), E.passRate, 0.006, `${k} : part ≥ 10/20`);
  ok(ev.every((r) => [1, 2, 3].includes(r.alc) && [1, 2, 3, 4].includes(r.pedu) && [0, 1, 2, 3].includes(r.absCat) && [0, 1, 2].includes(r.risque)), `${k} : domaines des dérivés`);
}

// Le signe de absences × G3 change selon les non-évalués (maths) : +0,034 avec eux, −0,213 sans eux
const withNE = pearson(ds.mat.map((r) => r.absences), ds.mat.map((r) => r.G3));
const withoutNE = pearson(evaluated(ds.mat).map((r) => r.absences), evaluated(ds.mat).map((r) => r.G3));
near(withNE, 0.034, 0.002, "r(absences, G3) avec non-évalués");
near(withoutNE, -0.213, 0.002, "r(absences, G3) sans non-évalués");

// Premier facteur lié à G3 hors G1 et G2 : failures (ρ −0,30 maths, −0,43 portugais)
for (const [k, expected] of [["mat", -0.30], ["por", -0.43]]) {
  const cells = spearmanMatrix(evaluated(ds[k]), MATRIX_KEYS).filter((c) => c.b === "G3" && !["G1", "G2"].includes(c.a));
  cells.sort((p, q) => Math.abs(q.rho) - Math.abs(p.rho));
  eq(cells[0].a, "failures", `${k} : premier facteur`);
  near(cells[0].rho, expected, 0.01, `${k} : ρ(failures, G3)`);
}

// Vue B : phrase décrivant une cellule (association, jamais cause)
{
  const thr = significanceThreshold(357);
  ok(/plus d'échecs passés ont en général une note finale plus basse.*lien faible/.test(describe({ a: "failures", b: "G3", rho: -0.2, n: 357 }, thr)), "describe : lien négatif faible");
  ok(/mère plus diplômée ont en général un père plus diplômé.*lien net/.test(describe({ a: "Medu", b: "Fedu", rho: 0.62, n: 357 }, thr)), "describe : lien positif net");
  ok(/ne dit pas lequel agit/.test(describe({ a: "traveltime", b: "G3", rho: -0.3, n: 357 }, thr)), "describe : rappel de l'absence de sens causal");
  ok(/Pas de lien net/.test(describe({ a: "Walc", b: "G3", rho: -0.02, n: 357 }, thr)), "describe : sous le seuil");
  ok(/non calculable/.test(describe({ a: "Walc", b: "G3", rho: NaN, n: 357 }, thr)), "describe : attribut constant");
}

// Graphe de similarité : 5 voisins, distances dans [0, 1], pas de doublon
{
  const ev = evaluated(ds.mat);
  const links = knn(ev, SIMILARITY_KEYS, NEIGHBORS, SIMILARITY_NOMINAL);
  const keys = new Set(links.map((l) => Math.min(l.source, l.target) + "-" + Math.max(l.source, l.target)));
  eq(keys.size, links.length, "liens sans doublon");
  ok(links.every((l) => l.d >= 0 && l.d <= 1 && l.source !== l.target), "distances de Gower dans [0, 1]");
  const deg = new Array(ev.length).fill(0);
  links.forEach((l) => { deg[l.source]++; deg[l.target]++; });
  ok(deg.every((d) => d >= NEIGHBORS), "chaque élève a au moins 5 liens");
  ok(links.length >= ev.length * NEIGHBORS / 2 && links.length <= ev.length * NEIGHBORS, "nombre de liens plausible");
  const R = gowerRanges(ev, SIMILARITY_KEYS, SIMILARITY_NOMINAL);
  eq(gower(ev[0], ev[0], SIMILARITY_KEYS, R, SIMILARITY_NOMINAL), 0, "distance d'un élève à lui-même");
  ok(!SIMILARITY_KEYS.some((k) => ["G1", "G2", "G3"].includes(k)), "les notes n'entrent pas dans la distance");
}

// ---------- Filtres et état (derive) ----------
{
  const base = { ds: "mat", inclNE: false, drill: [], slide: {}, selectedId: null };
  const d0 = derive(ds, base);
  eq(d0.base.length, 357, "base maths sans non-évalués");
  eq(derive(ds, { ...base, inclNE: true }).base.length, 395, "base maths avec non-évalués");
  const d1 = derive(ds, { ...base, drill: [{ dim: "risque", value: 2, src: "pset" }] });
  eq(d1.selection.length, 42, "drill risque 2+");
  eq(d1.exceptSrc("pset").length, 357, "exceptSrc retire les contraintes de sa source");
  eq(d1.exceptSrc("sun").length, 42, "exceptSrc garde les contraintes des autres sources");
  const d2 = derive(ds, { ...base, slide: { studytime: 3 } });
  eq(d2.selection.length, evaluated(ds.mat).filter((r) => r.studytime === 3).length, "curseur studytime");
  eq(derive(ds, { ...base, selectedId: 5 }).selected.__i, 5, "élève sélectionné");
  eq(okCount(d0.base) + d0.base.filter((r) => r.reussite === "non").length, 357, "réussites + échecs = évalués");
}

// ---------- state.js : changer de matière remet la sélection à zéro ----------
{
  const { state, setState, toggleDrill, setSlide } = await import("../js/state.js");
  toggleDrill("risque", 2, "pset");
  setSlide("goout", 4);
  setState({ selectedId: 3, mxPair: ["G3", "G2"] });
  eq(state.drill.length, 1, "toggleDrill pose une contrainte");
  toggleDrill("risque", 2, "pset");
  eq(state.drill.length, 0, "toggleDrill la retire au second appel");
  toggleDrill("sex", "F", "sun");
  setState({ ds: "por" });
  ok(state.ds === "por" && state.drill.length === 0 && state.selectedId === null && state.mxPair === null && Object.keys(state.slide).length === 0, "changer de matière remet la sélection à zéro");
}

console.log(fails ? `\n${fails} échec(s) sur ${checks} vérifications` : `OK : ${checks} vérifications`);
process.exit(fails ? 1 : 0);
