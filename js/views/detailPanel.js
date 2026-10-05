/* =====================================================================
   views/detailPanel.js — Technique 4 (Gabriel), niveau « détail »
   Fiche élève : 33 attributs + trajectoire personnelle située dans la sélection
   ---------------------------------------------------------------------
   Transformation : quartiles de G1, G2, G3 dans la sélection courante,
                    rang centile de G3, effectif des élèves de même trajectoire,
                    effectif des élèves au même PROFILE (tâche U2.5 : « ils sont 12 comme lui »).
   Lien vers les autres vues : « Isoler ces élèves » pose dans les coordonnées
                    parallèles un brush par attribut du profil (meta.PROFILE_KEYS).
   Marques   : bande (Q1–Q3 de la sélection), ligne pointillée (médiane),
               ligne pleine + points (l'élève).
   Canaux    : position verticale = note 0–20 ; teinte = résultat de l'élève.
   Interactions : ← / → (élève précédent / suivant de la sélection), fermer.
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { GROUPS, PASS, SMALL_N, KEY_ATTRS, PROFILE_KEYS } from "../meta.js";
import { percentBelow } from "../stats.js";
import { css, resultOf, resultSpec, resultBadge, labelOf, shortOf, titleOf, esc, pct, widthOf } from "../utils.js";

/* ---------------- profil (U2.5) ---------------- */
const bandOf = v => v < PASS ? [0, PASS - 1] : v < 14 ? [PASS, 13] : [14, 20];

/** Profil clé d'un élève : mêmes valeurs sur PROFILE_KEYS, G3 dans la même bande. */
function profileOf(ds, d) {
  const keys = PROFILE_KEYS.filter(k => ds.keys.includes(k));
  if (!ds.standard || d.__nograde || keys.length < 3) return null;
  const band = bandOf(d.G3);
  const match = r => !r.__nograde && keys.every(k => k === "G3" ? r.G3 >= band[0] && r.G3 <= band[1] : r[k] === d[k]);
  return { keys, band, match };
}

/** Pose dans les coordonnées parallèles un brush par attribut du profil (vues liées). */
function isolateProfile(ds, d, prof) {
  const brushes = {};
  prof.keys.forEach(k => {
    if (k === "G3") brushes.G3 = { kind: "range", lo: prof.band[0], hi: prof.band[1] };
    else if (ds.meta[k].t === "quant") brushes[k] = { kind: "range", lo: d[k], hi: d[k] };
    else brushes[k] = { kind: "set", values: [d[k]] };
  });
  const axes = cur.state.axes.filter(k => k !== "G3").concat(prof.keys.filter(k => k !== "G3" && !cur.state.axes.includes(k)));
  if (ds.keys.includes("G3")) axes.push("G3");
  setState({ axes, brushes, groupFilter: null, trend: "all" }, "detail");
}

let root;
let cur = { state: null, derived: null };
let moreOpen = false;                                     // « Autres attributs » déplié : conservé entre deux rendus

export function init(container) {
  root = container;
  root.addEventListener("toggle", e => { if (e.target.matches("details.dmore")) moreOpen = e.target.open; }, true);
  root.addEventListener("click", e => {
    const iso = e.target.closest("button[data-isolate]");
    if (iso && cur.derived && cur.derived.selected) {
      const ds = cur.derived.ds, d = cur.derived.selected, prof = profileOf(ds, d);
      if (prof) isolateProfile(ds, d, prof);
      return;
    }
    const b = e.target.closest("button[data-nav]"); if (!b) return;
    if (b.dataset.nav === "close") setState({ selectedId: null }, "detail");
    else step(b.dataset.nav === "next" ? 1 : -1);
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const t = e.target;
    if (t.closest && (t.closest("input, select, textarea, .matrix, .seg, .brush"))) return;
    if (cur.state && cur.state.selectedId != null) { e.preventDefault(); step(e.key === "ArrowRight" ? 1 : -1); }
  });
}

function step(dir) {
  const sel = cur.derived.selection;
  if (!sel.length) return;
  const i = sel.findIndex(d => d.__i === cur.state.selectedId);
  const j = i < 0 ? 0 : (i + dir + sel.length) % sel.length;
  setState({ selectedId: sel[j].__i }, "detail");
}

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds, d = derived.selected;
  if (!ds || !d) {
    root.innerHTML = `<p class="empty">Aucun élève sélectionné.<br>Cliquez une ligne des coordonnées parallèles, un point des boxplots,
      une trajectoire du slope graph ou une ligne de la table.</p>`;
    return;
  }
  const sel = derived.selection;
  const idx = sel.findIndex(r => r.__i === d.__i);
  const inSel = idx >= 0;
  const hasGrades = ["G1", "G2", "G3"].every(k => ds.keys.includes(k));

  const flags = [];
  if (d.__nograde) flags.push(`<div class="flag">✕ Non évalué : G3 = 0 avec 0 absence. À lire comme un dossier non renseigné (abandon, absence à l'épreuve), pas comme une note de 0.</div>`);
  if (!inSel) flags.push(`<div class="flag info">ⓘ Cet élève est hors de la sélection courante (filtres ou brushes) : il est comparé à une sélection dont il ne fait pas partie.</div>`);

  let summary = "", chart = "";
  if (hasGrades) {
    const graded = sel.filter(r => !r.__nograde);
    const below = percentBelow(graded.map(r => r.G3), d.G3);
    const same = sel.filter(r => r.G1 === d.G1 && r.G2 === d.G2 && r.G3 === d.G3).length;
    const delta = d.__delta;
    summary = `<div class="dsum">
      <div><b>${d.G1} → ${d.G2} → ${d.G3}</b>G1 → G2 → G3 (/20)</div>
      <div><b>${!isFinite(delta) ? "—" : delta > 0 ? "▲ +" + delta : delta < 0 ? "▼ " + delta : "● 0"}</b>progression G3 − G1</div>
      <div><b>${isFinite(below) && !d.__nograde ? pct(below) : "—"}</b>de la sélection a une note finale inférieure (n = ${graded.length})</div>
      <div><b>${same}</b>élève${same > 1 ? "s" : ""} avec exactement cette trajectoire dans la sélection</div>
    </div>`;
    chart = miniSlope(d, graded);
  }

  // Profil clé (U2.5) : combien d'élèves du périmètre (filtres de la barre) partagent ces valeurs ?
  let profile = "";
  const prof = profileOf(ds, d);
  if (prof) {
    const same = derived.scoped.filter(prof.match).length;
    const desc = prof.keys.map(k => k === "G3" ? `G3 ${prof.band[0]}–${prof.band[1]}` : `${titleOf(ds.meta, k)} : ${shortOf(ds.meta, k, d[k])}`).join(" · ");
    const verdict = same <= 1 ? "cas isolé : aucun autre élève n'a ce profil"
      : same < SMALL_N ? `profil rare : ${same} élèves (⚠ moins de ${SMALL_N})` : `profil représentatif : ${same} élèves`;
    profile = `<div class="dprofile">
      <div><b>${verdict}</b> <span class="nbadge">sur ${derived.scoped.length} dans le périmètre</span></div>
      <div class="note">${esc(desc)}</div>
      <button type="button" class="btn small" data-isolate>Isoler ces élèves dans toutes les vues</button>
    </div>`;
  }

  // Attributs : ceux qu'analysent les vues d'abord, les autres repliés (les 33 restent accessibles, U2.2)
  const row = k => {
    const m = ds.meta[k] || {};
    const tip = [m.def ? "Dérivé : " + m.def : "", m.note || ""].filter(Boolean).join(" — ");
    return `<dt>${esc(titleOf(ds.meta, k))}${tip ? ` <span class="info" title="${esc(tip)}">ⓘ</span>` : ""}</dt><dd>${esc(labelOf(ds.meta, k, d[k]))}</dd>`;
  };
  const grouped = ks => ds.builtin || ds.standard
    ? GROUPS.map(g => [g, ks.filter(k => ds.meta[k].g === g)]).filter(g => g[1].length)
    : [["Attributs", ks]];
  const block = ks => grouped(ks).map(([g, gk]) => `<div><h4>${esc(g)}</h4><dl>${gk.map(row).join("")}</dl></div>`).join("");
  let attrs;
  if (ds.standard) {
    const main = KEY_ATTRS.filter(k => ds.keys.includes(k));
    const rest = ds.rawKeys.filter(k => !main.includes(k));
    attrs = `<div class="dgroups">${block(main)}</div>` +
      (rest.length ? `<details class="dmore"${moreOpen ? " open" : ""}><summary>Autres attributs du fichier (${rest.length}) : non utilisés par les vues</summary>
        <div class="dgroups">${block(rest)}</div></details>` : "");
  } else attrs = `<div class="dgroups">${block(ds.keys)}</div>`;

  root.innerHTML = `
    <div class="dhead">
      <span class="who2">Élève n° ${d.__i + 1} · ${esc(ds.name)} ${resultBadge(d)}</span>
      <span class="dnav">
        <button type="button" class="btn small" data-nav="prev" aria-label="Élève précédent de la sélection">←</button>
        <span class="nbadge" style="align-self:center">${inSel ? `${idx + 1} / ${sel.length}` : `– / ${sel.length}`}</span>
        <button type="button" class="btn small" data-nav="next" aria-label="Élève suivant de la sélection">→</button>
        <button type="button" class="btn small" data-nav="close" aria-label="Fermer la fiche">✕</button>
      </span>
    </div>
    ${flags.join("")}${summary}${chart}${profile}
    ${attrs}`;
}

/** Trajectoire de l'élève sur fond de bande interquartile et médiane de la sélection. */
function miniSlope(d, graded) {
  const w = Math.min(460, widthOf(root, 400)), h = 170, m = { t: 12, r: 64, b: 20, l: 40 };
  const x = d3.scalePoint().domain(["G1", "G2", "G3"]).range([m.l, w - m.r]);
  const y = d3.scaleLinear().domain([0, 20]).range([h - m.b, m.t]);
  const q = k => {
    const v = graded.map(r => r[k]).sort(d3.ascending);
    return [d3.quantileSorted(v, 0.25), d3.quantileSorted(v, 0.5), d3.quantileSorted(v, 0.75)];
  };
  const keys = ["G1", "G2", "G3"];
  const col = resultSpec()[resultOf(d)].color;
  let band = "", med = "";
  if (graded.length) {
    const Q = keys.map(q);
    band = `<path d="M${keys.map((k, i) => `${x(k)},${y(Q[i][2])}`).join("L")}L${keys.slice().reverse().map((k, i) => `${x(k)},${y(Q[2 - i][0])}`).join("L")}Z"
      fill="${css("--chip-on")}" stroke="none"/>`;
    med = `<path d="M${keys.map((k, i) => `${x(k)},${y(Q[i][1])}`).join("L")}" fill="none" stroke="${css("--text-2")}" stroke-width="1.4" stroke-dasharray="5 3"/>`;
  }
  const path = `M${keys.map(k => `${x(k)},${y(d[k])}`).join("L")}`;
  const dots = keys.map(k => `<circle cx="${x(k)}" cy="${y(d[k])}" r="4.5" fill="${col}" stroke="${css("--surface-1")}" stroke-width="2"/>`).join("");
  const labs = keys.map(k => `<text x="${x(k)}" y="${h - 4}" text-anchor="middle" style="font-size:10px;fill:${css("--muted")}">${k}</text>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;display:block;margin-bottom:6px" role="img"
      aria-label="Notes de l'élève ${d.G1}, ${d.G2}, ${d.G3} comparées à la médiane et aux quartiles de la sélection">
    ${[0, 5, 10, 15, 20].map(t => `<text x="${m.l - 8}" y="${y(t)}" dy="0.32em" text-anchor="end" style="font-size:9.5px;fill:${css("--muted")}">${t}</text>`).join("")}
    <line x1="${m.l - 4}" x2="${w - m.r + 4}" y1="${y(PASS)}" y2="${y(PASS)}" class="passline"/>
    ${band}${med}
    <path d="${path}" fill="none" stroke="${col}" stroke-width="2.6" stroke-linejoin="round" ${d.__nograde ? 'stroke-dasharray="5 3"' : ""}/>
    ${dots}${labs}
    <text x="${w - m.r + 8}" y="${y(d.G3)}" dy="0.32em" style="font-size:10.5px;font-weight:700;fill:${css("--text-1")}">élève ${d.G3}</text>
  </svg>
  <p class="note" style="margin:0 0 8px">Bande : Q1–Q3 de la sélection · tirets : médiane (n = ${graded.length}) · trait plein : l'élève.</p>`;
}
