// Vue B : matrice de corrélation de Spearman (Jim LAINEL)
// Conteneur #viz-correlation-matrix. La légende (#bLegend), la note (#bInfo), la case #showG et les boutons
// #mxView sont dans index.html. Un clic sur une cellule écrit state.mxPair, que le nuage de points (#8) lira.
// Deux affichages : la matrice complète, ou un classement des liens avec G3 seule (plus simple à lire).

import { prepareContainer, widthOf, colors, cssVar, f2, signed, plural, showTip, hideTip, makeActionable } from "../utils.js";
import { setState } from "../state.js";
import { spearman, spearmanMatrix, significanceThreshold } from "../stats.js";
import { MATRIX_KEYS, MIN_N_CORRELATION, ATTR_LABELS, ATTR_SHORT, ATTR_SENS, DATASETS } from "../meta.js";

const MARGIN = { left: 104, top: 8, right: 4, bottom: 86 };
const MIN_CELL = 24, MAX_CELL = 56;
const NEAR_ZERO = 0.05;   // sous ce seuil on écrit « ≈ 0 » plutôt que −0,02
const RANK_ROW = 34;      // hauteur d'une ligne du classement

let host = null, svg = null;

const label = (k) => ATTR_LABELS[k] || k;
const short = (k) => ATTR_SHORT[k] || k;
const weak = (c, thr) => !Number.isFinite(c.rho) || Math.abs(c.rho) < thr;
const rhoText = (rho) => (!Number.isFinite(rho) ? "–" : Math.abs(rho) < NEAR_ZERO ? "≈ 0" : signed(rho));

function luminance(css) {
  const { r, g, b } = d3.rgb(css);
  const lin = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Couleur de texte la plus lisible sur `bg` parmi celles du thème ; si aucune n'atteint 4,5:1
// (cas des verts de luminance moyenne), on se rabat sur noir ou blanc.
function readableOn(bg, themed) {
  const best = themed.reduce((p, q) => (contrast(bg, q) > contrast(bg, p) ? q : p));
  if (contrast(bg, best) >= 4.5) return best;
  return contrast(bg, "#000") >= contrast(bg, "#fff") ? "#000" : "#fff";
}

// La phrase de l'info-bulle, reprise telle quelle dans l'aria-label.
// Elle compare des groupes d'élèves (« ceux qui ont plus de X ont en général… ») et rappelle que le sens
// de l'influence est inconnu : ρ est symétrique, il ne distingue pas « A agit sur B » de « B agit sur A ».
export function describe(c, thr) {
  const A = label(c.a), B = label(c.b);
  if (!Number.isFinite(c.rho)) return `${A} et ${B} : non calculable, l'un des deux est identique pour tous les élèves de la sélection.`;
  const detail = `ρ = ${signed(c.rho)}, n = ${c.n}`;
  if (Math.abs(c.rho) < thr) return `Pas de lien net entre ${A} et ${B} (${detail}).`;
  const force = Math.abs(c.rho) < 0.3 ? "faible" : Math.abs(c.rho) < 0.5 ? "modéré" : "net";
  const a = ATTR_SENS[c.a], b = ATTR_SENS[c.b];
  const lien = c.rho > 0
    ? `Les élèves avec ${a.plus} ont en général ${b.plus}`
    : `Les élèves avec ${a.plus} ont en général ${b.moins}`;
  return `${lien} (lien ${force}, ${detail}). Cela ne dit pas lequel agit sur l'autre.`;
}
const tipHtml = (c, thr) => `${describe(c, thr)}<br><small>Cliquez pour voir le nuage de points.</small>`;

// G3 en premier, puis les autres du plus au moins lié à G3. Les ρ non calculables passent à la fin.
function orderedKeys(rows, showG) {
  const rest = MATRIX_KEYS.filter((k) => k !== "G3" && (showG || (k !== "G1" && k !== "G2")));
  const strength = new Map(rest.map((k) => {
    const r = Math.abs(spearman(rows, k, "G3"));
    return [k, Number.isFinite(r) ? r : -1];
  }));
  rest.sort((p, q) => strength.get(q) - strength.get(p));
  return ["G3", ...rest];
}

function ensureSvg() {
  if (svg) return svg;
  // role="group" et pas "img" : img cacherait les cellules aux lecteurs d'écran
  svg = d3.select(host).append("svg").attr("role", "group");
  const matrix = svg.append("g").attr("class", "mx-matrix");
  matrix.append("g").attr("class", "mx-labels");
  matrix.append("g").attr("class", "mx-cells");
  matrix.append("rect").attr("class", "mx-frame").attr("rx", 7);
  svg.append("g").attr("class", "mx-rank");
  return svg;
}

function showMessage(html) {
  if (svg) { svg.remove(); svg = null; }
  host.querySelector(".mx-msg")?.remove();
  host.insertAdjacentHTML("beforeend", `<p class="empty mx-msg">${html}</p>`);
}

function renderLegend(thr) {
  const el = document.getElementById("bLegend");
  if (!el) return;
  el.innerHTML = thr === null ? "" :
    `<span>Négatif <span class="mx-scale"><span class="bar mx-legend-bar" role="img" aria-label="Du rouge (lien négatif) au vert (lien positif), blanc au centre"></span>` +
    `<span class="mx-ticks" aria-hidden="true"><i>−1</i><i>0</i><i>+1</i></span></span> Positif</span>` +
    `<span>Vert : même sens. Rouge : sens inverse.</span>` +
    `<span><span class="sw mx-legend-weak"></span>Pas de lien net (sous ±${f2(thr)})</span>` +
    `<span>≈ 0 : sous ±${f2(NEAR_ZERO)}</span>`;
}

function renderInfo(state, derived, best) {
  const el = document.getElementById("bInfo");
  if (!el) return;
  const n = derived.selection.length;
  const sur = n < derived.base.length ? `, sur les ${derived.base.length} de la matière` : "";
  const lines = [`${plural(n, "élève", "élèves")} de ${DATASETS[state.ds].name}${sur}.`];
  if (best) lines.push(`Le lien le plus marqué avec la note finale : ${label(best.a).toLowerCase()} (ρ = ${signed(best.rho)}).`);
  lines.push("ρ dit si deux attributs vont dans le même sens ou en sens inverse. Il ne dit pas lequel agit sur l'autre : un lien n'est pas une cause.");
  const exclus = state.inclNE ? 0 : derived.all.filter((r) => r.__nograde).length;
  if (exclus) lines.push(`${plural(exclus, "élève non évalué exclu", "élèves non évalués exclus")} (la case « non évalués » les réintègre).`);
  el.innerHTML = lines.map((l) => `<span class="mx-line">${l}</span>`).join("");
}

export function init(container) {
  host = prepareContainer(container);
  const box = document.getElementById("showG");
  if (box) box.addEventListener("change", () => setState({ matrixShowG: box.checked }));
  document.querySelectorAll("#mxView button").forEach((b) => b.addEventListener("click", () => setState({ matrixView: b.dataset.v })));
}

export function update(state, derived) {
  if (!host) return;
  const box = document.getElementById("showG");
  if (box) box.checked = state.matrixShowG;
  document.querySelectorAll("#mxView button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === state.matrixView));

  const rows = derived.selection;
  const n = rows.length;
  const thr = significanceThreshold(n);

  if (n < MIN_N_CORRELATION) {
    renderInfo(state, derived, null);
    renderLegend(null);
    showMessage(`Sélection trop petite (${plural(n, "élève", "élèves")}) : il faut au moins ${MIN_N_CORRELATION} élèves pour que les corrélations soient lisibles. Retirez un filtre pour élargir la sélection.`);
    return;
  }
  host.querySelector(".mx-msg")?.remove();
  renderLegend(thr);

  const keys = orderedKeys(rows, state.matrixShowG);
  const cells = spearmanMatrix(rows, keys);
  const withG3 = cells.filter((c) => c.b === "G3");   // colonne G3 : une cellule par autre attribut, déjà triée
  const best = withG3
    .filter((c) => c.a !== "G1" && c.a !== "G2" && Number.isFinite(c.rho))
    .sort((p, q) => Math.abs(q.rho) - Math.abs(p.rho))[0];
  renderInfo(state, derived, best);

  const s = ensureSvg();
  s.attr("aria-label", `Matrice de corrélation de Spearman, ${keys.length} attributs, ${plural(n, "élève", "élèves")}.` +
    (best ? ` Lien le plus marqué avec G3 : ${label(best.a)} (ρ = ${signed(best.rho)}).` : "") +
    " Chaque case se sélectionne au clavier.");

  // Échelle : blanc (ou fond du panneau en sombre) vers vert ou rouge, linéaire de 0 à ±1
  const { ink, panel, muted } = colors();
  const zero = cssVar("--panel");
  const toGreen = d3.interpolateRgb(zero, cssVar("--mx-pos"));
  const toRed = d3.interpolateRgb(zero, cssVar("--mx-neg"));
  const fillOf = (rho) => (rho >= 0 ? toGreen(Math.min(1, rho)) : toRed(Math.min(1, -rho)));

  const [pa, pb] = state.mxPair || [];
  const isSel = (c) => (c.a === pa && c.b === pb) || (c.a === pb && c.b === pa);
  const pick = (c) => setState({ mxPair: [c.a, c.b] });

  const asRank = state.matrixView === "rank";
  s.select(".mx-matrix").attr("display", asRank ? "none" : null);
  s.select(".mx-rank").attr("display", asRank ? null : "none");
  if (asRank) drawRank(s, withG3, { thr, isSel, pick, fillOf, ink, muted });
  else drawMatrix(s, keys, cells, { thr, isSel, pick, fillOf, ink, panel, muted });
}

// ---------- Matrice complète ----------

function drawMatrix(s, keys, cells, { thr, isSel, pick, fillOf, ink, panel, muted }) {
  // m lignes et m colonnes : le triangle ne garde pas la diagonale
  const m = keys.length - 1;
  const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor((widthOf(host) - MARGIN.left - MARGIN.right) / m)));
  const width = MARGIN.left + m * cell + MARGIN.right;
  const height = MARGIN.top + m * cell + MARGIN.bottom;
  s.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  const x = (j) => MARGIN.left + j * cell;
  const y = (i) => MARGIN.top + i * cell;

  const labels = s.select(".mx-labels");
  labels.selectAll("text.mx-row").data(keys.slice(1), (k) => k).join("text")
    .attr("class", (k) => "mx-row mx-lab" + (k === "G3" ? " mx-g3" : ""))
    .attr("x", MARGIN.left - 6).attr("y", (k, i) => y(i + 0.5))
    .attr("text-anchor", "end").attr("dominant-baseline", "central")
    .text(short);
  labels.selectAll("text.mx-col").data(keys.slice(0, -1), (k) => k).join("text")
    .attr("class", (k) => "mx-col mx-lab" + (k === "G3" ? " mx-g3" : ""))
    .attr("transform", (k, j) => `translate(${x(j + 0.5) + 4},${y(m) + 12}) rotate(-45)`)
    .attr("text-anchor", "end")
    .text(short);

  // Survol (ou focus clavier) : on estompe le reste pour suivre la ligne et la colonne de la case
  const follow = (c) => {
    s.classed("mx-hover", !!c);
    s.selectAll(".mx-c").classed("mx-rel", (d) => !!c && (d.a === c.a || d.b === c.b));
    s.selectAll("text.mx-row").classed("mx-rel", (k) => !!c && k === c.a);
    s.selectAll("text.mx-col").classed("mx-rel", (k) => !!c && k === c.b);
  };

  const groups = s.select(".mx-cells").selectAll("g").data(cells, (c) => `${c.a}|${c.b}`).join((enter) => {
    const g = enter.append("g").attr("class", "mx-c");
    const rect = g.append("rect").attr("rx", 3);
    g.append("text").attr("class", "mx-txt");
    makeActionable(rect, pick);
    rect.on("mouseenter", (ev, c) => follow(c))
      .on("mousemove", (ev, c) => showTip(ev, tipHtml(c, thr)))
      .on("mouseleave", () => { follow(null); hideTip(); })
      .on("focus", (ev, c) => {
        follow(c);
        const r = ev.currentTarget.getBoundingClientRect();
        showTip({ clientX: r.right, clientY: r.top }, tipHtml(c, thr));
      })
      .on("blur", () => { follow(null); hideTip(); });
    return g;
  });

  groups.select("rect")
    .attr("class", (c) => "mx-cell" + (isSel(c) ? " mx-sel" : ""))
    .attr("x", (c) => x(c.j) + 1).attr("y", (c) => y(c.i - 1) + 1)
    .attr("width", cell - 2).attr("height", cell - 2)
    .attr("fill", (c) => (weak(c, thr) ? "var(--soft)" : fillOf(c.rho)))
    .attr("aria-pressed", (c) => isSel(c))
    .attr("aria-label", (c) => `${describe(c, thr)} Sélectionner pour voir le nuage de points.`);

  groups.select("text")
    .attr("x", (c) => x(c.j + 0.5)).attr("y", (c) => y(c.i - 0.5))
    .style("font-size", Math.max(8.5, Math.min(12, cell / 3)) + "px")
    .attr("fill", (c) => (weak(c, thr) ? muted : readableOn(fillOf(c.rho), [ink, panel])))
    .text((c) => rhoText(c.rho));

  // Le cadre met G3 en avant : c'est la colonne qui répond à U1-1
  s.select(".mx-frame")
    .attr("x", MARGIN.left - 2).attr("y", MARGIN.top - 2)
    .attr("width", cell + 4).attr("height", m * cell + 4);
}

// ---------- Classement avec G3 ----------
// Une barre par attribut, vers la gauche (négatif, rouge) ou la droite (positif, vert), triée par force du lien.
// L'échelle s'ajuste au plus grand |ρ| de la sélection pour que les barres restent lisibles ; les repères l'indiquent.

function drawRank(s, list, { thr, isSel, pick, fillOf, ink, muted }) {
  const width = widthOf(host);
  const top = 26;
  const height = top + list.length * RANK_ROW + 6;
  s.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  const maxAbs = d3.max(list, (c) => (Number.isFinite(c.rho) ? Math.abs(c.rho) : 0)) || 0;
  const lim = Math.max(0.4, Math.ceil(maxAbs * 5) / 5);
  const x = d3.scaleLinear([-lim, lim], [MARGIN.left + 44, width - 48]);
  const ticks = [-lim, -lim / 2, 0, lim / 2, lim];

  const g = s.select(".mx-rank");
  g.selectAll("*").remove();

  g.selectAll("line.mx-grid").data(ticks).join("line")
    .attr("class", (t) => "mx-grid" + (t === 0 ? " mx-zero" : ""))
    .attr("x1", x).attr("x2", x).attr("y1", top - 4).attr("y2", height - 4);
  g.selectAll("text.mx-tick").data(ticks).join("text")
    .attr("class", "mx-tick").attr("x", x).attr("y", 12).attr("text-anchor", "middle")
    .text((t) => (t === 0 ? "0" : signed(t, 1)));

  const rows = g.selectAll("g.mx-rk").data(list, (c) => c.a).join("g").attr("class", "mx-rk");
  const rowY = (c, i) => top + i * RANK_ROW;

  // Zone cliquable sur toute la ligne : plus facile à viser qu'une barre fine
  const hit = rows.append("rect").attr("class", (c) => "mx-hit" + (isSel(c) ? " mx-sel" : ""))
    .attr("x", 4).attr("width", width - 8).attr("rx", 6)
    .attr("y", (c, i) => rowY(c, i) + 1).attr("height", RANK_ROW - 2)
    .attr("aria-pressed", (c) => isSel(c))
    .attr("aria-label", (c) => `${describe(c, thr)} Sélectionner pour voir le nuage de points.`);
  makeActionable(hit, pick);
  hit.on("mousemove", (ev, c) => showTip(ev, tipHtml(c, thr)))
    .on("mouseleave", hideTip)
    .on("focus", (ev, c) => {
      const r = ev.currentTarget.getBoundingClientRect();
      showTip({ clientX: r.right, clientY: r.top }, tipHtml(c, thr));
    })
    .on("blur", hideTip);

  rows.append("text").attr("class", "mx-lab mx-rklab")
    .attr("x", MARGIN.left - 6).attr("y", (c, i) => rowY(c, i) + RANK_ROW / 2)
    .attr("text-anchor", "end").attr("dominant-baseline", "central")
    .text((c) => short(c.a));

  rows.filter((c) => Number.isFinite(c.rho)).append("rect").attr("class", "mx-bar").attr("rx", 3)
    .attr("x", (c) => Math.min(x(0), x(c.rho))).attr("width", (c) => Math.max(2, Math.abs(x(c.rho) - x(0))))
    .attr("y", (c, i) => rowY(c, i) + 8).attr("height", RANK_ROW - 16)
    .attr("fill", (c) => (weak(c, thr) ? "var(--line)" : fillOf(Math.sign(c.rho) * Math.max(Math.abs(c.rho), 0.6))));

  rows.append("text").attr("class", "mx-rkval")
    .attr("x", (c) => (c.rho < 0 ? x(c.rho) - 6 : x(Number.isFinite(c.rho) ? c.rho : 0) + 6))
    .attr("y", (c, i) => rowY(c, i) + RANK_ROW / 2)
    .attr("text-anchor", (c) => (c.rho < 0 ? "end" : "start")).attr("dominant-baseline", "central")
    .attr("fill", (c) => (weak(c, thr) ? muted : ink))
    .text((c) => rhoText(c.rho));
}
