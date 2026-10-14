# ADR Review Manifest

## ADR Review Completed

- Date: 2026-10-14
- Reviewer: Claude (session de cadrage avec Benoît)
- Change: session-integrity

## In-Force ADR Context Reviewed

- adr/0001-use-dexie-indexeddb-storage.md - toujours en vigueur ; la migration v3 s'appuie sur le mécanisme de versions Dexie qu'il motive.
- adr/0002-multi-sessions-and-routing-architecture.md - toujours en vigueur ; l'isolation des sessions par UUID et le routage sont conservés, la copie figée les renforce sans les remplacer.

## Repository-Level ADRs Created

- adr/0003-template-snapshot-in-session.md - chaque session embarque une copie figée de son template ; mise à jour manuelle vers une nouvelle version ; normalisation unique des anciens formats.

## Notes

- Les autres décisions du design (migration unique v3, tons fixes, autosave différée, module de règles pur) sont tactiques à ce change et ne justifient pas d'ADR propre.
