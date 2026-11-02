// C. Sunburst   [Alexandre LARGUECH]
// Conteneur : #viz-sunburst   ·   Doc : docs/visualisations.md#c-sunburst
//
<<<<<<< HEAD
// Entrées : derived.exceptSrc("sun"), state.sunLevels (3 niveaux au plus, meta.SUN_DIMS) ; d3.group → d3.hierarchy → d3.partition
// Interactions :
//   - Clic sur un secteur : zoom (state.drill, src: "sun") pour chaque ancêtre jusqu'au secteur
//   - Clic au centre : retour (retire les filtres src "sun")
//   - Survol : chemin complet, n, % de réussite, mention prudence si n < 10
//   - Sélecteurs #sb0, #sb1, #sb2 pour changer les dimensions des anneaux
//   - Légende divergente et hachures dans #cLegend
//   - Hachures <pattern id="sun-hatch"> définies dans le SVG du module pour les secteurs n < meta.SMALL_N

import { SUN_DIMS, SUN_MAX_LEVELS, SMALL_N, DIMS, dimLabel, valueName, valueShort } from "../meta.js";
import { setState } from "../state.js";
import { rate, evaluated, okCount } from "../data.js";
import { colors, pct, showTip, hideTip, moveTip, prepareContainer } from "../utils.js";

let host = null;
let controlsInitialized = false;

/**
 * Filtre les niveaux d'anneaux valides :
 * - dimensions reconnues dans SUN_DIMS
 * - pas de doublons
 * - au plus 3 niveaux
 */
function activeLevels(st) {
  const lv = [];
  const req = Array.isArray(st.sunLevels) ? st.sunLevels : [];
  req.forEach((d) => {
    if (d && SUN_DIMS.includes(d) && !lv.includes(d)) lv.push(d);
  });
  return lv.slice(0, SUN_MAX_LEVELS);
}

/**
 * Initialisation unique du module : vide le placeholder et câble les sélecteurs #sb0, #sb1, #sb2.
 */
export function init(container) {
  host = prepareContainer(container);

  if (!controlsInitialized) {
    [0, 1, 2].forEach((i) => {
      const sel = document.getElementById(`sb${i}`);
      if (!sel) return;
      sel.addEventListener("change", (e) => {
        const val = e.target.value;
        const current = activeLevels(window.__appState || { sunLevels: [] });
        const next = [0, 1, 2].map((idx) => {
          if (idx === i) return val;
          return current[idx] || "";
        }).filter(Boolean);
        // Retirer les doublons si l'utilisateur a choisi la même dimension
        const dedup = [];
        next.forEach((d) => { if (!dedup.includes(d)) dedup.push(d); });
        setState({ sunLevels: dedup });
      });
    });
    controlsInitialized = true;
  }
}

/**
 * Met à jour les options et la sélection des menus déroulants #sb0, #sb1, #sb2.
 */
function updateToolbar(levels) {
  [0, 1, 2].forEach((i) => {
    const sel = document.getElementById(`sb${i}`);
    if (!sel) return;

    // Remplir les options si vide
    if (!sel.options.length) {
      sel.replaceChildren();
      const dims = i === 2 ? [""].concat(SUN_DIMS) : (i === 1 ? [""].concat(SUN_DIMS) : SUN_DIMS);
      dims.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d ? dimLabel(d) : "Aucun";
        sel.appendChild(opt);
      });
    }

    sel.value = levels[i] || "";
  });
}

/**
 * Construit l'arbre hiérarchique récursif :
 * { key, dim, value, n, ok, rate, path, children }
 */
function buildTree(list, depth, levels, pathSoFar) {
  const n = list.length;
  const ok = okCount(list);
  const nodeRate = n ? ok / n : NaN;
  const node = {
    n,
    ok,
    rate: nodeRate,
    path: pathSoFar,
    children: null,
  };

  if (depth < levels.length) {
    const dim = levels[depth];
    const grouped = new Map();
    list.forEach((r) => {
      const v = r[dim];
      if (v !== null && v !== undefined) {
        if (!grouped.has(v)) grouped.set(v, []);
        grouped.get(v).push(r);
      }
    });

    const dimMeta = DIMS[dim];
    const order = (dimMeta && dimMeta.order) ? dimMeta.order : Array.from(grouped.keys());

    // N'inclure que les valeurs effectivement présentes dans la sous-population
    const childNodes = order
      .filter((v) => grouped.has(v) && grouped.get(v).length > 0)
      .map((v) => {
        const subList = grouped.get(v);
        const childPath = pathSoFar.concat([{ dim, value: v }]);
        const child = buildTree(subList, depth + 1, levels, childPath);
        child.dim = dim;
        child.key = dim;
        child.value = v;
        child.v = v;
        return child;
      });

    if (childNodes.length > 0) {
      node.children = childNodes;
    }
  }

  return node;
}

/**
 * Rendu principal du sunburst.
 */
export function update(state, derived) {
  if (!host) return;

  // Référence pour les handlers d'événements
  window.__appState = state;

  const levels = activeLevels(state);
  updateToolbar(levels);

  const legendEl = document.getElementById("cLegend");

  // Données de C : exceptSrc("sun") (la sélection sans les filtres de zoom du sunburst lui-même)
  const rows = derived.exceptSrc ? derived.exceptSrc("sun") : [];
  const baseRate = rate(derived.base || []);
  const themeColors = colors();

  // Mise à jour de la légende dans #cLegend
  if (legendEl) {
    const basePct = Number.isFinite(baseRate) ? pct(baseRate) : "moyenne";
    legendEl.innerHTML = `
      <span>Moins de réussite<i class="bar" style="background:linear-gradient(90deg,${themeColors.ko},${themeColors.mid},${themeColors.ok})"></i>Plus de réussite que la moyenne (${basePct})</span>
      <span><svg width="14" height="14" style="display:inline-block;vertical-align:-2px;margin-right:6px"><rect width="14" height="14" fill="url(#sun-hatch)" style="stroke:var(--line)"/></svg>Moins de 10 élèves</span>
    `;
  }

  host.replaceChildren();

  if (!rows.length) {
    const emptyP = document.createElement("p");
    emptyP.className = "empty";
    emptyP.textContent = "Aucun élève dans la sélection.";
    host.appendChild(emptyP);
    return;
  }

  if (!levels.length) {
    const emptyP = document.createElement("p");
    emptyP.className = "empty";
    emptyP.textContent = "Sélectionnez au moins un attribut dans les anneaux.";
    host.appendChild(emptyP);
    return;
  }

  // Construction de l'arbre
  const treeData = buildTree(rows, 0, levels, []);

  // Échelle divergente centrée sur baseRate
  const g0 = Number.isFinite(baseRate) ? baseRate : (rate(rows) || 0.5);
  const colorScale = d3.scaleLinear()
    .domain([Math.max(0, g0 - 0.35), g0, Math.min(1, g0 + 0.2)])
    .range([themeColors.ko, themeColors.mid, themeColors.ok])
    .interpolate(d3.interpolateLab)
    .clamp(true);

  // Hiérarchie D3 et partition
  const rootHierarchy = d3.hierarchy(treeData, (d) => d.children)
    .sum((d) => (d.children ? 0 : d.n));

  // Tri des enfants selon l'ordre défini dans DIMS
  rootHierarchy.sort((a, b) => {
    if (!a.data.dim || !b.data.dim) return 0;
    const order = (DIMS[a.data.dim] && DIMS[a.data.dim].order) || [];
    return order.indexOf(a.data.value) - order.indexOf(b.data.value);
  });

  // Calcul des dimensions du SVG
  const containerWidth = Math.max(300, Math.floor(host.getBoundingClientRect().width) || 460);
  const size = Math.min(containerWidth, 460);
  const radius = size / 2;

  d3.partition().size([2 * Math.PI, radius])(rootHierarchy);

  const svg = d3.select(host)
    .append("svg")
    .attr("viewBox", `${-radius} ${-radius} ${size} ${size}`)
    .attr("width", size)
    .attr("height", size)
    .attr("role", "img")
    .attr("aria-label", `Sunburst, découpage par : ${levels.map((l) => dimLabel(l)).join(" puis ")}`)
    .style("margin", "0 auto");

  // Définition locale du motif de hachures <pattern id="sun-hatch">
  const defs = svg.append("defs");
  const hatchPattern = defs.append("pattern")
    .attr("id", "sun-hatch")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 6)
    .attr("height", 6)
    .attr("patternTransform", "rotate(45)");

  hatchPattern.append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", 6)
    .attr("stroke", themeColors.ink)
    .attr("stroke-width", 1.2)
    .attr("opacity", 0.45);

  // Générateur d'arc D3
  const arc = d3.arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.006))
    .padRadius(radius / 2)
    .innerRadius((d) => d.y0)
    .outerRadius((d) => Math.max(d.y0, d.y1 - 1));

  // Descendants de niveau > 0 (les secteurs des anneaux)
  const arcNodes = rootHierarchy.descendants().filter((d) => d.depth > 0 && d.x1 > d.x0);

  // Chemins et libellés complets
  const formatNodeLabel = (d) => d.ancestors()
    .reverse()
    .slice(1)
    .map((x) => `${dimLabel(x.data.dim)}, ${valueName(x.data.dim, x.data.value)}`)
    .join(" › ");

  // Groupe des secteurs
  const arcsGroup = svg.append("g").attr("class", "arcs-layer");

  // Secteurs colorés
  const sectors = arcsGroup.selectAll("path.arc")
    .data(arcNodes)
    .join("path")
    .attr("class", "arc")
    .attr("d", arc)
    .attr("fill", (d) => {
      const r = d.data.rate;
      return Number.isFinite(r) ? colorScale(r) : themeColors.mid;
    })
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (d) => {
      const lbl = formatNodeLabel(d);
      const rTxt = Number.isFinite(d.data.rate) ? `${pct(d.data.rate)} de réussite` : "pas de note";
      return `${lbl}, ${d.data.n} élèves, ${rTxt}. Appuyer sur Entrée pour zoomer.`;
    });

  // Secteurs hachurés si n < SMALL_N (10)
  arcsGroup.selectAll("path.arc-hatch")
    .data(arcNodes.filter((d) => d.data.n < SMALL_N))
    .join("path")
    .attr("class", "arc-hatch")
    .attr("d", arc)
    .attr("fill", "url(#sun-hatch)")
    .style("pointer-events", "none");

  // Interaction : Clic ou Entrée sur un secteur = zoom (state.drill, src: "sun") pour chaque ancêtre
  const onSectorClick = (ev, d) => {
    ev.stopPropagation();
    hideTip();

    // Filtres non-sun conservés
    const nonSunDrill = state.drill.filter((f) => f.src !== "sun");
    // Nouveaux filtres sun pour chaque niveau depuis la racine jusqu'à ce secteur
    const newSunDrill = d.ancestors()
      .filter((x) => x.depth > 0)
      .reverse()
      .map((x) => ({
        dim: x.data.dim,
        value: x.data.value,
        src: "sun",
      }));

    setState({ drill: nonSunDrill.concat(newSunDrill) });
  };

  sectors
    .on("click", onSectorClick)
    .on("keydown", (ev, d) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        onSectorClick(ev, d);
      }
    })
    .on("mouseenter", (ev, d) => {
      const ancestorsList = d.ancestors()
        .reverse()
        .slice(1)
        .map((x) => `${dimLabel(x.data.dim)} : <b>${valueName(x.data.dim, x.data.value)}</b>`)
        .join("<br>");
      const rTxt = Number.isFinite(d.data.rate) ? `${pct(d.data.rate)} de réussite` : "–";
      const warning = d.data.n < SMALL_N ? "<br><span style='color:var(--ko)'>⚠ Moins de 10 élèves, à lire avec prudence</span>" : "";
      const hint = "<div style='margin-top:6px;font-size:12px;opacity:0.8'>Clic : zoomer sur ce groupe</div>";
      showTip(ev, `${ancestorsList}<br><b>${d.data.n} élèves</b>, ${rTxt}${warning}${hint}`);
    })
    .on("mousemove", moveTip)
    .on("mouseleave", hideTip);

  // Étiquettes textuelles dans les secteurs suffisamment spacieux
  const labelsGroup = svg.append("g").attr("class", "labels-layer");

  labelsGroup.selectAll("text.arclbl")
    .data(arcNodes.filter((d) => (d.x1 - d.x0) * ((d.y0 + d.y1) / 2) > 42 && d.y1 - d.y0 > 16))
    .join("text")
    .attr("class", "arclbl")
    .attr("transform", (d) => `translate(${arc.centroid(d)})`)
    .each(function(d) {
      const textEl = d3.select(this);
      const spanVal = valueShort(d.data.dim, d.data.value);
      const isBig = (d.x1 - d.x0) * ((d.y0 + d.y1) / 2) > 110 && d.y1 - d.y0 > 65;

      textEl.attr("dy", isBig ? "-0.75em" : "-0.2em");
      textEl.append("tspan")
        .attr("x", 0)
        .style("font-weight", 700)
        .text(spanVal);

      textEl.append("tspan")
        .attr("x", 0)
        .attr("dy", "1.2em")
        .text(`${d.data.n} él.`);

      if (isBig && Number.isFinite(d.data.rate)) {
        textEl.append("tspan")
          .attr("x", 0)
          .attr("dy", "1.2em")
          .text(pct(d.data.rate));
      }
    });

  // Disque central : effectif, % de réussite, clic = remonter / réinitialiser le zoom de C
  const hasSunDrill = state.drill.some((f) => f.src === "sun");
  const centerRadius = Math.max(12, (rootHierarchy.y1 || radius / (levels.length + 1)) - 4);

  const centerGroup = svg.append("g").attr("class", "center-group");

  const centerCircle = centerGroup.append("circle")
    .attr("class", "center")
    .attr("r", centerRadius)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", hasSunDrill ? "Retour : retirer le zoom du sunburst" : "Ensemble de la population du sunburst");

  const onCenterClick = (ev) => {
    ev.stopPropagation();
    hideTip();
    if (hasSunDrill) {
      const remainingDrill = state.drill.filter((f) => f.src !== "sun");
      setState({ drill: remainingDrill });
    }
  };

  centerCircle
    .on("click", onCenterClick)
    .on("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        onCenterClick(ev);
      }
    })
    .on("mouseenter", (ev) => {
      if (hasSunDrill) {
        showTip(ev, "<b>Centre</b><br>Clic : remonter et annuler le zoom");
      }
    })
    .on("mousemove", moveTip)
    .on("mouseleave", hideTip);

  const totalEvaluatedRate = rate(rows);
  const totalRateText = Number.isFinite(totalEvaluatedRate) ? pct(totalEvaluatedRate) : "–";

  centerGroup.append("text")
    .attr("class", "ctr")
    .attr("dy", hasSunDrill ? "-0.9em" : "-0.5em")
    .style("font-size", "22px")
    .style("font-weight", 700)
    .text(rows.length);

  centerGroup.append("text")
    .attr("class", "ctr")
    .attr("dy", hasSunDrill ? "0.6em" : "1.0em")
    .style("font-size", "12.5px")
    .text("élèves");

  centerGroup.append("text")
    .attr("class", "ctr")
    .attr("dy", hasSunDrill ? "1.9em" : "2.3em")
    .style("font-size", "12.5px")
    .text(`${totalRateText} réussissent`);

  if (hasSunDrill) {
    centerGroup.append("text")
      .attr("class", "ctr")
      .attr("dy", "3.4em")
      .style("font-size", "12px")
      .style("text-decoration", "underline")
      .style("fill", "var(--ok)")
      .text("← Retour");
  }
=======
// COQUILLE À IMPLÉMENTER : cette vue ne dessine rien pour l'instant.
// Entrées : derived.exceptSrc("sun"), state.sunLevels (3 niveaux au plus, meta.SUN_DIMS) ; d3.group → d3.hierarchy → d3.partition
// Interactions : clic sur un secteur → toggleDrill(dim, value, "sun") pour chaque ancêtre ; clic au centre → retirer les contraintes src "sun" ; anneaux choisis via #sb0, #sb1, #sb2 ; légende dans #cLegend ; hachures si n < meta.SMALL_N
// Contrat de données : docs/data-contracts.md · conventions : docs/conventions.md

import { prepareContainer } from "../utils.js";

let host = null;

// Appelée une fois après le chargement des données. Crée le SVG / canvas dans `container`.
export function init(container) {
  host = prepareContainer(container);
}

// Appelée à chaque changement d'état. Doit pouvoir être appelée à tout moment, sans effet de bord hors de `host`.
// Les écritures dans l'état passent uniquement par setState / toggleDrill (js/state.js).
export function update(state, derived) {
  if (!host) return;
  // TODO : redessiner à partir de state et derived
>>>>>>> 7f31ffc932ba7fb2d48c385dc38b4048019484a9
}
