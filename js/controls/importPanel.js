// Import d'un CSV : fenêtre (modèle vide à télécharger, choix ou dépôt du fichier, erreurs), bannière « fichier importé ».
// Contrôle comme header.js : il n'écrit pas dans l'état. main.js remplace les données via onImport / onRestore.
// Le nom du fichier et les valeurs de l'utilisateur ne passent jamais par innerHTML (textContent seulement).

import { DATASETS, EXPECTED_COLUMNS, SCHEMA, IMPORT_MAX_BYTES } from "../meta.js";
import { importCsv, newImportKey, templateCsv, TEMPLATE_FILENAME, describeColumn } from "../importer.js";

let callbacks = {};
let dlg, resultEl, fileEl, lede, foot;

const $ = (id) => document.getElementById(id);

function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

export function init(cb) {
  callbacks = cb || {};
  dlg = $("importDialog");
  resultEl = $("impResult");
  fileEl = $("impFile");
  lede = $("lede");
  foot = $("foot");
  if (lede) lede.dataset.original = lede.textContent;
  if (foot) foot.dataset.original = foot.textContent;

  buildSchemaTable();

  $("importOpen").addEventListener("click", () => {
    clearResult();
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  });
  const close = () => (typeof dlg.close === "function" ? dlg.close() : dlg.removeAttribute("open"));
  $("impClose").addEventListener("click", close);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });   // clic sur le fond

  $("impTemplate").addEventListener("click", downloadTemplate);

  fileEl.addEventListener("change", () => {
    const file = fileEl.files && fileEl.files[0];
    fileEl.value = "";                  // permet de réimporter le même fichier après correction
    handleFile(file);
  });
  const drop = $("impDrop");
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => handleFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]));

  $("importRestore").addEventListener("click", () => callbacks.onRestore && callbacks.onRestore());
}

// Tableau d'aide : une ligne par colonne attendue (nom, signification, valeurs acceptées), généré depuis meta.SCHEMA.
function buildSchemaTable() {
  const body = $("impSchema");
  body.replaceChildren();
  EXPECTED_COLUMNS.forEach((col) => {
    const tr = el("tr");
    const th = el("th"); th.appendChild(el("code", col)); tr.appendChild(th);
    tr.appendChild(el("td", SCHEMA[col].label));
    tr.appendChild(el("td", describeColumn(col)));
    body.appendChild(tr);
  });
}

function downloadTemplate() {
  const blob = new Blob([templateCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = TEMPLATE_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function clearResult() { resultEl.hidden = true; resultEl.replaceChildren(); resultEl.className = "imp-result"; }

function showErrors(errors, warnings, fileName) {
  resultEl.replaceChildren();
  resultEl.className = "imp-result imp-error";
  resultEl.hidden = false;
  resultEl.appendChild(el("p", `${fileName ? `« ${fileName} » n'a pas été importé` : "Import impossible"} : les données actuelles sont conservées.`, "imp-result-title"));
  const ul = el("ul");
  errors.concat(warnings || []).forEach((m) => ul.appendChild(el("li", m)));
  resultEl.appendChild(ul);
  resultEl.scrollIntoView({ block: "nearest" });
}

async function handleFile(file) {
  if (!file) return;
  if (file.size > IMPORT_MAX_BYTES) {
    showErrors([`Le fichier fait ${(file.size / 1048576).toFixed(1).replace(".", ",")} Mo ; la limite est de ${IMPORT_MAX_BYTES / 1048576} Mo.`], [], file.name);
    return;
  }
  let text;
  try { text = await file.text(); } catch (e) { showErrors(["Le fichier n'a pas pu être lu."], [], file.name); return; }
  const result = importCsv(text, newImportKey());
  if (!result.ok) { showErrors(result.errors, result.warnings, file.name); return; }
  if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
  if (callbacks.onImport) callbacks.onImport({ key: result.key, rows: result.rows, info: result.info, warnings: result.warnings, fileName: file.name });
}

// Bannière, texte d'introduction, pied de page et sélecteur de matière : suivent le jeu de données actif.
export function update(st, derived, rowsByDs) {
  const info = DATASETS[st.ds];
  const imported = Boolean(info && info.imported);
  const banner = $("importBanner");
  const seg = $("matSeg");
  if (seg) seg.hidden = imported;                      // un seul jeu actif : rien à choisir
  banner.hidden = !imported;
  // Sans aucun dossier non évalué, la case « Inclure les 0 élèves non évalués » n'aurait pas de sens.
  const neBox = $("ne") && $("ne").closest("label");
  if (neBox) neBox.hidden = imported && !(rowsByDs[st.ds] || []).some((r) => r.__nograde);
  if (lede && lede.dataset.original !== undefined) {
    if (!imported) lede.textContent = lede.dataset.original;
    else {
      const rows = rowsByDs[st.ds] || [];
      const nb = rows.filter((r) => r.__nograde).length;
      lede.textContent = `Fichier importé « ${info.fileName} » : ${rows.length} élèves (${rows.length - nb} évalués). Cliquez sur une catégorie, un secteur ou un point pour filtrer toutes les vues. Ce qui apparaît ici, ce sont des associations, jamais des causes.`;
    }
  }
  if (foot && foot.dataset.original !== undefined) {
    foot.textContent = imported
      ? "Source : fichier importé par l'utilisateur, lu dans le navigateur (rien n'est envoyé sur Internet). Les élèves notés 0 sans aucune absence sont traités comme des dossiers non évalués, exclus par défaut. Démonstrateur pédagogique, pas un outil de suivi d'élèves."
      : foot.dataset.original;
  }
  if (!imported) return;
  const rows = rowsByDs[st.ds] || [];
  const nb = rows.filter((r) => r.__nograde).length;
  const text = $("importBannerText");
  text.replaceChildren();
  text.appendChild(el("strong", `Fichier importé « ${info.fileName} »`));
  text.appendChild(document.createTextNode(` : ${rows.length} élèves${nb ? `, dont ${nb} non évalué${nb > 1 ? "s" : ""}` : ""}. Les jeux Maths et Portugais ne sont plus affichés.`));
  (info.warnings || []).forEach((w) => text.appendChild(el("span", w, "imp-warn")));
}
