# Spécifications : Raccourcis clavier du runner

## Purpose
Permettre de remplir une checklist entièrement au clavier : item actif, navigation, raccourcis d'action sur l'item actif, annulation par Échap et aide, sans jamais interférer avec une saisie, une fenêtre modale ou une session terminée.

## Requirements

### Requirement: Item actif
Le système DOIT tenir, dans le runner, un item actif parmi les contrôles affichés (après application du filtre et du repli des sections, dans l'ordre d'affichage). L'item actif DOIT devenir celui que l'utilisateur clique, celui qui reçoit le focus, ou celui vers lequel il navigue. Il DOIT être le seul contrôle atteignable par la touche Tab parmi les lignes, et être visuellement distingué. Au chargement, l'item actif est le premier contrôle affiché. Lorsque l'item actif disparaît de la liste affichée (filtre, repli de sa section), le contrôle qui le suivait dans la liste DOIT devenir actif, ou à défaut le dernier contrôle affiché.

#### Scenario: Item actif au clic
- **WHEN** l'utilisateur clique sur la ligne d'un contrôle
- **THEN** ce contrôle devient l'item actif

#### Scenario: Item actif qui sort du filtre
- **GIVEN** le filtre « À traiter » est actif et l'item actif est le contrôle « Tests d'intégration », suivi du contrôle « Plan de rollback »
- **WHEN** l'utilisateur répond au contrôle « Tests d'intégration »
- **THEN** « Tests d'intégration » disparaît de la liste et « Plan de rollback » devient l'item actif

### Requirement: Navigation au clavier
Le système DOIT permettre de déplacer l'item actif avec les flèches ↓ (contrôle affiché suivant) et ↑ (contrôle affiché précédent), en sautant les sections repliées et les contrôles masqués par le filtre. La navigation DOIT donner le focus à la ligne du nouvel item actif et la faire défiler dans la zone visible. Aux extrémités de la liste, l'item actif ne change pas.

#### Scenario: Passage au contrôle suivant
- **WHEN** l'item actif est le dernier contrôle d'une section dépliée, que la section suivante est repliée et que l'utilisateur appuie sur ↓
- **THEN** l'item actif devient le premier contrôle de la section dépliée qui suit, et sa ligne reçoit le focus

#### Scenario: Fin de liste
- **WHEN** l'item actif est le dernier contrôle affiché et que l'utilisateur appuie sur ↓
- **THEN** l'item actif ne change pas

### Requirement: Raccourcis d'action sur l'item actif
Le système DOIT associer les touches suivantes à des actions sur l'item actif :
- Espace : geste principal (capacité `quick-check`) ;
- K : mise en KO, ou retrait du KO, d'un contrôle de type statut ;
- N : mise en `N/A`, ou retrait du `N/A` ;
- A : ouverture ou fermeture du tiroir.

Les lettres DOIVENT être reconnues en minuscule comme en majuscule. Une touche sans objet pour le type du contrôle (K sur une case à cocher, Espace sur un choix) NE DOIT avoir aucun effet. Lorsque le focus est sur un bouton ou un lien, Espace DOIT garder son comportement natif (activer cet élément).

#### Scenario: Geste principal par Espace
- **WHEN** l'item actif est un contrôle de type statut sans réponse, que sa ligne a le focus et que l'utilisateur appuie sur Espace
- **THEN** le contrôle passe au statut `OK` et la page ne défile pas

#### Scenario: KO par la touche K
- **WHEN** l'item actif est un contrôle de type statut et que l'utilisateur appuie sur K
- **THEN** le contrôle passe au statut `KO`, son tiroir s'ouvre et le focus est placé dans la note

#### Scenario: N/A par la touche N
- **WHEN** l'item actif est un contrôle de type case à cocher sans réponse et que l'utilisateur appuie sur N
- **THEN** le contrôle passe au statut `N/A`

#### Scenario: Tiroir par la touche A
- **WHEN** l'utilisateur appuie sur A alors que le tiroir de l'item actif est fermé
- **THEN** le tiroir de l'item actif s'ouvre

#### Scenario: Touche sans objet
- **WHEN** l'item actif est un contrôle de type case à cocher et que l'utilisateur appuie sur K
- **THEN** rien ne se passe

### Requirement: Annulation par Échap
Le système DOIT traiter la touche Échap dans le runner par ordre de priorité : fermer l'aide des raccourcis si elle est ouverte ; sinon annuler la demande de preuve en cours ; sinon rétablir la note en cours de saisie ; sinon fermer le tiroir ouvert et rendre le focus à la ligne de son contrôle.

#### Scenario: Échap dans une demande de preuve
- **WHEN** une demande de preuve est ouverte sur un contrôle et que l'utilisateur appuie sur Échap
- **THEN** la demande se ferme sans donner de réponse au contrôle

### Requirement: Gardes des raccourcis
Le système NE DOIT déclencher aucun raccourci à une lettre, ni ?, ni Espace, ni les flèches de navigation lorsque le focus est dans un champ de saisie (`input`, `textarea`, `select` ou élément `contenteditable`), lorsqu'une fenêtre modale est ouverte, ou lorsque la touche Ctrl, Alt ou Méta est enfoncée. Sur une session terminée, les raccourcis qui modifient une réponse (Espace, K, N) NE DOIVENT avoir aucun effet, tandis que la navigation, l'ouverture du tiroir et l'aide restent disponibles.

#### Scenario: Saisie dans une note
- **WHEN** le focus est dans la note d'un contrôle et que l'utilisateur tape « Nok »
- **THEN** les caractères sont saisis dans la note et aucun raccourci n'est déclenché

#### Scenario: Fenêtre modale ouverte
- **WHEN** la fenêtre d'export JSON est ouverte et que l'utilisateur appuie sur K
- **THEN** aucune réponse n'est modifiée

#### Scenario: Raccourci du navigateur
- **WHEN** l'utilisateur appuie sur Ctrl+A dans le runner
- **THEN** le tiroir de l'item actif ne s'ouvre pas et le navigateur garde son comportement habituel

#### Scenario: Session terminée
- **WHEN** la session est terminée et que l'utilisateur appuie sur Espace, puis sur ↓, puis sur A
- **THEN** aucune réponse n'est modifiée, l'item actif passe au contrôle suivant et son tiroir s'ouvre en consultation

### Requirement: Aide des raccourcis
Le système DOIT afficher, à l'appui sur la touche ? ou sur un bouton d'aide du résumé de progression, une fenêtre modale listant tous les raccourcis du runner. Cette fenêtre DOIT piéger le focus, se fermer avec Échap et rendre le focus à l'élément qui l'a ouverte.

#### Scenario: Ouverture de l'aide
- **WHEN** aucun champ de saisie n'a le focus et que l'utilisateur appuie sur ?
- **THEN** la fenêtre d'aide s'ouvre et liste les raccourcis ↑/↓, Espace, K, N, A, Entrée, Échap et ?

#### Scenario: Fermeture de l'aide
- **WHEN** la fenêtre d'aide est ouverte et que l'utilisateur appuie sur Échap
- **THEN** la fenêtre se ferme et le focus revient à l'élément qui avait le focus avant son ouverture
