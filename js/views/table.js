/* =====================================================================
   views/table.js — table de la sélection (accès aux valeurs exactes)
   Toutes les valeurs des graphiques sont lisibles ici ; c'est aussi le
   chemin d'accès au clavier (Tab, Entrée) vers la fiche élève.
   Colonnes : meta.TABLE_COLS (dont les dérivés risque et prog) ; liste nominative pour l'équipe (U1).
   Export   : les 33 colonnes d'origine seulement (compatibilité avec le fichier source).
   ===================================================================== */
/* global d3 */

import { setState } from "../state.js";
import { toCSV } from "../data.js";
import { TABLE_COLS } from "../meta.js";
import { resultOf, titleOf, shortOf, esc } from "../utils.js";

const COLS = TABLE_COLS;
const CAP = 400;
let root, theadEl, tbodyEl, noteEl, boxEl, exportBtn;
let cur = { state: null, derived: null };
let sort = { key: null, dir: 1 };
let lastSelected = null;

export function init(container) {
  root = container;
  root.innerHTML = `
    <div class="toolbar">
      <span id="tb-note" aria-live="polite"></span>
      <button type="button" class="btn small" id="tb-export">Exporter la sélection (CSV)</button>
    </div>
    <div class="tablebox"><table><thead></thead><tbody></tbody></table></div>`;
  theadEl = root.querySelector("thead"); tbodyEl = root.querySelector("tbody");
  noteEl = root.querySelector("#tb-note"); boxEl = root.querySelector(".tablebox");
  exportBtn = root.querySelector("#tb-export");

  const pick = tr => {
    const id = +tr.dataset.i;
    setState({ selectedId: cur.state.selectedId === id ? null : id }, "table");
  };
  tbodyEl.addEventListener("click", e => { const tr = e.target.closest("tr"); if (tr) pick(tr); });
  tbodyEl.addEventListener("keydown", e => {
    const tr = e.target.closest("tr"); if (!tr) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(tr); }
    else if (e.key === "ArrowDown" && tr.nextElementSibling) { e.preventDefault(); tr.nextElementSibling.focus(); }
    else if (e.key === "ArrowUp" && tr.previousElementSibling) { e.preventDefault(); tr.previousElementSibling.focus(); }
  });
  theadEl.addEventListener("click", e => {
    const th = e.target.closest("th[data-k]"); if (!th) return;
    const k = th.dataset.k;
    sort = { key: k, dir: sort.key === k ? -sort.dir : 1 };
    update(cur.state, cur.derived);
  });
  exportBtn.addEventListener("click", () => {
    const ds = cur.derived.ds; if (!ds) return;
    const blob = new Blob([toCSV(cur.derived.selection, ds.rawKeys)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `selection-${ds.builtin ? ds.key : "import"}-${cur.derived.selection.length}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

export function update(state, derived) {
  cur = { state, derived };
  const ds = derived.ds;
  if (!ds) { theadEl.innerHTML = ""; tbodyEl.innerHTML = ""; return; }
  const cols = COLS.filter(k => ds.keys.includes(k));
  const use = cols.length >= 4 ? cols : ds.keys.slice(0, 14);
  let rows = derived.selection.slice();
  if (sort.key && (sort.key === "__i" || use.includes(sort.key))) {
    const k = sort.key;
    rows.sort((a, b) => sort.dir * d3.ascending(a[k], b[k]) || a.__i - b.__i);
  }
  const shown = rows.slice(0, CAP);
  const focusedId = tbodyEl.contains(document.activeElement) ? document.activeElement.closest("tr")?.dataset.i : null;
  const ariaSort = k => sort.key === k ? (sort.dir > 0 ? "ascending" : "descending") : "none";
  theadEl.innerHTML = `<tr><th class="l" data-k="__i" aria-sort="${ariaSort("__i")}">n°</th>` +
    use.map(k => `<th data-k="${k}" aria-sort="${ariaSort(k)}" title="${esc(titleOf(ds.meta, k))}${ds.meta[k].def ? " (dérivé : " + esc(ds.meta[k].def) + ")" : ""} — cliquer pour trier">${esc(k)}</th>`).join("") + `</tr>`;
  tbodyEl.innerHTML = shown.map(d =>
    `<tr data-i="${d.__i}" tabindex="0" aria-selected="${d.__i === state.selectedId}"><td class="l">${d.__i + 1}</td>` +
    use.map(k => {
      if (typeof d[k] === "number" && isNaN(d[k])) return `<td class="none" title="non renseigné">n. r.</td>`;
      if (ds.meta[k].derived && ds.meta[k].t === "ord") return `<td>${esc(shortOf(ds.meta, k, d[k]))}</td>`;
      if (k !== "G3") return `<td>${esc(d[k])}</td>`;
      const r = resultOf(d);
      return `<td class="${r}">${r === "none" ? "✕ 0" : (r === "pass" ? "▲ " : "▼ ") + d.G3}</td>`;
    }).join("") + `</tr>`).join("");
  if (focusedId != null) { const f = tbodyEl.querySelector(`tr[data-i="${focusedId}"]`); if (f) f.focus({ preventScroll: true }); }
  noteEl.textContent = rows.length > CAP
    ? `${CAP} premières lignes sur ${rows.length} élèves sélectionnés (n = ${rows.length}) — l'export contient toute la sélection.`
    : `${rows.length} élèves sélectionnés (n = ${rows.length}). Clic ou Entrée sur une ligne : fiche élève.`;

  // amène la ligne de l'élève sélectionné dans la zone visible de la table (sans faire défiler la page)
  if (state.selectedId !== lastSelected) {
    lastSelected = state.selectedId;
    const tr = tbodyEl.querySelector(`tr[data-i="${state.selectedId}"]`);
    if (tr && (tr.offsetTop < boxEl.scrollTop + 24 || tr.offsetTop > boxEl.scrollTop + boxEl.clientHeight - 24)) {
      boxEl.scrollTop = tr.offsetTop - boxEl.clientHeight / 2;
    }
  }
}
