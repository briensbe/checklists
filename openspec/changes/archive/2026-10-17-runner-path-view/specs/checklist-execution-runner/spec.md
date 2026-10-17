## MODIFIED Requirements

### Requirement: Action de passage groupé à OK
Le système DOIT fournir une action permettant de donner en une seule fois une réponse conforme à tous les contrôles applicables encore sans réponse (statut `OK`, case cochée, ou premier choix sans anomalie), et DOIT permettre d'annuler cette action pendant 6 secondes via une notification toast. L'action NE DOIT modifier aucun contrôle déjà répondu, y compris un contrôle `N/A` de n'importe quel type. Elle NE DOIT pas répondre à un contrôle bloquant dont la preuve exigée par le modèle n'est pas fournie ; un contrôle non bloquant dans ce cas DOIT recevoir sa réponse avec l'indicateur « preuve à compléter » (`evidencePending`). Sur un modèle à dépendances, l'action NE DOIT concerner que les contrôles des étapes débloquées au moment où elle est lancée : les étapes qu'elle débloque ne sont pas remplies à leur tour, et le toast DOIT indiquer que les étapes verrouillées n'ont pas été modifiées lorsqu'elles contiennent des contrôles sans réponse.

#### Scenario: Exécution du passage groupé
- **WHEN** l'utilisateur clique sur « Passer le reste à OK »
- **THEN** tous les points de contrôle applicables encore non renseignés reçoivent une réponse conforme selon leur type, sans écraser les réponses déjà données (`KO`, `N/A`, choix), et un toast avec action « Annuler » s'affiche pendant 6 secondes.

#### Scenario: Case à cocher non applicable
- **GIVEN** un contrôle de type case à cocher au statut `N/A`
- **WHEN** l'utilisateur clique sur « Passer le reste à OK »
- **THEN** le contrôle reste `N/A` et n'est pas coché

#### Scenario: Preuve exigée manquante
- **GIVEN** un contrôle bloquant et un contrôle important, tous deux sans réponse, dont le modèle exige une photo qui n'a pas été fournie
- **WHEN** l'utilisateur clique sur « Passer le reste à OK »
- **THEN** le contrôle bloquant reste sans réponse, le contrôle important reçoit sa réponse avec l'indicateur « preuve à compléter », et le toast indique le nombre de contrôles laissés sans réponse faute de preuve

#### Scenario: Étapes verrouillées non concernées
- **GIVEN** une session du modèle « Mise en production » où seule l'étape « Préparation » est débloquée, sans aucune réponse
- **WHEN** l'utilisateur clique sur « Passer le reste à OK »
- **THEN** les trois contrôles de « Préparation » sont cochés, « Build » et « Documentation » se débloquent mais leurs contrôles restent sans réponse, et le toast indique que les étapes verrouillées n'ont pas été modifiées

#### Scenario: Annulation du passage groupé
- **WHEN** l'utilisateur clique sur « Annuler » dans le toast de passage groupé avant son expiration
- **THEN** les réponses de la session sont immédiatement restaurées dans leur état exact précédant l'action via `mutate()`, historiques et preuves en attente compris, et le toast disparaît.

### Requirement: Prochain item à traiter
Le système DOIT fournir dans la barre de progression un bouton « Prochain item à traiter » qui cherche, dans l'ordre du modèle (sections repliées comprises) et à partir de l'item actif, le premier contrôle applicable sans réponse qui le suit, en reprenant au début de la checklist si besoin. Les contrôles des étapes verrouillées NE DOIVENT pas être retenus. Le système DOIT alors déplier sa section (ou, en vue chemin, sélectionner son étape, capacité `runner-path-view`), repasser le filtre à « Tous » si le filtre actif le masque, faire défiler sa ligne dans la zone visible, lui donner le focus et en faire l'item actif. Lorsque tous les contrôles applicables ont une réponse, le bouton DOIT être désactivé et indiquer que tout est renseigné. Lorsque les seuls contrôles sans réponse sont dans des étapes verrouillées, le bouton DOIT être désactivé et indiquer que les contrôles restants attendent l'ouverture de leur étape.

#### Scenario: Contrôle suivant sans réponse
- **GIVEN** l'item actif est le troisième contrôle de la checklist, le quatrième a une réponse et le cinquième n'en a pas
- **WHEN** l'utilisateur clique sur « Prochain item à traiter »
- **THEN** le cinquième contrôle reçoit le focus et devient l'item actif

#### Scenario: Reprise au début
- **WHEN** aucun contrôle après l'item actif n'est sans réponse, mais que le premier contrôle de la checklist n'a pas de réponse
- **THEN** le premier contrôle de la checklist devient l'item actif

#### Scenario: Contrôle dans une section repliée et masqué par le filtre
- **GIVEN** le filtre « KO uniquement » est actif et le prochain contrôle sans réponse est dans une section repliée
- **WHEN** l'utilisateur clique sur « Prochain item à traiter »
- **THEN** le filtre repasse à « Tous », la section se déplie et le contrôle reçoit le focus

#### Scenario: Étape verrouillée ignorée
- **GIVEN** l'item actif est « FAQ du support », dernier contrôle de « Documentation », les étapes « Tests », « Go / no-go » et « Déploiement » sont verrouillées avec des contrôles sans réponse, et « Changelog rédigé » de « Préparation » n'a pas de réponse
- **WHEN** l'utilisateur clique sur « Prochain item à traiter »
- **THEN** aucun contrôle des étapes verrouillées n'est retenu et « Changelog rédigé » devient l'item actif

#### Scenario: Contrôles restants dans des étapes verrouillées
- **WHEN** tous les contrôles des étapes débloquées ont une réponse, l'un d'eux étant un bloquant `KO`, et que les étapes verrouillées ont des contrôles sans réponse
- **THEN** le bouton « Prochain item à traiter » est désactivé et indique que les contrôles restants attendent l'ouverture de leur étape

#### Scenario: Tout est renseigné
- **WHEN** tous les contrôles applicables de la session ont une réponse
- **THEN** le bouton « Prochain item à traiter » est désactivé et indique que tout est renseigné
