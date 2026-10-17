## MODIFIED Requirements

### Requirement: Historisation des changements d'état d'un contrôle
Le système DOIT ajouter un événement daté à l'historique de la réponse d'un contrôle à chaque changement d'état : statut posé ou retiré (`OK`, `KO`, `N/A`, y compris le `N/A` d'un contrôle de type case à cocher ou choix), case cochée ou décochée, choix sélectionné ou retiré, preuve ajoutée, preuve supprimée, lien de preuve renseigné ou retiré, preuve mise en attente ou complétée. Les saisies de texte (commentaire, champ additionnel, frappe d'un lien avant sa validation) NE DOIVENT PAS produire d'événement. Les événements existants NE DOIVENT jamais être modifiés ni supprimés, sauf par une réinitialisation de la session ou par l'annulation de l'action qui les a produits ; l'annulation de la suppression d'une preuve DOIT retirer l'événement de suppression de cette preuve, retrouvé par son identifiant.

#### Scenario: Changements de statut successifs
- **WHEN** l'utilisateur passe un contrôle à `OK`, puis à `KO`
- **THEN** l'historique de ce contrôle contient deux événements datés, dans l'ordre, l'un pour `OK` et l'autre pour `KO`

#### Scenario: Retrait d'une réponse
- **WHEN** l'utilisateur retire le statut d'un contrôle déjà `OK` par un nouveau geste principal sur sa ligne
- **THEN** un événement indiquant le retrait du statut est ajouté et les événements précédents sont conservés

#### Scenario: Saisie d'un commentaire
- **WHEN** l'utilisateur saisit ou modifie le commentaire d'un contrôle
- **THEN** aucun événement n'est ajouté à l'historique

#### Scenario: Ajout d'une preuve
- **WHEN** l'utilisateur joint un fichier de preuve à un contrôle
- **THEN** un événement daté portant le nom du fichier est ajouté à l'historique du contrôle

#### Scenario: Suppression de preuve annulée
- **WHEN** l'utilisateur supprime une preuve puis clique sur « Annuler » avant l'expiration du toast
- **THEN** l'événement de suppression ajouté au moment de la suppression est retiré, et l'historique du contrôle est identique à celui d'avant la suppression

#### Scenario: N/A sur une case à cocher
- **WHEN** l'utilisateur met en `N/A` un contrôle de type case à cocher, puis retire ce `N/A`
- **THEN** l'historique du contrôle contient, dans l'ordre, un événement pour le `N/A` et un événement pour son retrait

#### Scenario: Lien de preuve
- **WHEN** l'utilisateur valide un lien de preuve sur un contrôle, puis le retire
- **THEN** l'historique du contrôle contient un événement daté portant le lien, puis un événement de retrait du lien, sans événement pour la frappe du lien

#### Scenario: Preuve remise à plus tard puis complétée
- **WHEN** l'utilisateur choisit « Plus tard » dans la demande de preuve d'un contrôle, puis complète cette preuve
- **THEN** l'historique du contrôle contient, outre l'événement de réponse, un événement de mise en attente de la preuve puis un événement de preuve complétée

#### Scenario: Passage groupé à OK annulé
- **WHEN** l'utilisateur utilise « Passer le reste à OK » puis clique sur « Annuler »
- **THEN** les réponses et leurs historiques sont restaurés exactement comme avant l'action
