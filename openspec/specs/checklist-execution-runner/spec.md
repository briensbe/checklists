# Spécifications : Moteur d'Exécution de Checklist

## Purpose
Permettre l'évaluation des points de contrôle d'une session (OK / KO / N/A), leur conditionnement par le contexte, les actions groupées, le filtrage et le suivi de la progression (résumé fixé, anneaux par section, prochain item à traiter).

## Requirements

### Requirement: Évaluation interactive d'un contrôle
Le système DOIT permettre d'affecter un statut d'évaluation parmi `OK`, `KO` ou `N/A` à chaque point de contrôle applicable de type statut : `OK` par le geste principal sur la ligne, `KO` par le bouton discret de la ligne ou la touche K, `N/A` depuis le tiroir du contrôle ou la touche N (capacités `quick-check` et `runner-keyboard-shortcuts`).

#### Scenario: Sélection d'un statut conforme
- **WHEN** l'utilisateur clique sur la ligne d'un contrôle sans réponse, ou appuie sur Espace alors qu'il est l'item actif
- **THEN** le contrôle est marqué comme conforme (`OK`), les compteurs de progression sont actualisés et l'observation demeure facultative

#### Scenario: Sélection d'un statut non conforme
- **WHEN** l'utilisateur clique sur le bouton KO de la ligne, ou appuie sur K alors que le contrôle est l'item actif
- **THEN** le contrôle est marqué en anomalie, son tiroir s'ouvre sur la note, et la justification devient obligatoire et visuellement mise en évidence tant qu'elle est vide

#### Scenario: Sélection du statut non applicable
- **WHEN** l'utilisateur choisit « Non applicable » dans le tiroir d'un contrôle
- **THEN** le contrôle est marqué `N/A`, sans justification exigée

#### Scenario: Déselection d'un statut
- **WHEN** l'utilisateur clique sur la ligne d'un contrôle déjà `OK`, clique sur le bouton KO d'un contrôle déjà `KO`, ou retire le `N/A` depuis le tiroir
- **THEN** le statut repasse à l'état non renseigné / à traiter

### Requirement: Conditionnement contextuel des contrôles
Le système DOIT masquer ou afficher dynamiquement les points de contrôle en fonction des valeurs de contexte de la session. Un item peut porter une condition `visibleIf: { fieldId, equals[] }` : il est applicable si et seulement si la valeur du champ de contexte `fieldId` figure dans `equals`. Un item sans condition est toujours applicable. Les items non applicables sont exclus de la vue, des métriques et de la validation de clôture ; leurs réponses éventuelles sont conservées.

#### Scenario: Bascule vers le mode patch
- **WHEN** un item porte `visibleIf: { fieldId: 'mode', equals: ['patch'] }` et que le contexte `mode` passe à `patch`
- **THEN** l'item est visible, intégré au calcul de complétude et évaluable

#### Scenario: Bascule vers le mode complet
- **WHEN** pour ce même item, le contexte `mode` vaut `full` ou est vide
- **THEN** l'item est exclu de la vue et des métriques

#### Scenario: Condition à valeurs multiples
- **WHEN** un item porte `visibleIf: { fieldId: 'type', equals: ['majeure', 'mineure'] }` et que le contexte `type` vaut `mineure`
- **THEN** l'item est applicable

#### Scenario: Réponse conservée sur un item masqué
- **WHEN** l'utilisateur répond à un item puis modifie le contexte de sorte qu'il devienne non applicable, puis rétablit le contexte initial
- **THEN** l'item réapparaît avec sa réponse précédente

### Requirement: Action de passage groupé à OK
Le système DOIT fournir une action permettant de donner en une seule fois une réponse conforme à tous les contrôles applicables encore sans réponse (statut `OK`, case cochée, ou premier choix sans anomalie), et DOIT permettre d'annuler cette action pendant 6 secondes via une notification toast. L'action NE DOIT modifier aucun contrôle déjà répondu, y compris un contrôle `N/A` de n'importe quel type. Elle NE DOIT pas répondre à un contrôle bloquant dont la preuve exigée par le modèle n'est pas fournie ; un contrôle non bloquant dans ce cas DOIT recevoir sa réponse avec l'indicateur « preuve à compléter » (`evidencePending`).

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

#### Scenario: Annulation du passage groupé
- **WHEN** l'utilisateur clique sur « Annuler » dans le toast de passage groupé avant son expiration
- **THEN** les réponses de la session sont immédiatement restaurées dans leur état exact précédant l'action via `mutate()`, historiques et preuves en attente compris, et le toast disparaît.

### Requirement: Réinitialisation sécurisée des réponses de session
Le système DOIT soumettre la réinitialisation de toutes les réponses d'une session à une confirmation explicite via le dialogue modal applicatif (`DialogService`), sans utiliser `window.confirm()`.

#### Scenario: Confirmation de la réinitialisation
- **WHEN** l'utilisateur clique sur « Réinitialiser » dans le runner et confirme son choix dans la modale
- **THEN** toutes les réponses et observations de la session sont effacées via `mutate()` et un toast confirme la réinitialisation.

#### Scenario: Annulation de la réinitialisation
- **WHEN** l'utilisateur clique sur « Annuler » ou ferme la modale de réinitialisation
- **THEN** aucune réponse n'est modifiée et la session reste inchangée.

### Requirement: Notifications d'erreur non bloquantes dans le runner
Le système DOIT notifier les erreurs d'export (Excel, PDF, JSON) et de manipulation de preuves dans le runner à l'aide de toasts d'erreur, sans recourir à `window.alert()`.

#### Scenario: Échec d'export notifié par toast
- **WHEN** une erreur survient lors de la génération d'un export
- **THEN** un toast de ton `danger` s'affiche avec le message d'erreur explicatif, sans bloquer le runner ni l'interaction utilisateur.

### Requirement: Filtrage et navigation rapide
Le système DOIT permettre de filtrer l'affichage des contrôles selon leur état (`Tous`, `À traiter`, `KO uniquement`) et d'ouvrir/fermer toutes les sections.

#### Scenario: Filtrage des anomalies
- **WHEN** l'utilisateur sélectionne le filtre "KO uniquement"
- **THEN** seules les sections contenant des contrôles KO et les contrôles KO eux-mêmes sont affichés

### Requirement: Résumé de progression fixé en haut
Le système DOIT afficher dans le runner une barre de progression qui reste visible, juste sous l'en-tête de l'application, pendant le défilement des contrôles. Elle DOIT présenter le pourcentage et le nombre de contrôles applicables répondus, le nombre de contrôles bloquants applicables non résolus lorsque le modèle en déclare, les anneaux par section, le bouton « Prochain item à traiter » et un bouton d'aide des raccourcis. Elle NE DOIT ni recouvrir l'en-tête de l'application, ni masquer la ligne vers laquelle l'utilisateur navigue. Les champs de contexte, les exports et les filtres restent dans le résumé qui défile avec la page.

#### Scenario: Défilement de la liste
- **WHEN** l'utilisateur fait défiler une longue checklist vers le bas
- **THEN** la barre de progression reste affichée juste sous l'en-tête de l'application et se met à jour à chaque réponse

#### Scenario: Bloquants restants
- **WHEN** deux contrôles bloquants applicables de la session ne sont pas résolus
- **THEN** la barre indique « 2 bloquants restants »

#### Scenario: Modèle sans bloquant
- **WHEN** le modèle de la session ne déclare aucun contrôle bloquant
- **THEN** la barre n'affiche aucun compteur de bloquants

### Requirement: Anneaux de progression par section
Le système DOIT afficher dans la barre de progression un anneau, dessiné en SVG, pour chaque section qui a au moins un contrôle applicable. L'anneau DOIT représenter la part des contrôles applicables de la section qui ont une réponse. Il DOIT être de la couleur de marque tant que la section est incomplète, vert (`emerald`) lorsqu'elle est complète, et rouge (`rose`) lorsqu'au moins un de ses contrôles est en anomalie (KO ou choix en anomalie), ces couleurs venant des variables CSS des deux thèmes. Chaque anneau DOIT porter un nom accessible indiquant la section et sa progression, et un clic sur un anneau DOIT déplier la section et la faire défiler dans la zone visible.

#### Scenario: Section partiellement remplie
- **WHEN** une section compte 5 contrôles applicables dont 3 ont une réponse sans anomalie
- **THEN** son anneau est rempli à 60 % dans la couleur de marque et annoncé « Préparation : 3 sur 5 »

#### Scenario: Section complète
- **WHEN** tous les contrôles applicables d'une section ont une réponse sans anomalie
- **THEN** son anneau est entièrement rempli, en vert

#### Scenario: Section avec un KO
- **WHEN** un contrôle d'une section est au statut `KO`
- **THEN** son anneau est rouge

#### Scenario: Section sans contrôle applicable
- **WHEN** aucun contrôle d'une section n'est applicable dans le contexte courant
- **THEN** aucun anneau n'est affiché pour cette section

#### Scenario: Clic sur un anneau
- **WHEN** l'utilisateur clique sur l'anneau d'une section repliée
- **THEN** la section se déplie et défile dans la zone visible

### Requirement: Prochain item à traiter
Le système DOIT fournir dans la barre de progression un bouton « Prochain item à traiter » qui cherche, dans l'ordre du modèle (sections repliées comprises) et à partir de l'item actif, le premier contrôle applicable sans réponse qui le suit, en reprenant au début de la checklist si besoin. Le système DOIT alors déplier sa section, repasser le filtre à « Tous » si le filtre actif le masque, faire défiler sa ligne dans la zone visible, lui donner le focus et en faire l'item actif. Lorsque tous les contrôles applicables ont une réponse, le bouton DOIT être désactivé et indiquer que tout est renseigné.

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

#### Scenario: Tout est renseigné
- **WHEN** tous les contrôles applicables de la session ont une réponse
- **THEN** le bouton « Prochain item à traiter » est désactivé et indique que tout est renseigné
