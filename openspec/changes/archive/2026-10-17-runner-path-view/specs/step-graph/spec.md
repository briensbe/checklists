## ADDED Requirements

### Requirement: Placement des étapes en pixels
Le système DOIT dessiner le graphe des étapes dans un seul élément SVG, où les nœuds, les anneaux, les icônes, les libellés et les liens partagent le même repère, exprimé en pixels. Aucune position NE DOIT être exprimée en pourcentage. L'abscisse d'un nœud DOIT dépendre de la colonne de son étape (longueur du plus long chemin depuis un départ, capacité `step-flow`) : les colonnes se répartissent la largeur disponible, mesurée sur le conteneur, sans descendre sous une largeur minimale par colonne. Quand la largeur disponible ne suffit pas, le graphe DOIT garder sa largeur minimale et le conteneur DOIT défiler horizontalement. Dans une colonne, un nœud DOIT être placé à la hauteur moyenne des étapes dont il dépend, les nœuds d'une même colonne étant écartés d'une distance minimale. Les positions DOIVENT être recalculées quand la largeur du conteneur change.

#### Scenario: Graphe à branches
- **GIVEN** le modèle d'exemple « Mise en production » : « Préparation », puis « Build » et « Documentation » qui en dépendent, « Tests » qui dépend de « Build », « Go / no-go » qui dépend de « Tests » et de « Documentation », puis « Déploiement »
- **WHEN** le graphe est dessiné dans un conteneur assez large
- **THEN** les nœuds sont rangés en cinq colonnes de gauche à droite, « Build » et « Documentation » partagent la deuxième colonne à des hauteurs différentes, et « Tests » est à la hauteur de « Build »

#### Scenario: Conteneur trop étroit
- **WHEN** la largeur du conteneur est inférieure au nombre de colonnes multiplié par la largeur minimale d'une colonne
- **THEN** le graphe garde sa largeur minimale et le conteneur défile horizontalement, sans chevauchement des nœuds

#### Scenario: Redimensionnement
- **WHEN** la largeur du conteneur change, par exemple à l'ouverture d'un panneau latéral du navigateur
- **THEN** les positions des nœuds et le tracé des liens sont recalculés, et chaque lien reste attaché aux deux nœuds qu'il relie

### Requirement: Liens entre étapes
Le système DOIT relier chaque étape à chacune de ses dépendances par une courbe de Bézier allant du nœud de la dépendance au nœud de l'étape. Un lien DOIT être plein et coloré lorsque la dépendance est franchie (porte ouverte), et en pointillés gris sinon. Les liens sont décoratifs et NE DOIVENT pas être annoncés par les technologies d'assistance.

#### Scenario: Porte ouverte
- **WHEN** l'étape « Préparation » est franchie
- **THEN** les liens de « Préparation » vers « Build » et vers « Documentation » sont pleins et colorés

#### Scenario: Porte fermée
- **WHEN** l'étape « Build » n'est pas franchie
- **THEN** le lien de « Build » vers « Tests » est en pointillés gris

### Requirement: États visuels d'un nœud
Le système DOIT dessiner chaque nœud selon l'état visuel de son étape (capacité `step-flow`) :
- `locked` : un cadenas, sans anneau de progression ;
- `open` : l'icône de l'étape et un anneau qui représente la part de ses contrôles applicables qui ont une réponse ;
- `passed` : l'icône de l'étape et l'anneau incomplet ;
- `done` : une coche et un anneau complet, de la couleur « terminé ».

L'anneau DOIT prendre la couleur « anomalie » lorsqu'au moins un contrôle applicable de l'étape est en anomalie (KO ou choix en anomalie). Le nœud de l'étape sélectionnée DOIT être mis en évidence. Le libellé de l'étape DOIT s'afficher sous son nœud, raccourci par des points de suspension s'il dépasse la largeur d'une colonne, le libellé complet restant disponible au survol et dans le nom accessible du nœud.

#### Scenario: Étape verrouillée
- **WHEN** l'étape « Tests » est verrouillée
- **THEN** son nœud affiche un cadenas, sans anneau

#### Scenario: Étape ouverte en cours
- **WHEN** l'étape « Build », débloquée, a une réponse sur l'un de ses deux contrôles
- **THEN** son nœud affiche l'icône de l'étape et un anneau rempli à moitié

#### Scenario: Étape terminée
- **WHEN** l'étape « Préparation » est franchie et que tous ses contrôles applicables ont une réponse, sans preuve en attente
- **THEN** son nœud affiche une coche et un anneau complet de la couleur « terminé »

#### Scenario: Étape avec un KO
- **WHEN** un contrôle d'une étape débloquée est au statut `KO`
- **THEN** l'anneau de son nœud prend la couleur « anomalie »

### Requirement: Badge de jonction
Le système DOIT afficher sur le nœud d'une étape qui déclare au moins deux dépendances un badge de jonction indiquant le nombre de dépendances franchies sur leur nombre total (n/m). Le badge DOIT être distingué lorsque toutes les dépendances sont franchies.

#### Scenario: Jonction partiellement prête
- **WHEN** « Tests » est franchie et « Documentation » ne l'est pas
- **THEN** le nœud de « Go / no-go » porte le badge de jonction « 1/2 »

### Requirement: Icônes d'étape
Le système DOIT afficher, pour chaque étape, l'icône désignée par le champ `icon` de sa section, choisie dans une liste fermée d'icônes Lucide enregistrées par nom. Un ancien nom d'icône Heroicons connu DOIT être converti vers son équivalent Lucide (par exemple `document-text` vers `file-text`, `circle-stack` vers `database`, `archive-box` vers `archive`, `cube` vers `box`). Un nom absent ou inconnu de la liste DOIT être remplacé par une icône par défaut. La conversion se fait à l'affichage : le modèle et la copie figée de la session NE DOIVENT pas être modifiés. La même icône DOIT être utilisée par le graphe, le panneau d'étape et l'en-tête de section de la vue liste.

#### Scenario: Icône Lucide
- **WHEN** une section déclare l'icône `hammer`
- **THEN** son étape affiche l'icône Lucide `hammer`

#### Scenario: Ancien nom Heroicons
- **WHEN** une section du modèle de livraison déclare l'icône `circle-stack`
- **THEN** son étape affiche l'icône Lucide `database`, et la copie figée de la session conserve la valeur `circle-stack`

#### Scenario: Icône inconnue ou absente
- **WHEN** une section déclare l'icône `licorne`, ou ne déclare pas d'icône
- **THEN** son étape affiche l'icône par défaut

### Requirement: Clavier et accessibilité du graphe
Le système DOIT présenter le graphe comme un groupe nommé « Chemin des étapes ». Chaque nœud DOIT être atteignable par la touche Tab, dans l'ordre topologique des étapes, avoir le rôle de bouton et un nom accessible qui contient le libellé de l'étape, son état (verrouillée, ouverte, franchie, terminée), sa progression et, pour une jonction, le nombre de branches prêtes. Entrée ou Espace sur un nœud DOIT sélectionner son étape, comme un clic. Le nœud de l'étape sélectionnée DOIT être signalé comme l'étape courante (`aria-current="step"`). Le focus d'un nœud DOIT être visible dans les deux thèmes.

#### Scenario: Sélection au clavier
- **WHEN** l'utilisateur atteint le nœud « Build » avec Tab puis appuie sur Entrée
- **THEN** l'étape « Build » est sélectionnée et son nœud est signalé comme l'étape courante

#### Scenario: Nom accessible d'une jonction
- **WHEN** une technologie d'assistance lit le nœud verrouillé de « Go / no-go », dont une branche sur deux est prête
- **THEN** elle annonce un bouton nommé « Go / no-go », verrouillée, avec 1 branche prête sur 2

### Requirement: Animation du passage d'une porte
Le système DOIT pouvoir animer brièvement les nœuds des étapes qui viennent de se débloquer (le nœud s'ouvre), à la demande de la vue qui affiche le graphe. Les transitions de l'anneau et des liens DOIVENT être progressives. Lorsque l'utilisateur a demandé de réduire les animations (`prefers-reduced-motion`), aucune animation ni transition NE DOIT être jouée.

#### Scenario: Nœud qui s'ouvre
- **WHEN** la vue signale que l'étape « Build » vient de se débloquer
- **THEN** le nœud de « Build » joue une courte animation d'ouverture

#### Scenario: Animations réduites
- **WHEN** l'utilisateur a demandé de réduire les animations et que l'étape « Build » vient de se débloquer
- **THEN** le nœud de « Build » passe directement à son nouvel état, sans animation

### Requirement: Rendu du graphe dans les deux thèmes
Le système DOIT dessiner les nœuds, les anneaux, les liens, les badges et les libellés du graphe avec les variables de couleur de la feuille de style globale, sans couleur codée en dur dans le composant ni dans le SVG, afin qu'ils restent lisibles en thème clair et en thème sombre (`data-theme="dark"`).

#### Scenario: Bascule vers le thème sombre
- **WHEN** l'utilisateur bascule vers le thème sombre pendant que le graphe est affiché
- **THEN** les nœuds, les liens, les badges et les libellés adoptent les couleurs du thème sombre avec un contraste lisible
