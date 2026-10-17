## ADDED Requirements

### Requirement: Variante « structure » du graphe
Le composant de graphe des étapes DOIT proposer deux variantes : « progression » (par défaut, utilisée par le runner, dont le rendu est décrit par les autres exigences de cette capacité) et « structure » (utilisée par l'aperçu du constructeur, où aucune session n'existe). Dans la variante « structure », le composant DOIT :
- dessiner chaque nœud avec l'icône qui lui est fournie, sans anneau de progression, sans cadenas, sans coche et sans badge de jonction ;
- dessiner tous les liens pleins, dans une couleur neutre, quel que soit l'état des étapes ;
- conserver le placement en pixels, le défilement horizontal, la sélection au clic, à Entrée et à Espace, la mise en évidence de l'étape sélectionnée et le rendu dans les deux thèmes.

#### Scenario: Aperçu d'un modèle
- **WHEN** le graphe du modèle « Mise en production » est dessiné dans la variante « structure »
- **THEN** aucun nœud n'affiche d'anneau de progression, de cadenas, de coche ou de badge de jonction, et tous les liens sont pleins et de la couleur neutre

#### Scenario: Variante par défaut
- **WHEN** le runner dessine le graphe sans préciser de variante
- **THEN** le graphe est dessiné dans la variante « progression », à l'identique du comportement antérieur

### Requirement: Légende et nom accessible fournis par l'appelant
Le composant de graphe des étapes DOIT accepter, pour chaque nœud, une légende facultative affichée sur une seconde ligne sous le libellé, raccourcie par des points de suspension si elle dépasse la largeur d'une colonne. Lorsque au moins un nœud a une légende, la place réservée sous les nœuds DOIT être agrandie pour que la légende ne chevauche ni les nœuds ni les liens de la rangée suivante. Le composant DOIT aussi accepter, pour chaque nœud, un nom accessible fourni par l'appelant, qui remplace alors le nom accessible calculé à partir de l'état de l'étape.

#### Scenario: Légende sous un nœud
- **WHEN** un nœud reçoit la légende « 3 items · 2 bloq. »
- **THEN** la légende s'affiche sous le libellé du nœud, sans chevaucher les nœuds placés en dessous dans la même colonne

#### Scenario: Nom accessible fourni
- **WHEN** un nœud reçoit le nom accessible « Préparation : étape de départ, 3 items dont 2 bloquants »
- **THEN** une technologie d'assistance annonce ce nom pour le bouton du nœud, à la place du nom calculé à partir de l'état de l'étape
