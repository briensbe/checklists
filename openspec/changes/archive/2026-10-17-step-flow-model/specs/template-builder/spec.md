## MODIFIED Requirements

### Requirement: Options avancées d'un point de contrôle
Le système DOIT proposer pour chaque point de contrôle un volet d'options avancées repliable permettant de configurer un champ additionnel de saisie (`extraField`) et une condition d'affichage contextuelle (`visibleIf`). Le constructeur NE DOIT PAS proposer d'option de motif N/A obligatoire, et un modèle enregistré depuis le constructeur NE DOIT PAS contenir de propriété `requireNaReason`.

#### Scenario: Configuration d'un champ additionnel
- **WHEN** le concepteur renseigne le libellé et le texte d'exemple d'un champ additionnel sur un item
- **THEN** l'objet `extraField` est enregistré sur l'item avec un identifiant technique unique, un libellé et son placeholder.

#### Scenario: Définition d'une condition d'affichage contextuelle
- **WHEN** le concepteur active une condition d'affichage pour un item
- **THEN** l'interface lui propose de sélectionner une variable de contexte existante dans le `contextSchema` et de cocher ou saisir une ou plusieurs valeurs d'activation pour générer la condition `visibleIf: { fieldId, equals }`.

#### Scenario: Activation du motif N/A obligatoire
- **WHEN** le concepteur cherche à rendre un motif N/A obligatoire sur un item, y compris dans un modèle dont un item porte encore `requireNaReason: true`
- **THEN** aucune option ne le permet (un N/A n'exige jamais de justification), et le modèle enregistré ne contient plus la propriété `requireNaReason`.

### Requirement: Intégrité des identifiants et prévention des orphelins
Le système DOIT garantir la cohérence relationnelle du modèle en interdisant les doublons d'identifiants d'items sur tout le template, en protégeant les identifiants d'items et de sections existants contre toute modification accidentelle en mode édition, en alertant le concepteur si la suppression ou la modification d'un champ de contexte rend orpheline une condition `visibleIf`, et en maintenant valides les dépendances entre sections (`dependsOn`).

#### Scenario: Détection et rejet d'identifiants d'items en doublon
- **WHEN** le concepteur tente d'enregistrer un modèle contenant deux items avec le même `id`
- **THEN** l'enregistrement est bloqué et un toast d'erreur explicite nomme l'identifiant en conflit.

#### Scenario: Protection des identifiants existants en mode édition
- **WHEN** le concepteur ouvre un template existant en mode édition
- **THEN** les champs `id` des items et des sections existants sont figés et non modifiables dans l'interface, préservant ainsi l'association des réponses lors des mises à jour de sessions (`rebaseSessionOnTemplate`) et les références de `dependsOn`.

#### Scenario: Alerte en cas de suppression d'une variable de contexte référencée
- **WHEN** le concepteur tente de supprimer ou modifier l'identifiant d'un champ de contexte utilisé par une ou plusieurs conditions `visibleIf`
- **THEN** une alerte modale ou un avertissement bloque la suppression et liste les items dépendants affectés.

#### Scenario: Suppression d'une section référencée par une dépendance
- **WHEN** le concepteur supprime une section dont d'autres sections dépendent
- **THEN** son identifiant est retiré du `dependsOn` des autres sections, et un clic sur « Annuler » dans le toast restaure à la fois la section et ces dépendances.

#### Scenario: Duplication d'une section qui a des dépendances
- **WHEN** le concepteur duplique une section qui déclare des dépendances
- **THEN** la copie déclare les mêmes dépendances que l'originale, et aucune autre section ne dépend de la copie.

#### Scenario: Rejet d'un enchaînement invalide à l'enregistrement
- **WHEN** le concepteur tente d'enregistrer un modèle dont une section dépend d'elle-même, d'une section inexistante, ou dont les dépendances forment une boucle
- **THEN** l'enregistrement est bloqué et un toast d'erreur nomme les sections concernées.
