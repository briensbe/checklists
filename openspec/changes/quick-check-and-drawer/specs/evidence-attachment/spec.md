## MODIFIED Requirements

### Requirement: Attachement universel de preuve par point de contrôle
Le système DOIT fournir sur chaque point de contrôle un déclencheur d'attachement (icône trombone) qui ouvre le tiroir du contrôle sous sa ligne, sans fenêtre modale (capacité `quick-check`). Le tiroir DOIT permettre d'associer une ou plusieurs preuves documentées par collage d'une image, glisser-déposer, sélection de fichiers ou photo prise avec l'appareil. Chaque preuve DOIT être rattachée à l'identifiant de la session courante et ne DOIT pas dépasser 50 Mo. Tout refus de fichier volumineux DOIT être notifié par un toast sans bloquer l'interface. Chaque ajout DOIT mettre à jour immédiatement le compteur de preuves de la ligne.

#### Scenario: Attachement d'une capture d'écran par Ctrl+V
- **WHEN** l'utilisateur colle (Ctrl+V) une image présente dans son presse-papier dans le tiroir ouvert d'un contrôle
- **THEN** l'image est capturée, stockée localement sous forme de Blob, un aperçu miniature avec horodatage est affiché dans le tiroir et le compteur de preuves de la ligne augmente de un

#### Scenario: Attachement par glisser-déposer ou sélection de fichier
- **WHEN** l'utilisateur glisse-dépose dans le tiroir, ou sélectionne, un ou plusieurs fichiers (image, log texte, archive)
- **THEN** chacun des fichiers est ajouté à la liste des preuves du contrôle avec son nom, sa taille et sa date d'ajout

#### Scenario: Photo prise avec l'appareil
- **WHEN** l'utilisateur choisit « Photo » dans le tiroir d'un contrôle sur un appareil doté d'un appareil photo
- **THEN** le sélecteur de fichiers propose la prise de vue avec la caméra arrière (`capture="environment"`, images uniquement) et la photo prise est ajoutée comme preuve image

#### Scenario: Fichier trop volumineux
- **WHEN** l'utilisateur ajoute un fichier de plus de 50 Mo, seul ou parmi d'autres
- **THEN** ce fichier est refusé avec une notification toast d'avertissement indiquant son nom et la limite de 50 Mo, et les autres fichiers valides sont ajoutés

#### Scenario: Session terminée
- **WHEN** la session courante est au statut `completed`
- **THEN** aucune preuve ne peut être ajoutée ni supprimée, mais les preuves existantes restent consultables et téléchargeables depuis le tiroir

### Requirement: Gestion et suppression des preuves
Le système DOIT permettre de prévisualiser, de télécharger et de supprimer individuellement chaque preuve attachée depuis le tiroir du contrôle, avec une possibilité d'annulation pendant 6 secondes. La suppression DOIT ajouter immédiatement l'événement d'historique de suppression de la preuve ; l'annulation DOIT retirer cet événement, retrouvé par l'identifiant de la preuve. Les suppressions en attente DOIVENT être exécutées à l'expiration du toast, lorsque l'utilisateur quitte la page ou masque l'onglet, et avant la clôture effective de la session.

#### Scenario: Suppression d'une preuve
- **WHEN** l'utilisateur clique sur la suppression d'une pièce jointe
- **THEN** la pièce jointe est immédiatement retirée visuellement de la liste des preuves du contrôle et du compteur de sa ligne, un toast avec bouton « Annuler » s'affiche pendant 6 secondes, et la suppression définitive du stockage local est différée jusqu'à expiration ou sortie de page.

#### Scenario: Annulation de la suppression d'une preuve
- **WHEN** l'utilisateur clique sur « Annuler » dans le toast de suppression de preuve
- **THEN** la pièce jointe est réintégrée dans l'affichage du contrôle et dans le compteur de sa ligne, conservée dans le stockage local, et l'historique du contrôle redevient identique à celui d'avant la suppression.

#### Scenario: Clôture pendant le délai d'annulation
- **GIVEN** une suppression de preuve est en attente, son toast étant encore affiché
- **WHEN** l'utilisateur termine la session et que la clôture est acceptée
- **THEN** la preuve est supprimée du stockage local avant la clôture, et le toast disparaît sans possibilité d'annulation

## ADDED Requirements

### Requirement: Preuve exigée au geste principal
Le système DOIT, lorsque le modèle exige une preuve pour un contrôle (`evidenceRequired`) et que cette preuve n'est pas encore fournie, remplacer la réponse immédiate du geste principal (coche, `OK`) ou d'un clic sur un choix sans anomalie par une demande de preuve affichée sous la ligne, avec la consigne `evidenceHint` et le moyen de fournir la preuve selon son type. La preuve est fournie :
- `comment` : la note du contrôle n'est pas vide ;
- `photo` : le contrôle a au moins une preuve de type image ;
- `file` : le contrôle a au moins une preuve, quel qu'en soit le type ;
- `link` : le contrôle a un lien de preuve valide.

Le bouton « Valider » DOIT rester désactivé tant que la preuve n'est pas fournie, et donner la réponse conforme une fois actionné. Pour un contrôle non bloquant, un bouton « Plus tard » DOIT donner la réponse conforme avec l'indicateur « preuve à compléter » (`evidencePending`). Pour un contrôle bloquant, ce bouton NE DOIT PAS être proposé, et la demande DOIT expliquer que la preuve est nécessaire. « Annuler » DOIT fermer la demande sans répondre, en conservant les preuves déjà ajoutées. Si la preuve est déjà fournie, le geste DOIT répondre directement. La mise en KO, la mise en `N/A` et un choix en anomalie NE DOIVENT jamais demander de preuve.

Une ligne en « preuve à compléter » DOIT l'indiquer et proposer « Compléter », qui rouvre la demande de preuve ; valider une preuve fournie DOIT retirer l'indicateur. Retirer la réponse d'un contrôle DOIT retirer aussi l'indicateur. Un contrôle répondu dont la preuve exigée n'est plus fournie (preuve supprimée après la validation) DOIT être signalé « preuve manquante », sans que sa réponse soit modifiée.

#### Scenario: Demande de preuve au geste
- **GIVEN** un contrôle bloquant de type case à cocher qui exige une photo, avec la consigne « Capture du rapport de tests », sans preuve
- **WHEN** l'utilisateur clique sur sa ligne
- **THEN** une demande de preuve s'ouvre sous la ligne avec la consigne « Capture du rapport de tests » et la prise de photo, et le contrôle n'est pas coché

#### Scenario: Bloquant sans preuve
- **WHEN** la demande de preuve d'un contrôle bloquant est ouverte et qu'aucune photo n'a été ajoutée
- **THEN** le bouton « Valider » est désactivé, aucun bouton « Plus tard » n'est proposé et la demande indique que la preuve est nécessaire pour valider ce contrôle bloquant

#### Scenario: Validation avec la preuve
- **WHEN** l'utilisateur ajoute une photo dans la demande de preuve puis clique sur « Valider »
- **THEN** le contrôle est coché et la demande se ferme

#### Scenario: Preuve remise à plus tard
- **GIVEN** un contrôle important de type statut qui exige un commentaire
- **WHEN** l'utilisateur fait le geste principal puis clique sur « Plus tard » sans saisir de commentaire
- **THEN** le contrôle passe au statut `OK` avec l'indicateur « preuve à compléter », et sa ligne affiche « preuve à compléter » avec la commande « Compléter »

#### Scenario: Preuve complétée
- **WHEN** l'utilisateur clique sur « Compléter » sur un contrôle en « preuve à compléter », saisit le commentaire demandé puis clique sur « Valider »
- **THEN** l'indicateur « preuve à compléter » est retiré et la réponse du contrôle est conservée

#### Scenario: Preuve déjà fournie
- **WHEN** l'utilisateur fait le geste principal sur un contrôle sans réponse qui exige une photo et en a déjà une
- **THEN** le contrôle reçoit directement sa réponse, sans demande de preuve

#### Scenario: KO sans demande de preuve
- **WHEN** l'utilisateur met en KO un contrôle qui exige une preuve
- **THEN** le contrôle passe au statut `KO` et son tiroir s'ouvre sur la note, sans demande de preuve

#### Scenario: Annulation de la demande
- **WHEN** l'utilisateur ajoute une photo dans la demande de preuve puis clique sur « Annuler »
- **THEN** la demande se ferme, le contrôle reste sans réponse et la photo reste parmi ses preuves

#### Scenario: Retrait de la réponse d'un contrôle en attente de preuve
- **WHEN** l'utilisateur décoche un contrôle en « preuve à compléter »
- **THEN** le contrôle est sans réponse et l'indicateur « preuve à compléter » est retiré

#### Scenario: Preuve supprimée après la validation
- **GIVEN** un contrôle bloquant coché dont l'unique photo exigée a été fournie
- **WHEN** la suppression de cette photo devient définitive
- **THEN** le contrôle reste coché et sa ligne est signalée « preuve manquante »

### Requirement: Preuve de type lien
Le système DOIT permettre de renseigner, pour un contrôle dont la preuve exigée est un lien, un lien de preuve unique enregistré dans sa réponse (`evidenceLink`). Seules les adresses `http` et `https` DOIVENT être acceptées. Le lien DOIT s'afficher dans le tiroir comme un lien qui s'ouvre dans un nouvel onglet, sans donner à la page ouverte accès à l'application, et DOIT pouvoir être retiré tant que la session est en cours. Un lien importé dont l'adresse n'est ni `http` ni `https` DOIT être affiché comme du texte, jamais comme un lien cliquable.

#### Scenario: Lien valide
- **WHEN** l'utilisateur saisit « https://wiki.example.org/api » dans la demande de preuve d'un contrôle qui exige un lien, puis clique sur « Valider »
- **THEN** le lien est enregistré dans la réponse, le contrôle reçoit sa réponse et le tiroir affiche le lien

#### Scenario: Adresse refusée
- **WHEN** l'utilisateur saisit « wiki/api » ou « ftp://serveur/doc » comme lien de preuve
- **THEN** le bouton « Valider » reste désactivé et la demande indique qu'une adresse http ou https est attendue

#### Scenario: Ouverture du lien
- **WHEN** l'utilisateur clique sur le lien de preuve affiché dans le tiroir
- **THEN** le lien s'ouvre dans un nouvel onglet, sans référence vers l'application

#### Scenario: Lien importé non sûr
- **WHEN** une session importée contient un lien de preuve « javascript:alert(1) »
- **THEN** le tiroir affiche ce texte sans en faire un lien cliquable
