# Spécifications : Persistance Locale et Export d'Audit

## Requirements

### Requirement: Persistance locale continue avec Dexie.js
Le système DOIT persister l'état courant de l'audit et l'ensemble des pièces jointes associées dans la base de données IndexedDB du navigateur via Dexie.js.

#### Scenario: Sauvegarde automatique lors d'une saisie
- **WHEN** l'utilisateur modifie une métadonnée, un statut, un commentaire ou ajoute une preuve
- **THEN** la mise à jour est immédiatement sauvegardée dans IndexedDB et un indicateur visuel d'auto-sauvegarde confirme l'enregistrement

#### Scenario: Restauration de session au rechargement
- **WHEN** l'application est rechargée ou rouverte dans le navigateur
- **THEN** la session d'audit en cours est intégralement restaurée avec ses réponses et ses pièces jointes

### Requirement: Export et Import JSON de session
Le système DOIT permettre d'exporter l'audit en cours sous forme de fichier JSON et d'importer un fichier JSON pour restaurer un état d'audit.

#### Scenario: Export du fichier JSON
- **WHEN** l'utilisateur clique sur "Brouillon JSON"
- **THEN** un fichier JSON horodaté contenant les métadonnées et réponses de l'audit est téléchargé localement

#### Scenario: Import d'un fichier JSON
- **WHEN** l'utilisateur importe un fichier JSON valide préalablement exporté
- **THEN** l'état de l'audit est chargé et synchronisé dans IndexedDB

### Requirement: Export de rapports d'audit (Excel et PDF)
Le système DOIT générer des rapports de traçabilité formels aux formats Excel (.xlsx) et PDF (A4 formel).

#### Scenario: Export du rapport Excel
- **WHEN** l'utilisateur clique sur "Export Excel"
- **THEN** une feuille de calcul structurée avec métadonnées, synthèse et tableau des contrôles est générée et téléchargée

#### Scenario: Export du rapport PDF formel
- **WHEN** l'utilisateur clique sur "Export Audit PDF"
- **THEN** un document PDF normé (en-tête corporate, cartouche de métadonnées, tableau paginé avec mise en évidence des statuts OK/KO/NA et observations) est produit
