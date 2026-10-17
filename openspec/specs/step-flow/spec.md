# Spécifications : Enchaînement des étapes

## Purpose
Organiser les sections d'une checklist en étapes reliées par des dépendances (graphe orienté sans cycle), avec la criticité des contrôles, des portes strictes ou souples et des jonctions, tous les états étant calculés à partir des réponses.

## Requirements

### Requirement: Dépendances entre étapes
Le système DOIT traiter chaque section d'un modèle comme une étape d'un graphe orienté sans cycle. Une section PEUT déclarer, dans `dependsOn`, les identifiants des sections qui doivent être franchies avant elle. Une section sans dépendance est un départ. Un modèle dont aucune section ne déclare de dépendance DOIT se comporter exactement comme aujourd'hui : toutes ses sections sont débloquées en permanence.

#### Scenario: Modèle sans dépendance
- **GIVEN** un modèle dont aucune section ne déclare de `dependsOn`, contenant des contrôles bloquants non résolus
- **WHEN** le système calcule l'état des étapes d'une session
- **THEN** toutes les sections sont débloquées

#### Scenario: Étape verrouillée par un prérequis
- **GIVEN** une section « Build » qui dépend de « Préparation », et un contrôle bloquant de « Préparation » sans réponse
- **WHEN** le système calcule l'état des étapes
- **THEN** « Préparation » est débloquée et « Build » est verrouillée

#### Scenario: Bifurcation implicite
- **GIVEN** deux sections « Build » et « Documentation » qui dépendent toutes deux de « Préparation »
- **WHEN** tous les contrôles bloquants applicables de « Préparation » sont résolus
- **THEN** « Build » et « Documentation » se débloquent ensemble

### Requirement: Criticité des contrôles
Le système DOIT associer à chaque contrôle une criticité parmi `blocking` (bloquant), `important` et `optional` (optionnel). Un contrôle sans criticité DOIT être traité comme `optional`. Seuls les contrôles bloquants DOIVENT conditionner le franchissement d'une étape ; les contrôles importants et optionnels ne verrouillent jamais rien.

#### Scenario: Contrôle sans criticité
- **WHEN** un contrôle ne déclare pas de criticité
- **THEN** le système le traite comme optionnel

#### Scenario: Optionnel sans réponse
- **GIVEN** une section dont tous les contrôles bloquants sont résolus et dont un contrôle optionnel n'a pas de réponse
- **WHEN** le système calcule l'état des étapes
- **THEN** les sections qui dépendent d'elle sont débloquées

### Requirement: Résolution des contrôles bloquants
Le système DOIT considérer un contrôle comme résolu lorsqu'il est au statut `OK` ou `N/A`, lorsqu'il est coché (case à cocher), ou lorsque le choix sélectionné n'est pas marqué comme anomalie (`isBlocking` à faux). Un contrôle `KO`, ou dont le choix sélectionné est une anomalie, NE DOIT PAS être considéré comme résolu. Seuls les contrôles applicables selon les conditions d'affichage (`visibleIf`) et le contexte courant DOIVENT être pris en compte. Une section sans contrôle bloquant applicable a ses bloquants résolus d'office.

#### Scenario: N/A résout un bloquant
- **WHEN** l'unique contrôle bloquant d'une section passe au statut `N/A`, sans commentaire
- **THEN** les bloquants de la section sont résolus

#### Scenario: KO ne résout pas un bloquant
- **WHEN** l'unique contrôle bloquant d'une section passe au statut `KO`, même avec un commentaire
- **THEN** les bloquants de la section ne sont pas résolus et les sections qui en dépendent restent verrouillées

#### Scenario: Bloquant masqué par une condition d'affichage
- **GIVEN** un contrôle bloquant visible uniquement pour une livraison de type « patch »
- **WHEN** le contexte de la session indique une livraison complète
- **THEN** ce contrôle n'est pas pris en compte pour franchir la section

#### Scenario: Section sans contrôle applicable
- **WHEN** aucun contrôle d'une section débloquée n'est applicable dans le contexte courant
- **THEN** la section est franchie d'office

### Requirement: Calcul des étapes débloquées
Le système DOIT calculer, à partir de la copie figée du modèle, du contexte et des réponses de la session, si chaque section est débloquée et si elle est franchie. Une section est franchie lorsqu'elle est débloquée et que ses bloquants sont résolus ou que sa porte souple a été forcée. Une section avec `joinMode` absent ou `all` est débloquée lorsque toutes ses dépendances sont franchies ; avec `joinMode: 'any'`, lorsqu'au moins une l'est. Ces états NE DOIVENT jamais être persistés : ils sont recalculés à chaque changement.

#### Scenario: Jonction qui attend toutes les branches
- **GIVEN** une section « Go / no-go » qui dépend de « Tests » et de « Documentation », sans `joinMode`
- **WHEN** seule « Tests » est franchie
- **THEN** « Go / no-go » reste verrouillée

#### Scenario: Jonction sur une seule branche
- **GIVEN** la même section déclarée avec `joinMode: 'any'`
- **WHEN** seule « Tests » est franchie
- **THEN** « Go / no-go » est débloquée

#### Scenario: Reverrouillage sans perte de réponses
- **GIVEN** une section franchie dont la suivante a déjà des réponses
- **WHEN** l'utilisateur retire la réponse d'un contrôle bloquant de la section franchie
- **THEN** la section suivante redevient verrouillée et ses réponses sont conservées

#### Scenario: Aucun état de verrouillage persisté
- **WHEN** une session est enregistrée en base ou exportée
- **THEN** elle ne contient aucune information indiquant qu'une section est débloquée, franchie ou verrouillée, hormis les portes souples forcées

### Requirement: Portes souples forcées
Le système DOIT permettre de franchir une section dont les bloquants ne sont pas résolus lorsque sa porte est souple (`gate: 'soft'`), que la section est débloquée, que la session est en cours et qu'une justification non vide est fournie. Le forçage DOIT être enregistré dans la session avec l'identifiant de la section, la justification et la date. Une porte stricte (`gate` absent ou `hard`) NE DOIT PAS pouvoir être forcée, et un forçage enregistré DOIT être ignoré si la porte de la section n'est plus souple.

#### Scenario: Forçage d'une porte souple
- **GIVEN** une section débloquée à porte souple dont un bloquant est au statut `KO`
- **WHEN** l'utilisateur force la porte avec la justification « Dérogation validée par le PO »
- **THEN** le forçage est enregistré avec sa date, la section est franchie et les sections qui en dépendent sont débloquées

#### Scenario: Porte stricte
- **WHEN** l'utilisateur tente de forcer la porte d'une section à porte stricte
- **THEN** le forçage est refusé et rien n'est enregistré

#### Scenario: Justification absente
- **WHEN** l'utilisateur tente de forcer une porte souple avec une justification vide
- **THEN** le forçage est refusé et rien n'est enregistré

#### Scenario: Section verrouillée
- **WHEN** l'utilisateur tente de forcer la porte d'une section encore verrouillée
- **THEN** le forçage est refusé et rien n'est enregistré

#### Scenario: Porte redevenue stricte
- **GIVEN** une session dont la porte souple d'une section a été forcée
- **WHEN** une nouvelle version du modèle, où cette porte est stricte, est appliquée à la session
- **THEN** le forçage n'a plus d'effet sur le calcul des étapes

### Requirement: Progression des jonctions
Le système DOIT fournir, pour chaque section qui déclare au moins deux dépendances, le nombre de dépendances franchies et leur nombre total.

#### Scenario: Badge de jonction
- **GIVEN** une section qui dépend de « Tests » et de « Documentation »
- **WHEN** seule « Documentation » est franchie
- **THEN** la progression de la jonction vaut 1 sur 2

### Requirement: État visuel d'une étape
Le système DOIT attribuer à chaque section un état parmi :
- `locked` (verrouillée) : la section n'est pas débloquée ;
- `open` (ouverte) : la section est débloquée mais pas franchie ;
- `passed` (franchie avec des restes) : la section est franchie mais au moins un contrôle applicable n'a pas de réponse ou attend sa preuve ;
- `done` (terminée) : la section est franchie et tous ses contrôles applicables ont une réponse, sans preuve en attente.

#### Scenario: Étape ouverte
- **WHEN** une section débloquée a encore un bloquant sans réponse
- **THEN** son état est `open`

#### Scenario: Étape franchie avec des optionnels restants
- **WHEN** une section débloquée a tous ses bloquants résolus mais un contrôle optionnel sans réponse
- **THEN** son état est `passed`

#### Scenario: Étape terminée
- **WHEN** une section débloquée a tous ses bloquants résolus et une réponse sur chacun de ses contrôles applicables
- **THEN** son état est `done`

### Requirement: Étapes suivantes
Le système DOIT fournir, pour chaque section, la liste des sections qui en dépendent, chacune avec son état débloqué ou non, afin de distinguer une porte ouverte vers une étape d'une étape qui attend encore une autre branche.

#### Scenario: Étape qui attend une autre branche
- **GIVEN** « Go / no-go » dépend de « Tests » et de « Documentation », et seule « Tests » est franchie
- **WHEN** le système liste les étapes suivantes de « Tests »
- **THEN** la liste contient « Go / no-go », indiquée comme non débloquée

### Requirement: Contrôles laissés en route
Le système DOIT lister comme « laissés en route » les contrôles applicables non bloquants qui n'ont pas de réponse ou dont la preuve est en attente, situés dans une section franchie dont au moins une étape suivante est débloquée. Un modèle sans dépendance n'a jamais de contrôle laissé en route.

#### Scenario: Optionnel oublié dans une étape franchie
- **GIVEN** « Préparation » est franchie, « Build » qui en dépend est débloquée, et le contrôle optionnel « Changelog rédigé » de « Préparation » n'a pas de réponse
- **WHEN** le système calcule les contrôles laissés en route
- **THEN** « Changelog rédigé » figure dans la liste avec sa section

#### Scenario: Dernière étape
- **WHEN** une section sans étape suivante a un contrôle optionnel sans réponse
- **THEN** ce contrôle n'est pas laissé en route

#### Scenario: Modèle sans dépendance
- **WHEN** un modèle sans dépendance a des contrôles optionnels sans réponse
- **THEN** la liste des contrôles laissés en route est vide

### Requirement: Ordre, colonnes et détection de boucle
Le système DOIT fournir un ordre topologique des sections, la colonne de chaque section (longueur du plus long chemin depuis un départ, les départs étant en colonne 0) et un test indiquant si l'ajout d'une dépendance créerait une boucle. Si les données d'une session contiennent malgré tout une boucle, les sections concernées DOIVENT être traitées comme débloquées, pour que l'utilisateur ne soit jamais bloqué par un modèle invalide.

#### Scenario: Colonnes d'un graphe à branches
- **GIVEN** « Préparation » sans dépendance, « Build » et « Documentation » qui dépendent de « Préparation », « Tests » qui dépend de « Build », « Go / no-go » qui dépend de « Tests » et de « Documentation »
- **WHEN** le système calcule les colonnes
- **THEN** « Préparation » est en colonne 0, « Build » et « Documentation » en colonne 1, « Tests » en colonne 2 et « Go / no-go » en colonne 3

#### Scenario: Dépendance qui créerait une boucle
- **GIVEN** « Build » dépend de « Préparation »
- **WHEN** le système teste l'ajout de « Build » comme dépendance de « Préparation »
- **THEN** le test indique que l'ajout créerait une boucle

#### Scenario: Boucle présente dans les données
- **WHEN** la copie figée d'une session contient deux sections qui dépendent l'une de l'autre
- **THEN** ces deux sections sont considérées comme débloquées

### Requirement: Preuve exigée et preuve en attente
Le système DOIT conserver sur chaque contrôle le type de preuve exigé par le modèle (`evidenceRequired` parmi `comment`, `photo`, `link`, `file`) et sa consigne (`evidenceHint`), ainsi que, sur la réponse, l'indicateur `evidencePending` (fait, preuve à compléter). Une preuve en attente NE DOIT PAS modifier la résolution des bloquants ; elle DOIT empêcher l'état `done` de sa section et faire figurer le contrôle parmi les contrôles laissés en route.

#### Scenario: Preuve en attente dans une étape franchie
- **GIVEN** une section franchie dont toutes les réponses sont données, dont la suivante est débloquée, et dont un contrôle important porte `evidencePending`
- **WHEN** le système calcule l'état des étapes
- **THEN** la section est à l'état `passed` et le contrôle figure parmi les contrôles laissés en route

### Requirement: Saisie réservée aux étapes débloquées
Le système NE DOIT changer l'état de la réponse d'un contrôle (statut `OK`, `KO` ou `N/A`, coche, choix, réponse conforme donnée avec sa preuve ou avec « preuve à compléter ») que si la section de ce contrôle est débloquée. Cette garde DOIT s'appliquer au niveau du service, quelle que soit la vue du runner, comme la garde de lecture seule d'une session terminée. Elle NE DOIT pas s'appliquer :
- aux saisies de texte déjà en cours (note, champ additionnel), pour ne jamais perdre une frappe ;
- à l'annulation d'une action (restauration des réponses après « Passer le reste à OK », retrait de l'événement de suppression d'une preuve), à la réinitialisation confirmée de la session et à l'application d'une nouvelle version du modèle.

Les réponses déjà données dans une étape qui se verrouille DOIVENT être conservées. Un modèle sans dépendance n'est pas concerné, puisque toutes ses sections sont débloquées en permanence.

#### Scenario: Réponse refusée dans une étape verrouillée
- **GIVEN** l'étape « Tests » est verrouillée
- **WHEN** une opération de coche est invoquée sur le contrôle « Recette métier validée », par exemple depuis un raccourci clavier
- **THEN** la réponse du contrôle n'est pas modifiée et aucun événement d'historique n'est ajouté

#### Scenario: Annulation d'un passage groupé après un reverrouillage
- **GIVEN** l'utilisateur a utilisé « Passer le reste à OK », ce qui a débloqué l'étape « Tests »
- **WHEN** il clique sur « Annuler » dans le toast
- **THEN** les réponses sont restaurées exactement comme avant l'action, y compris dans les étapes qui redeviennent verrouillées

#### Scenario: Modèle sans dépendance
- **WHEN** l'utilisateur coche un contrôle d'un modèle sans dépendance dont des bloquants ne sont pas résolus
- **THEN** le contrôle est coché
