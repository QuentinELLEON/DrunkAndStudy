// Panneau 1 : boxplot de G3 de la sélection
// Conteneur : #viz-selection-boxplot   ·   Doc : docs/visualisations.md#panneaux-de-détail-liés
// Entrées : derived.selection et derived.base. Deux boîtes quand la sélection est un sous-ensemble, pour comparer.

import { boxStats } from "../stats.js";
import { f1, prepareContainer } from "../utils.js";

const ROW = 46;        // hauteur d'une boîte et de son texte (px)
const BOX = 14;        // épaisseur de la boîte (px)
const AXIS = 24;       // place de l'axe (px)
const MARGIN = 10;     // marges gauche et droite (px)

let host = null;

export function init(container) {
  host = prepareContainer(container);
}

export function update(state, derived) {
  if (!host) return;
  host.replaceChildren();
  const all = derived.base.map((r) => r.G3);
  const sel = derived.selection.map((r) => r.G3);
  if (!all.length) return;

  const subset = sel.length > 0 && sel.length !== all.length;
  const rows = subset
    ? [{ label: "Sélection", cls: "bx-sel", s: boxStats(sel) }, { label: "Ensemble", cls: "bx-all", s: boxStats(all) }]
    : [{ label: "Ensemble", cls: "bx-sel", s: boxStats(all) }];

  const width = Math.max(240, host.clientWidth);
  const height = rows.length * ROW + AXIS;
  const x = d3.scaleLinear().domain([0, 20]).range([MARGIN, width - MARGIN]);
  const summary = (r) => `${r.label}, médiane ${f1(r.s.med)}, n = ${r.s.n}`;

  const svg = d3.select(host).append("svg")
    .attr("width", width).attr("height", height)
    .attr("role", "img")
    .attr("aria-label", `Distribution de la note finale sur 20. ${rows.map(summary).join(". ")}.`);

  svg.append("line").attr("class", "det-seuil")
    .attr("x1", x(10)).attr("x2", x(10)).attr("y1", 0).attr("y2", height - AXIS);

  rows.forEach((r, i) => {
    const y = i * ROW + 26;
    const g = svg.append("g");
    g.append("text").attr("class", "det-lab").attr("x", MARGIN).attr("y", y - 11).text(summary(r));
    g.append("line").attr("class", "det-trait").attr("x1", x(r.s.min)).attr("x2", x(r.s.max)).attr("y1", y).attr("y2", y);
    g.append("rect").attr("class", r.cls).attr("x", x(r.s.q1)).attr("y", y - BOX / 2)
      .attr("width", x(r.s.q3) - x(r.s.q1)).attr("height", BOX);
    g.append("line").attr("class", "det-med").attr("x1", x(r.s.med)).attr("x2", x(r.s.med)).attr("y1", y - BOX / 2).attr("y2", y + BOX / 2);
  });

  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - AXIS})`)
    .call(d3.axisBottom(x).tickValues([0, 5, 10, 15, 20]).tickSizeOuter(0));
}
