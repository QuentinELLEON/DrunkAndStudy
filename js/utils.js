/* =====================================================================
   utils.js — couleurs, formatage (locale française), libellés, info-bulle
   ===================================================================== */
/* global d3 */

import { PASS, SMALL_N } from "./meta.js";

/* ---------------- couleurs ----------------
   Les couleurs vivent dans css/style.css (variables CSS, clair/sombre).
   On les relit à chaque rendu pour suivre le thème courant.            */
export function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Couleurs + icône du résultat d'un élève. Jamais rouge/vert seul : bleu ▲ / orange ▼. */
export function resultOf(d) {
  if (d.__nograde) return "none";
  return +d.G3 >= PASS ? "pass" : "fail";
}
export function resultSpec() {
  return {
    pass: { label: "Réussite (G3 ≥ 10)", color: css("--s1"), icon: "▲" },
    fail: { label: "Échec (G3 < 10)", color: css("--s2"), icon: "▼" },
    none: { label: "Non évalué (G3 = 0 et 0 absence)", color: css("--muted"), icon: "✕" }
  };
}
export function resultBadge(d) {
  if (!("G3" in d)) return "";
  const r = resultOf(d);
  if (r === "none") return `<span class="res none">✕ non évalué</span>`;
  return r === "pass" ? `<span class="res pass">▲ réussite</span>` : `<span class="res fail">▼ échec</span>`;
}

/** Échelle divergente bleu ↔ gris ↔ rouge pour ρ ∈ [−1, 1] (milieu neutre = « pas d'association »). */
export function divergingScale() {
  const neg = css("--div-neg"), mid = css("--div-mid"), pos = css("--div-pos");
  return d3.scaleLinear().domain([-1, 0, 1]).range([neg, mid, pos]).interpolate(d3.interpolateLab).clamp(true);
}

/* ---------------- formatage ---------------- */
const FR = d3.formatLocale({ decimal: ",", thousands: " ", grouping: [3], currency: ["", " €"], minus: "−" });
export const fmt0 = FR.format(",.0f");
export const fmt1 = FR.format(",.1f");
export const fmt2 = FR.format(",.2f");
export const pct = FR.format(".0%");
export const signed2 = FR.format("+.2f");
/** ρ compact : « −,36 » — assez court pour tenir dans une cellule. */
export function rhoShort(r) {
  if (!isFinite(r)) return "–";
  const s = FR.format(".2f")(Math.abs(r)).replace(/^0/, "");
  return (r < 0 ? "−" : r > 0 ? "+" : "") + s;
}
/** Qualificatif prudent de la force d'une association (jamais causal). */
export function strength(r) {
  const a = Math.abs(r);
  if (!isFinite(a)) return "non calculable";
  if (a < 0.1) return "association négligeable";
  if (a < 0.3) return "association faible";
  if (a < 0.5) return "association modérée";
  return "association forte";
}

/* ---------------- libellés ---------------- */
/** Libellé long d'une modalité (fiche, info-bulle). */
export function labelOf(meta, key, v) {
  const M = meta[key];
  if (v == null || v === "") return "—";
  if (typeof v === "number" && isNaN(v)) return "n. r. (non renseigné)";
  if (M && M.v && M.v[v] != null) return M.v[v];
  if (M && M.u && M.t === "quant") return `${v}`;
  return String(v).replace(/_/g, " ");
}
/** Libellé court d'une modalité (graduations, catégories de boxplot). */
export function shortOf(meta, key, v) {
  const M = meta[key];
  if (M && M.d && M.s) {
    const i = M.d.indexOf(v);
    if (i >= 0) return M.s[i];
  }
  const t = labelOf(meta, key, v);
  return t.length > 10 ? t.slice(0, 9) + "…" : t;
}
export function titleOf(meta, key) { return (meta[key] && meta[key].l) || key; }
export function truncate(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Badge d'effectif ; signale les groupes < 10 élèves. */
export function nBadge(n) {
  return n < SMALL_N
    ? `<span class="nbadge small" title="Moins de ${SMALL_N} élèves : à lire comme une anecdote, pas une tendance">n = ${n} ⚠</span>`
    : `<span class="nbadge">n = ${n}</span>`;
}

/* ---------------- info-bulle partagée ---------------- */
let tipEl = null;
function tipNode() {
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.id = "tip"; tipEl.setAttribute("role", "tooltip");
    document.body.appendChild(tipEl);
  }
  return tipEl;
}
/** Affiche l'info-bulle près du pointeur (ou d'un élément si ev est un DOMRect). */
export function showTip(ev, html) {
  const tip = tipNode();
  tip.innerHTML = html; tip.style.opacity = 1;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  const cx = ev.clientX != null ? ev.clientX : ev.left + ev.width / 2;
  const cy = ev.clientY != null ? ev.clientY : ev.top + ev.height;
  let x = cx + 14, y = cy + 14;
  if (x + w > window.innerWidth - 8) x = cx - w - 14;
  if (y + h > window.innerHeight - 8) y = cy - h - 14;
  tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
}
export function hideTip() { if (tipEl) tipEl.style.opacity = 0; }
/** Ligne clé / valeur dans l'info-bulle. */
export function tipRow(k, v) { return `<div class="r"><span>${k}</span><span>${v}</span></div>`; }

/** Mesure la largeur disponible d'un conteneur (repli si caché). */
export function widthOf(el, fallback = 600) {
  return Math.max(0, Math.floor(el.getBoundingClientRect().width)) || fallback;
}
