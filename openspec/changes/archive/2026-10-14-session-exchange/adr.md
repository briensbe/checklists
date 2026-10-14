# ADR Review Manifest

## ADR Review Completed

- Date: 2026-10-14
- Reviewer: Claude (session de planification, feuille de route validée avec Benoît)
- Change: session-exchange

## In-Force ADR Context Reviewed

- adr/0001-use-dexie-indexeddb-storage.md - toujours en vigueur ; les preuves restent des `Blob` en base, le base64 n'est utilisé que dans le fichier d'échange.
- adr/0002-multi-sessions-and-routing-architecture.md - toujours en vigueur ; l'UUID de session sert de clé de détection des conflits à l'import.
- adr/0003-template-snapshot-in-session.md - toujours en vigueur ; la copie figée rend la session autoportante et fonde le format d'échange ; l'import réutilise la normalisation commune qu'il impose.

## Repository-Level ADRs Created

- adr/0004-self-contained-session-exchange-file.md - une session s'échange en un seul fichier JSON à enveloppe versionnée, preuves base64 optionnelles, import rétro-compatible et conflits d'identifiant tranchés explicitement.

## Notes

- Les autres décisions du design (double `confirm()` provisoire, identifiant de copie des templates, découpage base64 par tranches, miniatures via canvas dans le PDF, rapports génériques) sont tactiques à ce change et ne justifient pas d'ADR propre.
