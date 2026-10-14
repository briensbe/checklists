# Checklists & Audit

Application Angular 100 % navigateur pour exécuter des checklists d'audit (ex. contrôle de livraison) à partir de modèles personnalisables. Aucune donnée ne quitte le poste : tout est stocké dans IndexedDB.

## Fonctionnalités

- **Modèles (templates)** : bibliothèque, constructeur visuel (sections, items, types de contrôle), import / export JSON.
- **Types de contrôle** : statut OK / KO / N/A, case à cocher (avec horodatage optionnel), choix personnalisés (tons de couleur, choix bloquants).
- **Conditions d'affichage** : un item peut n'être visible que pour certaines valeurs d'un champ de contexte (`visibleIf`).
- **Sessions multiples** : chaque checklist embarque une copie figée de son modèle ; modifier ou supprimer un modèle n'affecte pas les sessions existantes. Une nouvelle version du modèle peut être appliquée manuellement.
- **Cycle de vie** : une session se termine après validation bloquante (contexte requis, réponses, commentaire sur KO, motif N/A exigé) puis passe en lecture seule ; elle peut être rouverte.
- **Preuves** : captures (Ctrl+V), glisser-déposer ou sélection de fichiers (50 Mo max par fichier).
- **Exports** : brouillon JSON, Excel (.xlsx), PDF.
- **Thème** clair / sombre.

## Démarrage

Prérequis : Node.js et [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm start          # serveur de développement sur http://localhost:4200/
pnpm test           # tests unitaires (Vitest)
pnpm build          # build de production dans dist/
pnpm deploy         # build avec base-href /checklists/ et publication sur GitHub Pages
```

## Organisation

- `src/app/models` : modèle de données.
- `src/app/domain` : règles métier pures (applicabilité, métriques, validation de clôture, diff de modèles).
- `src/app/data` : normalisation des formats et migrations de base.
- `src/app/services` : persistance Dexie, sessions, modèles, preuves, exports.
- `src/app/pages` / `src/app/components` : interface.
- `openspec/` : spécifications et changes (en français) ; `openspec/BACKLOG.md` pour les idées reportées.
- `adr/` : décisions d'architecture.
