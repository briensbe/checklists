## 1. Ménage et préparation

- [x] 1.1 Supprimer `bash.exe.stackdump` à la racine du dépôt
- [x] 1.2 Retirer de `.agents/AGENTS.md` les règles Supabase hors sujet
- [x] 1.3 Remplacer `README.md` par une présentation réelle (fonctionnalités, `pnpm install`, `pnpm start`, `pnpm test`, `pnpm deploy`)
- [x] 1.4 Créer `openspec/BACKLOG.md` (comparaison de sessions, PWA hors ligne, synchronisation, photo caméra) avec pour chaque entrée la raison du report et le déclencheur de reconsidération
- [x] 1.5 Passer `<html lang="fr">` dans `src/index.html`
- [x] 1.6 Ajouter `fake-indexeddb` en devDependency (`pnpm add -D fake-indexeddb`)

## 2. Modèle de données

- [x] 2.1 Ajouter dans `checklist.model.ts` : `ChoiceTone`, `VisibilityCondition`, `SessionStatus`, `SessionClosure`
- [x] 2.2 Remplacer `ChecklistItemTemplate.mode` par `visibleIf?: VisibilityCondition` et `CustomChoiceOption.color` par `tone: ChoiceTone`
- [x] 2.3 Ajouter `updatedAt: string` sur `ChecklistTemplate`
- [x] 2.4 Ajouter sur `ChecklistSession` : `templateSnapshot`, `status`, `closures`, `structureUnavailable?`
- [x] 2.5 Mettre à jour `src/assets/templates/delivery-audit.json` au nouveau format (`visibleIf`, `tone`, `updatedAt`)

## 3. Normalisation et migration (fonctions pures, TDD)

- [x] 3.1 Créer `src/app/data/migrations.ts` avec `normalizeTemplate(raw)` (mode → visibleIf, color → tone selon la table de correspondance, `updatedAt` par défaut), idempotente
- [x] 3.2 Tests `normalizeTemplate` : ancien format complet, format courant inchangé, couleurs inconnues/hexadécimales → `neutral`, `mode: 'all'` sans condition
- [x] 3.3 Implémenter `migrateSessionV3(rawSession, templatesById, now)` : snapshot normalisé, `updatedAt` du snapshot aligné sur le template, `status: 'in_progress'`, `closures: []`, cas orphelin (`structureUnavailable`, snapshot vide « Modèle indisponible »)
- [x] 3.4 Tests `migrateSessionV3` : session nominale, session `mode=patch`, session orpheline, réponses conservées
- [x] 3.5 Déclarer `this.version(3)` dans `app-database.service.ts` avec un `upgrade` qui applique `normalizeTemplate` à la table `templates` puis `migrateSessionV3` à la table `sessions`
- [x] 3.6 Test d'intégration `fake-indexeddb` : créer une base v2 avec données représentatives, rouvrir en v3, vérifier templates et sessions migrés
- [x] 3.7 Brancher `normalizeTemplate` dans `TemplateService.importTemplate` et dans le chargement du seed

## 4. Règles métier partagées (fonctions pures, TDD)

- [x] 4.1 Créer `src/app/domain/session-rules.ts` avec `isAnswered(item, answer)` et `applicableItems(template, contextValues)` (règle `visibleIf`)
- [x] 4.2 Implémenter `computeMetrics(session)` à partir du snapshot
- [x] 4.3 Implémenter `validateForCompletion(session)` renvoyant les `CompletionIssue` (contexte requis, non répondu, KO sans commentaire, N/A sans motif quand exigé), en ignorant les items non applicables
- [x] 4.4 Implémenter `diffTemplates(snapshot, current, session, evidenceItemIds)` → `added`, `removed`, `removedWithData`
- [x] 4.5 Tests unitaires couvrant chaque scénario des specs `checklist-execution-runner`, `session-lifecycle` (validation) et `session-template-snapshot` (diff)

## 5. Service de session

- [x] 5.1 Exposer `currentTemplate` (computed sur le snapshot) et `loadState` (`loading | ready | not-found`) ; retirer la dépendance à `TemplateService.activeTemplate()` dans `applicableItems`, `metrics` et `collapseAll`
- [x] 5.2 `createSession` : copier le template normalisé via `structuredClone`, initialiser `status` et `closures`
- [x] 5.3 Introduire `mutate(fn, { immediate })` comme point d'entrée unique des modifications, avec garde `completed`
- [x] 5.4 Implémenter `scheduleSave` (debounce 400 ms pour commentaire, extra, contexte ; immédiat sinon), `flushPendingSave`, et la mise à jour ciblée de `allSessions` sans relecture globale
- [x] 5.5 Implémenter `completeSession()` (renvoie les anomalies ou clôture) et `reopenSession()`
- [x] 5.6 Implémenter `applyTemplateUpdate(sessionId)` en transaction Dexie (`sessions` + `evidences`) : remplacement du snapshot, purge des réponses et preuves des items supprimés, valeurs par défaut des nouveaux champs de contexte
- [x] 5.7 Exposer un `hasTemplateUpdate(session)` (template d'origine présent, `updatedAt` plus récent, session en cours)
- [x] 5.8 Tests du service : garde lecture seule, debounce (timers simulés Vitest), clôture/réouverture et historique, mise à jour ciblée de `allSessions`

## 6. Template service et builder

- [x] 6.1 Renseigner `updatedAt` à chaque `saveTemplate` et à chaque import
- [x] 6.2 Builder : remplacer la saisie de couleur des choix par un sélecteur des 5 tons, ton par défaut `neutral`
- [x] 6.3 Builder : préserver `visibleIf`, `requireNaReason` et `extraField` existants lors de l'édition d'un item (aucune perte silencieuse)

## 7. Styles

- [x] 7.1 Définir dans `src/styles.css` les variables `--tone-{success,danger,warning,info,neutral}-{bg,fg,border}` pour le thème clair et le thème sombre
- [x] 7.2 Remplacer le `[style.background-color]` des choix dans `checklist-item` (et l'aperçu du builder) par des classes `tone-*`

## 8. Interface du runner

- [x] 8.1 Afficher l'état « Session introuvable » avec lien vers `/checklists`
- [x] 8.2 Afficher l'état « Structure du modèle indisponible » pour une session `structureUnavailable`
- [x] 8.3 Propager un input `readonly` vers `audit-summary`, `checklist-section`, `checklist-item` et `evidence-attachment` ; désactiver saisies, « Passer le reste à OK » et réinitialisation en session terminée
- [x] 8.4 Ajouter le bouton « Terminer » et le panneau d'anomalies cliquables (dépli de section, défilement, focus via ancres `item-<id>` / `ctx_<id>`)
- [x] 8.5 Afficher le statut, la date de clôture et le bouton « Rouvrir » (confirmation) pour une session terminée
- [x] 8.6 Ajouter le badge « Modèle mis à jour » et la modale `template-update-modal` (récapitulatif ajouts / suppressions, signalement des données perdues, `role="dialog"`, Échap)
- [x] 8.7 Appeler `flushPendingSave` dans `ngOnDestroy` du runner et sur `visibilitychange`

## 9. Tableau de bord

- [x] 9.1 Remplacer `calculateStats` par `computeMetrics` et afficher le nom du template depuis le snapshot
- [x] 9.2 Afficher le statut de chaque session et le badge « Modèle mis à jour »
- [x] 9.3 Ajouter le filtre « Toutes / En cours / Terminées »

## 10. Preuves

- [x] 10.1 Rendre `sessionId` obligatoire dans `EvidenceService` (supprimer le défaut `'current'`) et refuser ajout/suppression sur une session terminée
- [x] 10.2 Contrôler la limite de 50 Mo fichier par fichier et signaler les fichiers refusés par nom
- [x] 10.3 Traiter tous les fichiers d'un glisser-déposer
- [x] 10.4 Révoquer les URL blob à la suppression d'une preuve et dans `ngOnDestroy`

## 11. Typage et vérification finale

- [x] 11.1 Supprimer les `any` restants (`checklist-runner.component.ts`, `export.service.ts`) ; adapter `export.service.ts` à `templateSnapshot` sans changer le format des exports
- [x] 11.2 Vérifier `pnpm build` et `pnpm test` sans erreur
- [x] 11.3 Vérification manuelle dans le navigateur : migration d'une base v2 existante, création, saisie, clôture refusée puis acceptée, réouverture, modification puis suppression du template d'origine, application d'une mise à jour, dark mode des tons
