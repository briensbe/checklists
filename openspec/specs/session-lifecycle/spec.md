# Spécifications : Cycle de vie des sessions

## Purpose
Gérer le statut d'une session (en cours / terminée), la validation bloquante à la clôture, la lecture seule et la réouverture tracée.

## Requirements

### Requirement: Statut de cycle de vie d'une session
Le système DOIT associer à chaque session un statut parmi `in_progress` (en cours) et `completed` (terminée). Toute nouvelle session DOIT être créée au statut `in_progress`.

#### Scenario: Statut initial d'une nouvelle session
- **WHEN** l'utilisateur crée une nouvelle checklist depuis un template
- **THEN** la session est persistée avec le statut `in_progress` et un historique de clôtures vide

#### Scenario: Affichage du statut
- **WHEN** l'utilisateur consulte une session dans le runner ou sur le dashboard
- **THEN** le statut « En cours » ou « Terminée » est affiché, accompagné de la date de clôture pour une session terminée

### Requirement: Validation bloquante à la clôture
Le système DOIT refuser de terminer une session tant qu'au moins une des règles suivantes est violée, et DOIT présenter la liste exhaustive des anomalies :
- un champ de contexte marqué `required` est vide ;
- un item applicable n'a pas de réponse, lorsque la politique de clôture du modèle est `all` ; lorsque la politique est `blocking`, seuls les items bloquants applicables sans réponse sont des anomalies. Un modèle sans politique de clôture DOIT être traité comme `all` ;
- un item applicable au statut `KO` n'a pas de commentaire non vide ;
- un item bloquant applicable est en anomalie (statut `KO` ou choix marqué comme anomalie), sauf si la porte souple de sa section a été forcée.

Un item au statut `NA` NE DOIT jamais exiger de commentaire. Seuls les items applicables (selon les conditions d'affichage et le contexte courant) sont évalués. Aucune action ne DOIT permettre de contourner cette validation.

#### Scenario: Clôture d'une session conforme
- **WHEN** l'utilisateur clique sur « Terminer » et que toutes les règles sont respectées
- **THEN** la session passe au statut `completed`, une entrée `{ closedAt }` est ajoutée à l'historique de clôtures et la session est persistée

#### Scenario: Clôture refusée avec anomalies
- **WHEN** l'utilisateur clique sur « Terminer » alors qu'un item KO n'a pas de commentaire et qu'un champ de contexte requis est vide
- **THEN** la session reste `in_progress` et le système affiche la liste des deux anomalies, chacune avec son libellé et sa section

#### Scenario: Navigation vers une anomalie
- **WHEN** l'utilisateur clique sur une anomalie de la liste
- **THEN** le système déplie la section concernée, fait défiler la vue jusqu'à l'item ou au champ de contexte et lui donne le focus

#### Scenario: Item masqué non évalué
- **WHEN** un item non répondu est masqué par sa condition d'affichage au moment de la clôture
- **THEN** cet item n'est pas compté comme anomalie

#### Scenario: N/A sans commentaire
- **WHEN** l'utilisateur termine une session dont un item est au statut `NA` sans commentaire, toutes les autres règles étant respectées
- **THEN** la session passe au statut `completed`

#### Scenario: Modèle sans politique de clôture
- **WHEN** l'utilisateur termine une session dont le modèle ne déclare pas de politique de clôture et dont un item optionnel n'a pas de réponse
- **THEN** la clôture est refusée et l'item figure parmi les anomalies

#### Scenario: Politique limitée aux bloquants
- **WHEN** l'utilisateur termine une session dont le modèle déclare `completionPolicy: 'blocking'`, dont tous les items bloquants sont résolus et dont des items optionnels n'ont pas de réponse
- **THEN** la session passe au statut `completed`

#### Scenario: Bloquant en anomalie
- **WHEN** l'utilisateur termine une session dont un item bloquant est au statut `KO` avec un commentaire
- **THEN** la clôture est refusée et l'item figure parmi les anomalies comme bloquant non résolu

#### Scenario: Bloquant en anomalie avec porte forcée
- **WHEN** l'utilisateur termine une session dont un item bloquant est au statut `KO` avec un commentaire, dans une section dont la porte souple a été forcée
- **THEN** cet item n'est pas compté comme anomalie

### Requirement: Session terminée en lecture seule
Le système DOIT empêcher toute modification d'une session au statut `completed` : contexte, réponses, commentaires, champs additionnels, preuves, passage groupé à OK et réinitialisation.

#### Scenario: Consultation d'une session terminée
- **WHEN** l'utilisateur ouvre une session terminée
- **THEN** tous les contrôles de saisie sont désactivés, les actions de modification sont masquées ou désactivées, et la consultation, la visualisation des preuves et les exports restent disponibles

#### Scenario: Garde au niveau du service
- **WHEN** une opération de modification est invoquée par programme sur une session terminée
- **THEN** l'opération est ignorée et aucune écriture n'est faite en base

### Requirement: Réouverture d'une session terminée
Le système DOIT permettre de rouvrir une session terminée après confirmation explicite, et DOIT tracer chaque réouverture dans l'historique de clôtures.

#### Scenario: Réouverture confirmée
- **WHEN** l'utilisateur clique sur « Rouvrir » puis confirme
- **THEN** la session repasse au statut `in_progress`, la dernière entrée de l'historique reçoit `reopenedAt` et la session redevient modifiable

#### Scenario: Réouverture annulée
- **WHEN** l'utilisateur clique sur « Rouvrir » puis annule la confirmation
- **THEN** la session reste terminée et inchangée

#### Scenario: Clôtures successives
- **WHEN** une session est terminée, rouverte puis terminée à nouveau
- **THEN** l'historique contient deux entrées, la première avec `closedAt` et `reopenedAt`, la seconde avec `closedAt` seul

### Requirement: Confirmation de clôture avec des preuves manquantes
Le système NE DOIT pas refuser la clôture d'une session parce qu'une preuve exigée a disparu après la validation d'un contrôle (ADR 0009) : la validation de clôture ne lit jamais les preuves. En revanche, lorsque l'utilisateur termine une session qui satisfait toutes les règles de clôture et qu'au moins un contrôle applicable est signalé « preuve manquante » (réponse conforme donnée, preuve exigée plus fournie, sans indicateur « preuve à compléter »), le système DOIT demander une confirmation par le dialogue applicatif (`DialogService`), en indiquant le nombre de contrôles concernés et combien sont bloquants. Cette vérification DOIT être faite après l'exécution des suppressions de preuves en attente. Confirmer DOIT terminer la session ; annuler DOIT la laisser en cours, sans autre modification.

#### Scenario: Clôture confirmée malgré une preuve manquante
- **GIVEN** une session conforme aux règles de clôture, dont le contrôle bloquant « Tests automatisés au vert » est coché alors que sa photo exigée a été supprimée
- **WHEN** l'utilisateur clique sur « Terminer » puis confirme
- **THEN** la session passe au statut `completed`

#### Scenario: Clôture annulée
- **WHEN** l'utilisateur clique sur « Terminer » sur la même session puis annule la confirmation
- **THEN** la session reste `in_progress` et aucune réponse n'est modifiée

#### Scenario: Aucune preuve manquante
- **WHEN** l'utilisateur termine une session conforme dont aucun contrôle n'est signalé « preuve manquante »
- **THEN** la session passe au statut `completed` sans demande de confirmation
