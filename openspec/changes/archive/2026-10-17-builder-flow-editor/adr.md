# ADR Review Manifest

## ADR Review Completed

- Date: 2026-10-17
- Reviewer: Claude Code (à valider par Benoît)
- Change: `builder-flow-editor`

## In-Force ADR Context Reviewed

Aucun ADR n'est remplacé : les ADR 0001 à 0010 restent tous en vigueur (aucun champ `Supersedes` ne pointe vers eux).

- [adr/0001-use-dexie-indexeddb-storage.md](../../../adr/0001-use-dexie-indexeddb-storage.md) - Aucun nouveau champ : pas de nouvelle version de base.
- [adr/0002-multi-sessions-and-routing-architecture.md](../../../adr/0002-multi-sessions-and-routing-architecture.md) - Routes du builder inchangées.
- [adr/0003-template-snapshot-in-session.md](../../../adr/0003-template-snapshot-in-session.md) - Le builder modifie la bibliothèque, jamais les copies figées ; les sessions en cours voient les changements par « Appliquer la mise à jour ».
- [adr/0004-self-contained-session-exchange-file.md](../../../adr/0004-self-contained-session-exchange-file.md) - `formatVersion` reste à 1 : aucune donnée nouvelle.
- [adr/0005-dialogs-toasts-and-delayed-undo.md](../../../adr/0005-dialogs-toasts-and-delayed-undo.md) - Suppression d'une section avec annulation de 6 s, dépendances restaurées comprises (existant) ; aucune nouvelle action destructive.
- [adr/0006-template-builder-v2-cdk-and-form-guards.md](../../../adr/0006-template-builder-v2-cdk-and-form-guards.md) - Appliqué jusqu'au bout : toutes les modifications passent par des helpers purs et immuables (design D1), ce qui rend fiable la garde des modifications non enregistrées ; glisser-déposer CDK conservé pour l'ordre d'affichage.
- [adr/0007-step-flow-sections-as-dag-steps.md](../../../adr/0007-step-flow-sections-as-dag-steps.md) - Le builder écrit explicitement les valeurs choisies (porte, jonction, politique de clôture d'un nouveau modèle) et rend la boucle impossible à la saisie (point 4), en plus du refus à l'enregistrement.
- [adr/0008-lucide-icons-via-lucide-angular.md](../../../adr/0008-lucide-icons-via-lucide-angular.md) - Palette par `LucideDynamicIcon` sur la liste fermée existante ; nouveaux composants entièrement en Lucide.
- [adr/0009-quick-check-input-rules.md](../../../adr/0009-quick-check-input-rules.md) - Non concerné : aucune règle de saisie modifiée.
- [adr/0010-step-graph-and-runner-views.md](../../../adr/0010-step-graph-and-runner-views.md) - Réutilisation du graphe unique et présentationnel (point 1), étendu d'une variante « structure » alimentée par le builder depuis le seul modèle ; une seule liste fermée d'icônes pour le runner et la palette (point 4).

## Repository-Level ADRs Created

- None: no major durable architectural decisions were introduced by this change.

## Notes

- La variante « structure » du graphe (design D3) prolonge l'ADR 0010 sans le contredire : le composant reste unique et présentationnel, c'est l'appelant qui fournit icône, légende et nom accessible.
- Les icônes de rôle de l'aperçu (design D4) et la conservation d'une porte sans dépendante (design D6) sont des choix d'interface réversibles, non promus en ADR.
