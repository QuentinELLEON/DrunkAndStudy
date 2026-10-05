/* =====================================================================
   views/parallelCoords.js — Technique 1 (Quentin)
   Coordonnées parallèles + brushing multi-axes + réordonnancement
   ---------------------------------------------------------------------
   Marques   : une polyligne par élève (canvas : 649 lignes sans saturer le DOM)
   Canaux    : position verticale sur chaque axe ; teinte = résultat (bleu ▲ / orange ▼),
               bande de G3 (▼ ● ▲), sexe ou établissement ; opacité = appartenance à la sélection
               (le contexte est estompé, jamais supprimé) ; épaisseur = élève sélectionné.
               Valeur manquante (non-évalué sur absences corrigées / progression) : repère « n. r. »
               sous l'axe, jamais confondue avec 0.
   Axes      : liste retenue dans docs/taches.md (meta.AXIS_KEYS) ; G1/G2 sont dans le slope graph.
   Interactions : brush (filtre global), glisser un titre (réordonner),
               puces (choisir les axes), survol (info-bulle), clic (fiche élève).
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { GROUPS, PASS, MAX_NOMINAL_AXIS } from "../meta.js";
import { axisKeys } from "../data.js";
import { css, resultOf, resultSpec, resultBadge, labelOf, titleOf, shortOf, showTip, hideTip, tipRow, widthOf, esc, truncate } from "../utils.js";

const M = { t: 34, r: 54, b: 34, l: 66 };
const INNER_H = 360;
const NR_Y = INNER_H + 20;                         // repère « non renseigné » sous l'axe

/** Options de couleur pour un fichier au schéma complet (les autres nominaux surchargeaient la liste). */
const COLOR_OPTIONS = [["result", "Résultat (réussite / échec)"], ["g3band", "Bande de G3 (3 niveaux)"],
  ["sex", "Sexe"], ["school", "Établissement"]];
const AXIS_MIN_SPACING = 118;

let root, svgEl, canvas, svg, legendEl, countEl, chipsEl, colorSel, boxEl;
let cur = { state: null, derived: null };
let xPos = {}, scales = {}, nrAxes = new Set(), posCache = [], hoverRec = null, width = 0;
let brushing = false, movingBrush = false;
const brushBehaviors = new Map();

export function init(container) {
  root = container;
  root.innerHTML = `
    <div class="toolbar">
      <label class="lbl" for="pc-color">Couleur des lignes</label><select id="pc-color"></select>
      <div class="legend" id="pc-legend"></div>
    </div>
    <div class="pcscroll"><div class="pcbox">
      <canvas aria-hidden="true"></canvas>
      <svg role="img" aria-label="Coordonnées parallèles : une ligne par élève, un axe par attribut"></svg>
    </div></div>
    <p class="pccount" id="pc-count" aria-live="polite"></p>
    <details class="axes"><summary>Choisir les axes</summary><div class="chipgroups" id="pc-chips"></div></details>`;
  boxEl = root.querySelector(".pcbox");
  svgEl = root.querySelector("svg"); canvas = root.querySelector("canvas");
  svg = d3.select(svgEl);
  legendEl = root.querySelector("#pc-legend"); countEl = root.querySelector("#pc-count");
  chipsEl = root.querySelector("#pc-chips"); colorSel = root.querySelector("#pc-color");

  colorSel.addEventListener("change", e => setState({ colorBy: e.target.value }, "pc"));

  // Choix des axes (clavier : Tab + Entrée/Espace, ce sont des <button>)
  chipsEl.addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    const k = c.dataset.k, axes = cur.state.axes.slice(), i = axes.indexOf(k);
    const brushes = { ...cur.state.brushes };
    if (i >= 0) { if (axes.length <= 2) return; axes.splice(i, 1); delete brushes[k]; }
    else axes.push(k);
    setState({ axes, brushes }, "pc");
  });

  // Survol : ligne la plus proche du pointeur, interpolée entre les deux axes encadrants
  svgEl.addEventListener("mousemove", onHover);
  svgEl.addEventListener("mouseleave", () => { hoverRec = null; hideTip(); svgEl.style.cursor = "default"; });
  svgEl.addEventListener("click", () => { if (hoverRec) toggleSelect(hoverRec.d.__i); });
}

function toggleSelect(id) {
  setState({ selectedId: cur.state.selectedId === id ? null : id }, "pc");
}

/* ---------------- échelles ---------------- */
function makeScale(ds, key) {
  const Mk = ds.meta[key];
  if (Mk.t === "nom" || Mk.t === "ord") {
    const present = new Set(ds.rows.map(d => d[key]));
    const dom = (Mk.d || Array.from(present).sort(d3.ascending)).filter(v => Mk.d ? true : present.has(v));
    const s = d3.scalePoint().domain(dom).range([INNER_H - 10, 10]);
    s.kind = "point";
    s.ticks_ = dom.map(v => [s(v), shortOf(ds.meta, key, v)]);
    return s;
  }
  const dom = Mk.fixed || d3.extent(ds.rows, d => d[key]);
  const s = d3.scaleLinear().domain(dom).range([INNER_H, 0]);
  if (!Mk.fixed) s.nice();
  s.kind = "linear";
  const [a, b] = s.domain(), span = b - a;
  const ticks = span <= 12 && Number.isInteger(a) && Number.isInteger(b)
    ? d3.range(a, b + 1, Math.max(1, Math.ceil(span / 8))) : s.ticks(6);
  if (Mk.fixed && Mk.fixed[1] === 20 && !ticks.includes(20)) ticks.push(20);
  s.ticks_ = ticks.map(v => [s(v), String(v)]);
  return s;
}

/* Conversion brush pixels ⇄ unités de données */
function pixelsToBrush(s, [y0, y1]) {
  if (s.kind === "linear") return { kind: "range", lo: s.invert(y1), hi: s.invert(y0) };
  const values = s.domain().filter(v => s(v) >= y0 - 0.5 && s(v) <= y1 + 0.5);
  return { kind: "set", values };
}
function brushToPixels(s, b) {
  if (!b) return null;
  if (b.kind === "range" && s.kind === "linear") {
    // un brush posé sur une seule valeur (profil d'élève, U2.5) garde une hauteur visible
    const y0 = s(b.hi), y1 = s(b.lo);
    return y1 - y0 >= 8 ? [y0, y1] : [Math.max(0, (y0 + y1) / 2 - 5), Math.min(INNER_H, (y0 + y1) / 2 + 5)];
  }
  if (b.kind === "set" && s.kind === "point") {
    const ys = b.values.map(v => s(v)).filter(y => y != null);
    if (!ys.length) return null;
    const pad = Math.min(8, s.step() / 2 - 1);
    return [Math.max(0, d3.min(ys) - pad), Math.min(INNER_H, d3.max(ys) + pad)];
  }
  return null;
}

/* ---------------- couleurs ---------------- */
function colorSpec(state, ds) {
  if (state.colorBy === "result" && ds.keys.includes("G3")) {
    const R = resultSpec();
    const cats = [{ k: "pass", ...R.pass }, { k: "fail", ...R.fail }];
    if (!state.excludeNoGrade) cats.push({ k: "none", ...R.none });
    return { title: "Résultat", cats, of: resultOf };
  }
  if (state.colorBy === "g3band" && ds.keys.includes("g3band")) {
    const R = resultSpec();
    const cats = [
      { k: 3, label: "solide (G3 ≥ 14)", color: css("--s1"), icon: "▲" },
      { k: 2, label: "juste (10–13)", color: css("--s1-soft"), icon: "●" },
      { k: 1, label: "échec (< 10)", color: css("--s2"), icon: "▼" }];
    if (!state.excludeNoGrade) cats.push({ k: "none", ...R.none });
    return { title: "Bande de G3", cats, of: d => d.__nograde ? "none" : d.g3band };
  }
  const key = ds.keys.includes(state.colorBy) ? state.colorBy : null;
  if (!key) return { title: "Élèves", cats: [{ k: "all", label: "élève", color: css("--s1"), icon: "" }], of: () => "all" };
  const slots = [css("--s1"), css("--s2"), css("--s3")];
  const dom = ds.meta[key].d || Array.from(new Set(ds.rows.map(d => d[key]))).sort(d3.ascending);
  return {
    title: titleOf(ds.meta, key),
    // la couleur suit la modalité (ordre fixe du domaine), jamais son rang dans la sélection
    cats: dom.slice(0, 3).map((v, i) => ({ k: v, label: labelOf(ds.meta, key, v), color: slots[i], icon: "" })),
    of: d => d[key]
  };
}

/* ---------------- rendu ---------------- */
export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) return;
  buildControls(state, ds);
  layout(state, ds);
  // axes sur lesquels au moins un élève affiché n'a pas de valeur → repère « n. r. »
  nrAxes = new Set(state.axes.filter(k => derived.scoped.some(d => { const y = scales[k](d[k]); return y == null || isNaN(y); })));
  drawAxes(state, ds);
  drawLines(state, derived);
  renderLegend(state, ds);
}

function buildControls(state, ds) {
  const eligible = axisKeys(ds);
  // sélecteur de couleur : résultat + nominaux à ≤ 3 modalités (taille de la palette validée)
  const nomOpts = ds.keys.filter(k => ds.meta[k].t === "nom" && new Set(ds.rows.map(d => d[k])).size <= 3);
  const opts = ds.standard
    ? COLOR_OPTIONS.filter(([k]) => k === "result" || ds.keys.includes(k))
    : (ds.keys.includes("G3") ? [["result", "Résultat (réussite / échec)"]] : [["none", "Uniforme"]])
      .concat(nomOpts.map(k => [k, titleOf(ds.meta, k)]));
  const sig = opts.map(o => o[0]).join();
  if (colorSel.dataset.sig !== sig) {
    colorSel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("");
    colorSel.dataset.sig = sig;
  }
  colorSel.value = opts.some(o => o[0] === state.colorBy) ? state.colorBy : opts[0][0];

  const groups = ds.builtin
    ? GROUPS.map(g => [g, eligible.filter(k => ds.meta[k].g === g)])
    : [["Attributs du fichier", eligible]];
  const TY = { nom: "nom", ord: "ord", quant: "qt" };
  chipsEl.innerHTML = groups.filter(g => g[1].length).map(([g, ks]) =>
    `<div class="chipgroup"><h3>${esc(g)}</h3><div class="chips">` +
    ks.map(k => `<button type="button" class="chip" data-k="${k}" aria-pressed="${state.axes.includes(k)}"` +
      (ds.meta[k].def ? ` title="${esc("Dérivé : " + ds.meta[k].def)}"` : "") + `>${esc(titleOf(ds.meta, k))}` +
      `<span class="ty">${TY[ds.meta[k].t]}${ds.meta[k].derived ? " · dér." : ""}</span></button>`).join("") +
    `</div></div>`).join("") +
    (ds.standard
      ? `<p class="note" style="grid-column:1/-1;margin:0">Seuls les attributs utiles aux tâches sont proposés (voir docs/taches.md).
         « dér. » = attribut dérivé (survol : définition). Les nominaux à plus de ${MAX_NOMINAL_AXIS} modalités (métiers, motif) sont dans les boxplots ;
         G1 et G2 dans le slope graph.</p>`
      : `<p class="note" style="grid-column:1/-1;margin:0">Les nominaux à plus de ${MAX_NOMINAL_AXIS} modalités ne sont pas proposés :
         leur ordre sur un axe serait arbitraire. Ils sont étudiés dans les boxplots.</p>`);
}

function layout(state, ds) {
  const ax = state.axes;
  boxEl.style.minWidth = (ax.length * AXIS_MIN_SPACING + 60) + "px";
  width = widthOf(boxEl, 900);
  const h = INNER_H + M.t + M.b, innerW = Math.max(120, width - M.l - M.r);
  svgEl.setAttribute("width", width); svgEl.setAttribute("height", h);
  svgEl.setAttribute("viewBox", `0 0 ${width} ${h}`);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr; canvas.height = h * dpr;
  canvas.style.width = width + "px"; canvas.style.height = h + "px";
  canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  const step = ax.length > 1 ? innerW / (ax.length - 1) : 0;
  xPos = {}; scales = {};
  ax.forEach((k, i) => { xPos[k] = M.l + (ax.length > 1 ? i * step : innerW / 2); scales[k] = makeScale(ds, k); });
}

function getBrush(key) {
  if (!brushBehaviors.has(key)) {
    const br = d3.brushY().extent([[-12, 0], [12, INNER_H]])
      .on("start", ev => { if (ev.sourceEvent) brushing = true; })
      .on("brush end", ev => {
        if (movingBrush || !ev.sourceEvent) return;      // déplacement programmatique : pas un geste
        if (ev.type === "end") brushing = false;
        const brushes = { ...cur.state.brushes };
        const s = scales[key];
        if (ev.selection && s) brushes[key] = pixelsToBrush(s, ev.selection);
        else delete brushes[key];
        // pendant le geste, seules les vues légères suivent en direct (interacting = true) ;
        // les vues coûteuses (boxplots, slope, table) se mettent à jour au relâchement.
        setState({ brushes, interacting: ev.type !== "end" }, "pc");
      });
    brushBehaviors.set(key, br);
  }
  return brushBehaviors.get(key);
}

function drawAxes(state, ds) {
  const ax = state.axes, last = ax.length - 1;
  const hl = state.highlightPair || [];
  const spacing = ax.length > 1 ? (xPos[ax[1]] - xPos[ax[0]]) : 200;
  const lastGrade = ax.filter(k => ["G1", "G2", "G3"].includes(k)).pop();
  const g = svg.selectAll("g.axis").data(ax, k => k);
  g.exit().remove();
  const en = g.enter().append("g").attr("class", "axis");
  en.append("line").attr("class", "axisline");
  en.append("g").attr("class", "ticks");
  en.append("g").attr("class", "pass");
  en.append("g").attr("class", "brush");
  en.append("g").attr("class", "nr");
  en.append("text").attr("class", "axlabel halo").attr("y", -14);
  const all = en.merge(g).attr("transform", k => `translate(${xPos[k]},${M.t})`);
  all.select("line.axisline").attr("y1", 0).attr("y2", INNER_H);

  const anchor = k => ax.indexOf(k) === 0 ? "start" : ax.indexOf(k) === last ? "end" : "middle";
  const dx = k => ax.indexOf(k) === 0 ? -50 : ax.indexOf(k) === last ? 44 : 0;
  // repère « non renseigné » : jamais confondu avec la valeur 0 de l'axe
  all.select("g.nr").each(function (k) {
    const sel = d3.select(this).selectAll("g").data(nrAxes.has(k) ? [k] : []);
    sel.exit().remove();
    const e = sel.enter().append("g");
    e.append("line").attr("class", "axisline").attr("y1", INNER_H + 4).attr("y2", NR_Y - 4).attr("stroke-dasharray", "2 2");
    e.append("text").attr("class", "tlab halo").attr("x", -8).attr("y", NR_Y).attr("dy", "0.32em").attr("text-anchor", "end").text("n. r.");
    e.append("title").text("Non renseigné : élèves non évalués (G3 = 0 et 0 absence), sans valeur sur cet attribut");
  });
  all.select("text.axlabel")
    .attr("text-anchor", anchor).attr("x", dx)
    .classed("hl", k => hl.includes(k))
    .text(k => {
      const i = ax.indexOf(k), room = (i === 0 || i === last) ? spacing / 2 + 44 : spacing - 10;
      return truncate(titleOf(ds.meta, k), Math.max(6, Math.floor(room / 6.6)));
    })
    .call(d3.drag()
      .on("drag", (e, k) => {
        const x = Math.max(M.l, Math.min(width - M.r, e.x + xPos[k]));
        const order = cur.state.axes.slice().sort((a, b) => (a === k ? x : xPos[a]) - (b === k ? x : xPos[b]));
        if (order.join() !== cur.state.axes.join()) setState({ axes: order }, "pc");
      }));
  const TYPE = { nom: "nominal", ord: "ordinal", quant: "quantitatif" };
  all.select("text.axlabel").selectAll("title").data(k => [k]).join("title")
    .text(k => {
      const m = ds.meta[k];
      return `${titleOf(ds.meta, k)} (${TYPE[m.t]}${m.u ? " · " + m.u : ""})` +
        (m.def ? `\nDérivé : ${m.def}` : "") + "\nGlisser latéralement pour réordonner";
    });

  all.each(function (k) {
    const s = scales[k], sel = d3.select(this);
    const t = sel.select("g.ticks").selectAll("g.tk").data(s.ticks_, d => d[1]);
    t.exit().remove();
    const te = t.enter().append("g").attr("class", "tk");
    te.append("line").attr("x1", -4).attr("x2", 0).attr("class", "axisline");
    te.append("text").attr("class", "tlab halo").attr("x", -8).attr("text-anchor", "end").attr("dy", "0.32em");
    te.merge(t).attr("transform", d => `translate(0,${d[0]})`).select("text").text(d => d[1]);

    // Seuil de réussite sur les axes de notes (échelle fixe 0–20)
    const isGrade = ["G1", "G2", "G3"].includes(k) && s.kind === "linear";
    const p = sel.select("g.pass").selectAll("g").data(isGrade ? [PASS] : []);
    p.exit().remove();
    const pe = p.enter().append("g");
    pe.append("line").attr("class", "passline").attr("x1", -14).attr("x2", 14);
    pe.append("text").attr("class", "muted halo").attr("x", 16).attr("dy", "0.32em").style("font-size", "9.5px");
    pe.merge(p).attr("transform", v => `translate(0,${s(v)})`)
      .select("text").text(k === lastGrade ? "seuil 10" : "");

    const br = getBrush(k), bg = sel.select("g.brush");
    if (bg.node().__brushRef !== br) { bg.call(br); bg.node().__brushRef = br; }
    if (!brushing) {
      movingBrush = true;
      bg.call(br.move, brushToPixels(s, state.brushes[k]));
      movingBrush = false;
    }
    bg.selectAll(".selection").attr("fill", css("--s1")).attr("fill-opacity", 0.14)
      .attr("stroke", css("--s1")).attr("stroke-opacity", 0.6);
  });
}

function strokePts(ctx, pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

function drawLines(state, derived) {
  const ds = derived.ds, ax = state.axes;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const spec = colorSpec(state, ds);
  const cmap = new Map(spec.cats.map(c => [c.k, c.color]));
  const pos = d => ax.map(k => {
    const y = scales[k](d[k]);
    return [xPos[k], M.t + (y == null || isNaN(y) ? NR_Y : y)];
  });
  posCache = [];
  const sel = [], ctxRows = [];
  derived.scoped.forEach(d => {
    const rec = { d, pts: pos(d), ok: derived.selectionIds.has(d.__i) };
    posCache.push(rec);
    (rec.ok ? sel : ctxRows).push(rec);
  });
  ctx.lineWidth = 1; ctx.lineJoin = "round";
  // contexte : estompé mais présent (on voit ce que le filtre a retiré)
  ctx.strokeStyle = css("--faint"); ctx.globalAlpha = 0.08;
  ctxRows.forEach(r => strokePts(ctx, r.pts));
  // opacité dégressive selon l'effectif pour limiter la saturation
  const n = sel.length;
  ctx.globalAlpha = n > 400 ? 0.12 : n > 150 ? 0.18 : n > 40 ? 0.32 : 0.6;
  d3.group(sel, r => cmap.get(spec.of(r.d)) || css("--muted")).forEach((arr, col) => {
    ctx.strokeStyle = col; arr.forEach(r => strokePts(ctx, r.pts));
  });
  ctx.globalAlpha = 1;
  // élève sélectionné au premier plan, avec un liseré de la couleur du fond
  const selected = derived.selected;
  if (selected) {
    const pts = pos(selected);
    ctx.lineWidth = 5; ctx.strokeStyle = css("--surface-1"); strokePts(ctx, pts);
    ctx.lineWidth = 2.4; ctx.strokeStyle = cmap.get(spec.of(selected)) || css("--text-1"); strokePts(ctx, pts);
    ctx.fillStyle = ctx.strokeStyle;
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 3.4, 0, 2 * Math.PI); ctx.fill(); });
  }
  const tot = derived.scoped.length;
  countEl.textContent = derived.brushCount
    ? `${n} élèves sur ${tot} passent les brushes (n = ${n}).`
    : `${n} élèves affichés sur ${tot} — brossez un axe pour restreindre la sélection.`;
}

function renderLegend(state, ds) {
  const spec = colorSpec(state, ds);
  legendEl.innerHTML = spec.cats.map(c =>
    `<span class="item"><span class="sw" style="background:${c.color}"></span>` +
    (c.icon ? `<span class="ic" style="color:${c.color}">${c.icon}</span>` : "") + `${esc(c.label)}</span>`).join("") +
    `<span class="item"><span class="sw" style="background:${css("--faint")}"></span>hors sélection (contexte)</span>`;
}

function onHover(ev) {
  if (!cur.derived || !cur.derived.ds || brushing) return;
  const ax = cur.state.axes;
  const r = svgEl.getBoundingClientRect();
  const mx = ev.clientX - r.left, my = ev.clientY - r.top;
  if (ax.length < 2 || mx < xPos[ax[0]] - 4 || mx > xPos[ax[ax.length - 1]] + 4) { hoverRec = null; hideTip(); return; }
  // pas de survol dans la zone de brush d'un axe : le geste y est réservé au brossage
  if (ax.some(k => Math.abs(mx - xPos[k]) <= 12)) { hoverRec = null; hideTip(); svgEl.style.cursor = "default"; return; }
  let seg = 0;
  for (let i = 0; i < ax.length - 1; i++) if (mx >= xPos[ax[i]]) seg = i;
  const x0 = xPos[ax[seg]], x1 = xPos[ax[seg + 1]];
  const t = x1 === x0 ? 0 : (mx - x0) / (x1 - x0);
  let best = null, bd = 8;
  for (const rec of posCache) {
    if (!rec.ok) continue;
    const y = rec.pts[seg][1] + t * (rec.pts[seg + 1][1] - rec.pts[seg][1]);
    const dd = Math.abs(y - my);
    if (dd < bd) { bd = dd; best = rec; }
  }
  hoverRec = best;
  if (!best) { hideTip(); svgEl.style.cursor = "default"; return; }
  svgEl.style.cursor = "pointer";
  const meta = cur.derived.ds.meta, d = best.d;
  showTip(ev, `<b>Élève n° ${d.__i + 1}</b> · ${resultBadge(d)}` +
    `<div style="margin-top:5px">${ax.map(k => tipRow(esc(titleOf(meta, k)), esc(labelOf(meta, k, d[k])))).join("")}</div>` +
    `<div class="hint">Clic : ouvrir la fiche</div>`);
}
