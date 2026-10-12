#!/usr/bin/env bash
# Crée les labels et les 8 issues du projet DrunkAndStudy.
# À lancer dans Git Bash, depuis le dossier du projet : bash create-issues.sh
# Option : DRY_RUN=1 bash create-issues.sh   (affiche sans rien créer)
set -euo pipefail

REPO="QuentinELLEON/DrunkAndStudy"
BRANCH="scaffold/viz-placeholders"
DOCS="https://github.com/$REPO/blob/$BRANCH/docs"

echo "== Vérification du compte =="
gh auth status
LOGIN="$(gh api user -q .login)"
if [ "${LOGIN,,}" != "quentinelleon" ]; then
  echo "ERREUR : compte actif = $LOGIN, attendu QuentinElleon. Utilise 'gh auth switch'." >&2
  exit 1
fi
echo "Compte OK : $LOGIN"

run() { if [ "${DRY_RUN:-0}" = "1" ]; then echo "[dry-run] $*"; else "$@"; fi; }

echo "== Labels =="
run gh label create visualization --repo "$REPO" --color 1F4FA3 --description "Implémentation d'une visualisation" --force
run gh label create setup         --repo "$REPO" --color D9822B --description "Socle technique partagé" --force

issue() { # titre, label, fichier-corps (stdin)
  local title="$1" label="$2" body; body="$(cat)"
  if [ "${DRY_RUN:-0}" = "1" ]; then echo "[dry-run] issue: $title ($label)"; return; fi
  gh issue create --repo "$REPO" --title "$title" --label "$label" --body "$body"
}

echo "== Issues =="

issue "Setup : socle (données, état partagé, styles, panneaux) : revue et finalisation" setup <<EOF
## Objectif
Valider et finaliser le socle que toutes les vues utilisent. Il est **déjà écrit** dans la branche \`$BRANCH\` ; cette issue sert à le relire, trancher les points ouverts et le fusionner pour que A, B, C, D et les panneaux soient développés en parallèle.

**Conteneurs** : tous les \`#viz-…\` de \`index.html\` (vides ; chaque module de vue est dans sa propre issue).

## Déjà en place (à relire)
- [x] \`js/data.js\` : chargement \`d3.csv()\` des deux CSV, typage, attributs dérivés (\`reussite\`, \`risque\`, \`pedu\`, \`alc\`, \`absCat\`, \`prog\`, \`tendance\`), \`derive()\` → \`base\`, \`selection\`, \`exceptSrc(src)\`, \`selected\`.
- [x] \`js/meta.js\`, \`js/state.js\`, \`js/stats.js\` (Spearman, Gower, k plus proches voisins), \`js/utils.js\`, \`js/main.js\`.
- [x] \`js/controls/\` : en-tête, panneau de sélection (puces, tuiles, curseurs), fiche élève.
- [x] \`css/\` extrait de \`index.html\` (tokens, layout, components, un fichier par vue).
- [x] \`tools/test-stats.mjs\` : 65 vérifications dont les chiffres de référence (\`npm test\`).
- [x] Coquilles \`js/views/*.js\` branchées sur \`main.js\`.

## Reste à faire
- [ ] Relecture par un autre membre de l'équipe, fusion dans \`main\`.
- [ ] Trancher : codes stockés des dérivés (\`"oui"\` / \`"baisse"\` plutôt que les libellés du prototype), voir \`docs/data-contracts.md\`.
- [ ] Trancher : seuil du « pas de lien net » dans B (|ρ| < 0,1 ou seuil de signification).
- [ ] Recalculer les écarts de G3 voisins / hasard avec 5 voisins (3,3 / 3,6 et 2,5 / 3,1 dans la source) et corriger la doc si besoin.
- [ ] Vérifier le rendu clair et sombre, le clavier et 390 px sur les contrôles existants.
- [ ] Option : mode hors ligne (D3 en local), message si le CDN est inaccessible (déjà affiché).

## Critères d'acceptation
- [ ] \`npm test\` passe.
- [ ] Les deux matières se chargent ; non-évalués exclus par défaut (38 / 15), 357 / 634 élèves évalués.
- [ ] Changer de matière ou de « non évalués » remet la sélection à zéro.
- [ ] Un module de vue se branche avec \`init(container)\` / \`update(state, derived)\` sans toucher aux autres.
- [ ] Aucune erreur en console ; message explicite en \`file://\`.

## Docs
- $DOCS/architecture.md
- $DOCS/data-contracts.md
- $DOCS/conventions.md
EOF

issue "Visualisation A : ensembles parallèles (Parallel Sets)" visualization <<EOF
**Conteneur** : \`#viz-parallel-sets\` (\`data-viz="parallel-sets"\`)
**Module** : \`js/views/parallelSets.js\` · **Membre** : Quentin ELLEON
**Type de graphique** : ensembles parallèles

## Données
- Source : \`derived.selection\` (les zooms de A y sont inclus : le diagramme se réétalonne), axes dans \`state.psetAxes\`.
- Axes par défaut : \`school\`, \`sex\`, \`address\`, \`alc\`, \`absCat\`, \`risque\`, \`tendance\`, \`reussite\` (dernier axe fixe) ; ajoutables : \`studytime\`, \`traveltime\`, \`pedu\`, \`higher\`, \`failures\`, \`goout\`. 5 axes au maximum.
- Structure : \`segments[dim] = [{value, n, ok}]\`, \`bands = [{a, b, va, vb, reussite, n}]\`.

## Encodage et interactions
- Segment = catégorie (hauteur ∝ n) ; ruban = croisement (largeur ∝ n) ; bleu = réussite, orange = échec.
- Clic sur un segment : zoom (\`state.drill\`, \`src: "pset"\`), diagramme réétalonné, fil d'Ariane.
- Survol : n et % de réussite. Axes ajoutables, retirables, déplaçables.
- Chemin de l'élève sélectionné ; curseurs studytime / goout (\`state.slide\`).

## Tâches servies
Principale : U1-3, U1-5, U2-3, U2-4, U2-5. Secondaire : U1-1, U1-2, U1-4, U2-1.

## Critères d'acceptation
- [ ] Rend pour les deux matières, avec et sans non-évalués.
- [ ] Zoom par clic + fil d'Ariane, les largeurs se réétalonnent.
- [ ] Risque 2 ou plus affiche 42 / 67 élèves ; 43 % / 58 % de réussite contre 81 % / 94 % pour risque 0.
- [ ] Tendance : 34 / 245 / 78 (maths) et 20 / 461 / 153 (portugais).
- [ ] n affiché sur chaque bande et segment ; groupes de moins de 10 signalés.
- [ ] Clavier, aria-label, mode clair et sombre, 390 px sans défilement horizontal.
- [ ] Doc de la vue à jour.

## Docs
- $DOCS/visualisations.md#a-ensembles-parallèles
- $DOCS/data-contracts.md
- $DOCS/pipeline.md
EOF

issue "Visualisation B : matrice de corrélation de Spearman" visualization <<EOF
**Conteneur** : \`#viz-correlation-matrix\` (\`data-viz="correlation-matrix"\`)
**Module** : \`js/views/correlationMatrix.js\` · **Membre** : Jim LAINEL
**Type de graphique** : heatmap (triangle inférieur)

## Données
- Source : \`derived.selection\` ; attributs \`meta.MATRIX_KEYS\` : G3, G2, G1, failures, absences, studytime, traveltime, goout, Dalc, Walc, Medu, Fedu (G1 et G2 masqués sauf case dédiée).
- Structure : \`cells = [{a, b, rho, n}]\`, ρ de Spearman (rangs moyens pour les ex æquo), lignes triées par |ρ| avec G3.

## Encodage et interactions
- Échelle divergente centrée sur 0 : bleu positif, rouge négatif, blanc proche de 0 ; légende de −1 à +1.
- Valeur et signe écrits dans chaque cellule ; cellules très faibles grisées (« pas de lien net »).
- Info-bulle en phrase simple ; clic sur une cellule = \`state.mxPair\` (nuage de points, issue séparée).
- **À trancher** : seuil du grisé, |ρ| < 0,1 ou seuil de signification 1,96/√(n−1) (voir \`docs/data-contracts.md\`). Sous 30 élèves, afficher un message au lieu de la matrice.

## Tâches servies
Principale : U1-1. Secondaire : U2-3.

## Critères d'acceptation
- [ ] Hors G1 et G2, le premier facteur lié à G3 est \`failures\` (ρ −0,30 / −0,43).
- [ ] Recalcul sur la sélection partagée.
- [ ] Légende −1 à +1, texte lisible sur chaque couleur, aucune information portée par la seule couleur.
- [ ] Clic sur une cellule met à jour \`state.mxPair\`.
- [ ] Rappel « un lien n'est pas une cause », n affiché.
- [ ] Clavier, aria-label, mode clair et sombre, 390 px.
- [ ] Doc de la vue à jour.

## Docs
- $DOCS/visualisations.md#b-matrice-de-corrélation
- $DOCS/data-contracts.md
- $DOCS/pipeline.md
EOF

issue "Visualisation C : sunburst" visualization <<EOF
**Conteneur** : \`#viz-sunburst\` (\`data-viz="sunburst"\`)
**Module** : \`js/views/sunburst.js\` · **Membre** : Alexandre LARGUECH
**Type de graphique** : sunburst

## Données
- Source : \`derived.exceptSrc("sun")\`, niveaux dans \`state.sunLevels\` (3 au plus, défaut \`school\`, \`sex\`, \`risque\`, ordre modifiable ; choix parmi \`school\`, \`sex\`, \`address\`, \`risque\`, \`alc\`, \`higher\`, \`absCat\`, \`pedu\`).
- Structure : arbre \`{key, dim, n, ok, children}\` (\`d3.group\`, \`d3.hierarchy\`, \`d3.partition\`).

## Encodage et interactions
- Angle = nombre d'élèves ; couleur = taux de réussite, échelle divergente centrée sur la moyenne de la matière.
- Secteurs de moins de 10 élèves hachurés (définir le \`<pattern>\` dans le SVG du module).
- Clic sur un secteur : zoom (\`state.drill\`, \`src: "sun"\`) ; clic au centre : retour ; survol : chemin, n, % de réussite.
- Légende de la couleur et des hachures dans \`#cLegend\`.

## Tâches servies
Principale : U1-2, U2-1. Secondaire : U1-3, U2-4, U2-5.

## Critères d'acceptation
- [ ] Avec école, sexe, risque : 11 groupes en maths dont 3 sous 10 élèves (le plus petit en compte 3), hachurés.
- [ ] Taux de réussite école GP 75 % / 93 % et MS 69 % / 75 % (maths / portugais).
- [ ] Zoom et retour fonctionnent, le zoom ne vide pas la vue elle-même.
- [ ] n affiché ; bascule maths / portugais sans cumul.
- [ ] Clavier, aria-label, mode clair et sombre, 390 px.
- [ ] Doc de la vue à jour.

## Docs
- $DOCS/visualisations.md#c-sunburst
- $DOCS/data-contracts.md
- $DOCS/pipeline.md
EOF

issue "Visualisation D : graphe de similarité d'élèves" visualization <<EOF
**Conteneur** : \`#viz-similarity-graph\` (\`data-viz="similarity-graph"\`)
**Module** : \`js/views/similarityGraph.js\` (+ \`stats.gower\`, \`stats.knn\`) · **Membre** : Gabriel LOIRAT
**Type de graphique** : graphe nœuds-liens, disposition par forces

## Données
- Source : \`derived.base\` (graphe et disposition, mis en cache), \`derived.selection\` (opacité), \`state.colorBy\`, \`state.ghost\`.
- Distance de Gower sur \`failures\`, \`absences\`, \`studytime\`, \`traveltime\`, \`goout\`, \`alc\`, \`pedu\`, \`school\`, \`sex\`, \`address\`, \`higher\` (sans les notes).
- Structure : \`nodes = [{i, id, x, y, ok, tendance}]\` (un nœud par élève), \`links = [{source, target, d}]\` (5 plus proches voisins, sans doublon).

## Encodage et interactions
- Couleur = réussite ou tendance, au choix. Opacité = appartenance à la sélection.
- Clic sur un nœud : fiche élève (\`state.selectedId\`) ; survol : voisins éclairés ; zoom et déplacement.
- « Tester un profil » (\`state.ghost\`) : nœud fictif relié à ses 5 voisins, phrase de lecture.
- Texte calculé : écart de G3 entre voisins contre élèves au hasard.

## Tâches servies
Principale : U1-4, U2-2. Secondaire : U1-3, U1-5.

## Critères d'acceptation
- [ ] 357 / 634 nœuds et 5 voisins par nœud, sans pelote illisible.
- [ ] Disposition calculée une seule fois par (matière, non-évalués).
- [ ] Écart de G3 voisins / hasard cohérent avec la source (3,3 contre 3,6 en maths, 2,5 contre 3,1 en portugais) ; **à recalculer avec 5 voisins** et corriger la doc si besoin.
- [ ] Le profil fictif affiche combien de ses 5 voisins réussissent.
- [ ] Mention que la position à l'écran n'a pas de valeur métrique.
- [ ] Clavier, aria-label, mode clair et sombre, 390 px.
- [ ] Doc de la vue à jour.

## Docs
- $DOCS/visualisations.md#d-graphe-de-similarité
- $DOCS/data-contracts.md
- $DOCS/pipeline.md
EOF

issue "Panneau de détail : boxplot de G3 de la sélection" visualization <<EOF
**Conteneur** : \`#viz-selection-boxplot\` (\`data-viz="selection-boxplot"\`)
**Module** : \`js/views/selectionBox.js\` · **Type de graphique** : boxplot horizontal

## Données
\`derived.selection\` et \`derived.base\` → \`{all: {n, q1, med, q3, min, max}, sel: {…}}\` sur G3.

## Encodage et interactions
Axe G3 de 0 à 20, seuil 10 en pointillés, médiane et n écrits ; deux boîtes (ensemble et sélection) quand la sélection est un sous-ensemble. Se met à jour à chaque clic dans A, C, D.

## Tâches servies
U1-2, U2-1 (distribution de G3 du groupe, médiane).

## Critères d'acceptation
- [ ] Médiane de G3 : 11 en maths et 12 en portugais pour la matière entière.
- [ ] Risque 2 ou plus : médiane 9 / 10 contre 12 / 13 pour risque 0.
- [ ] Mention « Moins de 10 élèves, ces chiffres sont fragiles » sous 10 élèves.
- [ ] Lisible en clair et sombre, aria-label, 390 px.

## Docs
- $DOCS/visualisations.md#panneaux-de-détail-liés
- $DOCS/data-contracts.md
EOF

issue "Panneau de détail : trajectoire G1, G2, G3 de l'élève" visualization <<EOF
**Conteneur** : \`#viz-student-trajectory\` (\`data-viz="student-trajectory"\`)
**Module** : \`js/views/studentTrajectory.js\` · **Type de graphique** : courbe à 3 points

## Données
\`derived.selected\` (G1, G2, G3) et médiane de G1, G2, G3 des élèves évalués de \`base\` dans la même école et la même matière.

## Encodage et interactions
Deux courbes (élève, médiane de l'école), axe 0 à 20, seuil 10 en pointillés, étiquettes « élève » et « école ». Ouvert par un clic sur un nœud de D (\`state.selectedId\`).

## Tâches servies
U1-4, U1-5.

## Critères d'acceptation
- [ ] Les trois points correspondent aux notes de la fiche élève.
- [ ] Vide propre (message) quand aucun élève n'est sélectionné.
- [ ] Un non-évalué n'est pas traité comme un décrochage.
- [ ] Lisible en clair et sombre, aria-label, 390 px.

## Docs
- $DOCS/visualisations.md#panneaux-de-détail-liés
- $DOCS/data-contracts.md
EOF

issue "Panneau de détail : nuage de points d'une paire (clic dans B)" visualization <<EOF
**Conteneur** : \`#viz-pair-scatter\` (\`data-viz="pair-scatter"\`)
**Module** : \`js/views/pairScatter.js\` · **Type de graphique** : nuage de points

## Données
\`derived.selection\` et \`state.mxPair = [a, b]\` ; ρ de Spearman et n pour le texte.

## Encodage et interactions
Points avec jitter léger pour les ordinaux, courbe des médianes de b par valeur ou classe de a, axes étiquetés. Ouvert par un clic sur une cellule de B, fermable.

## Tâches servies
U1-1 (le signe du lien se voit à l'œil), U2-3.

## Critères d'acceptation
- [ ] Le signe visible dans le nuage correspond au signe de ρ de la cellule.
- [ ] Texte : phrase simple, ρ, n, « un lien n'est pas une cause ».
- [ ] Bouton Fermer remet \`state.mxPair\` à \`null\`.
- [ ] Lisible en clair et sombre, aria-label, 390 px.

## Docs
- $DOCS/visualisations.md#b-matrice-de-corrélation
- $DOCS/data-contracts.md
EOF

echo "== Terminé =="
[ "${DRY_RUN:-0}" = "1" ] || gh issue list --repo "$REPO" --limit 20
