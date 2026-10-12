# Choix de conception et conformité aux consignes

La référence fonctionnelle est [`visualisations.md`](visualisations.md). Ce document garde les principes de conception qui restent valables et la checklist de conformité aux consignes du cours.

## Choix de conception (pour le rapport)

1. **Quatre techniques complémentaires, une par membre.** A (ensembles parallèles) porte les attributs catégoriels et ordinaux, B (matrice de corrélation) les quantitatifs et ordinaux, C (sunburst) une hiérarchie de catégories avec effectif et taux de réussite, D (graphe de similarité) tous les types via une distance de Gower. Chaque visualisation est la seule technique principale sur au moins une tâche, aucune n'est redondante.
2. **Vue d'ensemble et détail.** Les quatre vues forment la vue d'ensemble. Un clic sur un élève ou une catégorie ouvre les panneaux de détail (boxplot de la sélection, trajectoire G1, G2, G3, fiche élève, nuage de points d'une paire).
3. **Une sélection partagée.** Un clic dans A, C ou D filtre ou surligne les mêmes élèves dans les autres vues. Les filtres sont stockés en unités de données (dimension et modalité) pour que toute vue puisse les appliquer.
4. **Un état unique et un bus plutôt que des appels entre vues.** Les vues n'écrivent que dans `state` (`setState`) et `main.js` redessine tout à partir de cet état. Chaque membre développe sa vue sans connaître celles des autres.
5. **Un seul code couleur.** Bleu = note finale de 10 ou plus, orange = en dessous, dans toutes les vues. La couleur est toujours doublée d'une valeur écrite, d'une icône ou d'un motif. Le texte n'est jamais coloré par la donnée.
6. **Le seuil de 10/20 et l'échelle 0–20 partout.** Les boxplots, trajectoires et nuages de points gardent l'échelle 0 à 20 avec le seuil en pointillés : on compare d'une vue à l'autre.
7. **Honnêteté sur les petits groupes.** *n* est affiché sur tout agrégat ; un groupe de moins de 10 élèves est signalé (hachures dans C, mention dans les info-bulles et les panneaux).
8. **Vocabulaire d'association.** Les phrases disent « associé à », « réussite plus basse » et rappellent « association, pas cause » ; jamais « effet » ni « cause ». Les données sont observationnelles et en partie auto-déclarées.
9. **Un niveau de risque transparent.** `risque` compte les facteurs d'un élève parmi quatre (échec passé, plus de 10 absences, trajet de 30 min ou plus, ne vise pas le supérieur), sans pondération ; la fiche liste les facteurs.
10. **Non-évalués exclus par défaut, mais visibles et réinclus sur demande.** `G3 = 0` et `absences = 0` est une donnée manquante codée 0. La case affiche leur nombre ; réinclus, ils n'ont ni niveau de risque ni progression.
11. **Matières jamais cumulées.** Un seul jeu actif ; la fiche compare à l'école dans la même matière.
12. **Résultat honnête du graphe D.** Le profil seul prédit mal la note : l'application l'écrit (écart de G3 entre voisins comparé à celui entre élèves au hasard) au lieu de laisser croire à un regroupement net. La position à l'écran n'a pas de valeur métrique.
13. **Interface en français, codes d'origine conservés.** Les libellés sont dans `meta.js`, les valeurs brutes (`GP`, `at_home`, `yes`) ne sont jamais modifiées.
14. **Accessibilité.** Commandes en `<button>` ou `<select>`, éléments cliquables atteignables au clavier avec `aria-label`, mode sombre choisi plutôt qu'obtenu par inversion, pas de défilement horizontal à 390 px.

> Le choix du 5 octobre de remplacer ces techniques par des représentations plus simples (grille, classement, histogrammes, alluvial) n'est plus en vigueur ; l'ancien raisonnement (« lisibles sans formation ») reste en historique Git. Les liens à conserver en tête : phrases en langage simple, *n* partout, légendes explicites.

## Checklist de conformité

| Consigne | Couverture | Fichier / fonctionnalité |
|---|---|---|
| Données multivariées issues de Kaggle | 33 attributs (17 nominaux, 10 ordinaux, 6 quantitatifs), 395 et 649 élèves | `data/*.csv`, `js/meta.js`, crédits dans `README.md` et en pied de page |
| Pipeline explicite, des données brutes aux variables visuelles | décrit étape par étape pour chaque visualisation | `docs/pipeline.md` ; code : `data.js` → `stats.js` → `views/*` |
| Utilisateurs cibles, objectifs et tâches | U1 et U2, 10 tâches avec critères de réussite ; couverture tâches × visualisations | `docs/taches.md`, `docs/visualisations.md` |
| Transformation des données | attributs dérivés `reussite`, `risque`, `pedu`, `alc`, `absCat`, `prog`, `tendance` | `data.js`, `meta.js`, `tools/test-stats.mjs` |
| Technique 1 (Quentin) | ensembles parallèles, zoom, fil d'Ariane, curseurs | `views/parallelSets.js` |
| Technique 2 (Jim) | matrice de corrélation de Spearman et nuage de points | `views/correlationMatrix.js`, `views/pairScatter.js` |
| Technique 3 (Alexandre) | sunburst à 3 niveaux, zoom, hachures sous 10 élèves | `views/sunburst.js` |
| Technique 4 (Gabriel) | graphe de similarité (Gower, 5 voisins), profil fictif | `views/similarityGraph.js` |
| Navigation | clavier sur tous les éléments cliquables, fil d'Ariane, fermeture des panneaux | `utils.js`, `controls/*` |
| Sélection | clic sur une catégorie, un secteur, un nœud ; mise en évidence dans toutes les vues | `state.drill`, `state.selectedId` |
| Filtres | barre unique (matière, non-évalués) plus filtres posés depuis les vues, rappelés en puces | `controls/header.js`, `controls/selectionPanel.js`, `data.derive` |
| Vues liées | zoom A et C, curseurs, nœud D, cellule B | `state.js` + `main.js` |
| Overview + détail | quatre vues en vue d'ensemble ; boxplot, trajectoire, fiche, nuage en détail | `index.html`, `views/*`, `controls/studentCard.js` |
| Changer de dataset | bascule Mathématiques / Portugais | `controls/header.js`, `data.js` |
| Tout sur une seule page | aucune autre page ni onglet | `index.html` |
| Démonstration exécutable | serveur statique (Live Server, `npx serve`), message explicite en `file://` | `README.md`, `main.js` |
| Données hors du HTML, D3 v7 depuis le CDN, modules ES | `d3.csv()` asynchrone, D3 7.9.0, interface `init(container)` / `update(state, derived)` | `data.js`, `index.html`, `js/**` |
| Axe G3 de 0 à 20 avec seuil à 10 | dans les panneaux de détail | `selectionBox.js`, `studentTrajectory.js` |
| n partout, groupes < 10 signalés | hachures, mentions | toutes les vues |
| Association, jamais causalité | phrases d'en-tête, info-bulles | toutes les vues |
| Palette accessible, mode sombre, clavier, responsive | thème auto, clair, sombre | `css/tokens.css`, `utils.js` |
