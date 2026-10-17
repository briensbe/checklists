# Checklists & Audit

Application Angular 100 % navigateur pour exécuter des checklists d'audit (ex. contrôle de livraison) à partir de modèles personnalisables. Aucune donnée ne quitte le poste : tout est stocké dans IndexedDB.

## Fonctionnalités

- **Modèles (templates)** : bibliothèque, constructeur visuel (sections, items, types de contrôle), import / export JSON. Si un modèle importé porte un identifiant déjà présent, on choisit de remplacer l'existant ou d'importer une copie (nom suffixé « (import) »).
- **Types de contrôle** : statut OK / KO / N/A (un N/A n'exige jamais de justification), case à cocher (avec horodatage optionnel), choix personnalisés (tons de couleur, choix marqués comme anomalie).
- **Conditions d'affichage** : un item peut n'être visible que pour certaines valeurs d'un champ de contexte (`visibleIf`).
- **Étapes et criticité** (socle en place, écrans à venir) : une section peut dépendre d'autres sections (branches parallèles, jonctions, porte stricte ou souple) et chaque contrôle a une criticité (bloquant, important, optionnel). Seuls les bloquants verrouillent l'étape suivante ; l'état des étapes est toujours calculé, jamais stocké (ADR 0007). Un modèle d'exemple « Mise en production » est fourni.
- **Historique** : chaque changement d'état d'un contrôle (statut, coche, choix, preuve) est daté et conservé, y compris dans le fichier d'échange.
- **Sessions multiples** : chaque checklist embarque une copie figée de son modèle ; modifier ou supprimer un modèle n'affecte pas les sessions existantes. Une nouvelle version du modèle peut être appliquée manuellement.
- **Cycle de vie** : une session se termine après validation bloquante (contexte requis, réponses selon la politique de clôture du modèle, commentaire sur KO, aucun bloquant en anomalie sauf porte souple forcée) puis passe en lecture seule ; elle peut être rouverte.
- **Preuves** : captures (Ctrl+V), glisser-déposer ou sélection de fichiers (50 Mo max par fichier).
- **Échange de sessions par fichier** : depuis le runner, « Exporter le rapport » produit un fichier JSON unique et ré-importable (session complète, copie figée du modèle, statut, clôtures, réponses) ; la case « Inclure les pièces jointes » y embarque les preuves encodées en base64. Le bouton « Importer une session » du tableau de bord le relit (y compris les anciens brouillons JSON) ; en cas d'identifiant déjà présent, on choisit de remplacer la session existante ou d'importer une copie. Format décrit dans l'ADR 0004.
- **Rapports** : Excel (.xlsx) et PDF adaptés à n'importe quel modèle (champs de contexte, version du modèle, statut, date de clôture) ; le PDF se termine par une annexe des preuves (miniatures des images, liste des autres fichiers).
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
- `src/app/domain` : règles métier pures (applicabilité, métriques, validation de clôture, diff de modèles, fichier d'échange, préparation des rapports).
- `src/app/data` : normalisation des formats, migrations de base, validation des modèles, conversion base64.
- `src/app/services` : persistance Dexie, sessions, modèles, preuves, exports.
- `src/app/pages` / `src/app/components` : interface.
- `openspec/` : spécifications et changes (en français) ; `openspec/BACKLOG.md` pour les idées reportées.
- `adr/` : décisions d'architecture.
