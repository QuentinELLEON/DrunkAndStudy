/* =====================================================================
   views/boxplots.js — Technique 3 (Alexandre)
   Small multiples de boxplots + strip plots de G3 par groupe
   ---------------------------------------------------------------------
   Transformation : pour chaque attribut de regroupement (nominal, ordinal ou
                    quantitatif à peu de valeurs) et chaque modalité :
                    quartiles, médiane, moustaches à 1,5 × IQR, moyenne, IC 95 %.
   Marques   : boîte (rectangle Q1–Q3), trait (médiane), segments (moustaches),
               points (un par élève).
   Canaux    : position verticale = G3 sur une échelle commune 0–20 (comparaison
               entre panneaux possible) ; position horizontale = modalité ;
               teinte des points = résultat (bleu ▲ / orange ▼ / gris ✕) ;
               hachures + contour pointillé = groupe de moins de 10 élèves ;
               opacité réduite = groupes hors du filtre de groupe.
   Facettes  : liste retenue dans docs/taches.md (meta.PANEL_KEYS), dont les dérivés
               pedu, alc et absCat ; paid (non comparable entre matières) est exclu.
   Interactions : survol (statistiques du groupe, part de la sélection / de l'élève),
               clic sur une colonne (filtre global sur ce groupe),
               clic sur un point (fiche élève), ajout/retrait de panneaux,
               tri des panneaux par écart des médianes (hiérarchiser les facteurs, U1.3).
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { PASS, SMALL_N } from "../meta.js";
import { groupKeys } from "../data.js";
import { boxStats, hash01 } from "../stats.js";
import { css, resultOf, resultSpec, resultBadge, labelOf, shortOf, titleOf, showTip, hideTip, tipRow, widthOf, esc, fmt1, fmt2, pct, truncate } from "../utils.js";

const H = 200, MG = { t: 10, r: 6, b: 38, l: 30 };
let root, panelsEl, addSel, ptsBox, legendEl, sortSel;
let cur = { state: null, derived: null };
let showPoints = true;
let uid = 0;

export function init(container) {
  root = container;
  root.innerHTML = `
    <div class="toolbar">
      <label class="lbl" for="bx-add">Ajouter un panneau</label><select id="bx-add"></select>
      <label class="lbl" for="bx-sort">Ordre</label>
      <select id="bx-sort">
        <option value="manual">ordre d'ajout</option>
        <option value="gap">écart des médianes (décroissant)</option>
      </select>
      <label class="check" style="padding:0"><input type="checkbox" id="bx-pts" checked> points individuels</label>
      <div class="legend" id="bx-legend"></div>
    </div>
    <div class="panels" id="bx-panels"></div>`;
  panelsEl = root.querySelector("#bx-panels");
  addSel = root.querySelector("#bx-add");
  ptsBox = root.querySelector("#bx-pts");
  legendEl = root.querySelector("#bx-legend");
  sortSel = root.querySelector("#bx-sort");
  sortSel.addEventListener("change", e => setState({ panelSort: e.target.value }, "boxplots"));

  addSel.addEventListener("change", e => {
    const k = e.target.value; if (!k) return;
    setState({ panels: cur.state.panels.concat(k) }, "boxplots");
  });
  ptsBox.addEventListener("change", e => { showPoints = e.target.checked; update(cur.state, cur.derived); });
  panelsEl.addEventListener("click", e => {
    const b = e.target.closest("button.rm"); if (!b) return;
    const k = b.dataset.k;
    const patch = { panels: cur.state.panels.filter(p => p !== k) };
    if (cur.state.groupFilter && cur.state.groupFilter.key === k) patch.groupFilter = null;
    setState(patch, "boxplots");
  });
}

function toggleGroup(key, value) {
  const gf = cur.state.groupFilter;
  setState({ groupFilter: gf && gf.key === key && gf.value === value ? null : { key, value } }, "boxplots");
}

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) return;
  if (!ds.keys.includes("G3")) {
    panelsEl.innerHTML = `<p class="empty">Cette technique compare la distribution de G3 : le fichier importé n'a pas de colonne G3.</p>`;
    addSel.innerHTML = ""; legendEl.innerHTML = "";
    return;
  }
  const eligible = groupKeys(ds);
  sortSel.value = state.panelSort;
  const data = new Map(state.panels.filter(k => eligible.includes(k)).map(k => [k, panelData(k, state, derived)]));
  const panels = Array.from(data.keys());
  if (state.panelSort === "gap") panels.sort((a, b) => (data.get(b).gap ?? -1) - (data.get(a).gap ?? -1));
  addSel.innerHTML = `<option value="">— attribut —</option>` +
    eligible.filter(k => !panels.includes(k)).map(k => `<option value="${k}">${esc(titleOf(ds.meta, k))}${ds.meta[k].derived ? " (dérivé)" : ""}</option>`).join("");

  const R = resultSpec();
  legendEl.innerHTML = ["pass", "fail"].concat(state.excludeNoGrade ? [] : ["none"]).map(k =>
    `<span class="item"><span class="ic" style="color:${R[k].color}">${k === "none" ? "✕" : "●"}</span>${R[k].label}</span>`).join("") +
    `<span class="item"><svg width="14" height="12" aria-hidden="true"><rect x="1" y="1" width="12" height="10" fill="none" stroke="${css("--text-2")}" stroke-dasharray="3 2"/></svg>n &lt; ${SMALL_N} : anecdotique</span>`;

  // un panneau par attribut (jointure par clé → les panneaux ne sont pas recréés)
  const sel = d3.select(panelsEl).selectAll("div.panel").data(panels, k => k);
  sel.exit().remove();
  const en = sel.enter().append("div").attr("class", "panel");
  en.append("h3");
  en.append("svg");
  en.merge(sel).order().each(function (key) { drawPanel(this, key, data.get(key), state, derived); });
  if (!panels.length) panelsEl.innerHTML = `<p class="empty">Aucun panneau : ajoutez un attribut ci-dessus.</p>`;
  else panelsEl.querySelectorAll(":scope > p.empty").forEach(n => n.remove());
}

/**
 * Statistiques d'un panneau : une boîte par modalité.
 * gap = écart entre la plus haute et la plus basse médiane des groupes d'au moins SMALL_N élèves
 * (un groupe de 3 élèves ne doit pas décider du classement des facteurs).
 */
function panelData(key, state, derived) {
  const ds = derived.ds;
  const gf = state.groupFilter && state.groupFilter.key === key ? state.groupFilter : null;
  const rows = gf ? derived.exceptGroup : derived.selection;
  // modalités stables d'un rendu à l'autre (fichier entier), sauf celles des seuls non-évalués exclus (« n. r. »)
  const present = new Set((state.excludeNoGrade ? ds.rows.filter(d => !d.__nograde) : ds.rows).map(d => d[key]));
  const Mk = ds.meta[key];
  const domain = (Mk.d ? Mk.d.filter(v => present.has(v)) : Array.from(present).sort(d3.ascending));
  const byGroup = d3.group(rows, d => d[key]);
  const groups = domain.map(v => {
    const arr = byGroup.get(v) || [];
    const st = boxStats(arr.map(d => d.G3));
    return { v, rows: arr, st, pass: arr.filter(d => !d.__nograde && d.G3 >= PASS).length, graded: arr.filter(d => !d.__nograde).length };
  });
  const meds = groups.filter(g => g.st && g.st.n >= SMALL_N && g.v !== 9).map(g => g.st.med);   // 9 = « n. r. » d'absCat
  const gap = meds.length >= 2 ? d3.max(meds) - d3.min(meds) : null;
  return { gf, rows, domain, groups, gap };
}

function drawPanel(node, key, P, state, derived) {
  const ds = derived.ds;
  const { gf, rows, domain, groups, gap } = P;
  const Mk = ds.meta[key];
  const info = [Mk.def ? "Dérivé : " + Mk.def : "", Mk.note || ""].filter(Boolean).join(" — ");

  d3.select(node).select("h3").html(
    `<span>${esc(titleOf(ds.meta, key))}` +
    (info ? ` <span class="info" title="${esc(info)}" aria-label="${esc(info)}">ⓘ</span>` : "") +
    ` <span class="nbadge">n = ${rows.length}</span>` +
    `<span class="gap" title="Écart entre la plus haute et la plus basse médiane de G3, groupes d'au moins ${SMALL_N} élèves">` +
    (gap == null ? "écart : —" : `écart des médianes : ${fmt1(gap).replace(/,0$/, "")} pt${gap >= 2 ? "s" : ""}`) + `</span></span>` +
    `<button type="button" class="rm" data-k="${key}" aria-label="Retirer le panneau ${esc(titleOf(ds.meta, key))}">✕</button>`);

  const w = Math.max(200, widthOf(node, 260) - 18);
  const iw = w - MG.l - MG.r, ih = H - MG.t - MG.b;
  const x = d3.scaleBand().domain(domain.map(String)).range([0, iw]).paddingInner(0.18).paddingOuter(0.08);
  const y = d3.scaleLinear().domain([0, 20]).range([ih, 0]);          // toujours 0–20
  const bw = Math.min(30, x.bandwidth() * 0.55);
  const R = resultSpec();
  const hid = "hatch" + (++uid);

  const svg = d3.select(node).select("svg").attr("viewBox", `0 0 ${w} ${H}`).attr("height", H)
    .attr("role", "img").attr("aria-label", `Distribution de la note finale selon ${titleOf(ds.meta, key)}`);
  svg.selectAll("*").remove();
  svg.append("defs").append("pattern").attr("id", hid).attr("patternUnits", "userSpaceOnUse")
    .attr("width", 5).attr("height", 5).attr("patternTransform", "rotate(45)")
    .append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 5)
    .attr("stroke", css("--hatch")).attr("stroke-width", 1.4);
  const g = svg.append("g").attr("transform", `translate(${MG.l},${MG.t})`);

  // grille et axe G3
  const ticks = [0, 5, 10, 15, 20];
  g.selectAll("line.gridline").data(ticks).join("line").attr("class", "gridline")
    .attr("x1", 0).attr("x2", iw).attr("y1", y).attr("y2", y);
  g.selectAll("text.yt").data(ticks).join("text").attr("class", "yt muted")
    .attr("x", -6).attr("y", y).attr("dy", "0.32em").attr("text-anchor", "end").style("font-size", "9.5px").text(d => d);
  g.append("text").attr("class", "muted").attr("x", -MG.l + 2).attr("y", -2).style("font-size", "9px").text("G3");
  g.append("line").attr("class", "passline").attr("x1", 0).attr("x2", iw).attr("y1", y(PASS)).attr("y2", y(PASS));

  const col = g.selectAll("g.box").data(groups).join("g")
    .attr("class", d => "box" + (gf && gf.value !== d.v ? " dim" : ""))
    .attr("transform", d => `translate(${x(String(d.v))},0)`)
    .attr("tabindex", d => d.rows.length ? 0 : -1)
    .attr("role", "button")
    .attr("aria-pressed", d => String(!!gf && gf.value === d.v))
    .attr("aria-label", d => `${labelOf(ds.meta, key, d.v)} : n = ${d.rows.length}` +
      (d.st ? `, médiane ${fmt1(d.st.med)}` : "") + ". Entrée pour filtrer sur ce groupe.");

  // zone de clic = toute la colonne (derrière les points)
  col.append("rect").attr("x", 0).attr("y", 0).attr("width", x.bandwidth()).attr("height", ih).attr("fill", "transparent");
  const cx = x.bandwidth() / 2;
  const withSt = col.filter(d => d.st);
  // moustaches
  withSt.append("line").attr("x1", cx).attr("x2", cx).attr("y1", d => y(d.st.lo)).attr("y2", d => y(d.st.hi))
    .attr("stroke", css("--text-2")).attr("stroke-width", 1);
  withSt.selectAll("line.cap").data(d => [d.st.lo, d.st.hi]).join("line").attr("class", "cap")
    .attr("x1", cx - bw / 4).attr("x2", cx + bw / 4).attr("y1", v => y(v)).attr("y2", v => y(v))
    .attr("stroke", css("--text-2"));
  // boîte Q1–Q3 : hachurée et pointillée si n < 10
  withSt.append("rect").attr("class", "iqr")
    .attr("x", cx - bw / 2).attr("width", bw)
    .attr("y", d => y(d.st.q3)).attr("height", d => Math.max(1.5, y(d.st.q1) - y(d.st.q3)))
    .attr("rx", 2)
    .attr("fill", d => d.st.n < SMALL_N ? `url(#${hid})` : css("--chip"))
    .attr("stroke", css("--text-2")).attr("stroke-width", 1.2)
    .attr("stroke-dasharray", d => d.st.n < SMALL_N ? "3 2" : null);
  // points individuels (décalage horizontal déterministe, la note reste exacte)
  if (showPoints) {
    const selId = derived.selected ? derived.selected.__i : null;
    col.each(function (d) {
      const pts = d3.select(this).selectAll("circle.dot").data(d.rows, r => r.__i).join("circle")
        .attr("class", "dot")
        .attr("cx", r => cx + (hash01(r.__i) - 0.5) * x.bandwidth() * 0.8)
        .attr("cy", r => y(r.G3))
        .attr("r", 2.3)
        .attr("fill", r => R[resultOf(r)].color)
        .attr("fill-opacity", d.rows.length > 120 ? 0.35 : 0.6);
      pts.filter(r => r.__i === selId).raise().attr("r", 4.5).attr("fill-opacity", 1)
        .attr("stroke", css("--text-1")).attr("stroke-width", 2);
    });
  }
  // médiane (au-dessus des points)
  withSt.append("line").attr("x1", cx - bw / 2).attr("x2", cx + bw / 2)
    .attr("y1", d => y(d.st.med)).attr("y2", d => y(d.st.med))
    .attr("stroke", css("--text-1")).attr("stroke-width", 2.4).attr("stroke-linecap", "round");

  // libellés de modalité + effectif
  const maxChars = Math.max(4, Math.floor(x.bandwidth() / 5.6));
  col.append("text").attr("x", cx).attr("y", ih + 13).attr("text-anchor", "middle").style("font-size", "9.5px")
    .style("fill", css("--text-1"))
    .text(d => truncate(shortOf(ds.meta, key, d.v), maxChars));
  col.append("text").attr("x", cx).attr("y", ih + 26).attr("text-anchor", "middle")
    .style("font-size", "9px").style("font-family", "var(--mono)")
    .style("fill", d => d.rows.length < SMALL_N ? css("--text-1") : css("--muted"))
    .style("font-weight", d => d.rows.length < SMALL_N ? 600 : 400)
    .text(d => d.rows.length < SMALL_N ? `n=${d.rows.length}⚠` : `n=${d.rows.length}`);

  // interactions
  col.on("mousemove", (ev, d) => {
    const r = ev.target.__data__;
    if (ev.target.classList.contains("dot")) {
      showTip(ev, `<b>Élève n° ${r.__i + 1}</b> · ${resultBadge(r)}` + tipRow("G3", r.G3) +
        tipRow(esc(titleOf(ds.meta, key)), esc(labelOf(ds.meta, key, r[key]))) + `<div class="hint">Clic : ouvrir la fiche</div>`);
    } else showTip(ev, groupTip(ds, key, d, rows.length));
  })
    .on("mouseleave", hideTip)
    .on("click", (ev, d) => {
      if (ev.target.classList.contains("dot")) {
        const id = ev.target.__data__.__i;
        setState({ selectedId: cur.state.selectedId === id ? null : id }, "boxplots");
      } else if (d.rows.length) toggleGroup(key, d.v);
    })
    .on("keydown", (ev, d) => {
      if ((ev.key === "Enter" || ev.key === " ") && d.rows.length) { ev.preventDefault(); toggleGroup(key, d.v); }
    });
}

function groupTip(ds, key, d, total) {
  const head = `<b>${esc(titleOf(ds.meta, key))} : ${esc(labelOf(ds.meta, key, d.v))}</b>`;
  if (!d.st) return head + tipRow("Effectif", "n = 0");
  const s = d.st;
  return head +
    tipRow("Effectif", `n = ${s.n}${s.n < SMALL_N ? " ⚠" : ""}`) +
    tipRow("Part de la sélection", total ? `${pct(s.n / total)} (${s.n}/${total})` : "—") +
    tipRow("Médiane G3", fmt1(s.med)) +
    tipRow("Quartiles Q1 – Q3", `${fmt1(s.q1)} – ${fmt1(s.q3)}`) +
    tipRow("Moyenne ± IC 95 %", `${fmt2(s.mean)} ± ${fmt2(s.ci95)}`) +
    tipRow("Réussite (G3 ≥ 10)", d.graded ? `${pct(d.pass / d.graded)} (${d.pass}/${d.graded})` : "—") +
    (s.n < SMALL_N ? `<div class="hint">Moins de ${SMALL_N} élèves : anecdote, pas tendance.</div>` : "") +
    (ds.meta[key].note ? `<div class="hint">${esc(ds.meta[key].note)}</div>` : "") +
    `<div class="hint">Clic : filtrer toutes les vues sur ce groupe.</div>`;
}
