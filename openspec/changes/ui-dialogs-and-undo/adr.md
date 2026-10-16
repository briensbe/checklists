# ADR Review Manifest

## ADR Review Completed

- Date: 2026-10-16
- Reviewer: Antigravity
- Change: ui-dialogs-and-undo

## In-Force ADR Context Reviewed

- `adr/0001-use-dexie-indexeddb-storage.md` : Stockage local IndexedDB avec Dexie sans backend.
- `adr/0002-multi-sessions-and-routing-architecture.md` : Architecture multi-sessions et routage SPA.
- `adr/0003-template-snapshot-in-session.md` : Copie figée du template dans chaque session.
- `adr/0004-self-contained-session-exchange-file.md` : Fichier d'échange autoportant et gestion des conflits d'import.

## Repository-Level ADRs Created

- `adr/0005-dialogs-toasts-and-delayed-undo.md` : Dialogues modaux maison, toasts empilables et modèle d'annulation par persistance différée avec vidage garanti (`flush`).

## Notes

La décision formalise la proscription définitive des boîtes de dialogue natives du navigateur (`alert`, `confirm`, `prompt`) au profit d'un `DialogService` accessible (focus trap, Échap) et d'un système de Toasts empilables avec annulation réversible pendant 6 secondes.
