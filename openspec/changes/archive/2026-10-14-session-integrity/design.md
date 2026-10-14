## Context

L'application est un client Angular 22 sans backend, utilisé par une seule personne sur poste de bureau. Les données vivent dans IndexedDB via Dexie (ADR 0001), avec une table `sessions` indépendante par checklist et un routage par UUID (ADR 0002).

État actuel problématique :
- `ChecklistSession` ne stocke que `templateId`. Le runner résout la structure via `TemplateService.activeTemplate()`, qui reste sur un autre template si l'identifiant est introuvable : les sections s'affichent vides (`checklist-session.service.ts`, `applicableItems`).
- La logique d'applicabilité (`mode: 'all' | 'patch'` lu dans `contextValues['mode']`) est codée en dur dans le service ; le dashboard recalcule sa progression avec sa propre logique qui ignore cette condition.
- `persistSession` écrit en base **et relit toutes les sessions** à chaque frappe.
- Les couleurs de choix sont des chaînes libres (`'slate'`, `'yellow'`, hexadécimal...) injectées dans `[style.background-color]`.
- Aucune notion de statut de session ; les règles KO/N/A ne sont que visuelles.

Contraintes du projet : pnpm, composants standalone, contrôle de flux `@if/@for`, typage strict sans `any`, structure à trois fichiers par composant, artefacts en français.

## Goals / Non-Goals

**Goals:**
- Rendre chaque session autonome vis-à-vis de la bibliothèque de templates.
- Introduire un cycle de vie `in_progress` / `completed` avec validation bloquante.
- Faire toutes les évolutions de format de données en **une seule** migration Dexie (v3), testée.
- Centraliser les règles métier (applicabilité, métriques, validation) dans des fonctions pures partagées et testées.
- Corriger les défauts de fiabilité identifiés (autosave, session introuvable, preuves, typage).

**Non-Goals:**
- Import/export JSON de session, exports Excel/PDF génériques (change `session-exchange`).
- Remplacement des `confirm()` natifs par un service de dialogue et mécanisme d'annulation (change `ui-dialogs-and-undo`) : ce change utilise encore `confirm()` et une modale dédiée simple.
- Interface d'édition de `visibleIf`, `contextSchema`, `requireNaReason`, `extraField` dans le builder (change `template-builder-v2`) : seul le sélecteur de ton est adapté ici, pour que le builder ne produise plus de données invalides.

## Decisions

### D1 — Copie figée complète du template dans la session

`ChecklistSession` gagne `templateSnapshot: ChecklistTemplate` (copie profonde via `structuredClone`). `templateId` est conservé comme **référence d'origine**, utilisée uniquement pour détecter une nouvelle version et appliquer une mise à jour.

*Analogie Java* : on passe d'une association `@ManyToOne` vers une entité mutable à un **objet valeur embarqué** (`@Embedded`) copié au moment de la création, comme une ligne de commande qui recopie le prix du produit au lieu de pointer vers le catalogue.

Alternatives considérées :
- *Table `templateVersions` immuable, la session référence `(templateId, version)`* : déduplique les données mais impose au builder de créer une version à chaque enregistrement, de gérer le ramasse-miettes des versions orphelines et complique l'export d'une session. Rejeté : un template pèse quelques Ko et le nombre de sessions reste faible pour un usage mono-utilisateur.
- *Snapshot partiel (uniquement les items répondus)* : ne permet pas de réafficher la structure si le template disparaît. Rejeté.

### D2 — Migration Dexie v3 unique, logique en fonctions pures

Toutes les évolutions de format (snapshot, `updatedAt`, `visibleIf`, `tone`, `status`, `closures`) sont appliquées dans le seul `this.version(3).upgrade(...)`. La logique de transformation vit dans un module pur `src/app/data/migrations.ts` :
- `normalizeTemplate(raw: unknown): ChecklistTemplate` — convertit `mode` → `visibleIf`, `color` → `tone`, renseigne `updatedAt`. Idempotente. **Réutilisée par l'import de template** (une seule source de vérité pour « ancien format → format courant »).
- `migrateSessionV3(rawSession, templatesById): ChecklistSession` — construit le snapshot à partir du template normalisé, initialise `status: 'in_progress'` et `closures: []`.

L'`upgrade` Dexie se contente d'itérer sur les tables et d'appeler ces fonctions. Elles sont testables sans IndexedDB ; un test d'intégration supplémentaire ouvre une base v2 puis v3 avec `fake-indexeddb` (devDependency) pour valider le câblage.

*Subtilité* : `updatedAt` des templates existants est fixé à l'instant de migration, et chaque snapshot reçoit le même `updatedAt` que son template : aucune session ne présente donc de badge « Modèle mis à jour » juste après la migration.

*Session orpheline* (template déjà supprimé avant la migration) : impossible de reconstituer libellés et sections à partir des seules réponses. Le snapshot est créé avec `sections: []`, `contextSchema: []`, le nom « Modèle indisponible » et un drapeau `structureUnavailable: true` sur la session. Les réponses sont conservées pour l'export JSON futur.

Alternative : plusieurs versions Dexie successives (v3 snapshot, v4 tons...) — rejetée lors du cadrage pour ne tester et livrer qu'une migration.

### D3 — Conditions d'affichage génériques `visibleIf`

```ts
interface VisibilityCondition { fieldId: string; equals: string[] }
```
Règle : item applicable ⇔ pas de condition, ou `equals.includes(contextValues[fieldId] ?? '')`. Valeur absente = chaîne vide, donc non applicable sauf si `''` est explicitement listé. Comportement identique à l'existant pour `mode: 'patch'` (l'ancien code considérait un `mode` absent comme `'full'`).

Une seule condition par item (pas de ET/OU) : suffisant pour les besoins connus, extensible plus tard en tableau sans casser le format.

### D4 — Tons fixes pour les choix

```ts
type ChoiceTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';
```
`CustomChoiceOption.color` est **supprimé** au profit de `tone`. Le rendu passe par une classe `tone-<nom>` et des variables CSS `--tone-<nom>-bg / -fg / -border` définies dans `src/styles.css` pour le thème clair et redéfinies pour le thème sombre. Plus aucun `[style.background-color]` dynamique.

Alternative : garder le nom de champ `color` en restreignant son type — rejetée : le même nom avec une sémantique différente rendrait ambigus les anciens fichiers JSON et masquerait les oublis de migration au typage.

### D5 — Module de règles métier pur

`src/app/domain/session-rules.ts` expose des fonctions sans dépendance Angular :
- `applicableItems(template, contextValues)` → items enrichis de `sectionId` / `sectionTitle` ;
- `computeMetrics(session)` → `MetricsSummary` (lit `session.templateSnapshot`) ;
- `validateForCompletion(session)` → `CompletionIssue[]` avec `{ kind: 'context-required' | 'unanswered' | 'ko-without-comment' | 'na-without-reason', itemId?, fieldId?, label, sectionTitle? }` ;
- `isAnswered(item, answer)` — règle unique de « répondu » par type de contrôle (statut non nul, case cochée, choix sélectionné).

Le service expose ces résultats via des `computed()` ; le dashboard appelle `computeMetrics` par carte. C'est l'équivalent d'un *domain service* sans état en Java : facilement testable unitairement, et impossible à faire diverger entre deux écrans.

*Subtilité* : `isAnswered` sur un `checkbox` non coché retourne `false`. Un item checkbox ne peut donc être « terminé » que coché ; c'est l'interprétation retenue (une case à cocher représente une action à réaliser). Si un item checkbox doit pouvoir rester non coché, il faudra le passer en `status` avec N/A.

### D6 — Le runner lit le snapshot

`ChecklistSessionService` expose `currentTemplate = computed(() => this.currentSession()?.templateSnapshot ?? null)`. Le runner, `checklist-section`, `audit-summary` et `collapseAll` l'utilisent à la place de `TemplateService.activeTemplate()`. `loadSession` n'appelle plus `selectTemplate`. `TemplateService` reste la source de la bibliothèque (liste, builder, import).

Un état de chargement explicite `loadState = signal<'loading' | 'ready' | 'not-found'>` pilote l'affichage « Session introuvable ».

### D7 — Sauvegarde automatique : état immédiat, écriture différée

- Chaque mutation produit une nouvelle session immuable, posée **immédiatement** dans `currentSession` (l'UI réagit à la frappe).
- `scheduleSave(session, { immediate })` :
  - actions discrètes (statut, case, choix, clôture...) → écriture immédiate ;
  - saisies textuelles (commentaire, champ additionnel, contexte) → `setTimeout` de 400 ms réinitialisé à chaque frappe (*debounce*), une seule écriture à la fin.
  - Toute écriture immédiate annule et absorbe une écriture différée en attente (la dernière version de la session gagne).
- `flushPendingSave()` est appelé dans `ngOnDestroy` du runner et sur `visibilitychange` (onglet masqué).
- Après écriture, `allSessions` est mis à jour en remplaçant l'entrée par son `id` (`update(list => ...)`), sans `toArray()` global.

*Subtilité* : `beforeunload` ne garantit pas la fin d'une transaction IndexedDB asynchrone ; `visibilitychange` (déclenché avant la fermeture d'onglet dans les navigateurs modernes) est le signal le plus fiable. La fenêtre de perte possible est donc au plus les 400 dernières ms de frappe en cas de crash brutal.

Alternative : `liveQuery()` Dexie pour garder `allSessions` réactif — écartée pour ce change : elle relirait aussi toute la table à chaque écriture, ce qu'on cherche justement à éviter.

### D8 — Cycle de vie

```ts
type SessionStatus = 'in_progress' | 'completed';
interface SessionClosure { closedAt: string; reopenedAt?: string }
```
- `completeSession()` : calcule `validateForCompletion` ; si non vide, renvoie les anomalies sans rien écrire ; sinon passe à `completed`, ajoute `{ closedAt }`, écrit immédiatement (après `flushPendingSave`).
- `reopenSession()` : confirmation (`confirm()` natif, remplacé au change 3), renseigne `reopenedAt` sur la dernière clôture, repasse à `in_progress`.
- Garde centrale : une méthode privée `mutate(fn)` utilisée par toutes les opérations de modification ; elle ignore l'appel si `status === 'completed'`. Les composants reçoivent un `readonly` (`input()`) pour désactiver les contrôles. `EvidenceService.add/delete` vérifient aussi le statut.
- Panneau d'anomalies : liste cliquable dans `audit-summary` ; le clic déplie la section (`collapsedSections`) puis appelle `scrollIntoView` + `focus()` sur l'élément d'ancre `id="item-<itemId>"` ou `id="ctx_<fieldId>"` (identifiant déjà porté par les champs de contexte).

### D9 — Application d'une nouvelle version du template

Fonction pure `diffTemplates(snapshot, current)` → `{ added: Item[], removed: Item[], removedWithData: Item[] }` (données = réponse non vide ou preuves). Le récapitulatif est affiché dans une modale dédiée minimale (`template-update-modal`, construite comme `json-draft-modal` : `role="dialog"`, Échap). À la confirmation, dans une transaction Dexie `rw` sur `sessions` et `evidences` : remplacement du snapshot, purge des réponses des items supprimés, suppression de leurs preuves, ajout des valeurs par défaut des nouveaux champs de contexte.

Badge : `computed` comparant `snapshot.updatedAt < template.updatedAt` pour le template de même `templateId` présent dans `TemplateService.availableTemplates()`, et `status === 'in_progress'`.

### D10 — Preuves

- Constante `MAX_EVIDENCE_SIZE = 50 * 1024 * 1024` vérifiée avant écriture, fichier par fichier ; les fichiers refusés sont signalés par nom (`alert()` pour l'instant, toast au change 3).
- Le drop itère sur `dataTransfer.files`.
- `URL.createObjectURL` mis en cache par `id` et révoqué à la suppression de la preuve et dans `ngOnDestroy`.
- `sessionId` devient un paramètre obligatoire de `EvidenceService` (plus de défaut `'current'`).

## Risks / Trade-offs

- **[Échec de la migration v3 au premier chargement, base inutilisable]** → La transformation est en fonctions pures couvertes par des tests sur des jeux de données représentatifs (seed actuel, session `mode=patch`, session orpheline, choix aux couleurs variées) plus un test `fake-indexeddb` v2→v3. En cas d'exception, Dexie annule la transaction d'upgrade et la base reste en v2 : l'utilisateur peut revenir à la version précédente du site.
- **[Taille de la base accrue par la duplication des templates]** → Quelques Ko par session, négligeable face aux preuves binaires.
- **[Perte d'au plus 400 ms de frappe en cas de crash]** → Accepté ; `visibilitychange` couvre les fermetures normales.
- **[Purge de réponses lors d'une mise à jour de template]** → Récapitulatif explicite qui signale les items supprimés porteurs de données ; action jamais automatique.
- **[Sessions orphelines sans structure]** → Cas limité aux sessions dont le template avait été supprimé avant la migration ; données conservées pour l'export JSON (change 2).
- **[`confirm()` / `alert()` natifs encore présents]** → Temporaire, remplacés par le change `ui-dialogs-and-undo`.
- **[Item checkbox non coché bloque la clôture]** → Choix documenté (D5) ; contournable par le type `status`.

## Migration Plan

1. Déployer la nouvelle version (GitHub Pages) : au premier chargement, Dexie détecte la version 3 et exécute l'upgrade dans une transaction unique.
2. Le seed `delivery-audit.json` est lui aussi passé dans `normalizeTemplate` au chargement (il peut rester au format ancien, mais il est mis à jour au nouveau format pour servir d'exemple).
3. **Retour arrière** : une base v3 ne peut pas être rouverte par l'ancienne version (Dexie refuse une version inférieure). Avant déploiement, exporter les templates en JSON ; ils restent réimportables par la nouvelle version grâce à `normalizeTemplate`.

## Open Questions

- Aucune décision bloquante restante. L'ADR 0002 n'est pas remis en cause : il fixe l'isolation des sessions par UUID, que la copie figée renforce. La copie figée est consignée dans un nouvel ADR 0003 qui le complète sans le remplacer.
