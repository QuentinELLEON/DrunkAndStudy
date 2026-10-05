/* =====================================================================
   main.js — initialisation et orchestration
   ---------------------------------------------------------------------
   1. vérifie que D3 est chargé ;
   2. initialise chaque vue dans son conteneur (init) ;
   3. charge le jeu de données de façon asynchrone (état de chargement / erreur) ;
   4. à chaque "change" de l'état : recalcule UNE fois les sous-ensembles
      dérivés (data.derive) puis appelle update(state, derived) sur chaque vue.
      Les rendus sont regroupés par requestAnimationFrame (interactions fluides) ;
   5. écrit l'état dans l'URL (permalink.js, lien permanent) et le relit au démarrage.
   ===================================================================== */

import { state, on, setState } from "./state.js";
import { loadDataset, importFile, derive, histGroupKeys, DATASETS } from "./data.js";
import { RISK_FACTORS, SIM_KEYS } from "./meta.js";
import { readHash, writeHash, hashChangedExternally } from "./permalink.js";
import * as filterBar from "./views/filterBar.js";
import * as statTiles from "./views/statTiles.js";
import * as histograms from "./views/histograms.js";
import * as factorRanking from "./views/factorRanking.js";
import * as unitChart from "./views/unitChart.js";
import * as alluvial from "./views/alluvial.js";
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
/* [module, id du conteneur] — une technique par membre, dans l'ordre des questions de la page */
const VIEWS = [
  [filterBar, "filters"],
  [statTiles, "tiles"],
  [histograms, "hist-view"],          // Q1 — Alexandre
  [factorRanking, "rank-view"],       // Q2 — Jim
  [unitChart, "unit-view"],           // Q3 — Quentin
  [alluvial, "allu-view"],            // Q4 — Gabriel
  [detailPanel, "detail-view"],       // niveau détail (Gabriel)
  [table, "table-view"]
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
  if (out.criteria) out.criteria = out.criteria.filter(id => RISK_FACTORS.some(f => f.id === id));
  if (out.riskMin != null && !(out.riskMin >= 0 && out.riskMin <= 4)) delete out.riskMin;
  if (out.unitGroup && !["risque", "none", "school", "sex"].includes(out.unitGroup)) delete out.unitGroup;
  if (out.groupBy && !histGroupKeys(ds).includes(out.groupBy)) delete out.groupBy;
  if (out.groupFilter && !ds.keys.includes(out.groupFilter.key)) delete out.groupFilter;
  if (out.sim) out.sim = Object.fromEntries(Object.entries(out.sim).filter(([k, v]) => (SIM_KEYS.includes(k) || k === "note") && isFinite(v)));
  if (out.flow && !(out.flow.s === 0 || out.flow.s === 1)) delete out.flow;
  if (out.selectedId != null && !ds.rows.some(d => d.__i === out.selectedId)) delete out.selectedId;
  if (out.trend && !["all", "down"].includes(out.trend)) delete out.trend;
  return out;
}

function activate(ds, key) {
  active = ds;
  const restore = pending && pending.ds === key ? sanitize(pending, ds) : {};
  pending = null;
  setState({
    ds: key, status: "ready", error: null,
    criteria: [], riskMin: 0, groupFilter: null, trend: "all", flow: null,
    groupBy: "", sim: {},
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
  for (const [view] of VIEWS) {
    try { view.update(state, derived); }
    catch (err) { console.error("Erreur de rendu", err); }
  }
}
function scheduleRender() { if (frame == null) frame = requestAnimationFrame(render); }
on("change", scheduleRender);

/* ---------------- lien permanent ---------------- */
let hashTimer;
on("change", () => {
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
