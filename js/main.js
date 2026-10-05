/* =====================================================================
   main.js — initialisation et orchestration
   ---------------------------------------------------------------------
   1. vérifie que D3 est chargé ;
   2. initialise chaque vue dans son conteneur (init) ;
   3. charge le jeu de données de façon asynchrone (état de chargement / erreur) ;
   4. à chaque "change" de l'état : recalcule UNE fois les sous-ensembles
      dérivés (data.derive) puis appelle update(state, derived) sur chaque vue.
      Les rendus sont regroupés par requestAnimationFrame (brushing fluide) ;
   5. écrit l'état dans l'URL (permalink.js, tâche U4.5) et le relit au démarrage.
   ===================================================================== */

import { state, on, setState } from "./state.js";
import { loadDataset, importFile, derive, defaultAxesFor, axisKeys, groupKeys, DATASETS } from "./data.js";
import { DEFAULT_AXES } from "./meta.js";
import { readHash, writeHash, hashChangedExternally } from "./permalink.js";
import * as filterBar from "./views/filterBar.js";
import * as statTiles from "./views/statTiles.js";
import * as parallelCoords from "./views/parallelCoords.js";
import * as correlationMatrix from "./views/correlationMatrix.js";
import * as boxplots from "./views/boxplots.js";
import * as slopeGraph from "./views/slopeGraph.js";
import * as detailPanel from "./views/detailPanel.js";
import * as table from "./views/table.js";

const statusEl = document.getElementById("status");

function showStatus(kind, msg) {
  statusEl.className = "status" + (kind ? " " + kind : "");
  statusEl.textContent = msg || "";
  document.body.classList.toggle("is-loading", kind === "loading");
}

if (typeof window.d3 === "undefined") {
  showStatus("error", "D3.js n'a pas pu être chargé depuis le CDN (https://cdn.jsdelivr.net/npm/d3@7). " +
    "Vérifiez la connexion Internet, ou installez D3 en local (voir README, section « Sans Internet »).");
  throw new Error("D3 manquant");
}

/* ---------------- vues ---------------- */
/* [module, id du conteneur, vue coûteuse ?]
   Les vues coûteuses (≈ 4 000 points SVG, 400 lignes de table) ne suivent pas
   chaque pixel du brush : elles se mettent à jour quand l'utilisateur relâche. */
const VIEWS = [
  [filterBar, "filters"],
  [statTiles, "tiles"],
  [parallelCoords, "pc-view"],
  [correlationMatrix, "matrix-view"],
  [boxplots, "box-view", true],        // true = vue coûteuse, rafraîchie à la fin d'un brush
  [slopeGraph, "slope-view", true],
  [detailPanel, "detail-view"],
  [table, "table-view", true]
];
VIEWS.forEach(([view, id]) => view.init(document.getElementById(id)));

/* ---------------- jeu de données actif ---------------- */
let active = null;               // { key, name, meta, rawKeys, keys, rows, builtin, standard }
let loadToken = 0;               // ignore les chargements devenus obsolètes
let pending = readHash();        // état demandé par un lien (#…), appliqué au premier chargement compatible
if (pending && DATASETS[pending.ds]) state.ds = pending.ds;

/** Élève affiché au démarrage : le premier en échec, pour que le lien vue d'ensemble ⇄ détail soit visible d'emblée. */
function seedSelection(ds) {
  const d = ds.rows.find(r => !r.__nograde && r.G3 < 10) || ds.rows[0];
  return d ? d.__i : null;
}

/** Ne garde d'un état restauré que ce qui existe dans ce jeu de données (lien ancien ou modifié à la main). */
function sanitize(patch, ds) {
  const out = { ...patch };
  delete out.ds;
  const axOk = axisKeys(ds);
  if (out.axes) { out.axes = out.axes.filter(k => axOk.includes(k)); if (out.axes.length < 2) delete out.axes; }
  const axes = out.axes || (ds.standard ? DEFAULT_AXES : defaultAxesFor(ds));
  if (out.brushes) out.brushes = Object.fromEntries(Object.entries(out.brushes).filter(([k, b]) => axes.includes(k) && b && b.kind));
  if (out.panels) { const ok = groupKeys(ds); out.panels = out.panels.filter(k => ok.includes(k)); }
  if (out.groupFilter && !ds.keys.includes(out.groupFilter.key)) delete out.groupFilter;
  if (out.selectedId != null && !ds.rows.some(d => d.__i === out.selectedId)) delete out.selectedId;
  if (out.trend && !["all", "down", "flat", "up"].includes(out.trend)) delete out.trend;
  return out;
}

function activate(ds, key) {
  active = ds;
  const restore = pending && pending.ds === key ? sanitize(pending, ds) : {};
  pending = null;
  setState({
    ds: key, status: "ready", error: null,
    brushes: {}, groupFilter: null, trend: "all", highlightPair: null,
    axes: ds.standard ? DEFAULT_AXES.slice() : defaultAxesFor(ds),
    colorBy: ds.keys.includes("G3") ? "result" : "none",
    selectedId: seedSelection(ds),
    ...restore
  }, "main");
  const nDer = ds.derivedKeys.length;
  showStatus("", `${ds.name} : ${ds.rows.length} élèves, ${ds.rawKeys.length} attributs chargés` +
    (nDer ? ` + ${nDer} dérivés (survolez un titre pour sa définition).` : ".") +
    (Object.keys(restore).length ? " État restauré depuis le lien." : ""));
}

function switchDataset(key) {
  if (key === "custom") { if (state.custom) activate(state.custom, "custom"); return; }
  if (!DATASETS[key]) return;
  const token = ++loadToken;
  setState({ status: "loading" }, "main");
  showStatus("loading", `Chargement de ${DATASETS[key].label} (${DATASETS[key].url})…`);
  loadDataset(key)
    .then(ds => { if (token === loadToken) activate(ds, key); })
    .catch(err => {
      if (token !== loadToken) return;
      console.error(err);
      setState({ status: "error", error: err.message }, "main");
      showStatus("error", err.message);
    });
}

on("dataset", switchDataset);

on("import", file => {
  const token = ++loadToken;
  showStatus("loading", `Lecture de ${file.name}…`);
  importFile(file)
    .then(ds => {
      if (token !== loadToken) return;
      state.custom = ds;
      activate(ds, "custom");
      const inferred = ds.rawKeys.filter(k => ds.meta[k].inferred);
      const extra = inferred.length
        ? ` Types inférés pour ${inferred.length} colonne(s) inconnue(s) (≤ 6 valeurs numériques → ordinal) : à vérifier.`
        : "";
      showStatus("", `Fichier importé : ${ds.name} — ${ds.rows.length} lignes, ${ds.rawKeys.length} colonnes, séparateur « ${ds.separator === "\t" ? "tabulation" : ds.separator} ».${extra}`);
    })
    .catch(err => {
      if (token !== loadToken) return;
      showStatus("error", `Impossible de lire « ${file.name} » : ${err.message}. Il faut une ligne d'en-tête et un séparateur « , » ou « ; ».`);
    });
});

/* ---------------- rendu ---------------- */
let frame = null;
function render() {
  frame = null;
  const derived = derive(state, active);
  for (const [view, , heavy] of VIEWS) {
    if (heavy && state.interacting) continue;          // mis à jour au relâchement du brush
    try { view.update(state, derived); }
    catch (err) { console.error("Erreur de rendu", err); }
  }
}
function scheduleRender() { if (frame == null) frame = requestAnimationFrame(render); }
on("change", scheduleRender);

/* ---------------- lien permanent (U4.5) ---------------- */
let hashTimer;
on("change", () => {
  if (state.interacting) return;                         // pas d'écriture à chaque pixel de brush
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => writeHash(state), 200);
});
window.addEventListener("hashchange", () => {
  if (!hashChangedExternally()) return;                  // fragment écrit par l'application elle-même
  pending = readHash();
  if (pending) switchDataset(DATASETS[pending.ds] ? pending.ds : state.ds);
});

let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(scheduleRender, 120); });

/* ---------------- thème clair / sombre ---------------- */
const THEMES = ["auto", "light", "dark"];
const THEME_LABEL = { auto: "auto", light: "clair", dark: "sombre" };
const themeBtn = document.getElementById("theme-btn");
function applyTheme(t) {
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  themeBtn.textContent = `◐ Thème : ${THEME_LABEL[t]}`;
  themeBtn.dataset.theme = t;
  scheduleRender();                               // les couleurs du canvas/SVG sont relues dans les variables CSS
}
let savedTheme = "auto";
try { savedTheme = localStorage.getItem("spe-theme") || "auto"; } catch (e) { /* stockage indisponible */ }
applyTheme(THEMES.includes(savedTheme) ? savedTheme : "auto");
themeBtn.addEventListener("click", () => {
  const next = THEMES[(THEMES.indexOf(themeBtn.dataset.theme) + 1) % THEMES.length];
  try { localStorage.setItem("spe-theme", next); } catch (e) { /* stockage indisponible */ }
  applyTheme(next);
});
if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", scheduleRender);

/* ---------------- démarrage ---------------- */
scheduleRender();
switchDataset(state.ds);
