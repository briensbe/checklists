## ADDED Requirements

### Requirement: Vue chemin et bascule Chemin / Liste
Le système DOIT proposer dans le runner, pour une session dont le modèle déclare au moins une dépendance entre sections, une vue « Chemin » composée du graphe des étapes (capacité `step-graph`) puis du panneau de l'étape sélectionnée, et une bascule « Chemin / Liste » entre cette vue et la vue liste. La vue « Chemin » DOIT être la vue par défaut. Le dernier choix de l'utilisateur DOIT être mémorisé par le navigateur, pour tous les modèles à dépendances, sans être enregistré dans la session. Pour un modèle sans dépendance, le runner DOIT afficher la vue liste actuelle, sans bascule, sans graphe ni pied d'étape.

#### Scenario: Ouverture d'une session à étapes
- **WHEN** l'utilisateur ouvre une session du modèle « Mise en production » pour la première fois
- **THEN** le runner affiche le graphe des étapes, le panneau d'une étape et la bascule « Chemin / Liste » positionnée sur « Chemin »

#### Scenario: Choix mémorisé
- **GIVEN** l'utilisateur a choisi la vue « Liste » sur une session à étapes
- **WHEN** il ouvre une autre session dont le modèle a des dépendances
- **THEN** le runner affiche la vue liste

#### Scenario: Modèle sans dépendance
- **WHEN** l'utilisateur ouvre une session du modèle d'audit de livraison, qui ne déclare aucune dépendance
- **THEN** le runner affiche la vue liste actuelle, sans bascule ni graphe

### Requirement: Étape sélectionnée
Le système DOIT tenir, en vue chemin, une étape sélectionnée dont le panneau est affiché sous le graphe. À l'ouverture du runner, l'étape sélectionnée DOIT être la première étape ouverte (`open`) dans l'ordre topologique, à défaut la première étape franchie avec des restes (`passed`), à défaut la dernière étape de l'ordre topologique. Un clic sur un nœud, ou Entrée ou Espace sur un nœud qui a le focus, DOIT sélectionner son étape. L'étape sélectionnée NE DOIT pas changer d'elle-même quand son état change : une étape sélectionnée qui se verrouille reste sélectionnée et affiche son panneau d'étape verrouillée. L'étape sélectionnée n'est pas enregistrée dans la session.

#### Scenario: Étape sélectionnée à l'ouverture
- **GIVEN** une session où « Préparation » est franchie et terminée, « Build » est ouverte et « Documentation » est ouverte
- **WHEN** l'utilisateur ouvre le runner en vue chemin
- **THEN** l'étape « Build », première étape ouverte dans l'ordre topologique, est sélectionnée

#### Scenario: Toutes les étapes terminées
- **WHEN** l'utilisateur ouvre une session dont toutes les étapes sont terminées
- **THEN** l'étape « Déploiement », dernière de l'ordre topologique, est sélectionnée

#### Scenario: Sélection d'une étape
- **WHEN** l'utilisateur clique sur le nœud « Documentation »
- **THEN** le panneau affiche l'étape « Documentation »

### Requirement: Panneau d'une étape débloquée
Le système DOIT afficher, pour une étape sélectionnée débloquée, un panneau composé d'un en-tête (icône et titre de l'étape, son état, la mention « jonction » si elle déclare au moins deux dépendances, et le nombre de contrôles applicables qui ont une réponse sur leur total), des lignes de ses contrôles applicables, puis de son pied d'étape. Ces lignes DOIVENT être les mêmes que dans la vue liste et se comporter de la même façon : geste principal, mise en KO, tiroir, preuve exigée, raccourcis clavier et lecture seule (capacités `quick-check`, `evidence-attachment` et `runner-keyboard-shortcuts`). Le filtre actif (« Tous », « À traiter », « KO uniquement ») DOIT s'appliquer aux lignes du panneau. Les commandes « Tout déplier » et « Tout replier » ne concernent que la vue liste.

#### Scenario: Coche dans le panneau
- **WHEN** l'utilisateur clique sur la ligne « Version taggée » dans le panneau de l'étape « Build »
- **THEN** le contrôle est coché, l'anneau du nœud « Build » progresse et la réponse est enregistrée

#### Scenario: Filtre appliqué au panneau
- **GIVEN** le filtre « À traiter » est actif
- **WHEN** l'étape sélectionnée a un contrôle coché et un contrôle sans réponse
- **THEN** le panneau n'affiche que la ligne du contrôle sans réponse

### Requirement: Étape verrouillée
Le système DOIT afficher, pour une étape verrouillée, d'abord la liste de ses prérequis (les étapes dont elle dépend), introduite par « Cette étape attend : » ou, pour une jonction en mode `any`, par « Cette étape attend l'une de ces étapes : », chacun avec son état : « prête » (franchie), « bloquants en cours » (débloquée mais pas franchie) ou « pas encore ouverte » (verrouillée). Le système DOIT ensuite afficher ses contrôles applicables en simple liste de texte discret, sans case, sans badge, sans trombone et sans aucune commande de saisie. Un contrôle qui a déjà une réponse (étape reverrouillée) DOIT rappeler cette réponse en texte discret (« fait », « OK », « KO », « N/A » ou le libellé du choix), et la liste DOIT indiquer que les réponses sont conservées et redeviendront modifiables à l'ouverture de la porte. Ce contenu DOIT être affiché dans le panneau de la vue chemin comme dans la section de la vue liste.

#### Scenario: Prérequis d'une jonction
- **GIVEN** « Tests » est franchie et « Documentation » est débloquée avec un bloquant sans réponse
- **WHEN** l'utilisateur sélectionne l'étape verrouillée « Go / no-go »
- **THEN** le panneau indique « Cette étape attend : », « Tests » avec l'état « prête » et « Documentation » avec l'état « bloquants en cours », puis liste « Validation du PO » et « Plan de rollback rédigé » en texte simple

#### Scenario: Étape reverrouillée avec des réponses
- **GIVEN** « Build » est franchie et le contrôle « Recette métier validée » de « Tests » est coché
- **WHEN** l'utilisateur décoche « Build vert sur la branche de release »
- **THEN** « Tests » redevient verrouillée, son panneau rappelle « Recette métier validée » avec la mention « fait » en texte discret, sans case, et la réponse est conservée

#### Scenario: Section verrouillée en vue liste
- **WHEN** l'utilisateur affiche la vue liste alors que l'étape « Tests » est verrouillée
- **THEN** la section « Tests » affiche ses prérequis et ses contrôles en texte simple, sans ligne de saisie

#### Scenario: Tiroir ouvert sur une étape qui se verrouille
- **GIVEN** en vue liste, le tiroir d'un contrôle de « Tests » est ouvert, avec une note en cours de saisie
- **WHEN** l'utilisateur décoche un bloquant de « Build », ce qui reverrouille « Tests »
- **THEN** le tiroir se ferme, la note saisie est conservée et la section « Tests » affiche son contenu d'étape verrouillée

### Requirement: Pied d'étape
Le système DOIT afficher, sous les lignes d'une étape débloquée d'un modèle à dépendances, en vue chemin comme en vue liste, un pied d'étape qui contient, selon le cas :
- si l'étape n'est pas franchie : le nombre de contrôles bloquants applicables non résolus avant d'ouvrir la suite ;
- si l'étape est franchie : pour chaque étape suivante, « Porte ouverte vers « … » » lorsqu'elle est débloquée, ou « « … » attend encore une autre branche » sinon ; pour une étape sans suivante, « Étape finale franchie », ou « Toutes les étapes sont franchies » lorsque c'est le cas de toutes les étapes ;
- les contrôles bloquants passés en `N/A`, avec leur nombre et leurs libellés ;
- les contrôles en « preuve à compléter » et les contrôles signalés « preuve manquante » (preuve exigée supprimée après la validation), avec leur nombre et leurs libellés ;
- si sa porte souple a été forcée : la date du forçage et sa justification.

Chaque mention d'une étape suivante débloquée DOIT sélectionner cette étape quand on l'actionne, et chaque libellé de contrôle mentionné DOIT mener à ce contrôle.

#### Scenario: Porte ouverte
- **WHEN** tous les bloquants de « Préparation » sont résolus
- **THEN** le pied de « Préparation » indique « Porte ouverte vers « Build » » et « Porte ouverte vers « Documentation » », et actionner la première mention sélectionne l'étape « Build »

#### Scenario: Branche en attente
- **WHEN** « Tests » est franchie et « Documentation » ne l'est pas
- **THEN** le pied de « Tests » indique « « Go / no-go » attend encore une autre branche »

#### Scenario: Bloquants restants
- **WHEN** l'étape « Build » a ses deux bloquants sans réponse
- **THEN** son pied indique « 2 bloquants avant d'ouvrir la suite »

#### Scenario: Bloquant passé en N/A
- **WHEN** le bloquant « Créneau de déploiement réservé » est au statut `N/A`
- **THEN** le pied de « Préparation » signale 1 bloquant passé en N/A, avec son libellé

#### Scenario: Preuve manquante
- **GIVEN** le contrôle bloquant « Tests automatisés au vert » est coché avec sa photo exigée
- **WHEN** la suppression de cette photo devient définitive
- **THEN** le pied de « Tests » signale 1 preuve manquante, avec le libellé du contrôle

#### Scenario: Modèle sans dépendance
- **WHEN** le modèle de la session ne déclare aucune dépendance
- **THEN** aucune section n'affiche de pied d'étape

### Requirement: Forçage d'une porte souple
Le système DOIT proposer, dans le pied d'une étape à porte souple (`gate: 'soft'`) débloquée mais non franchie, d'une session en cours, une commande « Forcer le passage ». Cette commande DOIT afficher, dans le pied d'étape et sans fenêtre modale, un champ de justification obligatoire et les boutons « Forcer » et « Annuler ». « Forcer » DOIT rester désactivé tant que la justification est vide, et enregistrer le forçage avec sa justification et sa date (capacité `step-flow`). « Annuler » et Échap DOIVENT fermer le formulaire sans rien enregistrer. Une étape à porte stricte, une étape franchie et une session terminée NE DOIVENT pas proposer cette commande. Un forçage enregistré ne se révoque pas depuis le runner : seule une réinitialisation confirmée de la session l'efface.

#### Scenario: Forçage de la porte de la documentation
- **GIVEN** l'étape « Documentation », à porte souple, a le bloquant « Runbook d'exploitation » sans réponse
- **WHEN** l'utilisateur clique sur « Forcer le passage », saisit « Runbook livré la semaine prochaine, validé par l'exploitation » puis clique sur « Forcer »
- **THEN** le forçage est enregistré avec sa date, « Documentation » est franchie, son pied affiche la date et la justification du forçage, et le badge de jonction de « Go / no-go » progresse

#### Scenario: Justification vide
- **WHEN** l'utilisateur ouvre le formulaire de forçage sans saisir de justification
- **THEN** le bouton « Forcer » est désactivé

#### Scenario: Porte stricte
- **WHEN** l'étape « Build », à porte stricte, a un bloquant sans réponse
- **THEN** son pied n'affiche aucune commande « Forcer le passage »

#### Scenario: Annulation du forçage
- **WHEN** l'utilisateur ouvre le formulaire de forçage, saisit une justification puis appuie sur Échap
- **THEN** le formulaire se ferme et aucun forçage n'est enregistré

### Requirement: Contrôles laissés en route
Le système DOIT afficher, dans le résumé de la checklist d'un modèle à dépendances, en vue chemin comme en vue liste, le bloc « Laissés en route » qui liste les contrôles laissés en route (capacité `step-flow`), chacun avec son libellé, le titre de son étape et la raison (« sans réponse » ou « preuve à compléter »). Le bloc NE DOIT pas s'afficher quand la liste est vide. Actionner un contrôle de la liste DOIT mener à ce contrôle.

#### Scenario: Optionnel oublié
- **GIVEN** « Préparation » est franchie, « Build » est débloquée et « Changelog rédigé » n'a pas de réponse
- **WHEN** l'utilisateur consulte le résumé de la checklist
- **THEN** le bloc « Laissés en route » liste « Changelog rédigé », de l'étape « Préparation », sans réponse

#### Scenario: Retour au contrôle oublié
- **WHEN** l'utilisateur clique sur « Changelog rédigé » dans le bloc « Laissés en route », en vue chemin
- **THEN** l'étape « Préparation » est sélectionnée et la ligne « Changelog rédigé » reçoit le focus

### Requirement: Navigation vers un contrôle ou une étape
Le système DOIT, en vue chemin, remplacer le dépliage de la section par la sélection de l'étape pour toute navigation vers un contrôle : « Prochain item à traiter », bloc « Laissés en route », anomalie du panneau de clôture, libellé du pied d'étape. Comme en vue liste, le filtre DOIT repasser à « Tous » s'il masque le contrôle, puis la ligne DOIT défiler dans la zone visible, recevoir le focus et devenir l'item actif. Si le contrôle appartient à une étape verrouillée, son étape DOIT être sélectionnée et le panneau d'étape verrouillée recevoir le focus. Un clic sur l'anneau d'une section, dans la barre de progression, DOIT sélectionner son étape et faire défiler le panneau dans la zone visible.

#### Scenario: Anomalie de clôture dans une étape verrouillée
- **GIVEN** la clôture est refusée parce que le bloquant « Validation du PO » de l'étape verrouillée « Go / no-go » n'a pas de réponse
- **WHEN** l'utilisateur clique sur cette anomalie en vue chemin
- **THEN** l'étape « Go / no-go » est sélectionnée et son panneau d'étape verrouillée reçoit le focus

#### Scenario: Clic sur un anneau
- **WHEN** l'utilisateur clique sur l'anneau de la section « Tests » dans la barre de progression, en vue chemin
- **THEN** l'étape « Tests » est sélectionnée et son panneau défile dans la zone visible

### Requirement: Passage d'une porte
Le système DOIT, lorsqu'une action de l'utilisateur dans le runner débloque une ou plusieurs étapes, animer leurs nœuds dans le graphe (capacité `step-graph`) et annoncer « Porte ouverte vers « … » » aux technologies d'assistance par une région d'annonce polie, en vue chemin comme en vue liste. Aucune animation ni annonce NE DOIT être produite au chargement de la session, ni pour les étapes débloquées dès l'ouverture du runner.

#### Scenario: Porte qui s'ouvre
- **WHEN** l'utilisateur coche le dernier bloquant de « Préparation »
- **THEN** les nœuds de « Build » et de « Documentation » s'animent et la région d'annonce indique « Porte ouverte vers « Build » et « Documentation » »

#### Scenario: Chargement d'une session avancée
- **WHEN** l'utilisateur ouvre une session dont plusieurs étapes sont déjà débloquées
- **THEN** aucune animation n'est jouée et rien n'est annoncé

### Requirement: Fin du chemin et confettis
Le système DOIT, lorsqu'une action de l'utilisateur dans le runner rend franchies toutes les étapes d'un modèle à dépendances, lancer une fois une animation de confettis et annoncer « Toutes les étapes sont franchies ». La bibliothèque de confettis NE DOIT être chargée qu'au moment de cette animation, jamais au chargement de l'application. Lorsque l'utilisateur a demandé de réduire les animations (`prefers-reduced-motion`), la bibliothèque NE DOIT pas être chargée et aucun confetti NE DOIT être lancé ; l'annonce reste faite. Un échec de chargement de la bibliothèque NE DOIT produire aucune erreur visible. Aucun confetti NE DOIT être lancé au chargement d'une session déjà entièrement franchie, ni sur une session terminée.

#### Scenario: Dernière porte franchie
- **WHEN** l'utilisateur coche le dernier bloquant de « Déploiement », alors que toutes les autres étapes sont franchies
- **THEN** des confettis sont lancés une fois et la région d'annonce indique « Toutes les étapes sont franchies »

#### Scenario: Animations réduites
- **WHEN** l'utilisateur a demandé de réduire les animations et franchit la dernière porte
- **THEN** la bibliothèque de confettis n'est pas chargée, aucun confetti n'est lancé, et l'annonce est faite

#### Scenario: Retour en arrière puis nouveau passage
- **GIVEN** toutes les étapes ont été franchies et les confettis lancés
- **WHEN** l'utilisateur décoche puis recoche un bloquant de « Déploiement »
- **THEN** des confettis sont lancés de nouveau, une seule fois

### Requirement: Modèle dont les dépendances forment une boucle
Le système DOIT, lorsque la copie figée d'une session contient une boucle de dépendances, afficher quand même le graphe et la vue chemin, avec un avertissement indiquant que le chemin du modèle est invalide et que les étapes concernées sont ouvertes (capacité `step-flow`).

#### Scenario: Boucle dans une session importée
- **WHEN** l'utilisateur ouvre une session importée dont deux sections dépendent l'une de l'autre
- **THEN** le runner affiche le graphe, signale que le chemin du modèle est invalide, et les deux étapes concernées sont saisissables

### Requirement: Vue chemin d'une session terminée
Le système DOIT permettre d'utiliser la vue chemin sur une session terminée, en consultation : sélection des étapes, panneau en lecture seule (capacité `quick-check`), contenu des étapes verrouillées et pied d'étape restent affichés, sans commande « Forcer le passage », sans animation de porte ni confettis.

#### Scenario: Consultation d'une session terminée
- **WHEN** l'utilisateur ouvre en vue chemin une session terminée dont la porte de « Documentation » a été forcée
- **THEN** il peut sélectionner chaque étape, le pied de « Documentation » affiche la date et la justification du forçage, et aucune commande de saisie ni de forçage n'est proposée

### Requirement: Rendu de la vue chemin dans les deux thèmes
Le système DOIT dessiner la bascule, le panneau d'étape, le contenu d'une étape verrouillée, le pied d'étape, le formulaire de forçage et le bloc « Laissés en route » avec les variables de couleur de la feuille de style globale, sans couleur codée en dur, afin qu'ils restent lisibles en thème clair et en thème sombre (`data-theme="dark"`).

#### Scenario: Thème sombre
- **WHEN** l'utilisateur bascule vers le thème sombre en vue chemin
- **THEN** la bascule, le panneau, le pied d'étape et le bloc « Laissés en route » adoptent les couleurs du thème sombre avec un contraste lisible
