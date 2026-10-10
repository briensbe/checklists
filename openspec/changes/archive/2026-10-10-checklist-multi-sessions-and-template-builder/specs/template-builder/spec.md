## ADDED Requirements

### Requirement: Bibliothèque de templates et visualisation
Le système DOIT proposer un catalogue des templates disponibles permettant de visualiser la structure des sections et des items sans modifier le template.

#### Scenario: Visualisation arborescente d'un template
- **WHEN** l'utilisateur consulte la bibliothèque et déplie un template
- **THEN** le système affiche l'ensemble des sections ordonnées et le détail des items avec leur type de contrôle et options associées.

### Requirement: Importation et exportation de templates JSON
Le système DOIT permettre d'exporter tout template au format JSON structuré et d'importer un fichier JSON externe après validation de sa structure.

#### Scenario: Exportation d'un template en JSON
- **WHEN** l'utilisateur clique sur "Exporter JSON" sur la carte d'un template
- **THEN** le système télécharge un fichier `.json` contenant la définition complète du modèle (sans données de session).

#### Scenario: Importation d'un template JSON valide
- **WHEN** l'utilisateur importe un fichier JSON respectant le schéma de template
- **THEN** le template est sauvegardé dans Dexie, ajouté à la bibliothèque et sélectionnable immédiatement.

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
- **THEN** l'interface lui permet d'ajouter des options personnalisées définies par un libellé (ex: Vert, Rouge, Jaune, Bleu), une couleur ou un badge, et un indicateur bloquant optionnel.
