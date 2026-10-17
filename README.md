# Checklists & Audit

Application Angular 100 % navigateur pour exécuter des checklists d'audit (ex. contrôle de livraison) à partir de modèles personnalisables. Aucune donnée ne quitte le poste : tout est stocké dans IndexedDB.

## Fonctionnalités

- **Modèles (templates)** : bibliothèque, constructeur visuel (sections, items, types de contrôle, criticité qui change au clic, preuve exigée et sa consigne), import / export JSON. Un nouvel item est une case à cocher optionnelle. Si un modèle importé porte un identifiant déjà présent, on choisit de remplacer l'existant ou d'importer une copie (nom suffixé « (import) »).
- **Types de contrôle** : statut OK / KO / N/A, case à cocher (avec horodatage optionnel), choix personnalisés (tons de couleur, choix marqués comme anomalie). Tout contrôle peut être mis en N/A, sans justification exigée (ADR 0009).
- **Remplissage rapide** : toute la ligne est le geste principal (une case se coche, un statut passe à OK) ; le KO passe par un bouton discret qui ouvre la note, obligatoire pour un KO. Le trombone ouvre un tiroir sous la ligne : note, preuves, N/A. Le trombone s'allume brièvement après une réponse sans note ni preuve, et la ligne affiche ses compteurs et les badges « bloquant » / « important ».
- **Preuve exigée** : quand le modèle exige une preuve (commentaire, photo, lien ou fichier), elle est demandée au moment de répondre, avec la consigne du modèle. Un bloquant ne peut pas être validé sans preuve ; un autre contrôle peut passer en « preuve à compléter » avec « Plus tard ».
- **Clavier** : ↑/↓ pour naviguer, Espace pour le geste principal, K pour KO, N pour N/A, A pour le tiroir, Entrée pour enregistrer une note, Échap pour annuler, ? pour l'aide. Les raccourcis sont ignorés pendant une saisie et quand une fenêtre est ouverte.
- **Résumé fixé** : pendant le défilement, une barre reste sous l'en-tête avec la progression, les bloquants restants, un anneau par section et le bouton « Prochain item à traiter ».
- **Conditions d'affichage** : un item peut n'être visible que pour certaines valeurs d'un champ de contexte (`visibleIf`).
- **Étapes et criticité** : une section peut dépendre d'autres sections (branches parallèles, jonctions, porte stricte ou souple) et chaque contrôle a une criticité (bloquant, important, optionnel). Seuls les bloquants verrouillent l'étape suivante ; l'état des étapes est toujours calculé, jamais stocké (ADR 0007). Un modèle d'exemple « Mise en production » est fourni.
- **Vue chemin** : pour un modèle à dépendances, le runner affiche le graphe des étapes (anneaux, cadenas, coches, badge de jonction n/m, liens pleins quand la porte est ouverte), puis le panneau de l'étape sélectionnée ; une bascule « Chemin / Liste » est mémorisée par le navigateur (ADR 0010). Les portes s'appliquent à la saisie dans les deux vues : une étape verrouillée montre ses prérequis et ses contrôles en simple texte, réponses conservées. Le pied d'étape indique les portes ouvertes, les branches en attente, les bloquants passés en N/A et les preuves à compléter ou manquantes ; une porte souple se force avec une justification, datée et affichée. Le bloc « Laissés en route » ramène aux contrôles oubliés derrière une porte franchie. Des confettis saluent la fin du chemin (coupés si l'utilisateur demande de réduire les animations), et « Passer le reste à OK » ne touche que les étapes débloquées.
- **Historique** : chaque changement d'état d'un contrôle (statut, coche, choix, preuve) est daté et conservé, y compris dans le fichier d'échange.
- **Sessions multiples** : chaque checklist embarque une copie figée de son modèle ; modifier ou supprimer un modèle n'affecte pas les sessions existantes. Une nouvelle version du modèle peut être appliquée manuellement.
- **Cycle de vie** : une session se termine après validation bloquante (contexte requis, réponses selon la politique de clôture du modèle, commentaire sur KO, aucun bloquant en anomalie sauf porte souple forcée) puis passe en lecture seule ; elle peut être rouverte. Si des contrôles répondus ont perdu leur preuve exigée, une confirmation est demandée avant de terminer.
- **Preuves** : dans le tiroir du contrôle, captures (Ctrl+V), glisser-déposer, sélection de fichiers ou photo prise avec l'appareil (50 Mo max par fichier). La suppression d'une preuve s'annule pendant 6 secondes.
- **Échange de sessions par fichier** : depuis le runner, « Exporter le rapport » produit un fichier JSON unique et ré-importable (session complète, copie figée du modèle, statut, clôtures, réponses) ; la case « Inclure les pièces jointes » y embarque les preuves encodées en base64. Le bouton « Importer une session » du tableau de bord le relit (y compris les anciens brouillons JSON) ; en cas d'identifiant déjà présent, on choisit de remplacer la session existante ou d'importer une copie. Format décrit dans l'ADR 0004.
- **Rapports** : Excel (.xlsx) et PDF adaptés à n'importe quel modèle (champs de contexte, version du modèle, statut, date de clôture) ; le PDF se termine par une annexe des preuves (miniatures des images, liste des autres fichiers).
- **Thème** clair / sombre ; icônes [Lucide](https://lucide.dev/) via `@lucide/angular` (ADR 0008), adoptées composant par composant.

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
- `src/app/domain` : règles métier pures (applicabilité, métriques, validation de clôture, diff de modèles, enchaînement des étapes, vue chemin et placement du graphe, icônes d'étape, saisie rapide et raccourcis, fichier d'échange, préparation des rapports).
- `src/app/data` : normalisation des formats, migrations de base, validation des modèles, conversion base64.
- `src/app/services` : persistance Dexie, sessions, modèles, preuves, exports.
- `src/app/pages` / `src/app/components` : interface.
- `openspec/` : spécifications et changes (en français) ; `openspec/BACKLOG.md` pour les idées reportées.
- `adr/` : décisions d'architecture.
