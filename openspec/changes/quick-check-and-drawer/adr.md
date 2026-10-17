# ADR Review Manifest

## ADR Review Completed

- Date: 2026-10-17
- Reviewer: Claude Code (à valider par Benoît)
- Change: `quick-check-and-drawer`

## In-Force ADR Context Reviewed

Aucun ADR n'est remplacé : les ADR 0001 à 0007 restent tous en vigueur (aucun champ `Supersedes` ne pointe vers eux).

- [adr/0001-use-dexie-indexeddb-storage.md](../../../adr/0001-use-dexie-indexeddb-storage.md) - Persistance Dexie : `evidenceLink` et l'événement de lien sont optionnels, donc pas de nouvelle version de base.
- [adr/0002-multi-sessions-and-routing-architecture.md](../../../adr/0002-multi-sessions-and-routing-architecture.md) - Contrôles polymorphes : le geste principal dépend du type de contrôle ; routage inchangé.
- [adr/0003-template-snapshot-in-session.md](../../../adr/0003-template-snapshot-in-session.md) - Criticité, preuve exigée et consigne sont lues dans la copie figée.
- [adr/0004-self-contained-session-exchange-file.md](../../../adr/0004-self-contained-session-exchange-file.md) - `formatVersion` reste à 1 : le lien de preuve et le N/A sur tout type sont des données optionnelles qui voyagent avec la session.
- [adr/0005-dialogs-toasts-and-delayed-undo.md](../../../adr/0005-dialogs-toasts-and-delayed-undo.md) - Annulation de 6 s de la suppression d'une preuve, enfin implémentée, avec vidage à la sortie de page et avant la clôture ; l'aide des raccourcis reprend le piégeage du focus.
- [adr/0006-template-builder-v2-cdk-and-form-guards.md](../../../adr/0006-template-builder-v2-cdk-and-form-guards.md) - Criticité et preuve exigée modifiées par des fonctions pures et immuables dans le builder.
- [adr/0007-step-flow-sections-as-dag-steps.md](../../../adr/0007-step-flow-sections-as-dag-steps.md) - Historique en ajout seul : le retrait de l'événement `evidence-removed` à l'annulation relève de l'exception « annulation de l'action qui l'a produit » ; règle « absent = ancien comportement » respectée.

## Repository-Level ADRs Created

- [adr/0008-lucide-icons-via-lucide-angular.md](../../../adr/0008-lucide-icons-via-lucide-angular.md) - Lucide via le paquet officiel `@lucide/angular` (compatible Angular 17 et plus ; `lucide-angular`, déprécié et limité à Angular 21, est proscrit) ; import statique icône par icône ; liste fermée pour les icônes choisies d'après une donnée ; migration composant par composant.
- [adr/0009-quick-check-input-rules.md](../../../adr/0009-quick-check-input-rules.md) - N/A écrit `status: 'NA'` sur tout type de contrôle ; preuve exigée garantie au geste et jamais par la résolution ni la clôture ; lien de preuve stocké sur la réponse (`evidenceLink`).

## Notes

- Le contrôleur d'interaction du runner (`RunnerController`, design D1) reste une décision d'implémentation de ce change, consignée dans `design.md`. Elle sera à promouvoir en ADR si `runner-path-view` la confirme pour le panneau d'étape.
- L'ADR 0009 n'a pas été validé en cadrage : le N/A pour tous les types est une décision validée (« Écarts retenus »), mais l'ADR tranche trois points que la feuille de route laissait ouverts (stockage de ce N/A, preuve supprimée après validation, stockage du lien).
