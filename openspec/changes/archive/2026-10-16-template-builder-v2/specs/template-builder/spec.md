## MODIFIED Requirements

### Requirement: Constructeur visuel de templates
Le système DOIT fournir une interface visuelle dédiée permettant de créer un nouveau template ou de modifier un template existant sans manipulation de code JSON, avec annulation par toast lors de la suppression de sections ou d'items, et notification non bloquante des erreurs de validation.

#### Scenario: Configuration d'un item de type case à cocher avec horodatage optionnel
- **WHEN** le concepteur ajoute un item dans une section et sélectionne le type "Case à cocher simple"
- **THEN** l'interface présente un interrupteur permettant d'activer ou désactiver l'option d'horodatage automatique au clic.

#### Scenario: Configuration d'un item avec choix d'évaluation personnalisables
- **WHEN** le concepteur configure un item avec le type "Choix d'évaluation"
- **THEN** l'interface lui permet d'ajouter des options personnalisées définies par un libellé, un ton choisi dans la palette fixe (`success`, `danger`, `warning`, `info`, `neutral`) et un indicateur bloquant optionnel ; aucune couleur libre ne peut être saisie.

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

### Requirement: Éditeur visuel de schéma de contexte
Le système DOIT fournir dans le constructeur de modèle un éditeur dédié aux variables du schéma de contexte (`contextSchema`). Cet éditeur DOIT permettre d'ajouter, modifier, réordonner et supprimer des champs de type texte (`text`), date (`date`) ou liste déroulante (`select`), en définissant leur libellé, leur caractère obligatoire ou facultatif, leur valeur par défaut, leur texte indicatif (`placeholder`) et la liste de leurs options pour les champs de type `select`.

#### Scenario: Ajout d'un champ texte ou date de contexte
- **WHEN** le concepteur ajoute un champ de contexte de type `text` ou `date`
- **THEN** le champ est ajouté au schéma avec son identifiant technique, son libellé, son indicateur obligatoire ou facultatif, son texte d'exemple et sa valeur par défaut.

#### Scenario: Ajout d'un champ liste avec options personnalisées
- **WHEN** le concepteur configure un champ de contexte de type `select`
- **THEN** l'interface permet de définir la liste des options possibles (valeurs et libellés) et d'en désigner une par défaut.

### Requirement: Options avancées d'un point de contrôle
Le système DOIT proposer pour chaque point de contrôle un volet d'options avancées repliable permettant de configurer un motif d'inapplicabilité obligatoire (`requireNaReason`), un champ additionnel de saisie (`extraField`) et une condition d'affichage contextuelle (`visibleIf`).

#### Scenario: Activation du motif N/A obligatoire
- **WHEN** le concepteur coche l'option « Motif N/A obligatoire » sur un item
- **THEN** la propriété `requireNaReason: true` est affectée à l'item, obligeant l'auditeur à fournir une justification textuelle s'il évalue l'item à `N/A`.

#### Scenario: Configuration d'un champ additionnel
- **WHEN** le concepteur renseigne le libellé et le texte d'exemple d'un champ additionnel sur un item
- **THEN** l'objet `extraField` est enregistré sur l'item avec un identifiant technique unique, un libellé et son placeholder.

#### Scenario: Définition d'une condition d'affichage contextuelle
- **WHEN** le concepteur active une condition d'affichage pour un item
- **THEN** l'interface lui propose de sélectionner une variable de contexte existante dans le `contextSchema` et de cocher ou saisir une ou plusieurs valeurs d'activation pour générer la condition `visibleIf: { fieldId, equals }`.

### Requirement: Duplication et réordonnancement des éléments
Le système DOIT permettre de dupliquer rapidement n'importe quel item ou section, et de réordonner les éléments au sein d'une même section ou d'une section à l'autre par glisser-déposer (`@angular/cdk/drag-drop`) tout en conservant une alternative accessible au clavier via les boutons de déplacement (↑/↓). Chaque élément dupliqué DOIT recevoir de nouveaux identifiants uniques générés par `crypto.randomUUID()`.

#### Scenario: Duplication d'un point de contrôle
- **WHEN** le concepteur clique sur le bouton « Dupliquer » d'un item
- **THEN** une copie conforme de l'item est insérée immédiatement après l'original avec un nouvel `id` unique, ses choix ou options avancées éventuels étant fidèlement reproduits.

#### Scenario: Duplication d'une section
- **WHEN** le concepteur clique sur le bouton « Dupliquer » d'une section
- **THEN** une copie complète de la section et de tous les items qu'elle contient est insérée après l'originale, chaque section et item recevant un nouvel `id` unique.

#### Scenario: Réordonnancement d'items par glisser-déposer
- **WHEN** le concepteur glisse un item vers le haut ou vers le bas, ou le déplace vers une autre section
- **THEN** l'item est repositionné à l'emplacement cible sans altération de ses propriétés.

#### Scenario: Déplacement accessible au clavier
- **WHEN** le concepteur active les boutons ↑ ou ↓ sur un item ou une section
- **THEN** l'élément est permuté avec son voisin direct dans l'ordre d'affichage.

### Requirement: Intégrité des identifiants et prévention des orphelins
Le système DOIT garantir la cohérence relationnelle du modèle en interdisant les doublons d'identifiants d'items sur tout le template, en protégeant les identifiants d'items existants contre toute modification accidentelle en mode édition, et en alertant le concepteur si la suppression ou la modification d'un champ de contexte rend orpheline une condition `visibleIf`.

#### Scenario: Détection et rejet d'identifiants d'items en doublon
- **WHEN** le concepteur tente d'enregistrer un modèle contenant deux items avec le même `id`
- **THEN** l'enregistrement est bloqué et un toast d'erreur explicite nomme l'identifiant en conflit.

#### Scenario: Protection des identifiants existants en mode édition
- **WHEN** le concepteur ouvre un template existant en mode édition
- **THEN** les champs `id` des items existants sont figés et non modifiables dans l'interface, préservant ainsi l'association des réponses lors des mises à jour de sessions (`rebaseSessionOnTemplate`).

#### Scenario: Alerte en cas de suppression d'une variable de contexte référencée
- **WHEN** le concepteur tente de supprimer ou modifier l'identifiant d'un champ de contexte utilisé par une ou plusieurs conditions `visibleIf`
- **THEN** une alerte modale ou un avertissement bloque la suppression et liste les items dépendants affectés.

### Requirement: Garde contre les modifications non enregistrées
Le système DOIT intégrer une garde de navigation (`CanDeactivate`) et une écoute de l'événement navigateur `beforeunload` sur les vues du constructeur (`/templates/builder` et `/templates/:id/edit`). Si des modifications ont été apportées par rapport à l'état initial sans être enregistrées, le système DOIT interrompre la navigation et demander confirmation à l'utilisateur via le dialogue modal applicatif (`DialogService`).

#### Scenario: Navigation interne avec formulaire modifié
- **WHEN** le concepteur modifie un élément du formulaire et clique sur un lien de navigation vers une autre page de l'application
- **THEN** la navigation est suspendue et une modale de confirmation demande à l'utilisateur s'il souhaite quitter la page en abandonnant ses modifications.

#### Scenario: Abandon confirmé
- **WHEN** le concepteur confirme l'abandon dans la boîte de dialogue
- **THEN** la navigation s'exécute vers la route demandée et les modifications non enregistrées sont écartées.

#### Scenario: Annulation de la navigation
- **WHEN** le concepteur annule la boîte de dialogue de confirmation
- **THEN** le concepteur reste sur le constructeur avec son formulaire et ses modifications intacts.

#### Scenario: Fermeture de l'onglet ou rafraîchissement navigateur
- **WHEN** le concepteur ferme l'onglet ou rafraîchit la page alors que des modifications non enregistrées existent
- **THEN** l'événement `beforeunload` du navigateur est intercepté pour inviter l'utilisateur à confirmer la fermeture.
