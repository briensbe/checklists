## MODIFIED Requirements

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
