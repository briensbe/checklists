## ADDED Requirements

### Requirement: Historisation des changements d'état d'un contrôle
Le système DOIT ajouter un événement daté à l'historique de la réponse d'un contrôle à chaque changement d'état : statut posé ou retiré (`OK`, `KO`, `N/A`), case cochée ou décochée, choix sélectionné ou retiré, preuve ajoutée, preuve supprimée, preuve mise en attente ou complétée. Les saisies de texte (commentaire, champ additionnel) NE DOIVENT PAS produire d'événement. Les événements existants NE DOIVENT jamais être modifiés ni supprimés, sauf par une réinitialisation de la session ou par l'annulation de l'action qui les a produits.

#### Scenario: Changements de statut successifs
- **WHEN** l'utilisateur passe un contrôle à `OK`, puis à `KO`
- **THEN** l'historique de ce contrôle contient deux événements datés, dans l'ordre, l'un pour `OK` et l'autre pour `KO`

#### Scenario: Retrait d'une réponse
- **WHEN** l'utilisateur clique à nouveau sur le statut déjà sélectionné d'un contrôle
- **THEN** un événement indiquant le retrait du statut est ajouté et les événements précédents sont conservés

#### Scenario: Saisie d'un commentaire
- **WHEN** l'utilisateur saisit ou modifie le commentaire d'un contrôle
- **THEN** aucun événement n'est ajouté à l'historique

#### Scenario: Ajout d'une preuve
- **WHEN** l'utilisateur joint un fichier de preuve à un contrôle
- **THEN** un événement daté portant le nom du fichier est ajouté à l'historique du contrôle

#### Scenario: Suppression de preuve annulée
- **WHEN** l'utilisateur supprime une preuve puis clique sur « Annuler » avant l'expiration du toast
- **THEN** aucun événement de suppression n'est ajouté

#### Scenario: Passage groupé à OK annulé
- **WHEN** l'utilisateur utilise « Passer le reste à OK » puis clique sur « Annuler »
- **THEN** les réponses et leurs historiques sont restaurés exactement comme avant l'action

### Requirement: Conservation de l'historique
Le système DOIT conserver l'historique des contrôles lors de l'enregistrement, de l'export et de l'import du fichier d'échange, de la clôture et de la réouverture d'une session, ainsi que lors de l'application d'une nouvelle version du modèle pour les contrôles conservés, y compris quand leur réponse est réinitialisée pour incompatibilité. La réinitialisation explicite d'une session, soumise à confirmation, DOIT effacer les réponses avec leur historique.

#### Scenario: Échange d'une session par fichier
- **WHEN** l'utilisateur exporte une session puis l'importe sur un autre poste
- **THEN** l'historique de chaque contrôle est identique à celui de la session d'origine

#### Scenario: Réponse réinitialisée par une nouvelle version du modèle
- **GIVEN** un contrôle répondu dont le type de contrôle change dans la nouvelle version du modèle
- **WHEN** l'utilisateur applique cette nouvelle version
- **THEN** la réponse du contrôle est réinitialisée et son historique est conservé

#### Scenario: Réinitialisation de la session
- **WHEN** l'utilisateur réinitialise une session et confirme
- **THEN** toutes les réponses sont effacées, historiques compris
