## Context

L'application est une SPA Angular autonome sans backend avec persistance locale Dexie (IndexedDB). Jusqu'à présent, les interactions critiques (confirmation de suppression, alertes d'erreurs, résolution de conflits à l'import, lancement de session) s'appuyaient sur les boîtes natives du navigateur (`window.alert`, `window.confirm`, `window.prompt`).

Ces dialogues posent de multiples problèmes :
- Ils bloquent le thread JavaScript principal.
- Ils ne respectent pas le thème sombre de l'application.
- Ils ne permettent aucune personnalisation ergonomique (impossible de proposer 3 options distinctes sans chaîner des `confirm()`).
- Ils rendent toute action destructive immédiate et irrévocable (aucun droit à l'erreur).
- Ils ne répondent pas aux standards d'accessibilité (contraste, focus trap, ARIA).

Ce change conçoit un service applicatif de dialogue (`DialogService`), un système de toasts empilables avec annulation (`ToastService`), une mécanique de persistance différée avec vidage garanti (`flush`), et pose le socle d'accessibilité interactif du projet.

## Goals / Non-Goals

**Goals:**
- Éliminer 100 % des appels natifs `alert()`, `confirm()` et `prompt()` dans `src/app/`.
- Fournir un `DialogService` léger et pur Angular (sans bibliothèque tierce) avec méthode `confirm(options)` retournant `Promise<boolean>` et méthode `choice(options)` retournant `Promise<string | null>`.
- Assurer le piégeage du focus (`focus trap`), la fermeture par `Échap` et la restitution du focus sur l'élément d'origine pour tous les dialogues modaux.
- Fournir un `ToastService` gérant une file de notifications éphémères et empilables, supportant un bouton d'action optionnel (ex: « Annuler ») et un compte à rebours de 6 secondes.
- Implémenter l'annulation pour les suppressions de sessions, de preuves, d'items/sections de template, et pour l'action « Passer le reste à OK ».
- Sécuriser les suppressions différées : mise à jour immédiate des signaux UI, écriture en base différée de 6s, et vidage immédiat (`flush`) sur `ngOnDestroy` et `visibilitychange`.
- Établir le socle d'accessibilité : boutons d'en-tête de section avec `aria-expanded`, boutons icônes avec `aria-label`, contours de focus visibles et contrastes conformes en thèmes clair et sombre.

**Non-Goals:**
- Audit WCAG 2.1 AAA formel ou certification externe.
- Gestion d'un historique d'undo/redo global multi-niveaux (ex: pile de Ctrl+Z infinie). Seule l'action immédiate courante est annulable pendant sa fenêtre d'exposition de 6 secondes.
- Ajout de librairies lourdes de composants UI (pas de Angular Material, ni de PrimeNG).

## Decisions

### 1. `DialogService` et `DialogModalComponent`
- **Architecture** : Le `DialogService` est un service injectable (`providedIn: 'root'`) maintenant un signal réactif contenant l'état du dialogue actif (`currentDialog`).
- **Composant hôte** : Un composant `DialogModalComponent` inséré dans la coquille applicative racine (`app.component.html`) écoute ce signal et projette le dialogue avec son overlay sombre semi-transparent.
- **Piégeage du focus** : À l'ouverture, le dialogue mémorise `document.activeElement`, place le focus sur le bouton d'action par défaut (ou le premier élément interactif), intercepte la touche `Tab` pour cycler dans la boîte, et intercepte `Échap` pour rejeter/annuler. À la fermeture, le focus est réassigné à l'élément d'origine.
- **Choix multiples** : Le dialogue supporte un tableau de boutons configurables avec identifiant, libellé et ton (`primary`, `secondary`, `danger`), résolvant la promesse avec l'identifiant cliqué (utilisé dans `import-conflict.ts`).

### 2. `ToastService` et `ToastContainerComponent`
- **Architecture** : `ToastService` (`providedIn: 'root'`) maintient une liste réactive de toasts via un `signal<ToastItem[]>`.
- **Modèle `ToastItem`** : `{ id, message, tone ('info' | 'success' | 'warning' | 'danger'), durationMs, actionLabel?, onAction?, timerId? }`.
- **Positionnement** : Affiché en bas à droite (ou en haut à droite selon la grille d'agencement) via `ToastContainerComponent` monté dans `app.component.html`.
- **Actions annulables (Undo 6s)** : Lorsque l'action est déclenchée, le toast affiche un bouton « Annuler » et un minuteur de 6 secondes. Si l'utilisateur clique sur « Annuler », la fonction `onAction()` est exécutée et le toast est retiré.

### 3. Gestion des suppressions différées et garantie de persistance (Flush)
- **Principe** : L'annulation consiste à différer l'opération destructive en base IndexedDB tout en l'appliquant immédiatement sur l'affichage réactif (UI optimiste) :
  - *Suppression de session* : La session est retirée du signal `sessions()` du tableau de bord. Un timer de 6 secondes est armé. Si le timer expire, `ChecklistSessionService.deleteSession(id)` est exécuté en base Dexie (nettoyant atomiquement la session et ses preuves). Si l'utilisateur clique sur « Annuler », la session est remise dans le signal `sessions()` et le timer est annulé.
  - *Suppression de preuve* : La preuve est retirée du signal du composant. Le `Blob` reste disponible en mémoire. Si annulé, la preuve est réinsérée dans le signal sans réécriture disque. Si expiration, `EvidenceService.deleteEvidence(id)` est appelé.
  - *Passage groupé à OK* : Avant d'exécuter `setAllRemainingToOk()`, un snapshot immuable de l'objet `answers` est conservé. Si l'utilisateur annule le toast, les réponses sont restaurées via `sessionService.mutate(session => session.answers = snapshot)`.
- **Flush sur sortie de page** : Pour éviter qu'une suppression ne soit perdue si l'utilisateur change de route ou ferme l'onglet pendant les 6 secondes, les services et composants enregistrent leurs callbacks de suppression dans une liste de vidage (`flushPendingDeletions()`), exécutée sur `ngOnDestroy` et sur l'événement navigateur `visibilitychange` (ou `beforeunload`).

### 4. Remplacement du `prompt()` de titre
- Dans `templates-list.component.ts`, le bouton « Nouvelle checklist » d'une carte de modèle redirige vers le tableau de bord avec paramètre d'URL : `/checklists?new=<templateId>`.
- Le tableau de bord (`checklists-dashboard.component.ts`) détecte ce query parameter et ouvre automatiquement sa modale existante « Nouvelle checklist » avec le modèle pré-rempli.

### 5. Accessibilité
- **Accordéons / Sections** : Remplacer les `<div>` cliquables par des `<button type="button" [attr.aria-expanded]="isOpen" ...>` stylisés.
- **Boutons icônes** : Vérifier que chaque `<button>` dépourvu de texte visible possède un `aria-label` précis (ex: « Supprimer la checklist », « Joindre un fichier », « Fermer la fenêtre »).
- **Focus visible** : S'assurer que le style `:focus-visible` applique un contour bien contrasté (`var(--color-primary)` ou 2px solid) sans être masqué par un `outline: none` orphelin.

## Risks / Trade-offs

- **[Risque] Perte d'une suppression différée lors d'une fermeture brutale d'onglet**
  → *Atténuation* : Branchement sur l'événement `visibilitychange` et `beforeunload` pour déclencher les suppressions en attente avant le déchargement.
- **[Risque] Risque de collision lors de suppressions multiples consécutives**
  → *Atténuation* : Chaque suppression différée possède son propre identifiant unique et son propre enregistrement dans le gestionnaire de suppressions en attente.
- **[Risque] Complexité dans les tests Vitest liée aux timers asynchrones de 6 secondes**
  → *Atténuation* : `ToastService` et les fonctions différées permettront d'exécuter immédiatement le flush ou accepteront une durée configurable (ou utilisation de `vi.useFakeTimers()`). `DialogService` exposera une API basée sur des Promises facilement mockable.
- **[Risque] Rétablissement incorrect des réponses lors de l'annulation de « Passer le reste à OK »**
  → *Atténuation* : Copie profonde (`structuredClone` ou shallow copy immuable du record de réponses) injectée exclusivement via `mutate()` afin de respecter les gardes de lecture seule et la détection de changements.

## Migration Plan

1. Implémentation des briques transverses : `DialogService`, `ToastService`, `DialogModalComponent`, `ToastContainerComponent`.
2. Intégration de l'hôte dans `AppComponent`.
3. Remplacement des dialogues dans `import-conflict.ts` (conflits d'import 3 choix).
4. Remplacement des confirmations et ajout de l'annulation dans `checklists-dashboard` et `checklist-runner`.
5. Remplacement des alertes de taille et ajout de l'annulation dans `evidence-attachment`.
6. Remplacement des confirmations et alertes dans `template-builder` et `templates-list`.
7. Ajout des améliorations d'accessibilité (`<button aria-expanded>`, `aria-label`).
8. Validation par tests unitaires et vérification `rg "\b(confirm|alert|prompt)\(" src/app -g "*.ts"`.

## Open Questions

Aucune question ouverte majeure. Les décisions s'alignent strictement sur les arbitrages de cadrage consignés dans `openspec/HANDOVER.md`.
