## MODIFIED Requirements

### Requirement: Résolution des conflits d'identifiant à l'import de session
Lorsque l'identifiant de la session importée existe déjà en base, le système DOIT présenter une boîte de dialogue modale unique à trois choix explicites (« Remplacer l'existante », « Importer comme copie », « Annuler »), sans recourir à des boîtes de confirmation natives enchaînées.

#### Scenario: Remplacement de la session existante
- **WHEN** l'utilisateur sélectionne l'option « Remplacer l'existante » dans la boîte de dialogue de conflit
- **THEN** la boîte se ferme, la session en base est remplacée par celle du fichier avec le même identifiant, et un toast confirme le remplacement.

#### Scenario: Remplacement avec pièces jointes incluses
- **WHEN** l'utilisateur remplace une session et que le fichier contient un bloc de preuves
- **THEN** toutes les preuves existantes de la session sont supprimées et remplacées par celles du fichier.

#### Scenario: Remplacement sans pièces jointes incluses
- **WHEN** l'utilisateur remplace une session et que le fichier ne contient pas de bloc de preuves
- **THEN** les preuves existantes de la session sont conservées, sauf celles rattachées à des items absents de la copie figée importée, qui sont supprimées.

#### Scenario: Import comme copie
- **WHEN** l'utilisateur sélectionne l'option « Importer comme copie » dans la boîte de dialogue de conflit
- **THEN** la boîte se ferme, une nouvelle session est créée avec un nouvel UUID et le titre suffixé de « (import) », ses preuves éventuelles y étant rattachées ; la session existante est inchangée.

#### Scenario: Annulation
- **WHEN** l'utilisateur clique sur « Annuler », clique sur l'arrière-plan ou appuie sur `Échap`
- **THEN** la boîte se ferme et aucune donnée n'est modifiée ou importée.
