/* =====================================================================
   permalink.js — retrouver une vue plus tard (lien permanent)
   ---------------------------------------------------------------------
   L'état de l'analyse (matière, filtres, critères, groupes, profil simulé, élève)
   est encodé dans le fragment de l'URL (#ds=mat&school=GP&crit=fail,abs…).
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
    if (p.has("crit")) out.criteria = p.get("crit").split(",").filter(Boolean);
    if (p.has("risk")) out.riskMin = +p.get("risk") || 0;
    if (p.has("ug")) out.unitGroup = p.get("ug");
    if (p.has("gb")) out.groupBy = p.get("gb");
    if (p.has("group")) out.groupFilter = JSON.parse(p.get("group"));
    if (p.has("sim")) out.sim = JSON.parse(p.get("sim"));
    if (p.has("trend")) out.trend = p.get("trend");
    if (p.has("flow")) out.flow = JSON.parse(p.get("flow"));
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
  if (state.criteria.length) p.set("crit", state.criteria.join(","));
  if (state.riskMin) p.set("risk", String(state.riskMin));
  if (state.unitGroup !== "risque") p.set("ug", state.unitGroup);
  if (state.groupBy) p.set("gb", state.groupBy);
  if (state.groupFilter) p.set("group", JSON.stringify(state.groupFilter));
  if (Object.keys(state.sim).length) p.set("sim", JSON.stringify(state.sim));
  if (state.trend !== "all") p.set("trend", state.trend);
  if (state.flow) p.set("flow", JSON.stringify(state.flow));
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
