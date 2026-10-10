## Why

Les processus critiques (mises en production logicielle, audits de conformité, vérifications pré-vol ou pré-opératoires) nécessitent des listes de contrôle rigoureuses pour éviter les omissions humaines et garantir une traçabilité irréprochable. Le prototype HTML existant prouve la pertinence du concept mais reste monolithique, figé sur une checklist unique et limité en stockage. Cette évolution transforme ce besoin en un moteur d'exécution de checklists générique, autonome et modulaire dans Angular.

## What Changes

- **Moteur d'exécution multi-modèles** : Capacité de charger et d'exécuter différentes checklists à partir de définitions au format JSON.
- **Sélecteur de modèles** : Sélection d'un modèle de checklist actif au démarrage (une checklist active à la fois).
- **Contrôles universels de preuve (Attachements)** : Ajout sur chaque point de contrôle d'une action "trombone" permettant de joindre des preuves par raccourci clavier (Ctrl+V pour les captures d'écran), glisser-déposer ou sélection de fichier local.
- **Persistance locale robuste** : Sauvegarde locale continue dans IndexedDB via Dexie.js pour supporter le stockage de fichiers binaires et de captures d'écran sans restriction de taille.
- **Exports et rapports d'audit** : Génération d'exports structurés (JSON brouillon ré-importable, Excel .xlsx et rapport PDF formel pour la piste d'audit).

## Capabilities

### New Capabilities
- `checklist-template-management`: Chargement, validation et sélection de modèles de checklists au format JSON.
- `checklist-execution-runner`: Moteur d'évaluation interactive des contrôles (OK/KO/NA, observations obligatoires sur KO, champs complémentaires, conditionnement selon le contexte, progression et conformité globale).
- `evidence-attachment`: Capture, attachement universel (Ctrl+V, drag & drop, upload) et visualisation des pièces jointes associées à chaque point de contrôle.
- `audit-persistence-export`: Persistance locale autonome avec Dexie.js (IndexedDB) et génération des exports (JSON, Excel, PDF).

### Modified Capabilities
<!-- Aucun préexistant -->

## Impact

- **Architecture applicative** : Application Angular standalone (v19+) avec composants découplés en 3 fichiers (.html, .css, .ts) et syntaxe native de contrôle de flux (`@if`, `@for`, `@switch`).
- **Dépendances tierces** : Ajout de `dexie` pour la base IndexedDB locale, ainsi que des utilitaires d'export PDF/Excel (`jspdf`, `jspdf-autotable`, `xlsx`).
- **Autonomie** : Fonctionnement 100% côté client (aucun backend requis).
