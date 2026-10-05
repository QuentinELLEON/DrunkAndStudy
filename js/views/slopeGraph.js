/* =====================================================================
   views/slopeGraph.js — Technique 4 (Gabriel), partie « vue d'ensemble »
   Slope graph G1 → G2 → G3
   ---------------------------------------------------------------------
   Transformation : agrégation des trajectoires identiques (même triplet
                    G1, G2, G3) → un « faisceau » par triplet avec son effectif ;
                    trajectoire médiane de la sélection ; tendance = G3 − G1.
   Marques   : polylignes à 3 points (une par faisceau).
   Canaux    : position verticale = note (0–20, identique sur les 3 axes) ;
               pente = évolution ; épaisseur = effectif du faisceau (racine carrée,
               pour que l'aire perçue reste proportionnelle) ; teinte = résultat final
               (même code que les autres vues) ; opacité = appartenance au filtre de tendance ;
               tirets = non évalué ; trait épais cerné = élève sélectionné.
   Tendance  : calculée sur prog = G3 − G1 ; un non-évalué n'a pas de tendance
               (son 0 final n'est pas un décrochage) et n'apparaît que sous « Toutes ».
   Interactions : filtre de tendance (global), survol (faisceau), clic (fiche élève,
               en parcourant les élèves du faisceau à chaque clic).
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { PASS, SMALL_N } from "../meta.js";
import { css, resultOf, resultSpec, showTip, hideTip, tipRow, widthOf, fmt1, pct } from "../utils.js";

const H = 300, MG = { t: 22, r: 70, b: 30, l: 70 };
const STEPS = [["G1", "Période 1"], ["G2", "Période 2"], ["G3", "Finale"]];
const TRENDS = [["all", "Toutes"], ["down", "▼ En baisse"], ["flat", "● Stables"], ["up", "▲ En hausse"]];

let root, svgEl, segEl, noteEl;
let cur = { state: null, derived: null };
const cycle = new Map();                                 // faisceau → index du prochain élève à ouvrir

export function init(container) {
  root = container;
  root.innerHTML = `
    <div class="toolbar">
      <span class="lbl" id="sl-lb">Tendance G3 − G1</span>
      <div class="seg" id="sl-trend" role="group" aria-labelledby="sl-lb"></div>
    </div>
    <div class="slope"><svg role="img" aria-label="Trajectoires des notes G1, G2, G3"></svg></div>
    <p class="note" id="sl-note" style="margin:4px 0 0"></p>`;
  svgEl = root.querySelector("svg"); segEl = root.querySelector("#sl-trend"); noteEl = root.querySelector("#sl-note");
  segEl.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    setState({ trend: b.dataset.v }, "slope");
  });
}

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) return;
  if (!STEPS.every(([k]) => ds.keys.includes(k))) {
    segEl.innerHTML = ""; d3.select(svgEl).selectAll("*").remove();
    noteEl.textContent = "Le slope graph nécessite les colonnes G1, G2 et G3.";
    return;
  }
  const rows = derived.exceptTrend;                       // on garde en fond les tendances masquées
  const counts = d3.rollup(rows, v => v.length, d => d.__trend);
  segEl.innerHTML = TRENDS.map(([v, l]) =>
    `<button type="button" data-v="${v}" aria-pressed="${state.trend === v}">${l} <span class="nbadge">${v === "all" ? rows.length : (counts.get(v) || 0)}</span></button>`).join("");
  draw(state, derived, rows);
}

function draw(state, derived, rows) {
  const w = widthOf(root, 520);
  const iw = w - MG.l - MG.r, ih = H - MG.t - MG.b;
  const x = d3.scalePoint().domain(STEPS.map(s => s[0])).range([0, iw]);
  const y = d3.scaleLinear().domain([0, 20]).range([ih, 0]);
  const R = resultSpec();
  const inTrend = d => state.trend === "all" || d.__trend === state.trend;

  // Agrégation : un faisceau par triplet identique
  const bundles = Array.from(d3.group(rows, d => `${d.G1}|${d.G2}|${d.G3}|${d.__nograde ? 1 : 0}`), ([key, arr]) => ({
    key, rows: arr, n: arr.length, g: [arr[0].G1, arr[0].G2, arr[0].G3],
    res: resultOf(arr[0]), on: inTrend(arr[0]), nograde: arr[0].__nograde
  })).sort((a, b) => (a.on - b.on) || (a.n - b.n));       // faisceaux actifs et épais dessinés en dernier
  const maxN = d3.max(bundles, b => b.n) || 1;
  const width = d3.scaleSqrt().domain([1, Math.max(2, maxN)]).range([1, 9]);
  const shown = rows.filter(inTrend);

  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${w} ${H}`).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${MG.l},${MG.t})`);

  // axes : même échelle 0–20 sur les trois périodes
  [0, 5, 10, 15, 20].forEach(t => {
    g.append("line").attr("class", "gridline").attr("x1", 0).attr("x2", iw).attr("y1", y(t)).attr("y2", y(t));
    g.append("text").attr("class", "muted").attr("x", -10).attr("y", y(t)).attr("dy", "0.32em")
      .attr("text-anchor", "end").style("font-size", "9.5px").text(t);
  });
  g.append("line").attr("class", "passline").attr("x1", -4).attr("x2", iw + 4).attr("y1", y(PASS)).attr("y2", y(PASS));
  g.append("text").attr("class", "muted halo").attr("x", iw + 8).attr("y", y(PASS)).attr("dy", "0.32em")
    .style("font-size", "9.5px").text("seuil 10");
  STEPS.forEach(([k, l]) => {
    g.append("line").attr("class", "axisline").attr("x1", x(k)).attr("x2", x(k)).attr("y1", 0).attr("y2", ih);
    g.append("text").attr("x", x(k)).attr("y", ih + 18).attr("text-anchor", "middle")
      .style("fill", css("--text-1")).style("font-weight", 600).text(`${l} (${k})`);
  });

  const line = d3.line().x((v, i) => x(STEPS[i][0])).y(v => y(v));
  const alphaOn = shown.length > 300 ? 0.28 : shown.length > 80 ? 0.4 : 0.6;
  const bg = g.append("g").attr("class", "bundles");
  const bsel = bg.selectAll("g.bundle").data(bundles, b => b.key).join("g").attr("class", "bundle");
  bsel.append("path").attr("d", b => line(b.g)).attr("fill", "none")
    .attr("stroke", b => b.on ? R[b.res].color : css("--faint"))
    .attr("stroke-opacity", b => b.on ? alphaOn : 0.25)
    .attr("stroke-width", b => width(b.n))
    .attr("stroke-dasharray", b => b.nograde ? "4 3" : null)
    .attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
    .style("pointer-events", "none");                     // seule la zone de survol ci-dessous capte le pointeur
  // zone de survol plus large que la marque
  bsel.append("path").attr("d", b => line(b.g)).attr("fill", "none")
    .attr("stroke", "transparent").attr("stroke-width", b => Math.max(8, width(b.n) + 4))
    .style("pointer-events", b => b.on ? "stroke" : "none");

  // trajectoire médiane de la sélection (repère pour « situer » un élève)
  if (shown.length) {
    const med = STEPS.map(([k]) => d3.median(shown, d => d[k]));
    g.append("path").attr("d", line(med)).attr("fill", "none").attr("stroke", css("--text-1"))
      .attr("stroke-width", 1.6).attr("stroke-dasharray", "6 4").attr("pointer-events", "none");
  }

  // élève sélectionné : au premier plan, valeurs écrites
  const sd = derived.selected;
  if (sd && STEPS.every(([k]) => isFinite(sd[k]))) {
    const vals = STEPS.map(([k]) => sd[k]);
    const col = R[resultOf(sd)].color;
    const sg = g.append("g").attr("pointer-events", "none");
    sg.append("path").attr("d", line(vals)).attr("fill", "none").attr("stroke", css("--surface-1")).attr("stroke-width", 7);
    sg.append("path").attr("d", line(vals)).attr("fill", "none").attr("stroke", col).attr("stroke-width", 3.2)
      .attr("stroke-dasharray", sd.__nograde ? "5 3" : null);
    vals.forEach((v, i) => {
      sg.append("circle").attr("cx", x(STEPS[i][0])).attr("cy", y(v)).attr("r", 5)
        .attr("fill", col).attr("stroke", css("--surface-1")).attr("stroke-width", 2);
      sg.append("text").attr("class", "halo").attr("x", x(STEPS[i][0]) + (i === 2 ? 10 : i === 0 ? -10 : 0))
        .attr("y", y(v) + (i === 1 ? -11 : 0)).attr("dy", "0.32em")
        .attr("text-anchor", i === 2 ? "start" : i === 0 ? "end" : "middle")
        .style("fill", css("--text-1")).style("font-weight", 700).style("font-size", "11.5px")
        .text(i === 2 ? `${v} · n° ${sd.__i + 1}` : v);
    });
  }

  bsel.on("mousemove", (ev, b) => showTip(ev, bundleTip(b)))
    .on("mouseleave", hideTip)
    .on("click", (ev, b) => {
      const i = cycle.get(b.key) || 0;
      const d = b.rows[i % b.n];
      cycle.set(b.key, i + 1);
      setState({ selectedId: d.__i }, "slope");
    });

  const down = shown.filter(d => d.__trend === "down").length;
  noteEl.innerHTML = `n = ${shown.length} élèves · ${shown.length ? pct(down / shown.length) : "—"} en baisse (G3 − G1 ≤ −2)` +
    (shown.length < SMALL_N ? " · ⚠ trop peu d'élèves pour conclure" : "") + ` · tirets : trajectoire médiane`;
}

function bundleTip(b) {
  const ids = b.rows.slice(0, 6).map(d => "n° " + (d.__i + 1)).join(", ") + (b.n > 6 ? "…" : "");
  const R = resultSpec();
  return `<b>${b.g.join(" → ")}</b> <span style="color:${R[b.res].color}">${R[b.res].icon}</span>` +
    tipRow("Élèves sur cette trajectoire", `n = ${b.n}`) +
    tipRow("Évolution G3 − G1", (b.g[2] - b.g[0] > 0 ? "+" : "") + fmt1(b.g[2] - b.g[0]).replace(/,0$/, "")) +
    (b.nograde ? `<div class="hint">✕ Non évalué : G3 = 0 et 0 absence (donnée manquante).</div>` : "") +
    `<div class="hint">${ids}<br>Clic : ouvrir la fiche${b.n > 1 ? " (chaque clic passe à l'élève suivant)" : ""}</div>`;
}
