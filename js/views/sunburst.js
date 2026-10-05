/* =====================================================================
   views/sunburst.js — Technique C (Alexandre) : sunburst
   ---------------------------------------------------------------------
   Tâches : U1-2, U2-1 (principale) ; U1-3, U2-2, U2-4, U2-5 (secondaire).
   Transformation : hiérarchie DÉRIVÉE (le jeu n'est pas hiérarchique) : les élèves sont
            emboîtés selon 3 attributs au plus (par défaut école → sexe → niveau de risque,
            ordre modifiable). Chaque secteur : effectif et taux de réussite.
   Marques   : un secteur par groupe, un anneau par niveau.
   Canaux    : angle = nombre d'élèves ; teinte divergente = taux de réussite, centrée sur le
               taux de toute la sélection (orange = sous la moyenne, bleu = au-dessus) ;
               hachures = moins de 10 élèves.
   Interactions : clic sur un secteur = zoom (le secteur devient le centre) et sélection
               partagée avec toutes les vues ; clic au centre = remonter ; survol (n, %).
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { SUN_KEYS, SUN_DEFAULT, SMALL_N, PASS } from "../meta.js";
import { groupValue } from "../data.js";
import { css, labelOf, titleOf, showTip, hideTip, tipRow, widthOf, esc, pct } from "../utils.js";

let root, headEl, ctlEl, svgEl, legendEl, crumbEl;
let cur = { state: null, derived: null };

export function init(container) {
  root = container;
  root.innerHTML = `
    <p class="headline" id="sun-head" aria-live="polite"></p>
    <div class="toolbar" id="sun-ctl"></div>
    <nav class="crumbs" id="sun-crumbs" aria-label="Zoom du sunburst"></nav>
    <div class="sunwrap"><svg id="sun-svg" role="img" aria-label="Sunburst : élèves emboîtés par groupes"></svg>
      <div class="legend vert" id="sun-legend"></div></div>`;
  headEl = root.querySelector("#sun-head"); ctlEl = root.querySelector("#sun-ctl");
  svgEl = root.querySelector("#sun-svg"); legendEl = root.querySelector("#sun-legend"); crumbEl = root.querySelector("#sun-crumbs");
  ctlEl.addEventListener("change", e => {
    const i = e.target.dataset.level; if (i == null) return;
    const keys = levels(cur.state, cur.derived.ds).slice();
    if (e.target.value) keys[+i] = e.target.value; else keys.splice(+i);
    setState({ sunKeys: keys.filter((k, j, a) => k && a.indexOf(k) === j), drill: cur.state.drill.filter(c => c.src !== "sun") }, "sun");
  });
  crumbEl.addEventListener("click", e => {
    const b = e.target.closest("button[data-depth]"); if (!b) return;
    setSunPath(sunPath(cur.state).slice(0, +b.dataset.depth));
  });
  svgEl.addEventListener("click", e => {
    const a = e.target.closest("[data-path]"); if (a) setSunPath(JSON.parse(a.dataset.path));
  });
  svgEl.addEventListener("keydown", e => {
    const a = e.target.closest("[data-path]");
    if (a && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSunPath(JSON.parse(a.dataset.path)); }
  });
}

function levels(state, ds) { return (state.sunKeys || SUN_DEFAULT).filter(k => ds.keys.includes(k)).slice(0, 3); }
function sunPath(state) { return state.drill.filter(c => c.src === "sun"); }
function setSunPath(path) {
  setState({ drill: cur.state.drill.filter(c => c.src !== "sun").concat(path.map(c => ({ key: c.key, value: c.value, src: "sun" }))) }, "sun");
}
function cat(ds, k, d) { const v = groupValue(ds.meta, k, d); return v === "" || v == null || (typeof v === "number" && isNaN(v)) ? "__nr" : v; }
function catLabel(ds, k, v) {
  if (v === "__nr") return "non évalué";
  const M = ds.meta[k];
  if (M.bins) return M.bins.s[M.bins.d.indexOf(v)];
  return labelOf(ds.meta, k, v);
}
function order(ds, k, vals) {
  const M = ds.meta[k], D = M.bins ? M.bins.d : M.d;
  return vals.slice().sort((a, b) => (a === "__nr") - (b === "__nr") || (D ? D.indexOf(a) - D.indexOf(b) : d3.ascending(a, b)));
}
const rate = rows => { const g = rows.filter(d => !d.__nograde); return g.length ? g.filter(d => d.G3 >= PASS).length / g.length : NaN; };

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) return;
  const opts = (ds.standard ? SUN_KEYS : ds.keys.filter(k => ds.meta[k].t === "nom" || ds.meta[k].d)).filter(k => ds.keys.includes(k));
  const keys = levels(state, ds).filter(k => opts.includes(k));
  if (!keys.length && opts.length) keys.push(opts[0]);
  const focus = ctlEl.contains(document.activeElement) ? document.activeElement.dataset.level : null;
  ctlEl.innerHTML = [0, 1, 2].map(i => `<label class="lbl" for="sun-l${i}">Niveau ${i + 1}</label>
    <select id="sun-l${i}" data-level="${i}">${i ? `<option value="">—</option>` : ""}` +
    opts.map(k => `<option value="${k}"${keys[i] === k ? " selected" : ""}>${esc(titleOf(ds.meta, k))}</option>`).join("") + `</select>`).join("");
  if (focus != null) { const s = ctlEl.querySelector(`[data-level="${focus}"]`); if (s) s.focus({ preventScroll: true }); }

  const rows = derived.exceptSun;
  // hiérarchie dérivée : racine → niveau 1 → niveau 2 → niveau 3
  const build = (list, depth, path) => {
    const node = { rows: list, n: list.length, rate: rate(list), path };
    if (depth < keys.length) {
      const k = keys[depth], groups = d3.group(list, d => cat(ds, k, d));
      node.children = order(ds, k, Array.from(groups.keys())).map(v =>
        Object.assign(build(groups.get(v), depth + 1, path.concat({ key: k, value: v })), { key: k, v }));
    }
    return node;
  };
  const tree = build(rows, 0, []);
  const hroot = d3.hierarchy(tree, d => d.children).sum(d => d.children ? 0 : d.n);
  d3.partition().size([2 * Math.PI, keys.length + 1])(hroot);

  // nœud affiché au centre : celui qui correspond au zoom courant
  const path = sunPath(state);
  let p = hroot;
  for (const c of path) { const nx = (p.children || []).find(ch => ch.data.key === c.key && ch.data.v === c.value); if (!nx) break; p = nx; }
  crumbEl.innerHTML = `<button type="button" class="crumb" data-depth="0">Tous les élèves</button>` +
    p.ancestors().reverse().slice(1).map((a, i) => ` › <button type="button" class="crumb" data-depth="${i + 1}">${esc(titleOf(ds.meta, a.data.key))} : ${esc(catLabel(ds, a.data.key, a.data.v))}</button>`).join("");

  const base = tree.rate;
  headEl.innerHTML = headline(ds, p, base);
  draw(ds, keys, hroot, p, base);
}

function headline(ds, p, base) {
  const d = p.data;
  if (!d.n) return "Aucun élève dans la sélection.";
  const kids = (p.children || []).filter(c => c.data.n >= SMALL_N && isFinite(c.data.rate));
  let s = `${p.depth ? esc(catLabel(ds, d.key, d.v)) + " : " : ""}<b>${d.n} élèves</b>, <b>${isFinite(d.rate) ? pct(d.rate) : "—"}</b> ont au moins 10/20.`;
  if (kids.length >= 2) {
    const lo = kids.reduce((a, b) => b.data.rate < a.data.rate ? b : a), hi = kids.reduce((a, b) => b.data.rate > a.data.rate ? b : a);
    s += ` Au niveau suivant, de ${pct(lo.data.rate)} (${esc(catLabel(ds, lo.data.key, lo.data.v))}, n = ${lo.data.n}) à ${pct(hi.data.rate)} (${esc(catLabel(ds, hi.data.key, hi.data.v))}, n = ${hi.data.n}).`;
  }
  return s;
}

function draw(ds, keys, hroot, p, base) {
  const size = Math.min(460, widthOf(root, 460) - 10), r = size / 2, depthMax = keys.length + 1 - p.depth;
  const ring = r / Math.max(2, depthMax);
  const svg = d3.select(svgEl).attr("viewBox", `${-r} ${-r} ${size} ${size}`).attr("width", size).attr("height", size);
  svg.selectAll("*").remove();
  const defs = svg.append("defs");
  defs.append("pattern").attr("id", "sunhatch").attr("patternUnits", "userSpaceOnUse").attr("width", 6).attr("height", 6)
    .attr("patternTransform", "rotate(45)").append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6)
    .attr("stroke", css("--hatch")).attr("stroke-width", 2);
  const lo = css("--s2"), mid = css("--div-mid"), hi = css("--s1");
  const color = v => !isFinite(v) ? css("--muted") : v < base
    ? d3.interpolateLab(lo, mid)(Math.max(0, Math.min(1, 1 - (base - v) / Math.max(0.01, base))))
    : d3.interpolateLab(mid, hi)(Math.max(0, Math.min(1, (v - base) / Math.max(0.01, 1 - base))));
  const x = d => [(d.x0 - p.x0) / (p.x1 - p.x0) * 2 * Math.PI, (d.x1 - p.x0) / (p.x1 - p.x0) * 2 * Math.PI];
  const arc = d3.arc().startAngle(d => x(d)[0]).endAngle(d => x(d)[1]).padAngle(0.004).padRadius(r)
    .innerRadius(d => (d.depth - p.depth) * ring + 1).outerRadius(d => (d.depth - p.depth + 1) * ring - 1);
  const nodes = p.descendants().filter(d => d !== p && d.x1 > d.x0);
  const g = svg.append("g");
  const sec = g.selectAll("g.sec").data(nodes).join("g").attr("class", "sec")
    .attr("data-path", d => JSON.stringify(d.data.path)).attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", d => `${titleOf(ds.meta, d.data.key)} : ${catLabel(ds, d.data.key, d.data.v)}, ${d.data.n} élèves, ${isFinite(d.data.rate) ? pct(d.data.rate) + " de réussite" : ""}. Entrée pour zoomer.`);
  sec.append("path").attr("d", arc).attr("fill", d => color(d.data.rate)).attr("stroke", css("--surface-1")).attr("stroke-width", 1);
  sec.filter(d => d.data.n < SMALL_N).append("path").attr("d", arc).attr("fill", "url(#sunhatch)").attr("pointer-events", "none");
  sec.on("mousemove", (ev, d) => showTip(ev, `<b>${d.ancestors().reverse().slice(1).map(a => esc(catLabel(ds, a.data.key, a.data.v))).join(" › ")}</b>` +
      tipRow("Élèves", `n = ${d.data.n}${d.data.n < SMALL_N ? " ⚠" : ""}`) + tipRow("Part du parent", d.parent && d.parent.data.n ? pct(d.data.n / d.parent.data.n) : "—") +
      tipRow("Réussite (G3 ≥ 10)", isFinite(d.data.rate) ? pct(d.data.rate) : "—") + `<div class="hint">Clic : zoomer sur ce groupe (toutes les vues)</div>`))
    .on("mouseleave", hideTip);
  // libellés dans les secteurs assez grands
  sec.filter(d => (x(d)[1] - x(d)[0]) * ((d.depth - p.depth + 0.5) * ring) > 38).append("text")
    .attr("transform", d => { const a = (x(d)[0] + x(d)[1]) / 2 * 180 / Math.PI, rr = (d.depth - p.depth + 0.5) * ring;
      return `rotate(${a - 90}) translate(${rr},0) rotate(${a < 180 ? 0 : 180})`; })
    .attr("text-anchor", "middle").attr("dy", "0.32em").attr("pointer-events", "none").style("font-size", "10px")
    .style("fill", d => isFinite(d.data.rate) && d3.lab(color(d.data.rate)).l < 55 ? "#ffffff" : "#0b0b0b")
    .text(d => { const t = catLabel(ds, d.data.key, d.data.v); return (t.length > 12 ? t.slice(0, 11) + "…" : t); });
  // centre : groupe zoomé, clic = remonter
  const up = p.parent ? JSON.stringify(p.parent.data.path) : null;
  const c = svg.append("g").attr("class", up ? "suncenter up" : "suncenter");
  if (up) c.attr("data-path", up).attr("tabindex", 0).attr("role", "button").attr("aria-label", "Remonter d'un niveau");
  c.append("circle").attr("r", ring - 2).attr("fill", css("--surface-1"));
  c.append("text").attr("text-anchor", "middle").attr("y", -10).style("font-size", "11px").style("fill", css("--text-2"))
    .text(p.depth ? catLabel(ds, p.data.key, p.data.v) : "tous");
  c.append("text").attr("text-anchor", "middle").attr("y", 10).style("font-size", "18px").style("font-weight", 650).style("fill", css("--text-1"))
    .text(isFinite(p.data.rate) ? pct(p.data.rate) : "—");
  c.append("text").attr("text-anchor", "middle").attr("y", 26).style("font-size", "10.5px").style("fill", css("--muted"))
    .text(`n = ${p.data.n}${up ? " · ↑ remonter" : ""}`);
  legendEl.innerHTML = `<span class="item"><span class="sw sq" style="background:${lo}"></span>réussite sous la moyenne</span>` +
    `<span class="item"><span class="sw sq" style="background:${mid};border:1px solid var(--border)"></span>proche de ${pct(base)}</span>` +
    `<span class="item"><span class="sw sq" style="background:${hi}"></span>au-dessus</span>` +
    `<span class="item"><span class="sw sq hatch"></span>moins de ${SMALL_N} élèves</span>` +
    `<span class="item muted">angle = nombre d'élèves · anneaux : ${keys.map(k => esc(titleOf(ds.meta, k).toLowerCase())).join(" → ")}</span>`;
}
