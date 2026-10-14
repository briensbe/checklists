## ADDED Requirements

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
- un item applicable n'a pas de réponse ;
- un item applicable au statut `KO` n'a pas de commentaire non vide ;
- un item applicable au statut `NA` dont le template exige un motif (`requireNaReason`) n'a pas de commentaire non vide.

Seuls les items applicables (selon les conditions d'affichage et le contexte courant) sont évalués. Aucune action ne DOIT permettre de contourner cette validation.

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
