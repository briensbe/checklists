## ADDED Requirements

### Requirement: Aperçu du graphe en direct
Le constructeur DOIT afficher, au-dessus de la liste des sections et hors du mode Aperçu, un aperçu du graphe des étapes du modèle en cours d'édition, dessiné par le composant de graphe des étapes dans sa variante « structure » (capacité `step-graph`). L'aperçu DOIT être recalculé à chaque modification du modèle qui le concerne : titre, icône, ajout, suppression, duplication d'une section, dépendances, ajout, suppression ou déplacement d'un contrôle, criticité d'un contrôle. Chaque nœud DOIT afficher :
- une icône de rôle : `flag` pour une étape de départ (sans dépendance), sinon `git-merge` pour une jonction (au moins deux dépendances), sinon `goal` pour une fin (aucune section n'en dépend), sinon l'icône de la section résolue comme dans le runner ;
- le titre de la section, ou « Sans titre » s'il est vide ;
- la légende « n items · m bloq. », où n est le nombre de contrôles de la section et m le nombre de ses contrôles de criticité bloquante.

Le nom accessible d'un nœud DOIT contenir le titre, le rôle de l'étape (départ, jonction de k étapes, fin, étape) et la légende. Un clic, Entrée ou Espace sur un nœud DOIT faire défiler la liste jusqu'à la section correspondante et donner le focus à son titre. Lorsque aucune section du modèle ne déclare de dépendance, l'aperçu NE DOIT PAS dessiner de graphe et DOIT afficher à la place une phrase indiquant que toutes les étapes sont ouvertes dès le début et que les puces « Après : » permettent de les enchaîner.

#### Scenario: Graphe du modèle d'exemple
- **GIVEN** le modèle « Mise en production » ouvert dans le constructeur
- **WHEN** l'aperçu est affiché
- **THEN** il dessine six nœuds en cinq colonnes, « Préparation » avec l'icône `flag`, « Go / no-go » avec l'icône `git-merge`, « Déploiement » avec l'icône `goal`, « Build » avec l'icône `hammer`, et « Préparation » porte la légende « 3 items · 2 bloq. »

#### Scenario: Aperçu qui suit la saisie
- **WHEN** le concepteur renomme la section « Build » en « Compilation », puis ajoute un contrôle bloquant à cette section
- **THEN** le nœud affiche aussitôt le libellé « Compilation » et sa légende passe de « 2 items · 2 bloq. » à « 3 items · 3 bloq. »

#### Scenario: Aller à une section depuis l'aperçu
- **WHEN** le concepteur atteint le nœud « Tests » avec Tab puis appuie sur Entrée
- **THEN** la liste défile jusqu'à la section « Tests » et le champ de son titre reçoit le focus

#### Scenario: Modèle sans dépendance
- **WHEN** le concepteur ouvre le modèle d'audit de livraison, dont aucune section ne déclare de dépendance
- **THEN** aucun graphe n'est dessiné et l'aperçu indique que toutes les étapes sont ouvertes dès le début et que les puces « Après : » permettent de les enchaîner

### Requirement: Dépendances par puces « Après : »
Le constructeur DOIT afficher sur chaque section une rangée « Après : » comportant une puce par autre section du modèle, dans l'ordre de la liste, nommée par le titre de cette section (« Sans titre » s'il est vide). Une puce active DOIT signifier que la section dépend de la section nommée. Activer une puce DOIT ajouter cette dépendance à `dependsOn` ; la désactiver DOIT la retirer. Une puce inactive dont l'activation créerait une boucle (la section nommée dépend déjà, directement ou non, de la section courante) DOIT être grisée, désactivée et accompagnée de l'explication « Créerait une boucle ». Une puce active DOIT toujours pouvoir être désactivée. Chaque puce DOIT être un bouton à bascule annonçant son état (`aria-pressed`). Une section sans dépendance DOIT afficher la mention « étape de départ ». Lorsque la dernière dépendance d'une section est retirée, la propriété `dependsOn` DOIT disparaître du modèle.

#### Scenario: Ajouter une dépendance
- **GIVEN** un modèle dont les sections « Préparation » et « Build » n'ont aucune dépendance
- **WHEN** le concepteur active la puce « Préparation » dans la rangée « Après : » de « Build »
- **THEN** « Build » déclare `dependsOn: ['<id de Préparation>']`, la puce est annoncée comme enfoncée et l'aperçu dessine un lien de « Préparation » vers « Build »

#### Scenario: Puce qui créerait une boucle
- **GIVEN** « Build » dépend de « Préparation » et « Tests » dépend de « Build »
- **WHEN** le concepteur consulte la rangée « Après : » de « Préparation »
- **THEN** les puces « Build » et « Tests » sont grisées, désactivées et expliquées par « Créerait une boucle », et aucun clic sur elles ne modifie le modèle

#### Scenario: Retirer la dernière dépendance
- **WHEN** le concepteur désactive l'unique puce active de « Build »
- **THEN** la propriété `dependsOn` de « Build » disparaît du modèle et la section affiche « étape de départ »

#### Scenario: Boucle présente dans un modèle importé
- **GIVEN** un modèle importé dont deux sections dépendent l'une de l'autre
- **WHEN** le concepteur désactive l'une des deux puces actives concernées
- **THEN** la dépendance est retirée et la boucle disparaît du bandeau de validation

### Requirement: Porte et mode de jonction d'une section
Le constructeur DOIT proposer, sur une section dont au moins une autre section dépend, le choix de sa porte : « Stricte » (`gate: 'hard'`, bloquants résolus obligatoires) ou « Souple » (`gate: 'soft'`, passage forcé possible avec justification). Il DOIT proposer, sur une section qui déclare au moins deux dépendances, le choix de son mode de jonction : « Toutes les étapes précédentes » (`joinMode: 'all'`) ou « Au moins une » (`joinMode: 'any'`). Une section sans porte ou sans mode déclaré DOIT afficher la valeur par défaut (« Stricte », « Toutes les étapes précédentes »). Le choix fait par le concepteur DOIT être écrit explicitement dans le modèle, valeur par défaut comprise. Lorsqu'une section passe sous deux dépendances, sa propriété `joinMode` DOIT être retirée du modèle. La porte d'une section qui n'a plus de section dépendante DOIT être conservée, sans être proposée.

#### Scenario: Porte souple
- **GIVEN** « Documentation », dont « Go / no-go » dépend
- **WHEN** le concepteur choisit la porte « Souple » pour « Documentation »
- **THEN** « Documentation » déclare `gate: 'soft'`

#### Scenario: Jonction sur une seule branche
- **GIVEN** « Go / no-go » dépend de « Tests » et de « Documentation »
- **WHEN** le concepteur choisit « Au moins une » comme mode de jonction
- **THEN** « Go / no-go » déclare `joinMode: 'any'`

#### Scenario: Jonction retirée sous deux dépendances
- **GIVEN** « Go / no-go » déclare `joinMode: 'any'` et dépend de « Tests » et de « Documentation »
- **WHEN** le concepteur retire la dépendance à « Documentation »
- **THEN** la propriété `joinMode` de « Go / no-go » disparaît du modèle et le choix du mode de jonction n'est plus proposé

#### Scenario: Section sans dépendante
- **WHEN** aucune section ne dépend de « Déploiement »
- **THEN** le choix de la porte n'est pas proposé sur « Déploiement »

### Requirement: Bandeau de validation de l'enchaînement
Le constructeur DOIT afficher dans l'aperçu, lorsque le modèle a au moins une dépendance, un bandeau de validation annoncé aux technologies d'assistance comme une zone d'état (`role="status"`). Le bandeau DOIT indiquer :
- en l'absence d'erreur d'enchaînement, le nombre d'étapes de départ, le nombre d'étapes de fin et l'absence de boucle, sous la forme « n départ(s), m fin(s), pas de boucle » ;
- le nombre et les titres des sections sans contrôle, en avertissement ;
- les erreurs d'enchaînement détectées par la validation partagée avec l'import (section qui dépend d'elle-même, dépendance inconnue, boucle, avec les sections concernées), en erreur.

Le bandeau NE DOIT PAS bloquer l'édition ; l'enregistrement reste bloqué par la validation existante du modèle.

#### Scenario: Modèle valide
- **WHEN** le concepteur ouvre le modèle « Mise en production »
- **THEN** le bandeau indique « 1 départ(s), 1 fin(s), pas de boucle »

#### Scenario: Étape sans contrôle
- **WHEN** le concepteur ajoute une section « Communication » sans contrôle à un modèle à dépendances
- **THEN** le bandeau signale en avertissement 1 étape sans contrôle, nommée « Communication »

#### Scenario: Dépendance inconnue héritée d'un import
- **WHEN** le concepteur ouvre un modèle dont une section dépend d'un identifiant de section inexistant
- **THEN** le bandeau signale en erreur la dépendance inconnue de cette section, et n'affiche pas « pas de boucle »

### Requirement: Palette d'icônes d'étape
Le constructeur DOIT afficher sur chaque section un bouton montrant son icône d'étape courante, résolue comme dans le runner (nom de la liste fermée, ancien nom Heroicons converti, sinon icône par défaut), avec un nom accessible qui contient le libellé français de cette icône. Ce bouton DOIT ouvrir et fermer (`aria-expanded`) une palette présentant toutes les icônes de la liste fermée d'icônes d'étape, chacune comme un bouton nommé par son libellé français, l'icône courante étant signalée comme sélectionnée. Choisir une icône DOIT écrire son nom Lucide dans `icon` et fermer la palette en rendant le focus au bouton. Échap DOIT fermer la palette sans rien modifier et rendre le focus au bouton. Tant que le concepteur ne choisit pas d'icône, la valeur `icon` d'origine, y compris un ancien nom Heroicons, DOIT être conservée telle quelle.

#### Scenario: Choisir une icône
- **WHEN** le concepteur ouvre la palette de la section « Tests » et choisit l'icône « Fiole » (`flask-conical`)
- **THEN** la section déclare `icon: 'flask-conical'`, la palette se ferme, le focus revient sur le bouton et le nœud « Tests » de l'aperçu affiche cette icône s'il n'est ni un départ, ni une jonction, ni une fin

#### Scenario: Ancien nom Heroicons conservé
- **GIVEN** une section du modèle de livraison qui déclare `icon: 'circle-stack'`
- **WHEN** le concepteur enregistre le modèle sans ouvrir la palette de cette section
- **THEN** le bouton affichait l'icône `database`, et la section enregistrée déclare toujours `icon: 'circle-stack'`

#### Scenario: Fermer sans choisir
- **WHEN** le concepteur ouvre la palette puis appuie sur Échap
- **THEN** la palette se ferme, l'icône de la section est inchangée et le focus revient sur le bouton

### Requirement: Politique de clôture du modèle
Le constructeur DOIT proposer, dans les informations générales du modèle, le choix de la politique de clôture : « Seuls les bloquants » (`completionPolicy: 'blocking'`, seuls les contrôles bloquants empêchent de terminer) ou « Une réponse partout » (`completionPolicy: 'all'`). Un nouveau modèle DOIT être créé avec `completionPolicy: 'blocking'` écrit explicitement. Un modèle existant sans politique DOIT afficher « Une réponse partout » et NE DOIT être modifié que si le concepteur change ce choix.

#### Scenario: Nouveau modèle
- **WHEN** le concepteur crée un nouveau modèle
- **THEN** le choix « Seuls les bloquants » est sélectionné et le modèle porte `completionPolicy: 'blocking'`

#### Scenario: Modèle existant sans politique
- **WHEN** le concepteur ouvre le modèle d'audit de livraison, qui ne déclare pas de politique de clôture
- **THEN** le choix « Une réponse partout » est sélectionné, le modèle n'est pas signalé comme modifié, et il est enregistré sans `completionPolicy` si le concepteur ne change pas ce choix

#### Scenario: Changement de politique
- **WHEN** le concepteur choisit « Seuls les bloquants » sur un modèle existant
- **THEN** le modèle est signalé comme modifié et il est enregistré avec `completionPolicy: 'blocking'`

### Requirement: Dépendance d'une nouvelle section
Le constructeur DOIT créer une nouvelle section avec une dépendance à la dernière section de la liste lorsque au moins une section du modèle déclare déjà une dépendance, et sans dépendance sinon.

#### Scenario: Modèle à dépendances
- **GIVEN** le modèle « Mise en production », dont la dernière section de la liste est « Déploiement »
- **WHEN** le concepteur ajoute une section
- **THEN** la nouvelle section dépend de « Déploiement » et l'aperçu la dessine après « Déploiement »

#### Scenario: Modèle sans dépendance
- **WHEN** le concepteur ajoute une section au modèle d'audit de livraison
- **THEN** la nouvelle section ne déclare pas de dépendance

### Requirement: Ordre d'affichage indépendant des dépendances
Le réordonnancement des sections, par glisser-déposer ou par les boutons ↑/↓, DOIT fixer uniquement l'ordre d'affichage des sections en vue liste et NE DOIT modifier ni leurs dépendances, ni leur porte, ni leur mode de jonction.

#### Scenario: Déplacer une section
- **WHEN** le concepteur déplace la section « Documentation » avant « Build » dans la liste
- **THEN** les dépendances de toutes les sections sont inchangées, et les colonnes de l'aperçu aussi

### Requirement: Recréation d'un modèle à étapes sans JSON
Le constructeur DOIT permettre de créer, sans écrire de JSON, un modèle équivalent au modèle d'exemple « Mise en production » : mêmes sections, mêmes icônes, mêmes dépendances, même porte souple, mêmes criticités et preuves exigées, même schéma de contexte et même politique de clôture, aux identifiants près et aux criticités « optionnel » écrites explicitement près.

#### Scenario: Recréation du modèle d'exemple
- **WHEN** le concepteur crée un nouveau modèle et y reproduit les six sections de « Mise en production » avec le constructeur
- **THEN** le modèle enregistré produit dans le runner le même graphe, les mêmes portes et les mêmes jonctions que le modèle d'exemple
