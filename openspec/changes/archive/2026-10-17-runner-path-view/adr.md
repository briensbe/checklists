# ADR Review Manifest

## ADR Review Completed

- Date: 2026-10-17
- Reviewer: Claude Code (à valider par Benoît)
- Change: `runner-path-view`

## In-Force ADR Context Reviewed

Aucun ADR n'est remplacé : les ADR 0001 à 0009 restent tous en vigueur (aucun champ `Supersedes` ne pointe vers eux).

- [adr/0001-use-dexie-indexeddb-storage.md](../../../adr/0001-use-dexie-indexeddb-storage.md) - Aucun nouveau champ : pas de nouvelle version de base. La préférence de vue va dans `localStorage`, hors session.
- [adr/0002-multi-sessions-and-routing-architecture.md](../../../adr/0002-multi-sessions-and-routing-architecture.md) - Routage inchangé : la vue chemin est un mode de la page du runner, pas une route.
- [adr/0003-template-snapshot-in-session.md](../../../adr/0003-template-snapshot-in-session.md) - Le graphe, les icônes et les portes sont lus dans la copie figée ; la conversion des noms d'icônes se fait à l'affichage, sans réécrire la copie.
- [adr/0004-self-contained-session-exchange-file.md](../../../adr/0004-self-contained-session-exchange-file.md) - `formatVersion` reste à 1 : aucune donnée nouvelle, les forçages existaient déjà.
- [adr/0005-dialogs-toasts-and-delayed-undo.md](../../../adr/0005-dialogs-toasts-and-delayed-undo.md) - Toast de « Passer le reste à OK » enrichi ; confirmation de clôture avec preuves manquantes par `DialogService` ; pas d'annulation par toast du forçage d'une porte, qui n'est pas une action destructive.
- [adr/0006-template-builder-v2-cdk-and-form-guards.md](../../../adr/0006-template-builder-v2-cdk-and-form-guards.md) - Builder non modifié ; identifiants de sections stables, dont dépendent le graphe et les forçages.
- [adr/0007-step-flow-sections-as-dag-steps.md](../../../adr/0007-step-flow-sections-as-dag-steps.md) - États d'étape toujours calculés ; seul le forçage est stocké ; une boucle dans les données laisse les étapes concernées débloquées et la vue chemin s'affiche quand même.
- [adr/0008-lucide-icons-via-lucide-angular.md](../../../adr/0008-lucide-icons-via-lucide-angular.md) - Icônes d'étape par `LucideDynamicIcon` et une liste fermée enregistrée par `provideLucideIcons`, avec icône par défaut (point 3) ; composants modifiés entièrement en Lucide (point 6).
- [adr/0009-quick-check-input-rules.md](../../../adr/0009-quick-check-input-rules.md) - « Passer le reste à OK » limité aux étapes débloquées, sans changer ses règles ; la clôture ne lit toujours pas les preuves : une preuve manquante demande une confirmation, sans bloquer.

## Repository-Level ADRs Created

- [adr/0010-step-graph-and-runner-views.md](../../../adr/0010-step-graph-and-runner-views.md) - Graphe d'étapes unique, présentationnel, tout en SVG et en pixels ; vues du runner pilotées par un seul `RunnerController` (décision promue depuis `quick-check-and-drawer`) ; portes appliquées à la saisie au niveau du service, sans cascade pour les actions groupées ; liste fermée d'icônes d'étape résolue à l'affichage ; effets décoratifs chargés à la demande et coupés si `prefers-reduced-motion`.

## Notes

- La note du manifeste de `quick-check-and-drawer` prévoyait de promouvoir le `RunnerController` en ADR si la vue chemin le confirmait : c'est le point 2 de l'ADR 0010.
- La confirmation de clôture avec des preuves manquantes (design D11) ne remplace pas l'ADR 0009 : la validation de clôture reste pure. Un vrai blocage demanderait un nouvel ADR.
- L'absence de révocation d'une porte forcée (design D9) reste une décision de ce change, réversible sans impact sur les données : elle n'est pas promue en ADR.
