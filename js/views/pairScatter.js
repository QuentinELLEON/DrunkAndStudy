// Panneau 3 : nuage de points de la paire cliquée dans la matrice (B)
// Conteneur : #viz-pair-scatter   ·   Doc : docs/visualisations.md#b-matrice-de-corrélation
// Entrées : derived.selection et state.mxPair = [a, b]. Un clic sur un point ouvre la fiche de l'élève.

import { dimLabel } from "../meta.js";
import { setState } from "../state.js";
import { spearman, significanceThreshold, medianCurve } from "../stats.js";
import { describe } from "./correlationMatrix.js";
import { showTip, moveTip, hideTip, makeActionable, prepareContainer } from "../utils.js";

const HEIGHT = 250;
const MARGIN = { top: 10, right: 12, bottom: 40, left: 40 };
const MAX_DISCRETE = 8;   // au plus 8 valeurs distinctes : attribut traité comme ordinal, avec jitter
const GRADES = ["G1", "G2", "G3"];

let host = null, titleEl = null, textEl = null, closeEl = null;
let defaultTitle = "", defaultText = "";

// Décalage aléatoire mais stable d'un rendu à l'autre, entre −0,25 et +0,25.
function jitter(i, salt) {
  const t = Math.sin(i * 12.9898 + salt) * 43758.5453;
  return (t - Math.floor(t) - 0.5) / 2;
}

// Les notes gardent toujours leur axe de 0 à 20, les autres attributs s'ajustent à leurs valeurs.
function axisOf(attr, values, range) {
  const distinct = [...new Set(values)].sort((p, q) => p - q);
  const discrete = distinct.length <= MAX_DISCRETE;
  const grade = GRADES.includes(attr);
  const [lo, hi] = d3.extent(values);
  const pad = discrete ? 0.5 : Math.max(0.5, (hi - lo) * 0.03);
  const domain = grade ? [0, 20] : [lo - pad, hi + pad];
  return { scale: d3.scaleLinear().domain(domain).range(range), discrete, tickValues: grade ? [0, 5, 10, 15, 20] : discrete ? distinct : null };
}

const ticksOf = (ax, gen) => (ax.tickValues ? gen.tickValues(ax.tickValues) : gen.ticks(5)).tickFormat(d3.format("d")).tickSizeOuter(0);

export function init(container) {
  host = prepareContainer(container);
  titleEl = document.getElementById("panel-pair-title");
  textEl = document.getElementById("panel-pair-text");
  closeEl = document.getElementById("panel-pair-close");
  defaultTitle = titleEl.textContent;
  defaultText = textEl.textContent;
  closeEl.addEventListener("click", () => setState({ mxPair: null }));
}

export function update(state, derived) {
  if (!host) return;
  host.replaceChildren();
  const pair = state.mxPair;
  closeEl.hidden = !pair;
  if (!pair) {
    titleEl.textContent = defaultTitle;
    textEl.textContent = defaultText;
    return;
  }

  const [a, b] = pair;
  const rows = derived.selection;
  titleEl.textContent = `${dimLabel(a)} et ${dimLabel(b)}`;
  if (rows.length < 2) {
    textEl.textContent = "Pas assez d'élèves dans la sélection pour tracer ce nuage.";
    return;
  }
  const n = rows.length;
  const rho = spearman(rows, a, b);
  textEl.textContent = `${describe({ a, b, rho, n }, significanceThreshold(n))} Chaque point est un élève, la courbe relie les médianes.`;

  const width = Math.max(240, host.clientWidth);
  const xa = axisOf(a, rows.map((r) => r[a]), [MARGIN.left, width - MARGIN.right]);
  const ya = axisOf(b, rows.map((r) => r[b]), [HEIGHT - MARGIN.bottom, MARGIN.top]);

  const svg = d3.select(host).append("svg")
    .attr("width", width).attr("height", HEIGHT)
    .attr("role", "img")
    .attr("aria-label", `Nuage de points de ${dimLabel(b)} selon ${dimLabel(a)}, ${n} élèves, ρ = ${Number.isFinite(rho) ? rho.toFixed(2) : "non calculable"}.`);

  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${HEIGHT - MARGIN.bottom})`)
    .call(ticksOf(xa, d3.axisBottom(xa.scale)));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${MARGIN.left},0)`)
    .call(ticksOf(ya, d3.axisLeft(ya.scale)));
  svg.append("text").attr("class", "det-lab").attr("text-anchor", "middle")
    .attr("x", (MARGIN.left + width - MARGIN.right) / 2).attr("y", HEIGHT - 6).text(dimLabel(a));
  svg.append("text").attr("class", "det-lab").attr("text-anchor", "middle")
    .attr("transform", `translate(11,${(MARGIN.top + HEIGHT - MARGIN.bottom) / 2}) rotate(-90)`).text(dimLabel(b));

  const px = (r) => xa.scale(r[a] + (xa.discrete ? jitter(r.__i, 1) : 0));
  const py = (r) => ya.scale(r[b] + (ya.discrete ? jitter(r.__i, 2) : 0));

  const dots = svg.append("g").selectAll("circle").data(rows, (r) => r.__i).join("circle")
    .attr("class", "dot")
    .classed("me", (r) => r.__i === state.selectedId)
    .attr("r", (r) => (r.__i === state.selectedId ? 5 : 2.8))
    .attr("cx", px).attr("cy", py)
    .style("cursor", "pointer")
    .on("mouseenter", (ev, r) => showTip(ev, `<b>Élève n° ${r.__i + 1}</b><br>${dimLabel(a)} : ${r[a]}<br>${dimLabel(b)} : ${r[b]}`))
    .on("mousemove", moveTip)
    .on("mouseleave", hideTip);
  makeActionable(dots, (r) => setState({ selectedId: r.__i }), (r) => `Élève ${r.__i + 1}, ${dimLabel(a)} ${r[a]}, ${dimLabel(b)} ${r[b]}. Ouvrir la fiche`);

  const curve = medianCurve(rows, a, b);
  svg.append("path").attr("class", "trend")
    .attr("d", d3.line().x((p) => xa.scale(p.x)).y((p) => ya.scale(p.y))(curve));
}
