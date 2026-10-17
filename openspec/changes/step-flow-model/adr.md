# ADR Review Manifest

## ADR Review Completed

- Date: 2026-10-17
- Reviewer: Claude Code et Benoît
- Change: `step-flow-model`

## In-Force ADR Context Reviewed

- [adr/0001-use-dexie-indexeddb-storage.md](../../../adr/0001-use-dexie-indexeddb-storage.md) - Persistance Dexie : les nouveaux champs étant optionnels, aucune nouvelle version de base n'est nécessaire.
- [adr/0002-multi-sessions-and-routing-architecture.md](../../../adr/0002-multi-sessions-and-routing-architecture.md) - Sessions isolées par UUID et contrôles polymorphes, inchangés.
- [adr/0003-template-snapshot-in-session.md](../../../adr/0003-template-snapshot-in-session.md) - Les états d'étape se calculent sur la copie figée ; l'application d'une version conserve l'historique et purge les portes forcées des sections supprimées.
- [adr/0004-self-contained-session-exchange-file.md](../../../adr/0004-self-contained-session-exchange-file.md) - Ajout de champs optionnels : `formatVersion` reste à 1 ; validation du graphe à l'import.
- [adr/0005-dialogs-toasts-and-delayed-undo.md](../../../adr/0005-dialogs-toasts-and-delayed-undo.md) - Annulation de suppression de section (dépendances restaurées) et de preuve (événement d'historique retiré).
- [adr/0006-template-builder-v2-cdk-and-form-guards.md](../../../adr/0006-template-builder-v2-cdk-and-form-guards.md) - Mises à jour immuables et protection des identifiants, étendues aux identifiants de sections.

## Repository-Level ADRs Created

- [adr/0007-step-flow-sections-as-dag-steps.md](../../../adr/0007-step-flow-sections-as-dag-steps.md) - Section = étape d'un graphe orienté sans cycle, règle « absent = ancien comportement » sans migration, états d'étape calculés (seuls les forçages de porte souple sont stockés), tolérance aux modèles invalides, historique des contrôles en ajout seul.

## Notes

- Aucun ADR antérieur n'est remplacé : l'ADR 0007 prolonge les ADR 0003 et 0004.
- Le choix de Lucide pour les icônes relèvera de l'ADR du change `quick-check-and-drawer`, qui introduit la dépendance.
