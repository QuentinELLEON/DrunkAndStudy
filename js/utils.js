// Utilitaires partagés : formats français, couleurs du thème, info-bulle, accessibilité, message d'état.
// Les fonctions de format sont pures ; les autres utilisent le DOM.

const nf1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const f1 = (v) => (Number.isFinite(v) ? nf1.format(v) : "–");              // 11,5
export const f2 = (v) => (Number.isFinite(v) ? nf2.format(v) : "–");              // 0,34
export const pct = (v) => (Number.isFinite(v) ? Math.round(v * 100) + " %" : "–");   // 74 %
export const signed = (v, dec = 2) => (Number.isFinite(v) ? (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(dec).replace(".", ",") : "–");
export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Couleurs du thème, relues dans les variables CSS à chaque appel (les vues suivent le mode clair / sombre).
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const colors = () => ({
  ok: cssVar("--ok") || "#1F4FA3",
  ko: cssVar("--ko") || "#D9822B",
  mid: cssVar("--mid") || "#E4E8EF",
  ink: cssVar("--ink"), muted: cssVar("--muted"), line: cssVar("--line"), panel: cssVar("--panel"),
});

// Largeur disponible d'un conteneur (au moins 300 px)
export const widthOf = (el) => Math.max(300, Math.floor(el.getBoundingClientRect().width) || 860);

// ---------- Info-bulle ----------
let tipEl = null;
function tip() {
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.className = "tip";
    tipEl.setAttribute("role", "status");
    document.body.appendChild(tipEl);
  }
  return tipEl;
}
export function moveTip(ev) {
  const n = tip(), pad = 14;
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + n.offsetWidth > window.innerWidth - 8) x = ev.clientX - n.offsetWidth - pad;
  if (y + n.offsetHeight > window.innerHeight - 8) y = ev.clientY - n.offsetHeight - pad;
  n.style.transform = `translate(${Math.max(4, x)}px,${Math.max(4, y)}px)`;
}
export function showTip(ev, html) { const n = tip(); n.innerHTML = html; n.style.opacity = 1; moveTip(ev); }
export function hideTip() { if (tipEl) tipEl.style.opacity = 0; }

// ---------- Accessibilité ----------
// Rend un élément (ou une sélection D3) cliquable au clavier : tabindex, role, aria-label, Entrée et Espace.
export function makeActionable(el, handler, label) {
  const nodes = el.nodes ? el.nodes() : [el];
  nodes.forEach((n) => {
    n.setAttribute("tabindex", 0);
    n.setAttribute("role", "button");
    if (label) n.setAttribute("aria-label", typeof label === "function" ? label(n.__data__) : label);
    n.addEventListener("click", (e) => handler(n.__data__, e));
    n.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(n.__data__, e); }
    });
  });
}

// ---------- Message d'état (#status) ----------
export function setStatus(message, kind = "info") {
  const el = document.getElementById("status");
  if (!el) return;
  if (!message) { el.hidden = true; el.textContent = ""; return; }
  el.hidden = false;
  el.className = "status" + (kind === "error" ? " error" : "");
  el.innerHTML = message;
}

// Prépare un conteneur de vue : retire son contenu et signale qu'il est prêt (utilisé par init() de chaque vue).
export function prepareContainer(container) {
  container.replaceChildren();
  container.dataset.ready = "true";
  return container;
}
