/* =====================================================================
   views/statTiles.js — indicateurs de synthèse de la sélection courante
   Chaque indicateur rappelle son effectif : une moyenne sans n n'est pas lisible.
   ===================================================================== */
/* global d3 */

import { PASS, SMALL_N } from "../meta.js";
import { fmt1, fmt2, pct } from "../utils.js";

let root;

export function init(container) { root = container; }

function tile(k, v, d) {
  return `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
}

export function update(state, derived) {
  const ds = derived.ds;
  if (!ds) { root.innerHTML = ""; return; }
  const sel = derived.selection;
  const graded = sel.filter(d => !d.__nograde);
  const n = sel.length;
  const tiles = [tile("Élèves affichés", n,
    `${ds.name} · sur ${derived.scoped.length} après filtres${n < SMALL_N ? " · ⚠ n < " + SMALL_N : ""}`)];

  // U1.1 : la médiane et le taux de réussite se lisent en premier ; la moyenne passe en sous-texte.
  // (La tuile « absences moyennes » a été retirée : moyenne d'une variable très asymétrique,
  //  la tâche U3.5 est servie par le panneau « Absences (classes) » des boxplots.)
  if (ds.keys.includes("G3")) {
    const g = graded.map(d => d.G3);
    const ok = g.length > 0;
    tiles.push(tile("Médiane de G3", ok ? fmt1(d3.median(g)).replace(/,0$/, "") + "<small> /20</small>" : "—",
      ok ? `moyenne ${fmt2(d3.mean(g))} · n = ${g.length} évalués` : "aucun élève évalué"));
    const k = g.filter(v => v >= PASS).length;
    tiles.push(tile("Taux de réussite", ok ? pct(k / g.length) : "—",
      ok ? `▲ ${k} sur ${g.length} ont G3 ≥ ${PASS}` : "&nbsp;"));
  }
  if (!ds.builtin) tiles.push(tile("Colonnes", ds.rawKeys.length, `fichier importé · séparateur « ${ds.separator === "\t" ? "tab" : ds.separator} »`));
  root.innerHTML = tiles.join("");
}
