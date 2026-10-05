/* =====================================================================
   views/alluvial.js — Technique de Gabriel (vue d'ensemble)
   Diagramme alluvial des bandes de notes P1 → P2 → finale + trajectoires
   ---------------------------------------------------------------------
   Question de la page : « Comment évoluent les notes pendant l'année ? »
   Tâche : U1-5 (isoler les élèves en baisse d'au moins 2 points et afficher
           leur trajectoire). Variante « ensembles parallèles » de la famille
           multivariée citée dans evaluation.md.
   Transformation : chaque note (G1, G2, G3) est rangée dans une bande
           (meta.BANDS : solide ≥ 14, juste 10–13, échec < 10, non évalué) ;
           on compte les élèves pour chaque passage de bande entre deux périodes.
   Marques   : un rectangle par bande et par période (hauteur = nombre d'élèves),
               un ruban par passage (épaisseur = nombre d'élèves).
   Canaux    : teinte = bande de départ (bleu ▲ / bleu clair ● / orange ▼ / gris ✕) ;
               les rubans de la sélection (tendance ▼ ou flux cliqué) sont foncés,
               les autres restent en fond.
   Interactions : bouton « en baisse d'au moins 2 points » (filtre global),
               clic sur un ruban (filtre global sur ce passage), survol (effectif),
               liste des trajectoires sélectionnées (clic → fiche).
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { BANDS, bandOf, SMALL_N, PASS } from "../meta.js";
import { css, resultOf, resultSpec, showTip, hideTip, tipRow, widthOf, esc, pct } from "../utils.js";

const STEPS = [["G1", "Période 1"], ["G2", "Période 2"], ["G3", "Note finale"]];
const H = 280, NW = 14, PAD = 10, TOP = 24;
const LIST_MAX = 60;
let root, headEl, ctlEl, svgEl, listEl;
let cur = { state: null, derived: null };

export function init(container) {
  root = container;
  root.innerHTML = `
    <p class="headline" id="allu-head" aria-live="polite"></p>
    <div class="toolbar" id="allu-ctl"></div>
    <div class="allu"><svg id="allu-svg" role="img" aria-label="Diagramme alluvial des bandes de notes entre les trois périodes"></svg></div>
    <div id="allu-list"></div>`;
  headEl = root.querySelector("#allu-head");
  ctlEl = root.querySelector("#allu-ctl");
  svgEl = root.querySelector("#allu-svg");
  listEl = root.querySelector("#allu-list");
  ctlEl.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-trend")) setState({ trend: cur.state.trend === "down" ? "all" : "down" }, "allu");
    if (b.dataset.clearflow != null) setState({ flow: null }, "allu");
  });
  listEl.addEventListener("click", e => {
    const r = e.target.closest("[data-i]"); if (r) setState({ selectedId: +r.dataset.i }, "allu");
  });
  listEl.addEventListener("keydown", e => {
    const r = e.target.closest("[data-i]");
    if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setState({ selectedId: +r.dataset.i }, "allu"); }
  });
}

const band = (d, k) => k === "G3" && d.__nograde ? "N" : bandOf(d[k]);
const BAND = Object.fromEntries(BANDS.map(b => [b.k, b]));
function bandColor(k) { return { S: css("--s1"), J: css("--s1-soft"), E: css("--s2"), N: css("--muted") }[k]; }

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) return;
  if (!STEPS.every(([k]) => ds.keys.includes(k))) {
    headEl.textContent = ""; ctlEl.innerHTML = ""; d3.select(svgEl).selectAll("*").remove(); svgEl.removeAttribute("height");
    listEl.innerHTML = `<p class="empty">Cette vue nécessite les colonnes G1, G2 et G3.</p>`; return;
  }
  const rows = derived.exceptFlow, sel = derived.selection, selIds = derived.selectionIds;
  const down = rows.filter(d => d.__trend === "down").length;
  const focused = ctlEl.contains(document.activeElement);
  ctlEl.innerHTML =
    `<button type="button" class="btn${state.trend === "down" ? " on" : ""}" data-trend aria-pressed="${state.trend === "down"}">▼ En baisse d'au moins 2 points <span class="nbadge">${down}</span></button>` +
    (state.flow ? `<span class="fchip">Passage : ${STEPS[state.flow.s][1]} ${BAND[state.flow.a].icon} ${BAND[state.flow.a].label} → ${STEPS[state.flow.s + 1][1]} ${BAND[state.flow.b].icon} ${BAND[state.flow.b].label}
      <button type="button" data-clearflow aria-label="Retirer le filtre de passage">✕</button></span>` : "") +
    `<span class="muted">Cliquez un ruban pour isoler ces élèves.</span>`;
  if (focused) { const b = ctlEl.querySelector("[data-trend]"); if (b) b.focus({ preventScroll: true }); }

  // en-tête : décrochages et passage vers l'échec le plus fréquent
  const graded = rows.filter(d => !d.__nograde);
  const toFail = graded.filter(d => band(d, "G1") !== "E" && band(d, "G3") === "E").length;
  headEl.innerHTML = graded.length
    ? `Entre la période 1 et la note finale, <b>${down} élève${down > 1 ? "s" : ""}</b> perdent au moins 2 points ` +
      `(${pct(down / graded.length)}) et <b>${toFail}</b> passent sous 10.` +
      (rows.some(d => d.__nograde) ? ` Les non-évalués apparaissent à droite (✕) : regardez d'où ils viennent.` : "")
    : "Aucun élève dans la sélection.";

  draw(state, rows, selIds, derived.filtered && (state.trend !== "all" || state.flow));
  drawList(state, derived, sel);
}

function draw(state, rows, selIds, highlight) {
  const W = widthOf(root, 600), xs = [0, 1, 2].map(i => 70 + i * (W - 140 - NW) / 2);
  const total = rows.length || 1, k = (H - TOP - 3 * PAD - 10) / total;
  const order = ["S", "J", "E", "N"];
  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  // nœuds
  const nodes = STEPS.map(([key], s) => {
    const m = d3.rollup(rows, v => v.length, d => band(d, key)); let y = TOP; const o = {};
    order.forEach(b => { const v = m.get(b); if (v) { o[b] = { y, v, out: y, in: y, outS: y, inS: y }; y += v * k + PAD; } });
    return o;
  });
  // rubans (base) puis part sélectionnée par-dessus
  const g = svg.append("g");
  [0, 1].forEach(s => {
    const [ka] = STEPS[s], [kb] = STEPS[s + 1];
    const links = d3.rollups(rows, v => ({ n: v.length, nSel: v.filter(d => selIds.has(d.__i)).length }), d => band(d, ka), d => band(d, kb));
    const flat = [];
    order.forEach(a => order.forEach(b => {
      const l = links.find(x => x[0] === a); const ll = l && l[1].find(x => x[0] === b);
      if (ll) flat.push({ s, a, b, ...ll[1] });
    }));
    flat.forEach(l => {
      const A = nodes[s][l.a], B = nodes[s + 1][l.b], w = l.n * k;
      const x0 = xs[s] + NW, x1 = xs[s + 1], y0 = A.out, y1 = B.in;
      A.out += w; B.in += w;
      const on = state.flow && state.flow.s === s && state.flow.a === l.a && state.flow.b === l.b;
      const path = (ya, yb, ww) => `M${x0},${ya}C${(x0 + x1) / 2},${ya} ${(x0 + x1) / 2},${yb} ${x1},${yb}L${x1},${yb + ww}C${(x0 + x1) / 2},${yb + ww} ${(x0 + x1) / 2},${ya + ww} ${x0},${ya + ww}Z`;
      g.append("path").attr("class", "link").attr("d", path(y0, y1, w))
        .attr("fill", bandColor(l.a)).attr("fill-opacity", highlight ? 0.14 : on ? 0.7 : 0.38)
        .attr("stroke", on ? css("--text-1") : "none").attr("stroke-width", on ? 1.5 : 0)
        .attr("tabindex", 0).attr("role", "button")
        .attr("aria-label", `${STEPS[s][1]} ${BAND[l.a].label} vers ${STEPS[s + 1][1]} ${BAND[l.b].label} : ${l.n} élèves`)
        .on("mousemove", ev => showTip(ev, `<b>${BAND[l.a].icon} ${BAND[l.a].label} → ${BAND[l.b].icon} ${BAND[l.b].label}</b>` +
          tipRow(`${STEPS[s][1]} → ${STEPS[s + 1][1]}`, `${l.n} élève${l.n > 1 ? "s" : ""}`) +
          (highlight ? tipRow("dont sélection", l.nSel) : "") + `<div class="hint">Clic : isoler ces élèves dans toutes les vues</div>`))
        .on("mouseleave", hideTip)
        .on("click", () => toggleFlow(s, l.a, l.b))
        .on("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggleFlow(s, l.a, l.b); } });
      if (highlight && l.nSel) {
        // part sélectionnée, empilée en haut du ruban
        const ws = l.nSel * k, ya = A.outS, yb = B.inS;
        A.outS += ws; B.inS += ws;
        g.append("path").attr("d", path(ya, yb, ws)).attr("fill", bandColor(l.a)).attr("fill-opacity", 0.85).attr("pointer-events", "none");
      }
      // garde la part sélectionnée alignée sur le haut de chaque ruban
      if (highlight) { A.outS = A.out; B.inS = B.in; }
    });
  });
  // rectangles et étiquettes
  nodes.forEach((o, s) => order.forEach(b => {
    if (!o[b]) return;
    const n = o[b];
    svg.append("rect").attr("x", xs[s]).attr("y", n.y).attr("width", NW).attr("height", Math.max(1, n.v * k)).attr("rx", 2).attr("fill", bandColor(b));
    const left = s === 0, right = s === 2;
    const t = svg.append("text").attr("class", "halo").attr("y", n.y + n.v * k / 2 + 4).style("font-size", "11px").style("fill", css("--text-1"))
      .attr("x", left ? xs[s] - 6 : right ? xs[s] + NW + 6 : xs[s] + NW + 4).attr("text-anchor", left ? "end" : "start");
    t.text(`${BAND[b].icon} ${n.v}`);
    t.append("title").text(`${BAND[b].label} : ${n.v} élèves`);
  }));
  STEPS.forEach(([key, lab], s) => svg.append("text").attr("x", xs[s] + NW / 2).attr("y", 12).attr("text-anchor", "middle")
    .style("font-size", "12px").style("font-weight", 600).style("fill", css("--text-1")).text(`${lab} (${key})`));
  // légende des bandes
  const lg = svg.append("g").attr("transform", `translate(0,${H - 4})`);
  let lx = 0;
  BANDS.filter(b => nodes.some(o => o[b.k])).forEach(b => {
    lg.append("rect").attr("x", lx).attr("y", -9).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", bandColor(b.k));
    const t = lg.append("text").attr("x", lx + 14).attr("y", 0).style("font-size", "11px").text(`${b.icon} ${b.label}`);
    lx += 22 + (t.node().getComputedTextLength ? t.node().getComputedTextLength() : 80);
  });
}

function toggleFlow(s, a, b) {
  const f = cur.state.flow;
  setState({ flow: f && f.s === s && f.a === a && f.b === b ? null : { s, a, b } }, "allu");
}

/** Trajectoires individuelles de la sélection (quand elle est assez petite pour être lue). */
function drawList(state, derived, sel) {
  const active = state.trend !== "all" || state.flow || derived.nCrit || state.groupFilter;
  if (!active) { listEl.innerHTML = `<p class="note">Filtrez (▼ en baisse, un ruban, des facteurs de risque) pour lister les trajectoires individuelles.</p>`; return; }
  if (!sel.length) { listEl.innerHTML = `<p class="note">Aucun élève dans la sélection.</p>`; return; }
  if (sel.length > LIST_MAX) { listEl.innerHTML = `<p class="note">${sel.length} élèves sélectionnés : affinez la sélection (moins de ${LIST_MAX}) pour lister leurs trajectoires.</p>`; return; }
  const R = resultSpec(), rows = sel.slice().sort((a, b) => (isFinite(a.__delta) ? a.__delta : 99) - (isFinite(b.__delta) ? b.__delta : 99) || a.__i - b.__i);
  const spark = d => {
    const w = 84, h = 26, x = i => 4 + i * 38, y = v => 3 + (20 - v) / 20 * (h - 6);
    const pts = STEPS.map(([k], i) => [x(i), y(d[k])]);
    return `<svg width="${w}" height="${h}" aria-hidden="true"><line x1="0" x2="${w}" y1="${y(PASS)}" y2="${y(PASS)}" class="passline"/>` +
      `<polyline points="${pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="${R[resultOf(d)].color}" stroke-width="2" stroke-linejoin="round"/>` +
      pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="${R[resultOf(d)].color}"/>`).join("") + `</svg>`;
  };
  listEl.innerHTML = `<p class="note" style="margin:8px 0 4px">Trajectoires des ${sel.length} élèves sélectionnés (du plus fort recul au plus faible)${sel.length < SMALL_N ? " ⚠ moins de 10" : ""} :</p>
    <div class="tlist">` + rows.map(d => `<div class="trow${d.__i === state.selectedId ? " on" : ""}" data-i="${d.__i}" tabindex="0" role="button" aria-label="Élève ${d.__i + 1}, notes ${d.G1}, ${d.G2}, ${d.G3}">
      <span class="tid">n° ${d.__i + 1}</span>${spark(d)}<span class="tval">${d.G1} → ${d.G2} → ${d.G3}</span>
      <span class="tdel">${!isFinite(d.__delta) ? "✕" : d.__delta > 0 ? "▲ +" + d.__delta : d.__delta < 0 ? "▼ −" + -d.__delta : "● 0"}</span></div>`).join("") + `</div>`;
}
