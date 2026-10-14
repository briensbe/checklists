## MODIFIED Requirements

### Requirement: Importation et exportation de templates JSON
Le système DOIT permettre d'exporter tout template au format JSON structuré et d'importer un fichier JSON externe après normalisation et validation de sa structure. L'import d'un template dont l'identifiant existe déjà dans la bibliothèque NE DOIT PAS écraser silencieusement le template existant : l'utilisateur DOIT choisir entre « Remplacer l'existant » et « Importer comme copie », ou annuler.

#### Scenario: Exportation d'un template en JSON
- **WHEN** l'utilisateur clique sur "Exporter JSON" sur la carte d'un template
- **THEN** le système télécharge un fichier `.json` contenant la définition complète du modèle (sans données de session).

#### Scenario: Importation d'un template JSON valide
- **WHEN** l'utilisateur importe un fichier JSON respectant le schéma de template et dont l'identifiant n'existe pas dans la bibliothèque
- **THEN** le template est sauvegardé dans Dexie, ajouté à la bibliothèque et sélectionnable immédiatement.

#### Scenario: Conflit d'identifiant – remplacement
- **WHEN** l'utilisateur importe un template dont l'identifiant existe déjà et choisit « Remplacer l'existant »
- **THEN** le template existant est remplacé, son horodatage `updatedAt` est mis à jour et les sessions en cours qui en sont issues affichent le badge « Modèle mis à jour ».

#### Scenario: Conflit d'identifiant – copie
- **WHEN** l'utilisateur importe un template dont l'identifiant existe déjà et choisit « Importer comme copie »
- **THEN** le template est ajouté sous un nouvel identifiant avec le nom suffixé de « (import) » ; le template existant et les sessions qui en sont issues sont inchangés.

#### Scenario: Conflit d'identifiant – annulation
- **WHEN** l'utilisateur annule le choix
- **THEN** la bibliothèque est inchangée.

#### Scenario: Rejet d'un template JSON invalide
- **WHEN** l'utilisateur tente d'importer un JSON malformé ou dépourvu de champs obligatoires
- **THEN** le système bloque l'importation et affiche un message d'erreur explicatif.
