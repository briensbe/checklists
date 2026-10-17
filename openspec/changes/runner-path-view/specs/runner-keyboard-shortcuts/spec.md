## MODIFIED Requirements

### Requirement: Item actif
Le système DOIT tenir, dans le runner, un item actif parmi les contrôles affichés (après application du filtre et du repli des sections, dans l'ordre d'affichage). Sur un modèle à dépendances, les contrôles des étapes verrouillées ne sont jamais des contrôles affichés, et, en vue chemin, les contrôles affichés se limitent à ceux du panneau de l'étape sélectionnée (capacité `runner-path-view`). L'item actif DOIT devenir celui que l'utilisateur clique, celui qui reçoit le focus, ou celui vers lequel il navigue. Il DOIT être le seul contrôle atteignable par la touche Tab parmi les lignes, et être visuellement distingué. Au chargement, l'item actif est le premier contrôle affiché. Lorsque l'item actif disparaît de la liste affichée (filtre, repli de sa section, verrouillage de son étape, sélection d'une autre étape), le contrôle qui le suivait dans la liste DOIT devenir actif, ou à défaut le dernier contrôle affiché.

#### Scenario: Item actif au clic
- **WHEN** l'utilisateur clique sur la ligne d'un contrôle
- **THEN** ce contrôle devient l'item actif

#### Scenario: Item actif qui sort du filtre
- **GIVEN** le filtre « À traiter » est actif et l'item actif est le contrôle « Tests d'intégration », suivi du contrôle « Plan de rollback »
- **WHEN** l'utilisateur répond au contrôle « Tests d'intégration »
- **THEN** « Tests d'intégration » disparaît de la liste et « Plan de rollback » devient l'item actif

#### Scenario: Navigation limitée à l'étape sélectionnée
- **GIVEN** en vue chemin, l'étape « Build » est sélectionnée et l'item actif est son dernier contrôle, « Version taggée »
- **WHEN** l'utilisateur appuie sur ↓
- **THEN** l'item actif ne change pas

#### Scenario: Changement d'étape sélectionnée
- **WHEN** en vue chemin, l'utilisateur sélectionne l'étape « Documentation », débloquée
- **THEN** l'item actif devient le premier contrôle affiché du panneau de « Documentation »

### Requirement: Raccourcis d'action sur l'item actif
Le système DOIT associer les touches suivantes à des actions sur l'item actif :
- Espace : geste principal (capacité `quick-check`) ;
- K : mise en KO, ou retrait du KO, d'un contrôle de type statut ;
- N : mise en `N/A`, ou retrait du `N/A` ;
- A : ouverture ou fermeture du tiroir.

Les lettres DOIVENT être reconnues en minuscule comme en majuscule. Une touche sans objet pour le type du contrôle (K sur une case à cocher, Espace sur un choix) NE DOIT avoir aucun effet. Lorsque le focus est sur un bouton, un lien ou tout élément qui a le rôle de bouton, comme un nœud du graphe des étapes (capacité `step-graph`), Espace DOIT garder le comportement de cet élément (l'activer) et NE DOIT pas déclencher le geste principal.

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

#### Scenario: Espace sur un nœud du graphe
- **WHEN** le focus est sur le nœud « Tests » du graphe des étapes et que l'utilisateur appuie sur Espace
- **THEN** l'étape « Tests » est sélectionnée et la réponse de l'item actif n'est pas modifiée
