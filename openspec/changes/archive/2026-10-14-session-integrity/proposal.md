## Why

Les sessions de checklist dépendent aujourd'hui du template **vivant** : modifier un template altère rétroactivement les audits en cours ou passés, et le supprimer rend leurs sessions inexploitables (sections vides). Par ailleurs aucune session ne peut être « terminée » : les règles (commentaire sur KO, motif N/A, contexte requis) ne sont que visuelles, ce qui retire toute valeur probante à un audit. Ce change consolide l'intégrité des données avant toute nouvelle fonctionnalité, car chaque évolution future du modèle aggraverait la dette de migration.

## What Changes

- **Snapshot du template dans la session** : à la création, la structure complète du template est copiée dans la session ; le runner et le dashboard lisent ce snapshot. Modifier ou supprimer un template n'affecte plus les sessions existantes.
- **Mise à jour manuelle vers la nouvelle version du template** : badge « Modèle mis à jour » sur une session en cours dont le snapshot est antérieur au template ; application après récapitulatif (items ajoutés / supprimés), en conservant les réponses des items de même identifiant.
- **Cycle de vie de session** : statut `in_progress` / `completed`, bouton « Terminer » avec validation **bloquante** (contexte requis, KO sans commentaire, N/A sans motif quand exigé, items non répondus), session terminée en lecture seule, réouverture tracée dans un historique de clôtures, filtre par statut sur le dashboard.
- **Conditions d'affichage génériques** : **BREAKING** (format de template) — le champ `mode: 'all' | 'patch'` est remplacé par `visibleIf: { fieldId, equals[] }`. Migration automatique des templates stockés, des snapshots et des JSON importés.
- **Palette de couleurs fixe pour les choix** : **BREAKING** (format de template) — la couleur libre `color` est remplacée par un `tone` parmi `success | danger | warning | info | neutral`, lié aux variables CSS du thème (clair/sombre). Migration automatique des anciennes valeurs.
- **`updatedAt` sur les templates**, mis à jour à chaque enregistrement.
- **Migration Dexie v3 unique** regroupant toutes ces évolutions de modèle.
- **Correctifs de fiabilité** : sauvegarde automatique différée (400 ms) sans rechargement de toutes les sessions ; calcul de progression unique partagé entre dashboard et runner ; page « Session introuvable » ; preuves (limite 50 Mo réellement contrôlée, dépôt de plusieurs fichiers, libération des URL blob, plus d'identifiant de session par défaut `'current'`) ; `lang="fr"` ; suppression des `any`.
- **Tests** Vitest sur les règles de session (applicabilité, métriques, validation) et sur la migration v3.
- **Ménage** : README réel, retrait des règles Supabase hors sujet de `.agents/AGENTS.md`, suppression de `bash.exe.stackdump`, création de `openspec/BACKLOG.md`.

Hors périmètre (changes suivants) : import/export JSON de session avec preuves et exports Excel/PDF génériques (`session-exchange`), remplacement des dialogues natifs et annulation (`ui-dialogs-and-undo`), interface avancée du builder (`template-builder-v2`), productivité dashboard/runner (`runner-and-dashboard-productivity`).

## Capabilities

### New Capabilities
- `session-lifecycle` : statut d'une session (en cours / terminée), validation bloquante à la clôture, lecture seule, réouverture et historique des clôtures.
- `session-template-snapshot` : copie figée du template dans la session, autonomie vis-à-vis de la bibliothèque, détection et application manuelle d'une nouvelle version du template.

### Modified Capabilities
- `checklist-sessions-management` : création avec snapshot et statut initial, progression du dashboard alignée sur le runner, filtre par statut, comportement d'une session introuvable.
- `checklist-execution-runner` : le conditionnement contextuel devient générique (`visibleIf`) au lieu du mode `patch`/`full` codé en dur.
- `checklist-template-management` : horodatage `updatedAt`, normalisation des anciens formats (`mode`, `color`) au chargement et à l'import, palette de tons fixe.
- `template-builder` : la configuration d'un choix propose un ton parmi la palette fixe au lieu d'une couleur libre.
- `audit-persistence-export` : la sauvegarde automatique est différée et ciblée sur la session modifiée.
- `evidence-attachment` : limite de taille contrôlée et dépôt simultané de plusieurs fichiers.

## Impact

- **Modèle** : `src/app/models/checklist.model.ts` (`ChecklistSession`, `ChecklistTemplate`, `ChecklistItemTemplate`, `CustomChoiceOption`).
- **Persistance** : `src/app/services/app-database.service.ts` (version 3 + upgrade), nouveau module de migration pur testable.
- **Services** : `checklist-session.service.ts` (refonte autosave, lecture du snapshot, cycle de vie), `template.service.ts` (`updatedAt`, normalisation à l'import), `evidence.service.ts`.
- **Nouveau module de règles métier pur** (applicabilité, métriques, validation de clôture), utilisé par le service, le dashboard et les tests.
- **Composants** : `checklist-runner`, `checklists-dashboard`, `audit-summary`, `checklist-item`, `checklist-section`, `evidence-attachment`, `template-builder` (sélecteur de ton minimal), `src/styles.css` (variables `--tone-*`).
- **Données existantes** : migrées automatiquement au premier chargement ; les sessions dont le template a été supprimé reçoivent un snapshot vide signalé comme « structure indisponible ».
- **Fichiers JSON de template déjà exportés** : restent importables (normalisation à l'import).
- **Dépendances** : ajout de `fake-indexeddb` en devDependency pour tester la migration Dexie.
- **Documentation** : `README.md`, `.agents/AGENTS.md`, `openspec/BACKLOG.md`, ADR 0003.
