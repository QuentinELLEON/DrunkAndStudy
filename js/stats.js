/* =====================================================================
   stats.js — transformations statistiques pures (sans DOM, sans D3)
   ---------------------------------------------------------------------
   Séparées des vues pour pouvoir être testées isolément
   (voir tools/test-stats.mjs) et citées telles quelles dans le rapport.
   ===================================================================== */

/** Rangs moyens (gestion des ex æquo), indices 1..n. */
export function ranks(values) {
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(values.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;               // rang moyen du bloc d'ex æquo
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

/** Corrélation de Pearson ; NaN si une variance est nulle. */
export function pearson(x, y) {
  const n = x.length;
  if (n < 3) return NaN;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx === 0 || syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy);
}

/**
 * Corrélation de Spearman ρ = Pearson appliqué aux rangs moyens.
 * Adaptée aux ordinaux (Medu, Dalc…) : seule la monotonie compte,
 * pas l'écart entre les codes.
 */
export function spearman(x, y) {
  return pearson(ranks(x), ranks(y));
}

/**
 * Matrice de Spearman sur un ensemble de clés.
 * Renvoie { keys, n, get(a,b), cells:[{a,b,i,j,rho}] }.
 * Les rangs de chaque variable sont calculés une seule fois.
 */
export function spearmanMatrix(rows, keys) {
  const R = {};
  keys.forEach(k => { R[k] = ranks(rows.map(d => +d[k])); });
  const cells = [], lookup = new Map();
  keys.forEach((a, i) => keys.forEach((b, j) => {
    const rho = i === j ? 1 : (j < i ? lookup.get(b + "|" + a) : pearson(R[a], R[b]));
    lookup.set(a + "|" + b, rho);
    cells.push({ a, b, i, j, rho });
  }));
  return { keys, n: rows.length, cells, get: (a, b) => lookup.get(a + "|" + b) };
}

/** Quantile de type 7 (celui de R et de d3.quantile) sur un tableau trié. */
export function quantileSorted(s, p) {
  if (!s.length) return NaN;
  const h = (s.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}

/**
 * Résumé d'une boîte à moustaches (Tukey) :
 * quartiles, médiane, moustaches à 1,5 × IQR, valeurs atypiques.
 */
export function boxStats(values) {
  const s = values.slice().sort((a, b) => a - b);
  const n = s.length;
  if (!n) return null;
  const q1 = quantileSorted(s, 0.25), med = quantileSorted(s, 0.5), q3 = quantileSorted(s, 0.75);
  const iqr = q3 - q1, loF = q1 - 1.5 * iqr, hiF = q3 + 1.5 * iqr;
  const inside = s.filter(v => v >= loF && v <= hiF);
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(s.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) : 0;
  return {
    n, q1, med, q3, iqr, mean, sd,
    ci95: n > 1 ? 1.96 * sd / Math.sqrt(n) : 0,
    lo: inside.length ? inside[0] : s[0],
    hi: inside.length ? inside[inside.length - 1] : s[n - 1],
    outliers: s.filter(v => v < loF || v > hiF).length
  };
}

/** Rang centile d'une valeur dans un échantillon : part des valeurs strictement inférieures. */
export function percentBelow(values, v) {
  if (!values.length) return NaN;
  return values.filter(x => x < v).length / values.length;
}

/** Hachage déterministe → [0,1) : un même élève garde le même décalage (jitter) d'un rendu à l'autre. */
export function hash01(i) {
  let x = (i + 1) * 2654435761 >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

/**
 * Distance de Gower (attributs mixtes) — graphe de similarité (Gabriel).
 * Quantitatifs et ordinaux : |a − b| / étendue ; nominaux : 0 si égaux, 1 sinon.
 * Une valeur manquante retire l'attribut de la moyenne pour cette paire.
 * Renvoie dist(a, b) qui accepte deux objets élèves (ou un profil fictif).
 */
export function gower(rows, keys, types) {
  const span = {};
  keys.forEach(k => {
    if (types[k] === "nom") return;
    let lo = Infinity, hi = -Infinity;
    rows.forEach(d => { const v = d[k]; if (typeof v === "number" && isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } });
    span[k] = hi > lo ? hi - lo : 1;
  });
  return (a, b) => {
    let s = 0, n = 0;
    for (const k of keys) {
      const x = a[k], y = b[k];
      if (types[k] === "nom") { if (x === "" || y === "" || x == null || y == null) continue; s += x === y ? 0 : 1; n++; }
      else { if (!isFinite(x) || !isFinite(y)) continue; s += Math.abs(x - y) / span[k]; n++; }
    }
    return n ? s / n : 1;
  };
}

/** Indices des k plus proches voisins de chaque élève (k petit : on évite la « pelote »). */
export function knn(rows, k, dist) {
  return rows.map((a, i) => {
    const best = [];                                   // [distance, j] triés, au plus k
    for (let j = 0; j < rows.length; j++) {
      if (j === i) continue;
      const d = dist(a, rows[j]);
      if (best.length < k || d < best[best.length - 1][0]) {
        best.push([d, j]); best.sort((p, q) => p[0] - q[0] || p[1] - q[1]); if (best.length > k) best.pop();
      }
    }
    return best;
  });
}
