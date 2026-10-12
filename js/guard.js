// Script classique (pas un module) : en file://, le module js/main.js est bloqué par le navigateur
// et la page resterait muette. Ce garde affiche donc une explication.
(function () {
  if (location.protocol !== "file:") return;
  var el = document.getElementById("status");
  if (!el) return;
  el.hidden = false;
  el.className = "status error";
  el.innerHTML = "Cette page doit être servie en <code>http://</code> : les modules ES et <code>d3.csv()</code> sont bloqués en <code>file://</code>. " +
    "Lancez <code>npx serve .</code> dans le dossier du projet (ou <code>npm start</code>), ou « Open with Live Server » dans VS Code.";
})();
