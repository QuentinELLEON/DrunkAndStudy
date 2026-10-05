/* =====================================================================
   views/histograms.js — Technique d'Alexandre
   Small multiples d'histogrammes de la note finale + simulateur de profil
   ---------------------------------------------------------------------
   Question de la page : « Comment se répartissent les notes ? »
   Tâches : U2-1 (part des élèves ≥ 10), U1-2 (comparer des sous-groupes),
            U2-4 (profil à risque contre profil protégé), U2-2 et U2-5 (simulateur).
   Transformation : pour chaque modalité du groupe choisi, effectif par note
            entière 0–20, rapporté à l'effectif du groupe ; médiane ; taux de réussite.
   Marques   : une barre par note (0 à 20), un repère de médiane.
   Canaux    : position horizontale = note, toujours 0–20, seuil à 10 en pointillés ;
               hauteur = part du groupe (échelle commune à tous les panneaux) ;
               teinte = résultat (orange ▼ échec / bleu ▲ réussite / gris ✕ non évalué).
               Le pourcentage de réussite est écrit en gros : on ne demande pas de lire une aire.
   Interactions : choix du groupe, clic sur un panneau (filtre toutes les vues),
               survol d'une barre (effectif exact), simulateur (critères + note facultative).
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { PASS, SMALL_N, SIM_KEYS } from "../meta.js";
import { histGroupKeys } from "../data.js";
import { percentBelow } from "../stats.js";
import { css, resultOf, resultSpec, labelOf, shortOf, titleOf, showTip, hideTip, tipRow, widthOf, esc, fmt1, pct } from "../utils.js";

const PH = 160, MG = { t: 20, r: 8, b: 22, l: 8 };
let root, groupSel, headEl, panelsEl, simCtl, simOut;
let cur = { state: null, derived: null };

export function init(container) {
  root = container;
  root.innerHTML = `
    <p class="headline" id="hist-head" aria-live="polite"></p>
    <div class="toolbar">
      <label class="lbl" for="hist-group">Comparer selon</label>
      <select id="hist-group"></select>
      <div class="legend" id="hist-legend"></div>
    </div>
    <div class="hpanels" id="hist-panels"></div>
    <div class="sim" id="sim">
      <h3>Simuler un profil <span class="muted">fictif et anonyme : aucun élève n'est nommé</span></h3>
      <div class="simctl" id="sim-ctl"></div>
      <div id="sim-out"></div>
    </div>`;
  groupSel = root.querySelector("#hist-group");
  headEl = root.querySelector("#hist-head");
  panelsEl = root.querySelector("#hist-panels");
  simCtl = root.querySelector("#sim-ctl");
  simOut = root.querySelector("#sim-out");

  groupSel.addEventListener("change", e => setState({ groupBy: e.target.value, groupFilter: null }, "hist"));
  panelsEl.addEventListener("click", e => {
    const p = e.target.closest(".hpanel[data-v]"); if (!p) return;
    toggleGroup(p.dataset.v);
  });
  panelsEl.addEventListener("keydown", e => {
    const p = e.target.closest(".hpanel[data-v]");
    if (p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleGroup(p.dataset.v); }
  });
  simCtl.addEventListener("click", e => {
    const b = e.target.closest("button[data-k]"); if (!b) return;
    const sim = { ...cur.state.sim };
    if (b.dataset.v === "") delete sim[b.dataset.k]; else sim[b.dataset.k] = +b.dataset.v;
    setState({ sim }, "sim");
  });
  simCtl.addEventListener("change", e => {
    if (e.target.id !== "sim-note") return;
    const sim = { ...cur.state.sim }, v = e.target.value.trim();
    const n = +v.replace(",", ".");
    if (v === "" || !isFinite(n)) delete sim.note; else sim.note = Math.max(0, Math.min(20, Math.round(n)));
    setState({ sim }, "sim");
  });
}

function toggleGroup(raw) {
  const key = cur.state.groupBy, ds = cur.derived.ds;
  const value = ds.meta[key] && ds.meta[key].t !== "nom" ? +raw : raw;
  const gf = cur.state.groupFilter;
  setState({ groupFilter: gf && gf.key === key && gf.value === value ? null : { key, value } }, "hist");
}

/** Statistiques d'un ensemble d'élèves : effectif par note, médiane, réussite (élèves évalués seulement). */
function summarize(rows) {
  const counts = d3.range(21).map(() => ({ pass: 0, fail: 0, none: 0 }));
  rows.forEach(d => { if (isFinite(d.G3)) counts[Math.max(0, Math.min(20, d.G3))][resultOf(d)]++; });
  const graded = rows.filter(d => !d.__nograde && isFinite(d.G3));
  const ok = graded.filter(d => d.G3 >= PASS).length;
  return { n: rows.length, counts, graded: graded.length, ok,
    rate: graded.length ? ok / graded.length : NaN,
    median: graded.length ? d3.median(graded, d => d.G3) : NaN,
    mean: graded.length ? d3.mean(graded, d => d.G3) : NaN };
}

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) return;
  if (!ds.keys.includes("G3")) {
    headEl.textContent = ""; panelsEl.innerHTML = `<p class="empty">Ce fichier n'a pas de colonne G3 (note finale).</p>`;
    simCtl.innerHTML = ""; simOut.innerHTML = ""; groupSel.innerHTML = ""; return;
  }
  const keys = histGroupKeys(ds);
  const sig = keys.join();
  if (groupSel.dataset.sig !== sig) {
    groupSel.innerHTML = `<option value="">Tous les élèves (pas de groupe)</option>` +
      keys.map(k => `<option value="${k}">${esc(titleOf(ds.meta, k))}</option>`).join("");
    groupSel.dataset.sig = sig;
  }
  const key = keys.includes(state.groupBy) ? state.groupBy : "";
  groupSel.value = key;

  const R = resultSpec();
  legendEl().innerHTML = ["pass", "fail"].concat(state.excludeNoGrade ? [] : ["none"]).map(k =>
    `<span class="item"><span class="sw sq" style="background:${R[k].color}"></span>${R[k].icon} ${R[k].label}</span>`).join("");

  // panneaux : un par modalité (ou un seul, tous les élèves)
  const gf = state.groupFilter && state.groupFilter.key === key ? state.groupFilter : null;
  let groups;
  if (!key) groups = [{ v: "", label: `${ds.name} · tous les élèves affichés`, rows: derived.selection }];
  else {
    // un filtre posé sur ce même groupe ne fait pas disparaître les autres panneaux (ils restent estompés)
    const pool = gf ? derived.exceptGroup : derived.selection;
    const M = ds.meta[key], B = M.bins;                      // B : modalités réunies pour comparer (ex. risque ≥ 2)
    const val = d => B ? B.of(d[key]) : d[key];
    const present = new Set(pool.map(val).filter(v => v !== "" && !(typeof v === "number" && isNaN(v))));
    const D = B ? B.d : M.d;
    const dom = (D ? D.filter(v => present.has(v)) : Array.from(present).sort(d3.ascending));
    const lab = v => B ? B.s[B.d.indexOf(v)] : null;
    groups = dom.map(v => ({ v, label: lab(v) || `${shortOf(ds.meta, key, v)}`, long: lab(v) ? `${titleOf(ds.meta, key)} : ${lab(v)}` : labelOf(ds.meta, key, v),
      rows: pool.filter(d => val(d) === v) }));
  }
  groups.forEach(g => { g.s = summarize(g.rows); });
  const ymax = d3.max(groups, g => d3.max(g.s.counts, c => g.s.n ? (c.pass + c.fail + c.none) / g.s.n : 0)) || 0.1;

  headEl.innerHTML = headline(ds, key, groups);

  // un seul histogramme : toute la largeur ; plusieurs : petits multiples d'au moins 250 px
  panelsEl.style.setProperty("--pw", groups.length === 1 ? "100%" : "250px");
  const sel = d3.select(panelsEl).selectAll("div.hpanel").data(groups, g => String(g.v));
  sel.exit().remove();
  const en = sel.enter().append("div").attr("class", "hpanel");
  en.append("div").attr("class", "htitle");
  en.append("svg");
  en.merge(sel).order().each(function (g) { drawPanel(this, g, key, gf, ymax, ds, derived); });

  drawSim(state, derived);
}

function legendEl() { return root.querySelector("#hist-legend"); }

function headline(ds, key, groups) {
  const all = groups.length === 1 && !key ? groups[0].s : null;
  if (all) {
    if (!all.graded) return "Aucun élève évalué dans la sélection.";
    return `<b>${pct(all.rate)}</b> des élèves évalués ont au moins 10/20 (${all.ok} sur ${all.graded}). ` +
      `La note habituelle (médiane) est <b>${fmt1(all.median).replace(/,0$/, "")}/20</b>.` + (all.graded < SMALL_N ? " ⚠ Moins de 10 élèves : à lire comme un cas, pas une tendance." : "");
  }
  const ok = groups.filter(g => g.s.graded >= SMALL_N && isFinite(g.s.rate));
  if (groups.length < 2) return `Selon « ${esc(titleOf(ds.meta, key))} » : un seul groupe dans la sélection (${esc(groups[0] ? groups[0].long || groups[0].label : "aucun")}). Retirez des critères pour comparer.`;
  if (ok.length < 2) return `Selon « ${esc(titleOf(ds.meta, key))} » : pas assez d'élèves par groupe pour comparer (moins de 10).`;
  const hi = ok.reduce((a, b) => b.s.rate > a.s.rate ? b : a), lo = ok.reduce((a, b) => b.s.rate < a.s.rate ? b : a);
  return `Selon « ${esc(titleOf(ds.meta, key))} », la réussite va de <b>${pct(lo.s.rate)}</b> (${esc(lo.long || lo.label)}, médiane ${fmt1(lo.s.median).replace(/,0$/, "")}) ` +
    `à <b>${pct(hi.s.rate)}</b> (${esc(hi.long || hi.label)}, médiane ${fmt1(hi.s.median).replace(/,0$/, "")}). Association, pas cause.`;
}

function drawPanel(node, g, key, gf, ymax, ds, derived) {
  const s = g.s, small = s.graded < SMALL_N;
  const active = gf && gf.value === g.v, dim = gf && !active;
  d3.select(node)
    .attr("data-v", key ? String(g.v) : null)
    .attr("tabindex", key ? 0 : null)
    .attr("role", key ? "button" : null)
    .attr("aria-pressed", key ? String(!!active) : null)
    .classed("dim", !!dim).classed("active", !!active).classed("small", small)
    .attr("aria-label", `${key ? titleOf(ds.meta, key) + " : " + (g.long || g.label) + ". " : ""}${s.n} élèves, ${isFinite(s.rate) ? pct(s.rate) + " ont au moins 10" : "aucun évalué"}.${key ? " Entrée pour filtrer toutes les vues sur ce groupe." : ""}`);
  d3.select(node).select(".htitle").html(
    `<span class="hname">${esc(key ? (g.long || g.label) : g.label)}</span>` +
    `<span class="hrate">${isFinite(s.rate) ? pct(s.rate) : "—"}<small> ≥ 10/20</small></span>` +
    `<span class="hsub">médiane ${isFinite(s.median) ? fmt1(s.median).replace(/,0$/, "") : "—"} · n = ${s.n}${small ? " ⚠ moins de 10" : ""}</span>`);

  const w = parseInt(getComputedStyle(node).width) || 300, iw = w - MG.l - MG.r - 2, ih = PH - MG.t - MG.b;
  const x = d3.scaleBand().domain(d3.range(21)).range([0, iw]).paddingInner(0.12);
  const y = d3.scaleLinear().domain([0, ymax]).range([ih, 0]);
  const R = resultSpec(), sid = derived.selected ? derived.selected.__i : null;
  const svg = d3.select(node).select("svg").attr("viewBox", `0 0 ${w - 2} ${PH}`).attr("height", PH)
    .attr("role", "img").attr("aria-label", `Histogramme des notes finales, ${s.n} élèves`);
  svg.selectAll("*").remove();
  const gg = svg.append("g").attr("transform", `translate(${MG.l},${MG.t})`);
  gg.append("line").attr("class", "gridline").attr("x1", 0).attr("x2", iw).attr("y1", ih).attr("y2", ih);
  const bars = s.counts.map((c, v) => ({ v, c, n: c.pass + c.fail + c.none, key: c.none ? "none" : v >= PASS ? "pass" : "fail" }));
  gg.selectAll("path.bar").data(bars.filter(b => b.n)).join("path").attr("class", "bar")
    .attr("d", b => roundTop(x(b.v), y(b.n / s.n), x.bandwidth(), ih - y(b.n / s.n)))
    .attr("fill", b => R[b.key].color)
    .attr("fill-opacity", small ? 0.55 : 1);
  // zone de survol par note (plus large que la barre)
  gg.selectAll("rect.hit").data(bars).join("rect").attr("class", "hit")
    .attr("x", b => x(b.v)).attr("width", x.step()).attr("y", 0).attr("height", ih).attr("fill", "transparent")
    .on("mousemove", (ev, b) => showTip(ev, `<b>${b.v}/20</b>` + tipRow("Élèves", `${b.n} sur ${s.n}`) +
      tipRow("Part du groupe", s.n ? pct(b.n / s.n) : "—") + (b.c.none ? `<div class="hint">✕ ${b.c.none} non évalué(s) : 0 et aucune absence</div>` : "")))
    .on("mouseleave", hideTip);
  // seuil de réussite
  const xT = x(PASS) - x.step() * x.paddingInner() / 2;
  gg.append("line").attr("class", "passline").attr("x1", xT).attr("x2", xT).attr("y1", -4).attr("y2", ih + 2);
  // repère de médiane (sous l'axe)
  if (isFinite(s.median)) {
    const xm = x(Math.floor(s.median)) + x.bandwidth() / 2 + (s.median % 1 ? x.step() / 2 : 0);
    gg.append("path").attr("d", `M${xm},${ih + 3}l-4,7h8z`).attr("fill", css("--text-1"));
  }
  // élève ouvert dans la fiche : repère au-dessus de la barre de sa note
  const sd = derived.selected;
  if (sd && g.rows.some(d => d.__i === sid) && isFinite(sd.G3)) {
    const b = bars[sd.G3], xs = x(sd.G3) + x.bandwidth() / 2, yb = y(b.n / s.n) - 4;
    gg.append("path").attr("d", `M${xs},${yb}l-5,-8h10z`).attr("fill", css("--text-1"));
    gg.append("text").attr("class", "halo").attr("x", xs + (sd.G3 > 15 ? -8 : 8)).attr("y", yb - 4).attr("text-anchor", sd.G3 > 15 ? "end" : "start")
      .style("font-size", "10.5px").style("font-weight", 600).style("fill", css("--text-1")).text(`élève n° ${sd.__i + 1}`);
  }
  [0, 5, 10, 15, 20].forEach(t => gg.append("text").attr("class", "muted").attr("x", x(t) + x.bandwidth() / 2).attr("y", ih + 20)
    .attr("text-anchor", "middle").style("font-size", "10px").text(t));
}

/** Barre à extrémité arrondie (4 px), carrée sur la ligne de base. */
function roundTop(x, y, w, h) {
  if (h <= 0) return "";
  const r = Math.min(3, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/* ---------------- simulateur de profil (U2-2, U2-5) ---------------- */
function drawSim(state, derived) {
  const ds = derived.ds;
  const keys = ds.standard ? SIM_KEYS.filter(k => ds.keys.includes(k)) : [];
  if (!keys.length) { simCtl.innerHTML = `<p class="note">Le simulateur nécessite les colonnes du jeu d'origine.</p>`; simOut.innerHTML = ""; return; }
  const sim = state.sim || {};
  const focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k + "|" + document.activeElement.dataset.v : null;
  simCtl.innerHTML = keys.map(k => {
    const M = ds.meta[k];
    const dom = M.d || Array.from(new Set(ds.rows.map(d => d[k]).filter(v => isFinite(v)))).sort(d3.ascending);
    return `<div class="fgroup"><span class="flabel">${esc(titleOf(ds.meta, k))}</span><div class="seg" role="group">` +
      `<button type="button" data-k="${k}" data-v="" aria-pressed="${sim[k] == null}">peu importe</button>` +
      dom.map(v => `<button type="button" data-k="${k}" data-v="${v}" aria-pressed="${sim[k] === v}">${esc(shortOf(ds.meta, k, v))}</button>`).join("") +
      `</div></div>`;
  }).join("") +
    `<div class="fgroup"><label class="flabel" for="sim-note">Ma note (facultatif)</label>
      <input id="sim-note" type="number" min="0" max="20" step="1" inputmode="numeric" placeholder="0–20" value="${sim.note ?? ""}"></div>`;
  if (focusKey) { const b = simCtl.querySelector(`button[data-k="${focusKey.split("|")[0]}"][data-v="${focusKey.split("|")[1]}"]`); if (b) b.focus({ preventScroll: true }); }

  // élèves au profil : périmètre de la barre de filtres seulement (le simulateur ne dépend pas des critères de l'équipe)
  const pool = derived.scoped.filter(d => !d.__nograde);
  const match = pool.filter(d => keys.every(k => sim[k] == null || d[k] === sim[k]));
  const s = summarize(match), all = summarize(pool);
  const chosen = keys.filter(k => sim[k] != null).map(k => `${titleOf(ds.meta, k).toLowerCase()} : ${shortOf(ds.meta, k, sim[k])}`);
  let txt;
  if (!match.length) txt = `Aucun élève n'a exactement ce profil : relâchez un critère.`;
  else {
    txt = `${chosen.length ? "Élèves avec " + esc(chosen.join(", ")) : "Tous les élèves évalués"} : <b>n = ${s.graded}</b> · note moyenne <b>${fmt1(s.mean)}/20</b> · ` +
      `médiane ${fmt1(s.median).replace(/,0$/, "")} · <b>${pct(s.rate)}</b> ont au moins 10.` +
      (chosen.length ? ` (Ensemble : moyenne ${fmt1(all.mean)}, ${pct(all.rate)}.)` : "") +
      (s.graded < SMALL_N ? ` <span class="warn">⚠ Moins de 10 élèves : à lire comme un cas, pas une tendance.</span>` : "");
    if (sim.note != null) {
      const below = percentBelow(match.map(d => d.G3), sim.note);
      txt += ` Avec ${sim.note}/20, on est au-dessus de <b>${pct(below)}</b> des élèves de ce profil.`;
    }
  }
  simOut.innerHTML = `<p class="simtxt">${txt} <span class="muted">C'est une association observée, pas une cause : changer un critère ne change pas une note.</span></p><svg></svg>`;
  if (match.length) simChart(simOut.querySelector("svg"), s, all, sim.note);
}

/** Histogramme du profil (barres) sur la silhouette de tous les élèves (contour), + marqueur de la note saisie. */
function simChart(svgEl, s, all, note) {
  const w = Math.min(560, widthOf(simOut, 520)), h = 120, m = { t: 14, r: 8, b: 22, l: 8 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
  const x = d3.scaleBand().domain(d3.range(21)).range([0, iw]).paddingInner(0.12);
  const share = (S, v) => S.n ? (S.counts[v].pass + S.counts[v].fail) / S.graded : 0;
  const ymax = d3.max(d3.range(21), v => Math.max(share(s, v), share(all, v))) || 0.1;
  const y = d3.scaleLinear().domain([0, ymax]).range([ih, 0]);
  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
    .attr("role", "img").attr("aria-label", "Notes des élèves au profil choisi, comparées à tous les élèves");
  const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
  g.append("line").attr("class", "gridline").attr("x1", 0).attr("x2", iw).attr("y1", ih).attr("y2", ih);
  const R = resultSpec();
  d3.range(21).forEach(v => {
    const a = share(all, v), b = share(s, v);
    if (a) g.append("rect").attr("x", x(v)).attr("y", y(a)).attr("width", x.bandwidth()).attr("height", ih - y(a))
      .attr("fill", "none").attr("stroke", css("--muted")).attr("stroke-width", 1);
    if (b) g.append("path").attr("d", roundTop(x(v) + 2, y(b), x.bandwidth() - 4, ih - y(b))).attr("fill", v >= PASS ? R.pass.color : R.fail.color);
  });
  const xT = x(PASS) - x.step() * x.paddingInner() / 2;
  g.append("line").attr("class", "passline").attr("x1", xT).attr("x2", xT).attr("y1", -6).attr("y2", ih + 2);
  if (note != null) {
    const xn = x(note) + x.bandwidth() / 2;
    g.append("line").attr("x1", xn).attr("x2", xn).attr("y1", -10).attr("y2", ih).attr("stroke", css("--text-1")).attr("stroke-width", 2);
    g.append("text").attr("class", "halo").attr("x", xn + 4).attr("y", -3).style("font-size", "11px").style("fill", css("--text-1")).style("font-weight", 600).text(`ma note : ${note}`);
  }
  [0, 5, 10, 15, 20].forEach(t => g.append("text").attr("class", "muted").attr("x", x(t) + x.bandwidth() / 2).attr("y", ih + 18)
    .attr("text-anchor", "middle").style("font-size", "10px").text(t));
  g.append("text").attr("class", "muted").attr("x", iw).attr("y", -3).attr("text-anchor", "end").style("font-size", "10px")
    .text("barres : ce profil · contour : tous les élèves");
}
