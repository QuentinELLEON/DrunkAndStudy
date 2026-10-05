# Choix de conception et conformité aux consignes

## Choix de conception (pour le rapport)

1. **Un état unique et un bus plutôt que des appels entre vues.** Les vues n'écrivent que dans `state` (`setState`), et `main.js` redessine tout à partir de cet état. On évite ainsi les incohérences entre vues liées, et chaque membre peut développer sa vue sans connaître celles des autres.
2. **Brushes en unités de données.** Un brush est un intervalle de notes ou un ensemble de modalités, pas un intervalle de pixels. N'importe quelle vue peut donc l'appliquer, et il survit à un redimensionnement ou à un réordonnancement des axes.
3. **Canvas pour les polylignes, SVG pour le reste.** Les 649 polylignes des coordonnées parallèles sont dessinées sur canvas pour rester fluides pendant le brushing. Les axes, brushes, cellules et boîtes restent en SVG, car ils portent les interactions et l'accessibilité. Pendant un geste de brush, les coordonnées parallèles, les tuiles, la matrice et la fiche suivent en direct. Les vues coûteuses (environ 4 000 points de boxplots, slope graph, table) se mettent à jour au relâchement : on passe ainsi de 50–150 ms par image à un seul rendu d'environ 70 ms.
4. **Le contexte est estompé, jamais supprimé.** Les élèves hors sélection restent visibles en gris dans les coordonnées parallèles, les groupes non filtrés restent visibles dans les boxplots, les tendances masquées restent en fond dans le slope graph. On voit ainsi ce qu'un filtre a retiré.
5. **La matrice ignore les brushes.** Un brush restreint l'étendue d'une variable et atténue mécaniquement ρ. La matrice suit les filtres, le groupe et la tendance, mais pas les brushes, et sa note le dit explicitement.
6. **Spearman plutôt que Pearson.** 10 attributs sont ordinaux : seul l'ordre de leurs modalités a du sens. Les rangs moyens gèrent les très nombreux ex æquo des échelles 1–5.
7. **Nominaux à plus de 3 modalités exclus des axes parallèles.** Placer « métier de la mère » sur un axe imposerait un ordre arbitraire et créerait des croisements sans signification. Ces attributs sont traités par les boxplots, qui les acceptent naturellement.
7 bis. **Moins d'attributs à l'écran, aucun perdu.** Chaque technique ne propose que les attributs qui servent une tâche (listes de `meta.js`, justifiées dans `docs/taches.md`) : 7 axes par défaut au lieu de 9, une matrice de 12 attributs (66 cellules au lieu de 120), 4 panneaux par défaut au lieu de 6, 11 colonnes de table au lieu de 14. Les 11 attributs sans tâche et `paid` (non comparable entre matières) restent dans la fiche, repliés, et dans l'export.
7 ter. **Fusionner ce qui est redondant, mais montrer pourquoi.** Dalc/Walc (ρ ≈ 0,64) deviennent l'indice `alc`, Medu/Fedu (ρ ≈ 0,62) deviennent `pedu` dans les coordonnées parallèles, les boxplots et la table. La matrice garde les attributs bruts : c'est la vue où la redondance se lit, et un clic sur une paire fusionnée renvoie vers l'axe dérivé. L'indice d'alcool en 3 niveaux supprime tous les groupes de moins de 10 élèves sans affaiblir l'association (ρ −0,21 / −0,21, contre −0,15 à −0,20 pour Dalc ou Walc seuls).
7 quater. **Une valeur manquante n'est jamais un zéro.** Pour un non-évalué, la progression G3 − G1 et les absences corrigées sont vides : il apparaît sur un repère « n. r. » sous l'axe et n'a pas de tendance dans le slope graph (sinon son 0 final compterait comme un décrochage).
8. **Échelle 0–20 commune et seuil à 10 partout.** G1, G2 et G3 ont un domaine fixe dans toutes les vues (parallèles, boxplots, slope, fiche) : on peut comparer d'une vue à l'autre, et la troncature ne peut pas exagérer un écart.
9. **Agrégation des trajectoires identiques dans le slope graph.** Les notes sont entières : beaucoup d'élèves partagent le même triplet. Fusionner ces trajectoires, avec une épaisseur en racine carrée de l'effectif, réduit le surtracé sans perdre d'information.
10. **Non-évalués exclus par défaut, mais visibles et réinclus sur demande.** `G3 = 0 ∧ absences = 0` est traité comme une donnée manquante. La case affiche leur nombre, et quand ils sont inclus ils ont leur propre code : gris, ✕, tirets.
11. **n partout, et un signal pour n < 10.** Chaque agrégat affiche son effectif : tuiles, panneaux et modalités de boxplot, matrice, slope, table, fiche. Les groupes de moins de 10 élèves sont hachurés, en pointillés et marqués ⚠.
12. **Vocabulaire d'association.** Les info-bulles parlent d'« association faible / modérée / forte », rappellent « association, pas causalité » et n'emploient jamais « effet » ni « cause ».
13. **Accessibilité.** La palette bleu/orange est lisible par les daltoniens et toujours doublée d'icônes (▲ ▼ ✕). La valeur de ρ est écrite dans chaque cellule. Toutes les commandes sont des `<button>` ou `<select>`. La matrice se parcourt aux flèches, les boîtes s'activent avec Entrée, la table se parcourt avec ↑ ↓ et Entrée, la fiche avec ← →. Un lien d'évitement mène à la table. Le mode sombre est choisi explicitement plutôt qu'obtenu par inversion. Les animations respectent `prefers-reduced-motion`.
14. **Interface en français, codes d'origine conservés.** Les libellés sont traduits dans `meta.js`, mais les valeurs brutes (`GP`, `at_home`, `yes`) ne sont jamais modifiées : l'export CSV reste compatible avec le fichier source (les dérivés ne sont pas exportés).
15. **Les trous de couverture se comblent par des liaisons, pas par une 5e vue.** U2.5 (« ils sont 12 comme lui ») était couverte par le graphe de similarité abandonné : la fiche compte les élèves au même profil et pose les brushes correspondants. U4.5 (retrouver une sélection) passe par l'URL, qui encode tout l'état.
16. **Mode d'emploi replié.** Chaque carte n'affiche qu'une ligne d'instruction ; le détail est dans « Comment lire ». La table, utile pour la liste nominative et le clavier, est repliée par défaut.

## Checklist de conformité

| Consigne | Couverture | Fichier / fonctionnalité |
|---|---|---|
| Données multivariées issues de Kaggle | ✔ 33 attributs (17 nominaux, 10 ordinaux, 6 quantitatifs), 395 et 649 élèves | `data/*.csv`, `js/meta.js`, crédits dans `README.md` et en pied de page |
| Pipeline explicite, des données brutes aux variables visuelles | ✔ décrit étape par étape pour chaque technique | `docs/pipeline.md` ; code : `data.js` (parsing, typage, filtres) → `stats.js` (transformations) → `views/*` (mapping) |
| Utilisateurs cibles, objectifs et tâches | ✔ U1–U4, 20 tâches de Munzner avec utilisateurs et critères ; couverture tâches × techniques | `docs/taches.md` (tableaux 3 et 4, checklist), d'après `specification-projet.md` |
| Technique 1 — coordonnées parallèles + brushing (Quentin) | ✔ brushing multi-axes, réordonnancement, choix d'axes, couleur, survol, clic | `views/parallelCoords.js` |
| Technique 2 — matrice de Spearman (Jim) | ✔ 12 attributs ordonnables bruts, rangs moyens, deux ordres, clic qui crée des axes adjacents (via les dérivés) | `views/correlationMatrix.js`, `stats.js` |
| Technique 3 — small multiples de boxplots / strip plots (Alexandre) | ✔ panneaux configurables, axe 0–20 commun, points, clic qui filtre sur le groupe, tri par écart des médianes | `views/boxplots.js`, `stats.boxStats` |
| Technique 4 — slope graph + profil élève (Gabriel) | ✔ faisceaux agrégés, médiane, filtre de tendance, fiche avec trajectoire située et profil similaire | `views/slopeGraph.js`, `views/detailPanel.js` |
| Transformation des données | ✔ 6 attributs dérivés, définis au survol, testés sur les vraies données | `data.DERIVATIONS`, `meta.js`, `tools/test-stats.mjs` |
| Tout sur une seule page | ✔ aucune autre page ni onglet | `index.html` |
| Navigation | ✔ défilement des axes, ← → entre élèves, flèches dans la matrice et la table, lien d'évitement | `detailPanel.js`, `correlationMatrix.js`, `table.js`, `index.html` |
| Sélection | ✔ clic sur un élève dans 4 vues, mis en évidence dans toutes | `state.selectedId` |
| Filtres | ✔ barre unique (matière, école, sexe, non-évalués) plus filtres posés depuis les vues, rappelés en puces supprimables | `views/filterBar.js`, `data.derive` |
| Brushing | ✔ brushes combinés, propagés aux tuiles, boxplots, slope, table et fiche | `parallelCoords.js`, `data.passesBrush` |
| Survol avec info-bulle | ✔ dans les 4 techniques (+ focus clavier dans la matrice) | `utils.showTip` |
| Vues liées | ✔ matrice → axes parallèles ; boxplot → filtre global ; slope → filtre global ; brush → toutes les vues ; élève → toutes les vues ; fiche → brushes du profil | `state.js` + `main.js` |
| Retrouver une sélection | ✔ lien permanent (URL) + export CSV | `permalink.js`, `filterBar.js`, `table.js` |
| Overview + détail | ✔ clic sur un élève dans n'importe quelle vue : fiche (33 attributs, trajectoire G1→G3 située dans la sélection) et mise en avant dans le slope graph | `detailPanel.js`, `slopeGraph.js` |
| Changer de dataset | ✔ bascule Mathématiques / Portugais ; import CSV avec séparateur `,` `;` ou tabulation détecté automatiquement, types inférés, vues dégradées proprement | `filterBar.js`, `data.importFile`, `main.js` |
| Démonstration exécutable | ✔ serveur statique au choix (Live Server de VS Code, `npx serve`), message explicite en `file://` ou sans CDN | `README.md`, `index.html`, `main.js`, `data.loadDataset` |
| Données hors du HTML | ✔ aucun bloc `text/csv` ; `d3.csv()` asynchrone (repli `d3.dsv(";")`), état de chargement et message d'erreur | `data/*.csv`, `data.loadDataset`, `main.showStatus` |
| D3 hors du HTML | ✔ D3 v7.9.0 depuis jsDelivr, aucun code minifié collé ; alternative npm documentée | `index.html`, `README.md` |
| Découpage en modules ES | ✔ `<script type="module">`, interface `init(container)` / `update(state, derived)` commune | `js/**` |
| Non-évalués exclus par défaut, case pour les réinclure | ✔ avec leur nombre affiché | `filterBar.js`, `data.typeRows` |
| Axe G3 de 0 à 20 avec seuil à 10 | ✔ dans toutes les vues | `meta.fixed`, les 4 vues |
| Matières jamais cumulées | ✔ un seul jeu actif ; aucune fusion | `state.ds`, `data.js` |
| n partout, groupes < 10 signalés | ✔ hachures, pointillés, ⚠ | toutes les vues, `utils.nBadge` |
| Association, jamais causalité | ✔ | textes de `index.html`, `utils.strength`, info-bulles |
| Palette accessible, icônes ▲▼, mode sombre, clavier, responsive | ✔ bouton de thème auto/clair/sombre ; aucun défilement horizontal de page à 390 px (seules les coordonnées parallèles défilent dans leur cadre) | `css/style.css`, `main.js` |
