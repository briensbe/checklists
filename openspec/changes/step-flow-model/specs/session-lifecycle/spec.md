## MODIFIED Requirements

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
