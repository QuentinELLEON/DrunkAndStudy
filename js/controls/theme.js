// Bouton clair / sombre. Sans choix de l'utilisateur, la page suit le thème du système (css/tokens.css).
// Une fois le bouton utilisé, le choix est gardé dans le navigateur et pose data-theme sur <html>.

const KEY = "theme";
const root = document.documentElement;
const systemDark = () => !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
const current = () => root.dataset.theme || (systemDark() ? "dark" : "light");

function saved() {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : null; } catch { return null; }
}
function save(v) {
  try { localStorage.setItem(KEY, v); } catch { /* navigation privée : le choix vaut pour la session seulement */ }
}

function paint() {
  const btn = document.getElementById("themeBtn");
  if (!btn) return;
  const next = current() === "dark" ? "clair" : "sombre";
  btn.textContent = current() === "dark" ? "☀ Mode clair" : "☾ Mode sombre";
  btn.setAttribute("aria-label", `Passer en mode ${next}`);
}

export function init() {
  const v = saved();
  if (v) root.dataset.theme = v;
  const btn = document.getElementById("themeBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      const next = current() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      save(next);
      paint();
    });
  }
  // Si le système change de thème et que l'utilisateur n'a rien choisi, le libellé suit
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", paint);
  }
  paint();
}
