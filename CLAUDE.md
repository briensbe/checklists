# Checklists — contexte pour Claude Code

Application web Angular pour **créer** (template builder) et **remplir** (exécution) des checklists de contrôle, rendues visuelles et agréables. Inspiration : les checklists d'aviation avant décollage. Domaine initial : l'IT (projets, mises en production), mais le modèle doit rester générique.

## Documents de référence — à lire avant toute fonctionnalité UI

- `docs/design/checklist-ux.md` : **source de vérité** des décisions UX, du modèle de données et des règles de calcul (portes, jonctions, états).
- `docs/design/mockups/*.html` : maquettes interactives autonomes. Elles servent de **référence de comportement** (pas de code à copier tel quel). Index : `docs/design/mockups/index.html`.

| Fonctionnalité | Maquette |
|---|---|
| Vue d'ensemble par catégories | `01-anneaux-categories.html` |
| Chemin à étapes linéaire | `02-chemin-lineaire.html` |
| Chemin avec branches parallèles et jonction | `03-chemin-branches.html` |
| Grand périmètre : phases parallèles + zoom | `04-grand-perimetre-branches.html` |
| Template builder (liste + aperçu graphe) | `05-template-builder.html` |
| Preuve obligatoire (option du template) | `06-preuve-obligatoire.html` |
| Coche rapide + ajouts facultatifs (comportement par défaut) | `07-coche-rapide-ajouts.html` |

## Règles à respecter

- **Seuls les items bloquants verrouillent une porte.** L'état « débloqué » se **calcule**, il ne se stocke jamais.
- Graphe d'étapes/phases = DAG via `dependsOn` ; linéaire et parallèle ne sont qu'un seul modèle.
- **La coche est instantanée** (toute la ligne est cliquable) ; notes, photos, fichiers et N/A sont à un niveau secondaire (tiroir).
- Une étape verrouillée affiche ses prérequis puis ses items en **simple liste de texte**, sans case ni badge.
- « Non applicable » exige toujours une justification.
- Nouvel item = `optional` par défaut.
- On **historise** les changements d'état d'un item, on n'écrase pas.

## Conventions techniques

- Angular récent, composants standalone, **signals** : état des items dans un `signal`, tout le reste en `computed`.
- **Un seul composant de graphe** réutilisé pour les phases, les étapes et l'aperçu du builder.
- Rendu du graphe en **SVG fait main**. Nœuds et liens dans **le même système de coordonnées en pixels** (tout en SVG, ou positions recalculées via `ResizeObserver`). Ne jamais mélanger pourcentages CSS et `viewBox` étiré : c'est un bug déjà rencontré.
- Layout : colonne = plus long chemin depuis un départ ; `dagre` si les graphes se densifient.
- Graphiques de synthèse : `ngx-echarts`. Célébration : `canvas-confetti`.
- Valider le graphe à l'édition (tri topologique, pas de cycle, ≥ 1 départ et ≥ 1 fin).
- Accessibilité : navigation clavier dans les listes d'items (↑/↓, Espace, A, Entrée, Échap), `aria-label` sur les boutons-icônes.
