## Context

L'application est une solution de vérification et d'audit préalable aux opérations sensibles (mises en production logicielle). Un prototype complet sous forme de fichier autonome `checklist_audit_livraison.html` a validé l'ergonomie et le besoin opérationnel. Cette conception formalise l'architecture pour migrer vers une application Angular 19+ modulaire, réutilisable, autonome et découplée du cas d'usage unique initial.

## Goals / Non-Goals

**Goals:**
- Proposer une architecture modulaire basée sur des composants Angular standalone avec séparation stricte des fichiers (`.html`, `.css`, `.ts`) et utilisation exclusive du nouveau contrôle de flux natif (`@if`, `@for`).
- Supporter le chargement dynamique de modèles de checklists (JSON) et la sélection du modèle actif.
- Intégrer un système universel de capture de preuves par point de contrôle (Ctrl+V d'image, drag & drop, téléversement de fichier).
- Utiliser `Dexie.js` pour une persistance locale riche et asynchrone sur IndexedDB (stockage pérenne des sessions et des pièces jointes).
- Conserver la double capacité d'export technique (JSON) et d'audit formel (Excel via `xlsx`, PDF via `jspdf` et `jspdf-autotable`).

**Non-Goals:**
- Pas d'éditeur graphique de modèle de checklist en V1 (les modèles sont fournis par fichiers JSON).
- Pas de gestion multi-audits concurrents ou de tableau de bord d'historique en V1 (une seule session active à la fois).
- Pas de gestion de rôles complexes ni de co-signatures multi-utilisateurs.
- Pas de synchronisation cloud ou de backend distant (application 100% autonome dans le navigateur).

## Decisions

### 1. Stockage local avec Dexie.js (IndexedDB)
- **Choix** : Utilisation de `Dexie.js` comme couche d'accès à IndexedDB.
- **Raison** : `localStorage` est limité à ~5 Mo et s'avère insuffisant dès l'attachement d'images ou de captures d'écran. Dexie offre un typage TypeScript strict, une API transactionnelle fluide basée sur les promesses et stocke les `Blob` de manière native sans surcoût d'encodage Base64.
- **Alternatives envisagées** :
  - *LocalStorage pur* : rejeté pour cause de saturation rapide.
  - *idb (wrapper minimaliste)* : moins expressif pour les schémas évolutifs et les requêtes indexées que Dexie.

### 2. Modèle de données : Découplage Template vs Session
- **Choix** : Séparation stricte entre le schéma déclaratif (`ChecklistTemplate`) et les données d'évaluation instanciées (`ChecklistSession`).
- **Structure** :
  - `ChecklistTemplate` : sections, identifiants de contrôles, libellés, aides, conditions d'affichage, champs complémentaires.
  - `ChecklistSession` : modèle de référence, valeurs de contexte (ex: version, mode), réponses (`status: 'OK' | 'KO' | 'NA'`, commentaires, valeurs des champs extra).
  - `EvidenceRecord` : enregistrement rattaché au `sessionId` et à l'`itemId` contenant le `Blob` et ses métadonnées.

### 3. Pièces jointes : Approche universelle "Trombone"
- **Choix** : Chaque point de contrôle expose une icône trombone ouvrant un volet/modal de preuve universel capable d'intercepter les événements `paste` (Ctrl+V) d'images et le drop de fichiers.
- **Raison** : Offre une flexibilité maximale à l'opérateur sans alourdir le modèle déclaratif de chaque question.

### 4. Composants Angular et architecture
- **Choix** : Architecture par composants autonomes (`standalone: true`), formulaires typés, signaux Angular (`signal`, `computed`) pour la réactivité du calcul des métriques de conformité (progression, compteurs OK/KO/NA).
- **Structure de fichiers** : Respect systématique de la règle du projet : 3 fichiers séparés (`.html`, `.css`, `.ts`) pour chaque composant.

## Risks / Trade-offs

- **[Risque : Perte de données lors du vidage du cache du navigateur]** → *Mitigation* : Notification visuelle de la persistance locale et mise en avant des boutons d'export "Brouillon JSON" pour archivage fichier.
- **[Risque : Dégradation des performances mémoire avec de très gros fichiers joints]** → *Mitigation* : Stockage sous forme de Blobs dans IndexedDB et chargement des URLs d'objet (`URL.createObjectURL`) à la demande avec libération (`URL.revokeObjectURL`).
- **[Risque : Rendu PDF complexe des images jointes]** → *Mitigation* : Le PDF intègre en priorité la synthèse textuelle et les motifs d'anomalies ; l'inclusion des images est gérée de manière paginée et optimisée.
