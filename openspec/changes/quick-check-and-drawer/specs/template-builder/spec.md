## MODIFIED Requirements

### Requirement: Constructeur visuel de templates
Le système DOIT fournir une interface visuelle dédiée permettant de créer un nouveau template ou de modifier un template existant sans manipulation de code JSON, avec annulation par toast lors de la suppression de sections ou d'items, et notification non bloquante des erreurs de validation. Un nouvel item DOIT être créé de type « case à cocher » et de criticité « optionnel », ces deux valeurs étant écrites explicitement dans le modèle.

#### Scenario: Configuration d'un item de type case à cocher avec horodatage optionnel
- **WHEN** le concepteur ajoute un item dans une section et sélectionne le type "Case à cocher simple"
- **THEN** l'interface présente un interrupteur permettant d'activer ou désactiver l'option d'horodatage automatique au clic.

#### Scenario: Valeurs par défaut d'un nouvel item
- **WHEN** le concepteur ajoute un item dans une section, ou crée un nouveau modèle avec sa première section
- **THEN** l'item est créé avec `controlType: 'checkbox'` et `criticality: 'optional'` écrits explicitement, sans preuve exigée.

#### Scenario: Configuration d'un item avec choix d'évaluation personnalisables
- **WHEN** le concepteur configure un item avec le type "Choix d'évaluation"
- **THEN** l'interface lui permet d'ajouter des options personnalisées définies par un libellé, un ton choisi dans la palette fixe (`success`, `danger`, `warning`, `info`, `neutral`) et un indicateur « Anomalie » optionnel (`isBlocking`) ; aucune couleur libre ne peut être saisie, et le terme « bloquant » n'est jamais employé pour une option de choix.

#### Scenario: Valeurs par défaut d'un nouveau choix
- **WHEN** le concepteur ajoute un nouveau choix d'évaluation
- **THEN** le choix est créé avec un ton de la palette (par défaut `neutral`).

#### Scenario: Suppression d'une section avec annulation
- **WHEN** le concepteur supprime une section dans le constructeur
- **THEN** la section et ses items sont immédiatement masqués du formulaire, un toast d'annulation s'affiche pendant 6 secondes avec le bouton « Annuler », et si le concepteur clique sur « Annuler », la section est restaurée à son emplacement initial.

#### Scenario: Suppression d'un item avec annulation
- **WHEN** le concepteur supprime un item au sein d'une section
- **THEN** l'item est immédiatement retiré de la section, un toast d'annulation s'affiche pendant 6 secondes avec le bouton « Annuler », et si le concepteur clique sur « Annuler », l'item est restauré à sa position initiale.

#### Scenario: Validation du formulaire de modèle
- **WHEN** le concepteur tente d'enregistrer un modèle sans nom ou sans section
- **THEN** l'enregistrement est bloqué et une notification toast d'avertissement explicative est affichée sans recourir à `window.alert()`.

## ADDED Requirements

### Requirement: Criticité et preuve exigée d'un point de contrôle
Le système DOIT afficher sur chaque item du constructeur sa criticité, sous la forme d'une pastille qui change à chaque clic dans l'ordre bloquant → important → optionnel → bloquant, avec un nom accessible indiquant la criticité courante. Le constructeur DOIT permettre de choisir la preuve exigée parmi « aucune », « commentaire », « photo », « lien » et « fichier », et de saisir sa consigne (`evidenceHint`) lorsque une preuve est exigée. Choisir « aucune » DOIT retirer du modèle la preuve exigée et sa consigne. L'aperçu du constructeur DOIT afficher les badges « bloquant » et « important » et l'indication de preuve exigée, comme le runner.

#### Scenario: Rotation de la criticité
- **GIVEN** un item de criticité « optionnel »
- **WHEN** le concepteur clique trois fois sur sa pastille de criticité
- **THEN** la criticité passe successivement à « bloquant », « important », puis « optionnel »

#### Scenario: Exiger une preuve avec consigne
- **WHEN** le concepteur choisit la preuve exigée « photo » et saisit la consigne « Capture du rapport de tests »
- **THEN** l'item enregistré porte `evidenceRequired: 'photo'` et `evidenceHint: 'Capture du rapport de tests'`

#### Scenario: Retrait de la preuve exigée
- **WHEN** le concepteur repasse la preuve exigée d'un item à « aucune »
- **THEN** l'item enregistré ne contient plus ni `evidenceRequired` ni `evidenceHint`

#### Scenario: Aperçu
- **WHEN** le concepteur passe en mode Aperçu sur un modèle contenant un item bloquant qui exige un lien
- **THEN** l'aperçu affiche le badge « bloquant » et l'indication de preuve exigée sur cet item, et aucun badge sur les items optionnels
