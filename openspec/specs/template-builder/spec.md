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

### Requirement: Éditeur visuel de schéma de contexte
Le système DOIT fournir dans le constructeur de modèle un éditeur dédié aux variables du schéma de contexte (`contextSchema`). Cet éditeur DOIT permettre d'ajouter, modifier, réordonner et supprimer des champs de type texte (`text`), date (`date`) ou liste déroulante (`select`), en définissant leur libellé, leur caractère obligatoire ou facultatif, leur valeur par défaut, leur texte indicatif (`placeholder`) et la liste de leurs options pour les champs de type `select`.

#### Scenario: Ajout d'un champ texte ou date de contexte
- **WHEN** le concepteur ajoute un champ de contexte de type `text` ou `date`
- **THEN** le champ est ajouté au schéma avec son identifiant technique, son libellé, son indicateur obligatoire ou facultatif, son texte d'exemple et sa valeur par défaut.

#### Scenario: Ajout d'un champ liste avec options personnalisées
- **WHEN** le concepteur configure un champ de contexte de type `select`
- **THEN** l'interface permet de définir la liste des options possibles (valeurs et libellés) et d'en désigner une par défaut.

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
