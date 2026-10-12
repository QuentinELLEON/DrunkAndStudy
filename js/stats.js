// Fonctions statistiques pures (aucune dépendance, testables sous Node). Contrat : docs/data-contracts.md.

export function mean(v) {
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN;
}

// Quantile par interpolation linéaire (méthode « type 7 », celle de d3.quantile). p dans [0, 1].
export function quantile(values, p) {
  const v = values.slice().sort((a, b) => a - b);
  if (!v.length) return NaN;
  const h = (v.length - 1) * p, i = Math.floor(h);
  return i + 1 < v.length ? v[i] + (h - i) * (v[i + 1] - v[i]) : v[i];
}
export const median = (v) => quantile(v, 0.5);

export function boxStats(values) {
  if (!values.length) return null;
  const v = values.slice().sort((a, b) => a - b);
  return { n: v.length, min: v[0], q1: quantile(v, 0.25), med: quantile(v, 0.5), q3: quantile(v, 0.75), max: v[v.length - 1], mean: mean(v) };
}

// Rangs moyens (les ex æquo reçoivent la moyenne de leurs rangs, à partir de 1).
export function ranks(arr) {
  const idx = arr.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(arr.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x, y) {
  const n = x.length;
  if (n < 2) return NaN;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    sxy += a * b; sxx += a * a; syy += b * b;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

// ρ de Spearman = Pearson sur les rangs moyens. NaN si un des deux attributs est constant.
export const spearman = (rows, a, b) => pearson(ranks(rows.map((r) => r[a])), ranks(rows.map((r) => r[b])));

// Triangle inférieur de la matrice : [{ a, b, i, j, rho, n }] avec i > j (indices dans keys).
export function spearmanMatrix(rows, keys) {
  const R = {};
  keys.forEach((k) => { R[k] = ranks(rows.map((r) => r[k])); });
  const cells = [];
  for (let i = 1; i < keys.length; i++) {
    for (let j = 0; j < i; j++) cells.push({ a: keys[i], b: keys[j], i, j, rho: pearson(R[keys[i]], R[keys[j]]), n: rows.length });
  }
  return cells;
}

// Seuil en dessous duquel un ρ n'est pas distinguable de 0 pour n élèves (approximation, 5 %).
export const significanceThreshold = (n) => (n > 3 ? 1.96 / Math.sqrt(n - 1) : 1);

// Distance de Gower entre deux élèves sur `keys`. `ranges[k] = [min, étendue]` pour les attributs numériques,
// `nominal` = attributs comparés en tout ou rien (0 si égaux, 1 sinon). Résultat dans [0, 1].
export function gowerRanges(rows, keys, nominal = []) {
  const ranges = {};
  keys.filter((k) => !nominal.includes(k)).forEach((k) => {
    let lo = Infinity, hi = -Infinity;
    rows.forEach((r) => { if (r[k] < lo) lo = r[k]; if (r[k] > hi) hi = r[k]; });
    ranges[k] = [lo, hi - lo || 1];
  });
  return ranges;
}
export function gower(a, b, keys, ranges, nominal = []) {
  let s = 0;
  for (const k of keys) s += nominal.includes(k) ? (a[k] === b[k] ? 0 : 1) : Math.abs(a[k] - b[k]) / ranges[k][1];
  return s / keys.length;
}

// k plus proches voisins de chaque élément de `rows` : [{ source, target, d }] sans doublon (liens non orientés).
// Complexité O(n²) : acceptable pour 357 ou 634 élèves.
export function knn(rows, keys, k, nominal = []) {
  const ranges = gowerRanges(rows, keys, nominal);
  const links = [], seen = new Set();
  for (let i = 0; i < rows.length; i++) {
    const best = [];
    for (let j = 0; j < rows.length; j++) {
      if (i === j) continue;
      const d = gower(rows[i], rows[j], keys, ranges, nominal);
      if (best.length < k) { best.push([d, j]); best.sort((p, q) => p[0] - q[0]); }
      else if (d < best[k - 1][0]) { best[k - 1] = [d, j]; best.sort((p, q) => p[0] - q[0]); }
    }
    for (const [d, j] of best) {
      const key = i < j ? i + "-" + j : j + "-" + i;
      if (!seen.has(key)) { seen.add(key); links.push({ source: i, target: j, d }); }
    }
  }
  return links;
}
