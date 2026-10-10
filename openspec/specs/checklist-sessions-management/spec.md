# Spécifications : Gestion multi-sessions de Checklists

## Purpose
Permettre la création, la persistance indépendante dans Dexie et le suivi via un tableau de bord de plusieurs checklists exécutées en parallèle.

## Requirements

### Requirement: Gestion multi-sessions et persistance indépendante
Le système DOIT permettre de créer et gérer plusieurs sessions de checklists distinctes et persistées indépendamment dans Dexie (IndexedDB), chacune identifiée par un identifiant unique (UUID).

#### Scenario: Création d'une nouvelle checklist depuis un template
- **WHEN** l'utilisateur choisit un template et saisit un titre pour sa checklist puis valide
- **THEN** le système génère un UUID unique, initialise la session avec les valeurs de contexte par défaut du template, persiste la session dans la base Dexie et ouvre la vue d'exécution de cette checklist.

#### Scenario: Reprise d'une checklist existante
- **WHEN** l'utilisateur sélectionne une checklist dans la liste des checklists
- **THEN** le système charge la session correspondante depuis Dexie avec l'intégralité de ses réponses et son état d'avancement.

#### Scenario: Suppression d'une session de checklist
- **WHEN** l'utilisateur demande la suppression d'une checklist avec confirmation
- **THEN** la session et ses preuves associées sont définitivement purgées de la base IndexedDB et la liste est mise à jour.

### Requirement: Tableau de bord des checklists en cours
Le système DOIT présenter un tableau de bord listant toutes les checklists existantes avec leur titre, le template associé, la date de modification et les métriques d'avancement.

#### Scenario: Affichage du tableau de bord
- **WHEN** l'utilisateur navigue vers la route `/checklists`
- **THEN** le système affiche la liste triée par dernière modification avec pour chaque entrée le pourcentage d'avancement, le compte des items cochés/validés et le statut global.
