# Spécifications : Attachement Universel de Preuves

## Requirements

### Requirement: Attachement universel de preuve par point de contrôle
Le système DOIT fournir sur chaque point de contrôle un déclencheur d'attachement (icône trombone) permettant d'associer une ou plusieurs preuves documentées.

#### Scenario: Attachement d'une capture d'écran par Ctrl+V
- **WHEN** l'utilisateur colle (Ctrl+V) une image présente dans son presse-papier dans le composant de preuve d'un contrôle
- **THEN** l'image est capturée, stockée localement sous forme de Blob et un aperçu miniature avec horodatage est affiché sous le contrôle

#### Scenario: Attachement par glisser-déposer ou sélection de fichier
- **WHEN** l'utilisateur glisse-dépose ou sélectionne un fichier (image, log texte, archive)
- **THEN** le fichier est ajouté à la liste des preuves du contrôle avec son nom, sa taille et sa date d'ajout

### Requirement: Gestion et suppression des preuves
Le système DOIT permettre de prévisualiser et de supprimer individuellement chaque preuve attachée.

#### Scenario: Suppression d'une preuve
- **WHEN** l'utilisateur clique sur l'action de suppression d'une pièce jointe
- **THEN** la pièce jointe est retirée du point de contrôle et supprimée du stockage local
