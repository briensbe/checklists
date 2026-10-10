## Why

Actuellement, l'application est cantonnée à une session unique (`id: 'current'`) et un modèle unique codé en dur sans routage, contraignant les contrôles au format rigide OK/KO/NA et empêchant l'exécution simultanée de plusieurs checklists.
Cette évolution permet d'instancier plusieurs checklists indépendantes en parallèle, de naviguer via des routes dédiées, de disposer d'une bibliothèque et d'un constructeur visuel de modèles de checklists (avec import/export JSON), et de proposer des types de contrôles polyvalents (case à cocher simple avec horodatage optionnel ou choix d'évaluation entièrement personnalisables).

## What Changes

- **Architecture multi-sessions** : Gestion de sessions indépendantes identifiées par un UUID dans IndexedDB (Dexie), permettant de créer, suivre, reprendre et archiver plusieurs checklists en parallèle.
- **Routage Angular & navigation dédiée** : Mise en place de routes Angular distinctes (`/checklists`, `/checklists/:id`, `/templates`, `/templates/builder`, `/templates/:id/edit`).
- **Typologie d'évaluation flexible** : 
  - Mode case à cocher (`checkbox`) avec option d'horodatage automatique au clic activable au niveau de l'item.
  - Mode choix personnalisé (`choice`) permettant de configurer des libellés et couleurs sur-mesure (ex: Vert/Orange/Rouge, Jaune/Bleu, Validé/En cours).
  - Mode statut classique ou saisie complémentaire.
- **Bibliothèque de modèles & Import/Export** : Visualisation de l'arborescence des templates, téléchargement et import de fichiers JSON validés, et instanciation immédiate d'une checklist à partir d'un modèle.
- **Constructeur visuel de modèles** : Interface graphique interactive permettant de concevoir ou éditer un template (sections, items, options d'évaluation, options d'horodatage) sans manipuler de JSON à la main.

## Capabilities

### New Capabilities
- `checklist-sessions-management`: Gestion du cycle de vie multi-checklists (création avec nom/contexte, exécution simultanée, reprise, métriques individuelles et suppression).
- `template-builder`: Constructeur visuel de modèles, bibliothèque, import et export JSON, configuration personnalisée des choix d'évaluation et de l'horodatage optionnel.
- `interactive-checklist-execution`: Vue d'exécution interactive de la checklist adaptée aux nouveaux types d'items (cases à cocher horodatées, choix personnalisés dynamiques, gestion des commentaires et preuves).

### Modified Capabilities
<!-- Aucune capability préexistante dans openspec/specs -->

## Impact

- **Modèle de données & Dexie** : Évolution des interfaces `ChecklistItemTemplate`, `ChecklistSession` et `ItemAnswer` ; migration ou adaptation du schéma Dexie pour supporter des IDs multiples et des types de réponses enrichis.
- **Routage & Composants** : Configuration de `app.routes.ts`, refactorisation de `app.ts` et `app.html` en conteneur de routage (`<router-outlet>`), création des composants de pages (`checklists-list`, `checklist-runner`, `templates-list`, `template-builder`).
- **Services** : Mise à jour de `ChecklistSessionService` pour gérer une session active sélectionnée par ID plutôt qu'un singleton `current`, enrichissement de `TemplateService`.
