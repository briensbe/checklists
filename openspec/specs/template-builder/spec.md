# Spécifications : Constructeur et Bibliothèque de Templates

## Purpose
Fournir un catalogue complet des modèles de checklists avec import/export JSON et un constructeur visuel pour concevoir des sections et contrôles sur-mesure.

## Requirements

### Requirement: Bibliothèque de templates et visualisation
Le système DOIT proposer un catalogue des templates disponibles permettant de visualiser la structure des sections et des items sans modifier le template.

#### Scenario: Visualisation arborescente d'un template
- **WHEN** l'utilisateur consulte la bibliothèque et déplie un template
- **THEN** le système affiche l'ensemble des sections ordonnées et le détail des items avec leur type de contrôle et options associées.

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

### Requirement: Constructeur visuel de templates
Le système DOIT fournir une interface visuelle dédiée permettant de créer un nouveau template ou de modifier un template existant sans manipulation de code JSON.

#### Scenario: Configuration d'un item de type case à cocher avec horodatage optionnel
- **WHEN** le concepteur ajoute un item dans une section et sélectionne le type "Case à cocher simple"
- **THEN** l'interface présente un interrupteur permettant d'activer ou désactiver l'option d'horodatage automatique au clic.

#### Scenario: Configuration d'un item avec choix d'évaluation personnalisables
- **WHEN** le concepteur configure un item avec le type "Choix d'évaluation"
- **THEN** l'interface lui permet d'ajouter des options personnalisées définies par un libellé, un ton choisi dans la palette fixe (`success`, `danger`, `warning`, `info`, `neutral`) et un indicateur bloquant optionnel ; aucune couleur libre ne peut être saisie.

#### Scenario: Valeurs par défaut d'un nouveau choix
- **WHEN** le concepteur ajoute un nouveau choix d'évaluation
- **THEN** le choix est créé avec un ton de la palette (par défaut `neutral`).
