# ADR Review Manifest

## ADR Review Completed

- Date: 2026-10-16
- Reviewer: Assistant Antigravity & Équipe Projet
- Change: `template-builder-v2`

## In-Force ADR Context Reviewed

- [adr/0001-use-dexie-indexeddb-storage.md](adr/0001-use-dexie-indexeddb-storage.md) - Persistance des modèles et sessions en base locale Dexie sans backend.
- [adr/0002-multi-sessions-and-routing-architecture.md](adr/0002-multi-sessions-and-routing-architecture.md) - Architecture de routage et découpage des pages du template builder.
- [adr/0003-template-snapshot-in-session.md](adr/0003-template-snapshot-in-session.md) - Copie figée du modèle dans les sessions et nécessité de préserver la stabilité des `id` d'items pour le rebase.
- [adr/0004-self-contained-session-exchange-file.md](adr/0004-self-contained-session-exchange-file.md) - Échange et normalisation des structures de templates et de sessions.
- [adr/0005-dialogs-toasts-and-delayed-undo.md](adr/0005-dialogs-toasts-and-delayed-undo.md) - Remplacement total des fenêtres natives par `DialogService` et `ToastService`, réutilisés pour les gardes et notifications du builder.

## Repository-Level ADRs Created

- [adr/0006-template-builder-v2-cdk-and-form-guards.md](adr/0006-template-builder-v2-cdk-and-form-guards.md) - Décision d'adopter `@angular/cdk/drag-drop` pour le réordonnancement par glisser-déposer, d'implémenter une garde `CanDeactivate` / `beforeunload` basée sur un snapshot immuable et `DialogService`, et de protéger l'intégrité des identifiants et des dépendances de contexte.

## Notes

- L'ADR 0006 s'inscrit en continuité directe de l'ADR 0005 (dialogues et toasts) et de l'ADR 0003 (copies figées et rebase de templates).
- Aucune décision antérieure n'est remise en cause ni rendue obsolète.
