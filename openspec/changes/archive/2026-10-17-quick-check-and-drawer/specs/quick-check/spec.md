## ADDED Requirements

### Requirement: Geste principal sur toute la ligne
Le système DOIT faire de toute la ligne d'un contrôle applicable la zone du geste principal, selon le type du contrôle :
- case à cocher : le geste coche le contrôle s'il ne l'est pas, le décoche sinon ;
- statut (`controlType` absent ou `status`) : le geste met `OK` un contrôle sans statut ou au statut `KO`, et retire le statut d'un contrôle déjà `OK` ;
- choix personnalisé : la ligne n'a pas de geste principal, les boutons de choix restent le seul moyen de répondre.

Un clic sur un bouton, un lien ou un champ de saisie situé dans la ligne, un clic dans le tiroir, ou un clic qui termine une sélection de texte NE DOIT PAS déclencher le geste principal. Le geste principal NE DOIT avoir aucun effet sur un contrôle au statut `N/A`. Lorsque le modèle exige une preuve pour ce contrôle, le geste principal suit l'exigence « Preuve exigée au geste principal » de la capacité `evidence-attachment`.

#### Scenario: Coche par la ligne
- **GIVEN** un contrôle de type case à cocher, non coché, sans preuve exigée
- **WHEN** l'utilisateur clique sur le libellé ou sur l'espace vide de la ligne
- **THEN** le contrôle est coché, avec son horodatage si l'option est activée, et la réponse est enregistrée

#### Scenario: Décoche par la ligne
- **WHEN** l'utilisateur clique sur la ligne d'un contrôle de type case à cocher déjà coché
- **THEN** le contrôle est décoché et son horodatage effacé

#### Scenario: OK par la ligne
- **WHEN** l'utilisateur clique sur la ligne d'un contrôle de type statut sans réponse
- **THEN** le contrôle passe au statut `OK`

#### Scenario: Retrait du OK par la ligne
- **WHEN** l'utilisateur clique sur la ligne d'un contrôle de type statut déjà `OK`
- **THEN** le statut est retiré et le contrôle redevient à traiter

#### Scenario: Correction d'un KO par la ligne
- **WHEN** l'utilisateur clique sur la ligne d'un contrôle au statut `KO`
- **THEN** le contrôle passe au statut `OK` et son commentaire est conservé

#### Scenario: Clic sur un bouton de la ligne
- **WHEN** l'utilisateur clique sur le trombone, sur le bouton KO ou dans le champ additionnel d'une ligne
- **THEN** seule l'action de cet élément s'exécute et le geste principal n'est pas déclenché

#### Scenario: Sélection de texte
- **WHEN** l'utilisateur sélectionne à la souris une partie du libellé d'un contrôle
- **THEN** la réponse du contrôle n'est pas modifiée

#### Scenario: Contrôle de type choix
- **WHEN** l'utilisateur clique sur la ligne d'un contrôle de type choix, en dehors de ses boutons
- **THEN** la réponse du contrôle n'est pas modifiée

#### Scenario: Contrôle non applicable
- **WHEN** l'utilisateur clique sur la ligne d'un contrôle au statut `N/A`
- **THEN** la réponse du contrôle n'est pas modifiée

### Requirement: Mise en KO discrète
Le système DOIT proposer, sur la ligne d'un contrôle de type statut, un bouton discret de mise en `KO`. Ce bouton, comme la touche K, DOIT mettre le contrôle au statut `KO`, ouvrir son tiroir et placer le focus dans la note, dont la saisie est obligatoire pour un KO. Sur un contrôle déjà `KO`, la même action DOIT retirer le statut. Les contrôles de type case à cocher et choix n'ont pas de mise en KO.

#### Scenario: Mise en KO avec ouverture de la note
- **WHEN** l'utilisateur clique sur le bouton KO d'un contrôle de type statut sans réponse
- **THEN** le contrôle passe au statut `KO`, son tiroir s'ouvre, le focus est placé dans la note et la note est signalée comme obligatoire tant qu'elle est vide

#### Scenario: Retrait du KO
- **WHEN** l'utilisateur clique sur le bouton KO d'un contrôle déjà `KO`
- **THEN** le statut est retiré et le commentaire est conservé

### Requirement: Tiroir d'un contrôle
Le système DOIT fournir, sous la ligne de chaque contrôle, un tiroir ouvert et fermé par le trombone, qui regroupe la note du contrôle, ses preuves et la mise en `N/A`. Un seul tiroir DOIT être ouvert à la fois : en ouvrir un ferme le précédent. Le trombone DOIT être visible au survol de la ligne, quand la ligne a le focus, quand le tiroir est ouvert, quand le contrôle a une note ou une preuve, et en permanence sur un écran tactile. La touche Échap DOIT fermer le tiroir et rendre le focus à la ligne. Un contrôle dont le tiroir est ouvert DOIT rester affiché tant que le tiroir est ouvert, même si le filtre actif devrait le masquer.

#### Scenario: Ouverture du tiroir
- **WHEN** l'utilisateur clique sur le trombone d'un contrôle
- **THEN** le tiroir s'ouvre sous la ligne avec la note, les preuves du contrôle et la commande « Non applicable », et le focus entre dans le tiroir

#### Scenario: Un seul tiroir ouvert
- **GIVEN** le tiroir d'un premier contrôle est ouvert
- **WHEN** l'utilisateur ouvre le tiroir d'un second contrôle
- **THEN** le tiroir du premier contrôle se ferme

#### Scenario: Fermeture par Échap
- **WHEN** le focus est dans un tiroir ouvert, hors du champ de note, et que l'utilisateur appuie sur Échap
- **THEN** le tiroir se ferme et le focus revient sur la ligne du contrôle

#### Scenario: Contrôle maintenu affiché malgré le filtre
- **GIVEN** le filtre « À traiter » est actif
- **WHEN** l'utilisateur met en KO un contrôle sans réponse, ce qui ouvre son tiroir
- **THEN** le contrôle reste affiché avec son tiroir ouvert, et disparaît de la liste filtrée à la fermeture du tiroir

#### Scenario: Écran tactile
- **WHEN** l'application est affichée sur un appareil sans survol (écran tactile)
- **THEN** le trombone de chaque ligne est visible en permanence

### Requirement: Note d'un contrôle dans le tiroir
Le système DOIT présenter dans le tiroir la note du contrôle, qui est son commentaire existant. La note DOIT être enregistrée au fil de la saisie, comme aujourd'hui, sans produire d'événement d'historique. Dans le champ de note, Entrée sans Maj DOIT terminer la saisie et rendre le focus à la ligne, Maj+Entrée DOIT insérer un saut de ligne, et Échap DOIT rétablir la note telle qu'elle était à l'entrée dans le champ.

#### Scenario: Enregistrement par Entrée
- **WHEN** l'utilisateur saisit « Vérifié avec l'équipe ops » dans la note puis appuie sur Entrée
- **THEN** la note est enregistrée et le focus revient sur la ligne du contrôle

#### Scenario: Annulation par Échap
- **GIVEN** la note d'un contrôle vaut « Procédure dans le wiki »
- **WHEN** l'utilisateur la modifie puis appuie sur Échap
- **THEN** la note retrouve la valeur « Procédure dans le wiki »

### Requirement: Non applicable dans le tiroir
Le système DOIT permettre de mettre en `N/A`, puis de retirer le `N/A`, depuis le tiroir de tout contrôle, quel que soit son type, sans justification obligatoire. Mettre un contrôle en `N/A` DOIT retirer sa coche, son choix, son statut et sa preuve en attente. Tant qu'un contrôle est `N/A`, le geste principal, la mise en KO et ses boutons de choix NE DOIVENT avoir aucun effet, et la ligne DOIT afficher l'état « Non applicable ». Un `N/A` DOIT compter comme une réponse, quel que soit le type du contrôle.

#### Scenario: N/A sur une case à cocher
- **GIVEN** un contrôle de type case à cocher, coché
- **WHEN** l'utilisateur choisit « Non applicable » dans son tiroir
- **THEN** le contrôle est `N/A`, n'est plus coché, et compte comme répondu dans la progression

#### Scenario: Retrait du N/A
- **WHEN** l'utilisateur retire le `N/A` d'un contrôle depuis son tiroir
- **THEN** le contrôle redevient sans réponse

#### Scenario: Choix désactivés sur un contrôle N/A
- **WHEN** l'utilisateur clique sur un bouton de choix d'un contrôle `N/A`
- **THEN** la réponse du contrôle n'est pas modifiée

### Requirement: Compteurs et suggestion d'ajout
Le système DOIT afficher sur la ligne d'un contrôle, tiroir fermé, un indicateur de note lorsque la note n'est pas vide et le nombre de ses preuves lorsqu'il en a au moins une. Juste après un geste principal qui donne une réponse à un contrôle sans note ni preuve, le système DOIT mettre en évidence le trombone pendant environ 2 secondes, sans animation lorsque l'utilisateur a demandé de réduire les animations (`prefers-reduced-motion`).

#### Scenario: Compteurs d'un contrôle documenté
- **WHEN** un contrôle a une note et deux preuves, et que son tiroir est fermé
- **THEN** sa ligne affiche l'indicateur de note et le nombre 2 à côté de l'icône des preuves

#### Scenario: Suggestion après une coche
- **WHEN** l'utilisateur coche un contrôle qui n'a ni note ni preuve
- **THEN** le trombone de la ligne est mis en évidence pendant environ 2 secondes, puis revient à son état normal

#### Scenario: Pas de suggestion pour un contrôle documenté
- **WHEN** l'utilisateur coche un contrôle qui a déjà une preuve
- **THEN** le trombone n'est pas mis en évidence

### Requirement: Badges de criticité et d'anomalie
Le système DOIT afficher un badge « bloquant » sur la ligne d'un contrôle de criticité `blocking` et un badge « important » sur celle d'un contrôle de criticité `important`. Un contrôle optionnel, ou sans criticité, NE DOIT porter aucun badge de criticité. Un bouton de choix dont l'option est marquée `isBlocking` DOIT être signalé comme « anomalie », jamais comme « bloquant ».

#### Scenario: Contrôle bloquant
- **WHEN** un contrôle de criticité `blocking` est affiché
- **THEN** sa ligne porte le badge « bloquant »

#### Scenario: Contrôle optionnel
- **WHEN** un contrôle sans criticité est affiché
- **THEN** sa ligne ne porte aucun badge de criticité

#### Scenario: Choix en anomalie
- **WHEN** un contrôle de type choix propose une option marquée `isBlocking`
- **THEN** le bouton de cette option est signalé « anomalie »

### Requirement: Accessibilité de la ligne
Le système DOIT annoncer le rôle et l'état de chaque ligne aux technologies d'assistance : une ligne de case à cocher DOIT porter `role="checkbox"` et `aria-checked` ; une ligne de statut DOIT être un bouton dont le nom accessible contient le libellé et l'état (à traiter, OK, KO ou non applicable). Le trombone DOIT porter un `aria-label` nommant le contrôle et un `aria-expanded` reflétant l'état du tiroir, et le tiroir DOIT être une région nommée. Le focus de la ligne DOIT être visible dans les deux thèmes.

#### Scenario: Case à cocher annoncée
- **WHEN** une technologie d'assistance lit la ligne d'un contrôle de type case à cocher coché
- **THEN** elle annonce une case à cocher cochée portant le libellé du contrôle

#### Scenario: Trombone annoncé
- **WHEN** une technologie d'assistance lit le trombone d'un contrôle dont le tiroir est fermé
- **THEN** elle annonce un bouton nommé d'après le contrôle et indiquant que le tiroir est replié

### Requirement: Ligne en lecture seule
Le système DOIT, sur une session terminée, désactiver le geste principal, la mise en KO, les boutons de choix, la mise en `N/A`, la modification de la note et l'ajout ou la suppression de preuves. L'ouverture du tiroir DOIT rester possible pour consulter la note et télécharger les preuves.

#### Scenario: Clic sur une ligne d'une session terminée
- **WHEN** l'utilisateur clique sur la ligne d'un contrôle d'une session terminée
- **THEN** la réponse du contrôle n'est pas modifiée

#### Scenario: Consultation des preuves d'une session terminée
- **WHEN** l'utilisateur ouvre le tiroir d'un contrôle d'une session terminée
- **THEN** la note s'affiche en lecture seule et les preuves sont listées avec leur téléchargement, sans commande d'ajout, de suppression ni de mise en `N/A`

### Requirement: Rendu dans les deux thèmes
Le système DOIT dessiner la ligne, le tiroir, les badges et les compteurs avec les variables de couleur de la feuille de style globale, sans couleur codée en dur dans les composants, afin qu'ils restent lisibles en thème clair et en thème sombre (`data-theme="dark"`).

#### Scenario: Bascule vers le thème sombre
- **WHEN** l'utilisateur bascule vers le thème sombre pendant qu'un tiroir est ouvert
- **THEN** la ligne, le tiroir, les badges et les compteurs adoptent les couleurs du thème sombre avec un contraste lisible
