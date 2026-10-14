# Spécifications : Gestion multi-sessions de Checklists

## Purpose
Permettre la création, la persistance indépendante dans Dexie et le suivi via un tableau de bord de plusieurs checklists exécutées en parallèle.

## Requirements

### Requirement: Gestion multi-sessions et persistance indépendante
Le système DOIT permettre de créer et gérer plusieurs sessions de checklists distinctes et persistées indépendamment dans Dexie (IndexedDB), chacune identifiée par un identifiant unique (UUID) et portant sa propre copie figée du template.

#### Scenario: Création d'une nouvelle checklist depuis un template
- **WHEN** l'utilisateur choisit un template et saisit un titre pour sa checklist puis valide
- **THEN** le système génère un UUID unique, copie la définition du template dans la session, initialise les valeurs de contexte par défaut, fixe le statut à `in_progress`, persiste la session dans la base Dexie et ouvre la vue d'exécution de cette checklist.

#### Scenario: Reprise d'une checklist existante
- **WHEN** l'utilisateur sélectionne une checklist dans la liste des checklists
- **THEN** le système charge la session correspondante depuis Dexie avec l'intégralité de ses réponses, sa copie de template et son état d'avancement.

#### Scenario: Session introuvable
- **WHEN** l'utilisateur ouvre l'URL `/checklists/:id` d'une session qui n'existe pas en base
- **THEN** le système affiche un état « Session introuvable » avec un lien de retour vers le tableau de bord, au lieu d'un chargement infini.

#### Scenario: Suppression d'une session de checklist
- **WHEN** l'utilisateur demande la suppression d'une checklist avec confirmation
- **THEN** la session et ses preuves associées sont définitivement purgées de la base IndexedDB et la liste est mise à jour.

### Requirement: Tableau de bord des checklists en cours
Le système DOIT présenter un tableau de bord listant toutes les checklists existantes avec leur titre, le nom du template issu de leur copie figée, leur statut, la date de modification et les métriques d'avancement. Les métriques DOIVENT être calculées par la même règle que dans le runner, en ne comptant que les items applicables au contexte de la session.

#### Scenario: Affichage du tableau de bord
- **WHEN** l'utilisateur navigue vers la route `/checklists`
- **THEN** le système affiche la liste triée par dernière modification avec pour chaque entrée le pourcentage d'avancement, le compte des items répondus, le statut (en cours / terminée) et, le cas échéant, le badge « Modèle mis à jour ».

#### Scenario: Cohérence des métriques avec le runner
- **WHEN** une session contient des items masqués par leur condition d'affichage
- **THEN** le pourcentage affiché sur le dashboard est identique à celui affiché dans le runner pour cette session.

#### Scenario: Filtre par statut
- **WHEN** l'utilisateur sélectionne le filtre « En cours » ou « Terminées »
- **THEN** seules les sessions du statut choisi sont affichées ; le filtre « Toutes » rétablit la liste complète.
