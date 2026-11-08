// C. Sunburst   [Alexandre LARGUECH]
// Conteneur : #viz-sunburst   ·   Doc : docs/visualisations.md#c-sunburst
//
// Entrées : derived.exceptSrc("sun"), state.sunLevels (3 niveaux au plus, meta.SUN_DIMS) ; d3.group → d3.hierarchy → d3.partition
// Interactions :
//   - Clic sur un secteur : zoom (state.drill, src: "sun") pour chaque ancêtre jusqu'au secteur ; second clic = remonter d'un cran
//   - Clic au centre : retour (retire les filtres src "sun")
//   - Survol : chemin complet, n, % de réussite, mention prudence si n < 10
//   - Sélecteurs #sb0, #sb1, #sb2 pour changer les dimensions des anneaux
//   - Légende divergente et hachures dans #cLegend
//   - Hachures <pattern id="sun-hatch"> définies dans le SVG du module pour les secteurs n < meta.SMALL_N
//
// Règles de cohérence :
//   - un anneau dont l'attribut est déjà fixé par une contrainte d'une autre vue (drill hors "sun") est retiré
//     (un seul secteur par anneau n'apprend rien) ; on complète pour garder au moins 2 anneaux ;
//   - les élèves sans valeur sur un anneau (ex. non-évalués pour « risque ») sont écartés partout, de sorte que
//     la somme des enfants égale toujours le parent ; leur nombre est indiqué sous le graphique.

import { SUN_DIMS, SUN_MAX_LEVELS, SMALL_N, DIMS, dimLabel, valueName, valueShort } from "../meta.js";
import { state as appState, setState } from "../state.js";
import { rate, okCount } from "../data.js";
import { colors, pct, showTip, hideTip, moveTip, prepareContainer, makeActionable } from "../utils.js";

const MIN_LEVELS = 2;
const same = (a, b) => String(a) === String(b);

let host = null;
let controlsInitialized = false;

export function activeLevels(st) {
  const lv = [];
  (Array.isArray(st && st.sunLevels) ? st.sunLevels : []).forEach((d) => {
    if (d && SUN_DIMS.includes(d) && !lv.includes(d)) lv.push(d);
  });
  return lv.slice(0, SUN_MAX_LEVELS);
}

export function effectiveLevels(requested, drill) {
  const fixed = new Set((drill || []).filter((f) => f.src !== "sun").map((f) => f.dim));
  const lv = requested.filter((d) => !fixed.has(d));
  for (const d of SUN_DIMS) {
    if (lv.length >= Math.min(MIN_LEVELS, requested.length || MIN_LEVELS)) break;
    if (!fixed.has(d) && !lv.includes(d)) lv.push(d);
  }
  return lv.slice(0, SUN_MAX_LEVELS);
}

export function computeSunburstTree(rows, levels) {
  const usable = rows.filter((r) => levels.every((d) => r[d] !== null && r[d] !== undefined));
  const build = (list, depth, path) => {
    const node = { n: list.length, ok: okCount(list), rate: rate(list), path, children: null };
    if (depth < levels.length) {
      const dim = levels[depth];
      const groups = new Map();
      list.forEach((r) => {
        if (!groups.has(r[dim])) groups.set(r[dim], []);
        groups.get(r[dim]).push(r);
      });
      const order = (DIMS[dim] && DIMS[dim].order) || Array.from(groups.keys()).sort();
      const kids = order.filter((v) => groups.has(v)).map((v) => {
        const child = build(groups.get(v), depth + 1, path.concat([{ dim, value: v }]));
        child.dim = dim;
        child.value = v;
        return child;
      });
      if (kids.length) node.children = kids;
    }
    return node;
  };
  return { tree: build(usable, 0, []), excluded: rows.length - usable.length };
}

// ---------- Contrôles ----------

export function init(container) {
  host = prepareContainer(container);
  if (controlsInitialized) return;
  [0, 1, 2].forEach((i) => {
    const sel = document.getElementById(`sb${i}`);
    if (!sel) return;
    sel.addEventListener("change", (e) => {
      const val = e.target.value;
      const current = activeLevels(appState);
      const prev = current[i] || "";
      const next = [0, 1, 2].map((idx) => (idx === i ? val : current[idx] || ""));
      // Choisir une dimension déjà utilisée ailleurs : on échange les deux anneaux
      const dup = next.findIndex((d, idx) => idx !== i && d && d === val);
      if (val && dup !== -1) next[dup] = prev;
      const lv = [];
      next.filter(Boolean).forEach((d) => { if (!lv.includes(d)) lv.push(d); });
      // Les zooms posés par C portent sur les anciens anneaux : on les retire
      setState({ sunLevels: lv, drill: appState.drill.filter((f) => f.src !== "sun") });
    });
  });
  controlsInitialized = true;
}

function updateToolbar(levels) {
  [0, 1, 2].forEach((i) => {
    const sel = document.getElementById(`sb${i}`);
    if (!sel) return;
    if (!sel.options.length) {
      (i === 0 ? SUN_DIMS : [""].concat(SUN_DIMS)).forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d ? dimLabel(d) : "Aucun";
        sel.appendChild(opt);
      });
    }
    sel.value = levels[i] || "";
  });
}

// ---------- Rendu ----------

function updateLegend(baseRate) {
  const legendEl = document.getElementById("cLegend");
  if (!legendEl) return;
  const basePct = Number.isFinite(baseRate) ? pct(baseRate) : "–";
  legendEl.innerHTML = `
    <span>Moins de réussite que la moyenne
      <i class="bar sun-bar" aria-hidden="true"></i>
      Plus de réussite (moyenne de la matière : ${basePct})</span>
    <span><i class="sun-hatch-swatch" aria-hidden="true"></i>Moins de ${SMALL_N} élèves : à lire avec prudence</span>
  `;
}

function message(text) {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = text;
  host.appendChild(p);
}

export function update(state, derived) {
  if (!host) return;

  const requested = activeLevels(state);
  updateToolbar(requested);

  const rows = derived.exceptSrc ? derived.exceptSrc("sun") : [];
  const baseRate = rate(derived.base || []);
  const th = colors();
  updateLegend(baseRate);

  host.replaceChildren();

  if (!requested.length) return message("Sélectionnez au moins un attribut dans les anneaux.");
  if (!rows.length) return message("Aucun élève dans la sélection.");

  const levels = effectiveLevels(requested, state.drill);
  const { tree, excluded } = computeSunburstTree(rows, levels);
  if (!tree.n) return message("Aucun élève avec une valeur pour ces attributs.");

  const zoom = state.drill.filter((f) => f.src === "sun");
  const hasZoom = zoom.length > 0;
  const zs = zoom.filter((z) => levels.includes(z.dim));
  const has = (node, z) => node.path.some((p) => p.dim === z.dim && same(z.value, p.value));
  const isAncestorOrSelf = (node) => node.path.every((p) => zs.some((z) => z.dim === p.dim && same(z.value, p.value)));
  const isDescendantOrSelf = (node) => zs.every((z) => has(node, z));
  const isZoomTarget = (node) => zs.length > 0 && node.path.length === zs.length && isAncestorOrSelf(node);

  const g0 = Number.isFinite(baseRate) ? baseRate : (rate(rows) || 0.5);
  const colorScale = d3.scaleLinear()
    .domain([Math.max(0, g0 - 0.35), g0, Math.min(1, g0 + 0.2)])
    .range([th.ko, th.mid, th.ok])
    .interpolate(d3.interpolateLab)
    .clamp(true);

  const root = d3.hierarchy(tree, (d) => d.children).sum((d) => (d.children ? 0 : d.n));

  const size = Math.min(Math.max(300, Math.floor(host.getBoundingClientRect().width) || 460), 460);
  const radius = size / 2;
  d3.partition().size([2 * Math.PI, radius])(root);

  const svg = d3.select(host).append("svg")
    .attr("viewBox", `${-radius} ${-radius} ${size} ${size}`)
    .attr("width", size)
    .attr("height", size)
    .attr("role", "group")
    .attr("aria-label", `Sunburst, découpage par : ${levels.map(dimLabel).join(" puis ")}`)
    .style("display", "block")
    .style("max-width", "100%")
    .style("height", "auto")
    .style("margin", "0 auto");

  svg.append("defs").append("pattern")
    .attr("id", "sun-hatch")
    .attr("class", "hatch")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 6).attr("height", 6)
    .attr("patternTransform", "rotate(45)")
    .append("line")
    .attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6);

  const arc = d3.arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.006))
    .padRadius(radius / 2)
    .innerRadius((d) => d.y0)
    .outerRadius((d) => Math.max(d.y0, d.y1 - 1));

  const nodes = root.descendants().filter((d) => d.depth > 0 && d.x1 > d.x0);

  const pathText = (d) => d.ancestors().reverse().slice(1)
    .map((x) => `${dimLabel(x.data.dim)} : ${valueName(x.data.dim, x.data.value)}`).join(", ");
  const rateText = (d) => (Number.isFinite(d.data.rate) ? `${pct(d.data.rate)} de réussite` : "taux non calculable");

  // Zoom : pose une contrainte par ancêtre ; un second clic sur le secteur déjà zoomé remonte d'un cran.
  const zoomTo = (d) => {
    hideTip();
    const others = state.drill.filter((f) => f.src !== "sun");
    const chain = d.ancestors().filter((x) => x.depth > 0).reverse()
      .map((x) => ({ dim: x.data.dim, value: x.data.value, src: "sun" }));
    const target = isZoomTarget(d.data);
    setState({ drill: others.concat(target ? chain.slice(0, -1) : chain) });
  };

  const layer = svg.append("g").attr("class", "arcs-layer");

  const sectors = layer.selectAll("path.arc").data(nodes).join("path")
    .attr("class", (d) => {
      let c = "arc";
      if (zs.length && !isAncestorOrSelf(d.data) && !isDescendantOrSelf(d.data)) c += " off";
      if (isZoomTarget(d.data)) c += " sel";
      return c;
    })
    .attr("d", arc)
    .attr("fill", (d) => (Number.isFinite(d.data.rate) ? colorScale(d.data.rate) : th.mid));

  makeActionable(
    sectors,
    (d) => zoomTo(d),
    (d) => `${pathText(d)}, ${d.data.n} élèves, ${rateText(d)}${d.data.n < SMALL_N ? ", effectif faible" : ""}. Entrée pour zoomer.`,
  );

  sectors
    .on("mouseenter", (ev, d) => {
      const chain = d.ancestors().reverse().slice(1)
        .map((x) => `${dimLabel(x.data.dim)} : <b>${valueName(x.data.dim, x.data.value)}</b>`).join("<br>");
      const warn = d.data.n < SMALL_N ? `<br><span class="tip-warn">⚠ Moins de ${SMALL_N} élèves, à lire avec prudence</span>` : "";
      const hint = isZoomTarget(d.data) ? "Clic : remonter d'un cran" : "Clic : zoomer sur ce groupe";
      showTip(ev, `${chain}<br><b>${d.data.n} élèves</b>, ${rateText(d)}${warn}<div class="tip-hint">${hint}</div>`);
    })
    .on("mousemove", moveTip)
    .on("mouseleave", hideTip)
    .on("blur", hideTip);

  // Hachures sur les groupes trop petits
  layer.selectAll("path.arc-hatch").data(nodes.filter((d) => d.data.n < SMALL_N)).join("path")
    .attr("class", "arc-hatch")
    .attr("d", arc)
    .attr("fill", "url(#sun-hatch)");

  svg.append("g").attr("class", "labels-layer")
    .selectAll("text.arclbl")
    .data(nodes.filter((d) => (d.x1 - d.x0) * ((d.y0 + d.y1) / 2) > 42 && d.y1 - d.y0 > 16))
    .join("text")
    .attr("class", "arclbl")
    .attr("transform", (d) => `translate(${arc.centroid(d)})`)
    .each(function (d) {
      const t = d3.select(this);
      const big = (d.x1 - d.x0) * ((d.y0 + d.y1) / 2) > 110 && d.y1 - d.y0 > 65;
      const showRate = big && Number.isFinite(d.data.rate);
      t.attr("dy", showRate ? "-0.75em" : "-0.2em");
      t.append("tspan").attr("x", 0).style("font-weight", 700).text(valueShort(d.data.dim, d.data.value));
      t.append("tspan").attr("x", 0).attr("dy", "1.2em").text(`${d.data.n} él.`);
      if (showRate) t.append("tspan").attr("x", 0).attr("dy", "1.2em").text(pct(d.data.rate));
    });

  const shown = hasZoom ? (derived.selection || rows) : rows;
  const shownRate = rate(shown);
  const centerR = Math.max(12, (root.y1 || radius / (levels.length + 1)) - 4);
  const center = svg.append("g").attr("class", "center-group");

  const disc = center.append("circle").attr("class", "center").attr("r", centerR);
  makeActionable(
    disc,
    () => { if (hasZoom) { hideTip(); setState({ drill: state.drill.filter((f) => f.src !== "sun") }); } },
    hasZoom
      ? `Retour : retirer le zoom du sunburst. Sélection : ${shown.length} élèves, ${pct(shownRate)} de réussite.`
      : `Ensemble : ${shown.length} élèves, ${pct(shownRate)} de réussite.`,
  );
  disc.classed("inert", !hasZoom)
    .on("mouseenter", (ev) => { if (hasZoom) showTip(ev, "<b>Centre</b><br>Clic : annuler le zoom"); })
    .on("mousemove", moveTip)
    .on("mouseleave", hideTip);

  const line = (dy, size2, txt, extra) => {
    const el = center.append("text").attr("class", "ctr").attr("dy", dy).style("font-size", size2).text(txt);
    if (extra) el.attr("class", `ctr ${extra}`);
  };
  line(hasZoom ? "-0.9em" : "-0.5em", "22px", shown.length);
  center.select("text").style("font-weight", 700);
  line(hasZoom ? "0.6em" : "1.0em", "12.5px", shown.length > 1 ? "élèves" : "élève");
  line(hasZoom ? "1.9em" : "2.3em", "12.5px", `${pct(shownRate)} réussissent`);
  if (hasZoom) line("3.4em", "12px", "← Retour", "ctr-back");

  const notes = [];
  if (levels.join() !== requested.join()) {
    notes.push(`Anneaux ajustés : ${levels.map(dimLabel).join(", ")} (les attributs déjà filtrés ailleurs sont retirés).`);
  }
  if (excluded > 0) {
    notes.push(`${excluded} élève${excluded > 1 ? "s" : ""} sans valeur sur ces attributs (dossier non évalué) ne figure${excluded > 1 ? "nt" : ""} pas dans le graphique.`);
  }
  if (notes.length) {
    const p = document.createElement("p");
    p.className = "viz-note";
    p.textContent = notes.join(" ");
    host.appendChild(p);
  }
}