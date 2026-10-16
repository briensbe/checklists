## Context

Le constructeur de modèles ([`TemplateBuilderComponent`](src/app/pages/template-builder/template-builder.component.ts)) permet actuellement d'éditer le nom, la version, la description, ainsi qu'une arborescence basique de sections et d'items (cases à cocher, choix personnalisés avec palette de tons). 

Toutefois, les capacités avancées du modèle de données [`ChecklistTemplate`](src/app/models/checklist.interface.ts) (introduites lors des précédents changes et persistées dans Dexie v3) ne disposent d'aucune interface utilisateur :
1. `contextSchema` : définition des variables de contexte (`text`, `date`, `select`) avec leurs options et valeurs par défaut.
2. `visibleIf` : conditions d'affichage dynamique par item (`fieldId`, `equals[]`).
3. `requireNaReason` : obligation d'un motif textuel en cas de sélection `N/A`.
4. `extraField` : champ de saisie textuel libre supplémentaire par item.

De plus, l'état interne du composant repose actuellement sur des mutations directes d'objets imbriqués avec `[(ngModel)]`, les réordonnancements se font uniquement par clics successifs ↑/↓, aucune duplication rapide n'existe, et aucune protection n'empêche la perte de travail en cas de clic accidentel sur un lien de navigation.

## Goals / Non-Goals

**Goals:**
- Offrir une interface graphique 100% visuelle pour configurer l'ensemble des propriétés du modèle de template sans nécessiter d'édition JSON.
- Intégrer le réordonnancement intuitif par glisser-déposer (`@angular/cdk/drag-drop`) au sein d'une section et entre sections, avec maintien des contrôles clavier accessibles.
- Permettre la duplication d'items et de sections en un clic avec garantie d'identifiants uniques non conflictuels (`crypto.randomUUID()`).
- Sécuriser la navigation via un guard `CanDeactivate` et l'écoute de `beforeunload` pour prévenir la perte de modifications non enregistrées.
- Garantir l'intégrité relationnelle du template : unicité globale des `id` d'items, protection des `id` existants en édition (pour le rebase des sessions), et détection des conditions `visibleIf` orphelines.
- Isoler les manipulations de structure dans des fonctions pures testables unitairement (`template-builder.helpers.ts`).

**Non-Goals:**
- Modifier le schéma de stockage Dexie (Dexie v3 supporte déjà toutes les propriétés du modèle de données).
- Modifier le moteur d'exécution (`checklist-runner`) qui interprète déjà fidèlement `contextSchema`, `visibleIf`, `requireNaReason` et `extraField`.
- Ajouter d'autres dépendances externes que `@angular/cdk`.

## Decisions

### 1. Immuabilité de l'état du template et dirty checking par snapshot
- **Décision :** Lors de l'initialisation du builder (création ou chargement), un instantané initial est capturé via `initialSnapshot = structuredClone(template())`. L'état modifié est détecté via un signal dérivé `isDirty = computed(() => !deepEqual(template(), initialSnapshot))` ou par comparaison sérialisée. Les modifications d'arborescence passent par des fonctions pures renvoyant une nouvelle instance du template (`template.update(t => ...)`) plutôt que par mutation en place.
- **Alternatives considérées :** Un indicateur booléen manuel `hasChanged = true` positionné sur chaque `(ngModelChange)` : rejeté car vulnérable aux faux positifs lors des annulations et omissions sur les modifications complexes.

### 2. Réordonnancement avec `@angular/cdk/drag-drop`
- **Décision :** Installer `@angular/cdk` (dans la même version majeure qu'Angular 22) et utiliser les directives `cdkDropListGroup`, `cdkDropList`, `cdkDrag` et `cdkDropListConnectedTo`.
  - Au lâcher d'un item, si `event.previousContainer === event.container`, application de `moveItemInArray`.
  - Si `event.previousContainer !== event.container`, application de `transferArrayItem` vers la section cible.
  - Les boutons ↑/↓ existants sont conservés pour l'accessibilité au clavier.
- **Alternatives considérées :**
  - HTML5 Drag and Drop natif : rejeté en raison de la complexité de gestion du placeholder visuel, des limitations d'accessibilité et des comportements hétérogènes entre navigateurs.
  - Librairies tierces : rejetées pour respecter le périmètre strict du projet.

### 3. Garde `CanDeactivate` et dialogue modal
- **Décision :** Créer un guard fonctionnel `canDeactivateTemplateBuilder` attaché aux routes `/templates/builder` et `/templates/:id/edit`.
  - Si `component.isDirty()` est vrai, le guard appelle `dialogService.confirm()` avec le message « Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ? ».
  - Pour la fermeture de l'onglet ou le rafraîchissement, un `@HostListener('window:beforeunload', ['$event'])` déclenche l'avertissement natif du navigateur si `isDirty()`.
- **Alternatives considérées :** Utiliser `window.confirm` : proscrit par l'ADR 0005.

### 4. Modularisation des helpers purs (`template-builder.helpers.ts`)
- **Décision :** Centraliser toute la logique algorithmique dans un fichier dédié de fonctions pures :
  - `duplicateItem(section, item): ChecklistItemTemplate`
  - `duplicateSection(template, section): ChecklistSectionTemplate`
  - `validateTemplateIntegrity(template): { valid: boolean; errors: string[] }` (unicité globale des ID d'items, présence du titre, présence d'au moins une section et un item)
  - `findVisibleIfOrphans(template, contextSchema): Array<{ itemId: string; fieldId: string }>` (détection des références à des champs inexistants)
- **Alternatives considérées :** Écrire la logique directement dans les méthodes du composant : rejeté car cela alourdirait le contrôleur et compliquerait les tests unitaires.

### 5. Protection des identifiants existants et génération des nouveaux
- **Décision :**
  - En mode édition d'un template existant, le champ `id` des items existants est désactivé / masqué pour éviter toute rupture avec les sessions en cours (`rebaseSessionOnTemplate`).
  - Lors de la création ou de la duplication d'un item ou d'une section, l'identifiant est généré via `crypto.randomUUID()`.

## Risks / Trade-offs

- **[Risk] Gestion des listes connectées CDK dans des sections dynamiques**  
  → *Mitigation* : Calculer la liste des identifiants des conteneurs cibles via un signal `computed` : `connectedDropLists = computed(() => sections().map(s => 'drop-section-' + s.id))`.
- **[Risk] Rupture de cohérence si un champ de contexte est supprimé alors qu'il est ciblé par un `visibleIf`**  
  → *Mitigation* : Utiliser `findVisibleIfOrphans` lors de la suppression d'une variable de contexte. Si des items en dépendent, afficher une alerte modale demandant confirmation ou nettoyage préalable.
- **[Risk] Performance de la comparaison d'état (dirty check)**  
  → *Mitigation* : Le volume de données d'un template de checklist est modeste (<50 Ko). Une comparaison JSON ou un clone de référence est exécuté en moins d'une milliseconde sans impact sur le thread UI.
