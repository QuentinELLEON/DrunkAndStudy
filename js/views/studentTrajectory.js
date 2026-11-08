// Panneau 2 : trajectoire G1, G2, G3 de l'élève ouvert dans la fiche
// Conteneur : #viz-student-trajectory   ·   Doc : docs/visualisations.md#panneaux-de-détail-liés
// Entrées : derived.selected et les médianes des élèves évalués de la même école. Rien à dessiner sans élève ouvert.

import { schoolPeers } from "../data.js";
import { median } from "../stats.js";
import { f1, prepareContainer } from "../utils.js";

const NOTES = ["G1", "G2", "G3"];
const HEIGHT = 170;
const MARGIN = { top: 22, right: 18, bottom: 22, left: 26 };

let host = null;

export function init(container) {
  host = prepareContainer(container);
}

export function update(state, derived) {
  if (!host) return;
  host.replaceChildren();
  const stu = derived.selected;
  if (!stu) return;

  const peers = schoolPeers(derived.all, stu);
  const eleve = NOTES.map((k) => stu[k]);
  const ecole = peers.length ? NOTES.map((k) => median(peers.map((r) => r[k]))) : null;

  const width = Math.max(240, host.clientWidth);
  const x = d3.scalePoint().domain(NOTES).range([MARGIN.left + 8, width - MARGIN.right - 8]);
  const y = d3.scaleLinear().domain([0, 20]).range([HEIGHT - MARGIN.bottom, MARGIN.top]);
  const line = d3.line().x((v, i) => x(NOTES[i])).y((v) => y(v));

  const svg = d3.select(host).append("svg")
    .attr("width", width).attr("height", HEIGHT)
    .attr("role", "img")
    .attr("aria-label", `Notes de l'élève en G1, G2, G3 : ${eleve.join(", ")}.${ecole ? ` Médianes de son école : ${ecole.map(f1).join(", ")}.` : ""}`);

  svg.append("line").attr("class", "det-seuil")
    .attr("x1", MARGIN.left).attr("x2", width - MARGIN.right).attr("y1", y(10)).attr("y2", y(10));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${HEIGHT - MARGIN.bottom})`)
    .call(d3.axisBottom(x).tickSizeOuter(0));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${MARGIN.left},0)`)
    .call(d3.axisLeft(y).tickValues([0, 10, 20]).tickSizeOuter(0));

  // Légende écrite : le trait pointillé porte aussi la distinction, pas seulement la teinte.
  svg.append("text").attr("class", "det-lab").attr("x", MARGIN.left).attr("y", 12)
    .text(ecole ? "Trait plein : l'élève. Pointillés : médiane de son école." : "Trait plein : l'élève.");

  if (ecole) {
    svg.append("path").attr("class", "trajg").attr("stroke-dasharray", "5 4").attr("d", line(ecole));
    svg.selectAll("text.det-ecole").data(ecole).join("text")
      .attr("class", "det-lab det-ecole").attr("text-anchor", "middle")
      .attr("x", (v, i) => x(NOTES[i]))
      .attr("y", (v, i) => y(v) + (v > eleve[i] ? -7 : 14))
      .text((v) => f1(v));
  }

  svg.append("path").attr("class", "traj").attr("d", line(eleve));
  svg.selectAll("circle.det-pt").data(eleve).join("circle")
    .attr("class", "det-pt").attr("r", 3.5)
    .attr("cx", (v, i) => x(NOTES[i])).attr("cy", (v) => y(v));
  svg.selectAll("text.det-eleve").data(eleve).join("text")
    .attr("class", "det-val det-eleve").attr("text-anchor", "middle")
    .attr("x", (v, i) => x(NOTES[i]))
    .attr("y", (v, i) => y(v) + (ecole && v < ecole[i] ? 15 : -7))
    .text((v) => v);
}
