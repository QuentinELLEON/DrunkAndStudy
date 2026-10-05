/* =====================================================================
   permalink.js — tâche U4.5 : retrouver une sélection plus tard
   ---------------------------------------------------------------------
   L'état de l'analyse (matière, filtres, brushes, axes, panneaux, élève)
   est encodé dans le fragment de l'URL (#ds=mat&school=GP&b=…).
   Copier l'adresse suffit pour rouvrir exactement la même vue, dans une
   autre session ou chez un collègue. Un CSV importé n'est pas restaurable
   (le fichier n'est pas dans l'URL) : son état n'est pas écrit.
   ===================================================================== */

/** Lit le fragment de l'URL ; renvoie un patch d'état partiel ou null. */
export function readHash() {
  const h = location.hash.replace(/^#/, "");
  if (!h) return null;
  const p = new URLSearchParams(h);
  const out = {};
  try {
    if (p.has("ds")) out.ds = p.get("ds");
    if (p.has("school")) out.school = p.get("school");
    if (p.has("sex")) out.sex = p.get("sex");
    if (p.has("nr")) out.excludeNoGrade = p.get("nr") !== "0";
    if (p.has("trend")) out.trend = p.get("trend");
    if (p.has("axes")) out.axes = p.get("axes").split(",").filter(Boolean);
    if (p.has("color")) out.colorBy = p.get("color");
    if (p.has("panels")) out.panels = p.get("panels").split(",").filter(Boolean);
    if (p.has("psort")) out.panelSort = p.get("psort");
    if (p.has("mx")) out.matrixOrder = p.get("mx");
    if (p.has("b")) out.brushes = JSON.parse(p.get("b"));
    if (p.has("group")) out.groupFilter = JSON.parse(p.get("group"));
    if (p.has("sel")) out.selectedId = +p.get("sel");
  } catch (e) {
    console.warn("Lien d'état illisible, ignoré :", e.message);
    return null;
  }
  return out;
}

let lastWritten = "";

/** Écrit l'état courant dans l'URL, sans créer d'entrée d'historique. */
export function writeHash(state) {
  if (state.ds === "custom" || state.status !== "ready") return;
  const p = new URLSearchParams();
  p.set("ds", state.ds);
  if (state.school) p.set("school", state.school);
  if (state.sex) p.set("sex", state.sex);
  if (!state.excludeNoGrade) p.set("nr", "0");
  if (state.trend !== "all") p.set("trend", state.trend);
  p.set("axes", state.axes.join(","));
  if (state.colorBy !== "result") p.set("color", state.colorBy);
  p.set("panels", state.panels.join(","));
  if (state.panelSort !== "manual") p.set("psort", state.panelSort);
  if (state.matrixOrder !== "meta") p.set("mx", state.matrixOrder);
  if (Object.keys(state.brushes).length) p.set("b", JSON.stringify(state.brushes));
  if (state.groupFilter) p.set("group", JSON.stringify(state.groupFilter));
  if (state.selectedId != null) p.set("sel", String(state.selectedId));
  const h = "#" + p.toString();
  lastWritten = h;
  if (h !== location.hash) {
    try { history.replaceState(null, "", h); } catch (e) { /* contexte sans historique */ }
  }
}

/** Vrai si le fragment actuel n'a pas été écrit par l'application (lien collé à la main). */
export function hashChangedExternally() {
  return location.hash !== lastWritten;
}
