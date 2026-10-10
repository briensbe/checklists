## Context

L'application Angular actuelle propose une interface unique avec une session persistée sous la clé statique `'current'` dans IndexedDB via Dexie. Aucun routeur Angular n'est branché (`app.routes.ts` est vide), limitant l'utilisation à un seul audit actif et imposant un système d'évaluation rigide (OK / KO / NA).
Pour supporter des cas d'usage variés (todos opérationnelles, déploiements, contrôles qualité avec libellés sur-mesure), l'application doit passer à une architecture multi-sessions, intégrer un routeur Angular complet, et fournir un constructeur visuel de templates.

## Goals / Non-Goals

**Goals:**
- Implémenter le routage Angular avec des pages autonomes (`/checklists`, `/checklists/:id`, `/templates`, `/templates/builder`).
- Gérer plusieurs instances indépendantes de checklists en parallèle avec Dexie (UUID pour chaque session, indexation des preuves par session).
- Élargir le modèle de contrôle des items : case à cocher simple avec horodatage optionnel au clic, choix personnalisables (libellés et couleurs libres), et rétrocompatibilité avec le format OK/KO/NA.
- Fournir un constructeur visuel de templates pour créer, modifier, prévisualiser, importer et exporter des modèles en JSON.
- Respecter strictement les règles du projet (composants standalone, syntaxe de flux native `@if` et `@for`, structure séparée `.html`, `.css` et `.ts`, typage strict).

**Non-Goals:**
- Synchronisation cloud temps réel ou backend distant (le stockage reste local-first dans IndexedDB/Dexie).
- Authentification multi-utilisateurs.

## Decisions

### 1. Routage Angular avec composants de vues autonomes
- **Choix :** Utiliser `@angular/router` avec des composants de pages dédiés :
  - `ChecklistsDashboardComponent` (`/checklists`) : liste et métriques des sessions.
  - `ChecklistRunnerComponent` (`/checklists/:id`) : exécution d'une checklist précise.
  - `TemplatesListComponent` (`/templates`) : catalogue, import/export et lancement.
  - `TemplateBuilderComponent` (`/templates/builder` et `/templates/:id/edit`) : constructeur graphique.
- **Raison :** Permet la navigation standard du navigateur (URLs uniques, boutons précédent/suivant, ouverture simultanée dans plusieurs onglets).
- **Alternative rejetée :** Gestion par onglets dans une vue unique (complexité accrue du state et perte des bénéfices des URLs).

### 2. Modèle de données flexible pour les contrôles
- **Choix :** Étendre `ChecklistItemTemplate` avec :
  - `controlType: 'checkbox' | 'choice' | 'status'`
  - `withTimestamp?: boolean` pour les cases à cocher.
  - `customChoices?: { id: string; label: string; color?: string; isBlocking?: boolean }[]` pour les choix personnalisés.
- **Raison :** Offre une souplesse totale à l'utilisateur (pouvoir définir du Jaune/Bleu ou de simples étapes validées et horodatées).
- **Rétrocompatibilité :** Les templates existants sans `controlType` défini sont traités par défaut comme `status` (OK/KO/NA).

### 3. Gestion d'état et persistance Dexie
- **Choix :** Mettre à jour la table Dexie `sessions` pour utiliser un `id` UUID généré (via `crypto.randomUUID()`).
- `ChecklistSessionService` est adapté pour charger la session active via un paramètre de route ou signal `activeSessionId`.

## Risks / Trade-offs

- **[Risque : Migration des anciennes données avec `id: 'current'`]** → **Mitigation :** Lors de l'initialisation de la BDD, si une session `'current'` existe, elle est migrée vers une session avec un UUID et un titre explicite (ex: "Checklist initiale").
- **[Risque : Cohérence de l'affichage avec des choix personnalisés variés]** → **Mitigation :** Définir une palette de badges préconfigurés avec support de couleurs CSS contrastées pour les libellés libres.
