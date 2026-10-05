# Choix de conception et conformité aux consignes

## Choix de conception (pour le rapport)

1. **Des représentations lisibles sans formation.** Les utilisateurs sont l'équipe pédagogique (littératie visuelle moyenne) et les parents et élèves (faible). Une première version utilisait des coordonnées parallèles, une matrice de Spearman, des boxplots et un faisceau de trajectoires : chacune demandait de savoir lire des lignes superposées, un coefficient ρ ou des quartiles. Elles ont été remplacées par une grille d'élèves, un classement des facteurs en % de réussite, des histogrammes avec seuil et un diagramme alluvial. Ce que l'on montre est toujours un **nombre d'élèves**, un **pourcentage de réussite** ou une **note sur 20**.
2. **Une question par technique.** La page est découpée en quatre questions dans l'ordre où un utilisateur les pose : répartition des notes, facteurs associés, élèves à risque, évolution dans l'année. Chaque question s'ouvre sur une phrase calculée à partir des données (« 74 % des élèves évalués ont au moins 10/20… ») ; le mode d'emploi est replié dans « Comment lire ».
3. **Un seul code couleur.** Orange ▼ = échec (G3 < 10), bleu ▲ = réussite, gris ✕ = non évalué, dans toutes les vues. La paire bleu / orange est validée pour les daltoniens (ΔE 24,7 en protanopie, 33,6 en vision normale) et toujours doublée d'une icône. Le texte n'est jamais coloré par la donnée.
4. **Le seuil de 10/20 et l'échelle 0–20 partout.** Les histogrammes, la fiche et les trajectoires ont tous une échelle de 0 à 20 et le seuil en pointillés : on compare d'une vue à l'autre et la troncature ne peut pas exagérer un écart.
5. **Le pourcentage est écrit, pas estimé.** Les histogrammes affichent le % de réussite en gros, le classement écrit l'écart en points et le sens du lien en une phrase : on ne demande jamais d'estimer une aire ou une pente.
6. **Un état unique et un bus plutôt que des appels entre vues.** Les vues n'écrivent que dans `state` (`setState`) et `main.js` redessine tout à partir de cet état. Chaque membre développe sa vue sans connaître celles des autres ; les vues liées restent cohérentes.
7. **Les filtres s'expriment en unités de données.** Un critère est un facteur de risque, un groupe est une modalité, un flux est un passage de bande : n'importe quelle vue peut les appliquer, et ils survivent à un changement de taille de fenêtre.
8. **Le classement des facteurs ignore les critères de la grille.** Filtrer sur « au moins 1 échec » puis classer les facteurs viderait la comparaison du facteur « échecs passés ». Le classement suit la barre de filtres (matière, école, sexe) et le dit en bas de la vue. Le simulateur suit la même règle : un parent compare un profil à tous les élèves, pas à la sélection de l'équipe.
9. **Le contexte est estompé, jamais supprimé.** Les élèves hors sélection restent visibles et pâles dans la grille, les autres groupes restent estompés dans les histogrammes, les autres flux restent en fond dans le diagramme alluvial.
10. **Un niveau de risque transparent.** `risque` compte les facteurs d'un élève parmi quatre (échec passé, plus de 10 absences, trajet de 30 min ou plus, ne vise pas le supérieur), sans pondération. Chacun peut vérifier pourquoi un élève est à risque 2 : la fiche liste ses facteurs.
11. **Non-évalués exclus par défaut, mais visibles et réinclus sur demande.** `G3 = 0 ∧ absences = 0` est une donnée manquante. La case affiche leur nombre ; réinclus, ils sont gris ✕, n'ont ni niveau de risque ni progression (sinon leur 0 compterait comme un décrochage), et forment une bande « non évalué » dans le diagramme alluvial, qui montre d'où ils viennent.
12. **n partout, et un signal pour n < 10.** Chaque agrégat affiche son effectif ; un groupe de moins de 10 élèves est signalé (⚠, contour pointillé, point creux) et n'entre pas dans l'écart du classement.
13. **Vocabulaire d'association.** Les phrases disent « réussite plus basse », « associé à », et rappellent « association, pas cause » ; jamais « effet » ni « cause ».
14. **Anonymat pour U2.** Le simulateur de profil ne montre que des effectifs et des distributions, jamais un élève : U2 situe un profil fictif sans comparaison nominative. Les vues nominatives (grille, liste de trajectoires, table, fiche) servent U1.
15. **Accessibilité.** Toutes les commandes sont des `<button>` ou `<select>` ; les panneaux d'histogrammes, les lignes du classement et les rubans s'activent au clavier (Entrée), le classement se parcourt avec ↑ ↓, la fiche avec ← →, la table avec ↑ ↓ et Entrée ; un lien d'évitement mène à la table. Le mode sombre est choisi, pas obtenu par inversion. Pas de défilement horizontal de la page à 390 px.
16. **Interface en français, codes d'origine conservés.** Les libellés sont dans `meta.js` ; les valeurs brutes (`GP`, `at_home`, `yes`) ne sont jamais modifiées et l'export CSV contient les 33 colonnes d'origine.

## Checklist de conformité

| Consigne | Couverture | Fichier / fonctionnalité |
|---|---|---|
| Données multivariées issues de Kaggle | ✔ 33 attributs (17 nominaux, 10 ordinaux, 6 quantitatifs), 395 et 649 élèves | `data/*.csv`, `js/meta.js`, crédits dans `README.md` et en pied de page |
| Pipeline explicite, des données brutes aux variables visuelles | ✔ décrit étape par étape pour chaque technique | `docs/pipeline.md` ; code : `data.js` → `stats.js` → `views/*` |
| Utilisateurs cibles, objectifs et tâches | ✔ U1 et U2, 10 tâches de Munzner avec critères de réussite ; couverture tâches × techniques | `docs/taches.md` (§3, §4), `rendu1.md` |
| Transformation des données | ✔ 6 attributs dérivés, définis au survol, testés sur les vraies données | `data.DERIVATIONS`, `meta.js`, `tools/test-stats.mjs` |
| Technique 1 — grille d'élèves (Quentin) | ✔ facteurs à cocher, niveau de risque, regroupement, survol, clic | `views/unitChart.js` |
| Technique 2 — classement des facteurs (Jim) | ✔ taux par modalité, écart, sens du lien, clic vers les histogrammes | `views/factorRanking.js`, `stats.spearman` |
| Technique 3 — histogrammes + simulateur (Alexandre) | ✔ groupes au choix, seuil, médiane, % de réussite, profil fictif avec « ma note » | `views/histograms.js` |
| Technique 4 — diagramme alluvial + fiche (Gabriel) | ✔ bandes P1 → P2 → finale, filtre « en baisse », trajectoires, fiche comparée à l'école | `views/alluvial.js`, `views/detailPanel.js` |
| Navigation | ✔ ← → entre élèves, ↑ ↓ dans le classement et la table, lien d'évitement, questions numérotées | `detailPanel.js`, `factorRanking.js`, `table.js`, `index.html` |
| Sélection | ✔ clic sur un élève dans la grille, la liste de trajectoires ou la table ; mis en évidence dans les histogrammes et la grille | `state.selectedId` |
| Filtres | ✔ barre unique (matière, école, sexe, non-évalués) plus filtres posés depuis les vues, rappelés en puces supprimables | `views/filterBar.js`, `data.derive` |
| Vues liées | ✔ critères de risque → toutes les vues ; clic sur un histogramme → toutes les vues ; ruban ou tendance → toutes les vues ; facteur → regroupement des histogrammes ; élève → fiche | `state.js` + `main.js` |
| Overview + détail | ✔ quatre questions en vue d'ensemble ; fiche élève à côté, toujours visible sur grand écran | `index.html`, `detailPanel.js` |
| Changer de dataset | ✔ bascule Mathématiques / Portugais ; import CSV (`,` `;` ou tabulation), dérivés recalculés, vues dégradées proprement | `filterBar.js`, `data.importFile`, `main.js` |
| Tout sur une seule page | ✔ aucune autre page ni onglet | `index.html` |
| Démonstration exécutable | ✔ serveur statique (Live Server de VS Code, `npx serve`), message explicite en `file://` ou sans CDN | `README.md`, `index.html`, `main.js` |
| Données hors du HTML, D3 v7 depuis le CDN, modules ES | ✔ `d3.csv()` asynchrone, D3 7.9.0 jsDelivr, interface `init(container)` / `update(state, derived)` | `data.loadDataset`, `index.html`, `js/**` |
| Non-évalués exclus par défaut, case pour les réinclure | ✔ avec leur nombre affiché | `filterBar.js`, `data.typeRows` |
| Axe G3 de 0 à 20 avec seuil à 10 | ✔ dans toutes les vues | les 4 vues, la fiche |
| Matières jamais cumulées | ✔ un seul jeu actif ; la fiche compare à l'école dans la même matière | `state.ds`, `data.js`, `detailPanel.js` |
| n partout, groupes < 10 signalés | ✔ ⚠, contour pointillé, point creux | toutes les vues |
| Association, jamais causalité | ✔ | phrases d'en-tête, classement, simulateur, info-bulles |
| Palette accessible, icônes ▲▼, mode sombre, clavier, responsive | ✔ thème auto / clair / sombre ; pas de défilement horizontal de la page à 390 px | `css/style.css`, `main.js` |
