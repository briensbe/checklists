## ADDED Requirements

### Requirement: Boîtes de dialogue modales accessibles
Le système DOIT fournir un service applicatif de dialogue (`DialogService`) et un composant modal dédié permettant d'afficher des boîtes de confirmation et des dialogues à choix multiples intégrés au design system et au thème courant (clair/sombre), sans aucun recours aux fonctions natives du navigateur (`window.alert`, `window.confirm`, `window.prompt`). Les dialogues DOIVENT piéger le focus clavier (`focus trap`), se fermer lors de l'appui sur la touche `Échap`, et restituer le focus à l'élément déclencheur à leur fermeture.

#### Scenario: Confirmation modale acceptée
- **WHEN** une action requérant confirmation est déclenchée et que l'utilisateur clique sur le bouton de confirmation ou valide au clavier
- **THEN** la boîte de dialogue se ferme, la promesse de confirmation est résolue à `true`, et le focus retourne sur l'élément déclencheur.

#### Scenario: Confirmation modale refusée ou annulée
- **WHEN** la boîte de confirmation est affichée et que l'utilisateur clique sur « Annuler », clique sur l'arrière-plan ou appuie sur `Échap`
- **THEN** la boîte de dialogue se ferme, la promesse de confirmation est résolue à `false`, et l'action n'est pas exécutée.

#### Scenario: Dialogue modal à choix multiples
- **WHEN** un dialogue à choix multiples est affiché (ex: conflit d'importation de session)
- **THEN** l'utilisateur peut choisir parmi les actions proposées (ex: « Remplacer », « Importer comme copie ») ou fermer sans appliquer, et la promesse résout l'identifiant du choix retenu ou `null`.

#### Scenario: Piégeage du focus dans la modale
- **WHEN** une boîte de dialogue modale est active et que l'utilisateur navigue avec la touche `Tab` ou `Shift+Tab`
- **THEN** le focus boucle exclusivement entre les éléments interactifs de la modale sans atteindre les éléments d'arrière-plan.

### Requirement: Système de notifications temporaires (Toasts)
Le système DOIT fournir un service de notification (`ToastService`) et un conteneur d'affichage (`ToastContainerComponent`) permettant d'afficher des notifications légères et empilables dans un coin de l'écran pour les retours de succès, d'information, d'avertissement et d'erreur. Les toasts DOIVENT supporter une action interactive optionnelle (ex: « Annuler ») et un délai d'expiration automatique paramétrable.

#### Scenario: Affichage d'un toast informatif ou d'erreur
- **WHEN** une opération réussit ou génère une anomalie non bloquante (ex: échec d'export, fichier rejeté)
- **THEN** une notification toast s'affiche avec le message approprié et le ton visuel correspondant, puis disparaît automatiquement après un délai défini sans bloquer l'interaction utilisateur.

#### Scenario: Empilement des toasts
- **WHEN** plusieurs notifications sont émises successivement dans un court intervalle
- **THEN** les toasts sont empilés verticalement de manière ordonnée et restent individuellement refermables par l'utilisateur.

### Requirement: Mécanisme d'annulation différée (Undo 6s)
Le système DOIT proposer un mécanisme d'annulation par toast pour les actions destructives réversibles (suppression de session, suppression de preuve, suppression d'item/section de template, action groupée « Passer le reste à OK »). Lors du déclenchement d'une telle action, l'élément DOIT être retiré immédiatement de l'affichage, un toast avec bouton « Annuler » DOIT s'afficher pendant 6 secondes. Si l'action n'est pas annulée avant expiration, ou si l'utilisateur quitte la page (`ngOnDestroy`, `visibilitychange`), l'opération de suppression ou de modification en base DOIT être exécutée immédiatement.

#### Scenario: Annulation d'une action destructive
- **WHEN** l'utilisateur clique sur « Annuler » dans le toast avant la fin du délai de 6 secondes
- **THEN** l'action en attente est révoquée, l'état initial des données est restauré à l'affichage, et aucune écriture destructive n'est portée en base Dexie.

#### Scenario: Exécution définitive après expiration
- **WHEN** le délai de 6 secondes s'écoule sans clic sur « Annuler »
- **THEN** le toast se ferme et la modification ou suppression définitive est persistée en base Dexie.

#### Scenario: Vidage garanti lors du déchargement de la page (Flush)
- **WHEN** des suppressions ou modifications différées sont en attente et que l'utilisateur change de route ou masque l'onglet du navigateur
- **THEN** toutes les opérations en attente sont immédiatement exécutées et persistées en base Dexie pour éviter toute perte ou incohérence de données.

### Requirement: Socle d'accessibilité interactif
Le système DOIT respecter les règles d'accessibilité courantes : chaque élément interactif à icône seule DOIT porter un attribut `aria-label` descriptif, les en-têtes de sections pliables/dépliables DOIVENT être des boutons interactifs portant l'attribut `aria-expanded`, les indicateurs de focus DOIVENT être clairement visibles au clavier, et le contraste des textes et éléments interactifs DOIT être préservé en thème clair et en thème sombre.

#### Scenario: Navigation au clavier sur les sections pliables
- **WHEN** l'utilisateur navigue au clavier jusqu'à un en-tête de section et appuie sur `Entrée` ou `Espace`
- **THEN** la section bascule son état d'ouverture et l'attribut `aria-expanded` passe à `true` ou `false` de manière cohérente.

#### Scenario: Présence des descriptions textuelles sur les boutons icônes
- **WHEN** un bouton d'action ne comporte qu'une icône visuelle (ex: poubelle, trombone, flèche)
- **THEN** un attribut `aria-label` explicite est présent pour les technologies d'assistance.
