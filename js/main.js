// Point d'entrée : charge les données avec D3, initialise les contrôles et les vues, redessine à chaque changement d'état.
// Chaque vue exporte init(container) et update(state, derived) (voir docs/architecture.md).

import { loadAll, derive } from "./data.js";
import { state, on } from "./state.js";
import { setStatus, hideTip } from "./utils.js";

import * as theme from "./controls/theme.js";
import * as header from "./controls/header.js";
import * as selectionPanel from "./controls/selectionPanel.js";
import * as studentCard from "./controls/studentCard.js";

import * as parallelSets from "./views/parallelSets.js";
import * as correlationMatrix from "./views/correlationMatrix.js";
import * as sunburst from "./views/sunburst.js";
import * as similarityGraph from "./views/similarityGraph.js";
import * as selectionBox from "./views/selectionBox.js";
import * as studentTrajectory from "./views/studentTrajectory.js";
import * as pairScatter from "./views/pairScatter.js";

// Conteneur (id dans index.html) → module de vue
const VIEWS = [
  ["viz-parallel-sets", parallelSets],
  ["viz-correlation-matrix", correlationMatrix],
  ["viz-sunburst", sunburst],
  ["viz-similarity-graph", similarityGraph],
  ["viz-selection-boxplot", selectionBox],
  ["viz-student-trajectory", studentTrajectory],
  ["viz-pair-scatter", pairScatter],
];

let rowsByDs = null;
let queued = false;

function render() {
  queued = false;
  hideTip();
  const derived = derive(rowsByDs, state);
  header.update(state, derived, rowsByDs);
  selectionPanel.update(state, derived);
  studentCard.update(state, derived);
  VIEWS.forEach(([, mod]) => {
    try { mod.update(state, derived); } catch (e) { console.error(e); setStatus(`Erreur dans une vue : ${e.message}`, "error"); }
  });
}

// Un seul rendu par image, même si plusieurs setState se suivent
function scheduleRender() {
  if (queued || !rowsByDs) return;
  queued = true;
  requestAnimationFrame(render);
}

async function start() {
  theme.init();
  if (location.protocol === "file:") {
    setStatus("Cette page doit être servie en <code>http://</code> (les modules et <code>d3.csv()</code> sont bloqués en <code>file://</code>). Lancez par exemple <code>npx serve .</code> dans le dossier du projet, ou « Open with Live Server » dans VS Code.", "error");
    return;
  }
  if (typeof d3 === "undefined") {
    setStatus("D3 n'a pas pu être chargé depuis le CDN. Vérifiez la connexion, ou installez <code>d3@7.9.0</code> en local (voir le README).", "error");
    return;
  }
  setStatus("Chargement des données…");
  try {
    rowsByDs = await loadAll();
  } catch (e) {
    console.error(e);
    setStatus(`Impossible de charger les données (<code>data/student-*.csv</code>) : ${e.message}`, "error");
    return;
  }
  setStatus("");

  header.init();
  selectionPanel.init();
  studentCard.init();
  VIEWS.forEach(([id, mod]) => {
    const el = document.getElementById(id);
    if (el) mod.init(el); else console.warn(`Conteneur #${id} introuvable dans index.html`);
  });

  on(scheduleRender);
  let t;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(scheduleRender, 150); });
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", scheduleRender);
  }
  if (window.MutationObserver) new MutationObserver(scheduleRender).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  render();
}

start();
