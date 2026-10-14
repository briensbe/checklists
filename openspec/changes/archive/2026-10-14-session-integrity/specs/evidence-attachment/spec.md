## MODIFIED Requirements

### Requirement: Attachement universel de preuve par point de contrôle
Le système DOIT fournir sur chaque point de contrôle un déclencheur d'attachement (icône trombone) permettant d'associer une ou plusieurs preuves documentées. Chaque preuve DOIT être rattachée à l'identifiant de la session courante et ne DOIT pas dépasser 50 Mo.

#### Scenario: Attachement d'une capture d'écran par Ctrl+V
- **WHEN** l'utilisateur colle (Ctrl+V) une image présente dans son presse-papier dans le composant de preuve d'un contrôle
- **THEN** l'image est capturée, stockée localement sous forme de Blob et un aperçu miniature avec horodatage est affiché sous le contrôle

#### Scenario: Attachement par glisser-déposer ou sélection de fichier
- **WHEN** l'utilisateur glisse-dépose ou sélectionne un ou plusieurs fichiers (image, log texte, archive)
- **THEN** chacun des fichiers est ajouté à la liste des preuves du contrôle avec son nom, sa taille et sa date d'ajout

#### Scenario: Fichier trop volumineux
- **WHEN** l'utilisateur ajoute un fichier de plus de 50 Mo, seul ou parmi d'autres
- **THEN** ce fichier est refusé avec un message indiquant son nom et la limite, et les autres fichiers valides sont ajoutés

#### Scenario: Session terminée
- **WHEN** la session courante est au statut `completed`
- **THEN** aucune preuve ne peut être ajoutée ni supprimée, mais les preuves existantes restent consultables et téléchargeables
