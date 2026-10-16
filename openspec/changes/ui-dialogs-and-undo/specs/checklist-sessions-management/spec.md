## MODIFIED Requirements

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
- **WHEN** l'utilisateur clique sur la suppression d'une session depuis le tableau de bord
- **THEN** la session est immédiatement masquée de la liste affichée, un toast d'annulation s'affiche pendant 6 secondes avec le bouton « Annuler », et la suppression réelle (session et preuves) en base Dexie n'a lieu qu'à l'expiration du délai ou immédiatement lors du déchargement de la page.

#### Scenario: Annulation de la suppression d'une session
- **WHEN** l'utilisateur clique sur « Annuler » dans le toast de suppression avant l'expiration du délai
- **THEN** la session réapparaît immédiatement dans la liste du tableau de bord et aucune opération de suppression n'est exécutée en base.

## ADDED Requirements

### Requirement: Lancement d'une checklist avec présélection de template
Le système DOIT permettre de déclencher la création d'une nouvelle checklist depuis la liste des modèles en ouvrant la modale dédiée du tableau de bord avec le modèle présélectionné, sans recourir à un dialogue natif `prompt()`.

#### Scenario: Lancement depuis la liste des modèles
- **WHEN** l'utilisateur clique sur « Nouvelle checklist » sur la carte d'un modèle dans la bibliothèque de modèles
- **THEN** le système navigue vers `/checklists?new=<templateId>` et ouvre directement la modale de création avec le modèle sélectionné et le titre par défaut suggéré.
