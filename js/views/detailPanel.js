/* =====================================================================
   views/detailPanel.js — Technique de Gabriel, niveau « détail »
   Fiche élève : valeurs de l'élève à côté de la moyenne de son école
   ---------------------------------------------------------------------
   Tâche : U1-4 (consulter le profil d'un élève et le situer par rapport à la
           moyenne de son école et de sa matière, en un clic).
   Transformation : groupe de référence = élèves évalués du même établissement,
           dans la matière affichée (jamais les deux matières ensemble) ;
           moyenne (quantitatifs, ordinaux) ou part de « oui » (binaires),
           quartiles et médiane de G1, G2, G3 pour la mini-trajectoire.
   Marques   : tableau élève / école ; trajectoire de l'élève sur la bande Q1–Q3
               de son école ; attributs non analysés repliés.
   Canaux    : position verticale = note 0–20, seuil à 10 ; teinte = résultat ;
               ▲ ▼ = écart à la moyenne de l'école, dans le sens favorable ou non.
   Interactions : ← / → (élève précédent / suivant de la sélection), fermer.
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { GROUPS, PASS, SMALL_N, KEY_ATTRS, RISK_FACTORS } from "../meta.js";
import { css, resultOf, resultSpec, resultBadge, labelOf, titleOf, esc, fmt1, pct, widthOf } from "../utils.js";

/** Sens favorable d'un attribut : +1 = plus haut est mieux, −1 = plus bas est mieux, 0 = neutre. */
const GOOD = { failures: -1, absences: -1, traveltime: -1, risque: -1, studytime: 1, pedu: 1, G1: 1, G2: 1, G3: 1, prog: 1, higher: 1, goout: 0, alc: -1 };

let root;
let cur = { state: null, derived: null };
let moreOpen = false;

export function init(container) {
  root = container;
  root.addEventListener("toggle", e => { if (e.target.matches("details.dmore")) moreOpen = e.target.open; }, true);
  root.addEventListener("click", e => {
    const b = e.target.closest("button[data-nav]"); if (!b) return;
    if (b.dataset.nav === "close") setState({ selectedId: null }, "detail");
    else step(b.dataset.nav === "next" ? 1 : -1);
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const t = e.target;
    if (t.closest && t.closest("input, select, textarea, .seg, .rank, .tlist")) return;
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
    root.innerHTML = `<p class="empty">Aucun élève sélectionné.<br>Cliquez un carré de la grille, une trajectoire, un nœud du graphe de similarité, un point du nuage ou une ligne de la table.</p>`;
    return;
  }
  const sel = derived.selection;
  const idx = sel.findIndex(r => r.__i === d.__i);
  const hasGrades = ["G1", "G2", "G3"].every(k => ds.keys.includes(k));
  const hasSchool = ds.keys.includes("school");
  // groupe de référence : même établissement, même matière, élèves évalués (indépendant des filtres)
  const ref = ds.rows.filter(r => !r.__nograde && (!hasSchool || r.school === d.school));
  const refName = `${hasSchool ? (d.school === "GP" ? "Gabriel Pereira" : d.school === "MS" ? "Mousinho da Silveira" : d.school) + ", " : ""}${ds.name.toLowerCase()}`;

  const flags = [];
  if (d.__nograde) flags.push(`<div class="flag">✕ Non évalué : G3 = 0 avec 0 absence. À lire comme un dossier non renseigné (abandon, absence à l'épreuve), pas comme une note de 0.</div>`);
  if (idx < 0) flags.push(`<div class="flag info">ⓘ Cet élève est hors de la sélection courante (filtres ou critères).</div>`);

  let summary = "", chart = "";
  if (hasGrades) {
    const delta = d.__delta;
    const facs = ds.standard ? RISK_FACTORS.filter(f => f.test(d)).map(f => f.label.toLowerCase()) : [];
    summary = `<div class="dsum">
      <div><b>${d.G1} → ${d.G2} → ${d.G3}</b>notes P1 → P2 → finale (/20)</div>
      <div><b>${!isFinite(delta) ? "—" : delta > 0 ? "▲ +" + delta : delta < 0 ? "▼ −" + -delta : "● 0"}</b>progression G3 − G1</div>` +
      (ds.standard ? `<div><b>${isFinite(d.risque) ? d.risque + " / 4" : "—"}</b>facteurs de risque${facs.length ? " : " + esc(facs.join(", ")) : ""}</div>` : "") +
    `</div>`;
    chart = miniSlope(d, ref, refName);
  }

  // tableau élève / moyenne de l'école
  const keys = (ds.standard ? KEY_ATTRS : ds.keys.filter(k => ds.meta[k].t !== "nom").slice(0, 12)).filter(k => ds.keys.includes(k));
  const rowsHtml = keys.map(k => {
    const M = ds.meta[k], v = d[k];
    const vals = ref.map(r => r[k]).filter(x => x !== "" && !(typeof x === "number" && isNaN(x)));
    let refTxt = "—", cmp = "";
    if (M.t === "nom") {
      const yes = vals.filter(x => x === "yes").length;
      refTxt = vals.length ? `${pct(yes / vals.length)} « oui »` : "—";
    } else if (vals.length) {
      const m = d3.mean(vals);
      refTxt = `moy. ${fmt1(m)} · méd. ${fmt1(d3.median(vals)).replace(/,0$/, "")}`;
      const g = GOOD[k] ?? 0;
      if (g && typeof v === "number" && isFinite(v) && Math.abs(v - m) >= 0.5) cmp = (v - m) * g > 0 ? `<span class="up">▲</span>` : `<span class="down">▼</span>`;
    }
    const tip = [M.def ? "Dérivé : " + M.def : "", M.note || ""].filter(Boolean).join(" — ");
    return `<tr><th scope="row">${esc(titleOf(ds.meta, k))}${tip ? ` <span class="info" title="${esc(tip)}">ⓘ</span>` : ""}</th>
      <td>${cmp} ${esc(labelOf(ds.meta, k, v))}</td><td class="ref">${refTxt}</td></tr>`;
  }).join("");
  const table = `<table class="dcmp"><thead><tr><th></th><th>Élève</th><th>Son école (n = ${ref.length})</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <p class="note" style="margin:4px 0 0">▲ / ▼ : valeur plus favorable / moins favorable que la moyenne de l'école (association, pas jugement).</p>`;

  // autres attributs, repliés (les 33 restent accessibles)
  const rest = ds.rawKeys.filter(k => !keys.includes(k));
  const block = ks => (ds.standard ? GROUPS.map(g => [g, ks.filter(k => ds.meta[k].g === g)]).filter(g => g[1].length) : [["Attributs", ks]])
    .map(([g, gk]) => `<div><h4>${esc(g)}</h4><dl>${gk.map(k => {
      const n = ds.meta[k].note;
      return `<dt>${esc(titleOf(ds.meta, k))}${n ? ` <span class="info" title="${esc(n)}">ⓘ</span>` : ""}</dt><dd>${esc(labelOf(ds.meta, k, d[k]))}</dd>`;
    }).join("")}</dl></div>`).join("");
  const more = rest.length ? `<details class="dmore"${moreOpen ? " open" : ""}><summary>Autres attributs du fichier (${rest.length})</summary>
      <div class="dgroups">${block(rest)}</div></details>` : "";

  root.innerHTML = `
    <div class="dhead">
      <span class="who2">Élève n° ${d.__i + 1} · ${esc(ds.name)} ${resultBadge(d)}</span>
      <span class="dnav">
        <button type="button" class="btn small" data-nav="prev" aria-label="Élève précédent de la sélection">←</button>
        <span class="nbadge" style="align-self:center">${idx >= 0 ? `${idx + 1} / ${sel.length}` : `– / ${sel.length}`}</span>
        <button type="button" class="btn small" data-nav="next" aria-label="Élève suivant de la sélection">→</button>
        <button type="button" class="btn small" data-nav="close" aria-label="Fermer la fiche">✕</button>
      </span>
    </div>
    ${flags.join("")}${summary}${chart}${table}${more}`;
}

/** Trajectoire de l'élève sur la bande Q1–Q3 et la médiane de son école. */
function miniSlope(d, ref, refName) {
  const w = Math.min(420, widthOf(root, 340)), h = 150, m = { t: 12, r: 70, b: 20, l: 30 };
  const keys = ["G1", "G2", "G3"];
  const x = d3.scalePoint().domain(keys).range([m.l, w - m.r]);
  const y = d3.scaleLinear().domain([0, 20]).range([h - m.b, m.t]);
  const col = resultSpec()[resultOf(d)].color;
  let band = "", med = "";
  if (ref.length) {
    const Q = keys.map(k => { const v = ref.map(r => r[k]).sort(d3.ascending); return [0.25, 0.5, 0.75].map(p => d3.quantileSorted(v, p)); });
    band = `<path d="M${keys.map((k, i) => `${x(k)},${y(Q[i][2])}`).join("L")}L${keys.slice().reverse().map((k, i) => `${x(k)},${y(Q[2 - i][0])}`).join("L")}Z" fill="${css("--chip-on")}"/>`;
    med = `<path d="M${keys.map((k, i) => `${x(k)},${y(Q[i][1])}`).join("L")}" fill="none" stroke="${css("--text-2")}" stroke-width="1.5" stroke-dasharray="5 3"/>`;
  }
  const path = `M${keys.map(k => `${x(k)},${y(d[k])}`).join("L")}`;
  const dots = keys.map(k => `<circle cx="${x(k)}" cy="${y(d[k])}" r="4.5" fill="${col}" stroke="${css("--surface-1")}" stroke-width="2"/>`).join("");
  const labs = ["P1", "P2", "finale"].map((t, i) => `<text x="${x(keys[i])}" y="${h - 4}" text-anchor="middle" style="font-size:10px;fill:${css("--muted")}">${t}</text>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;display:block;margin-bottom:4px" role="img"
      aria-label="Notes de l'élève ${d.G1}, ${d.G2}, ${d.G3}, comparées à la médiane et aux quartiles de son école">
    ${[0, 10, 20].map(t => `<text x="${m.l - 8}" y="${y(t)}" dy="0.32em" text-anchor="end" style="font-size:10px;fill:${css("--muted")}">${t}</text>`).join("")}
    ${band}${med}
    <line x1="${m.l - 4}" x2="${w - m.r + 4}" y1="${y(PASS)}" y2="${y(PASS)}" class="passline"/>
    <path d="${path}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" ${d.__nograde ? 'stroke-dasharray="5 3"' : ""}/>
    ${dots}${labs}
    <text x="${w - m.r + 8}" y="${y(d.G3)}" dy="0.32em" style="font-size:11px;font-weight:600;fill:${css("--text-1")}">élève ${d.G3}</text>
  </svg>
  <p class="note" style="margin:0 0 8px">Bande : moitié centrale des élèves de son école (${esc(refName)}, n = ${ref.length}${ref.length < SMALL_N ? " ⚠" : ""}) · tirets : leur médiane.</p>`;
}
