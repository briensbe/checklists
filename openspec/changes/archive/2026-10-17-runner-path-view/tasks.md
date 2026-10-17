## 1. Socle : vérification du rendu, dépendance et thème

- [x] 1.1 Vérifier dans le navigateur, avec un prototype jetable, qu'un `<svg [lucideIcon]>` placé dans un `<g transform="translate(…)">` à l'intérieur d'un `<svg>` s'affiche à la bonne place et à la bonne taille dans les deux thèmes ; sinon appliquer le repli du design (tracés de `LucideIconData` dans un `<g>`) et le noter dans `design.md`
- [x] 1.2 Installer `canvas-confetti` (`pnpm add canvas-confetti`, version 1.9.x) et ses types (`pnpm add -D @types/canvas-confetti`), puis lancer `pnpm build` sans erreur
- [x] 1.3 Ajouter dans `src/styles.css`, pour le thème clair et pour `[data-theme="dark"]`, les variables du graphe (`--graph-node-bg`, `--graph-node-border`, `--graph-node-selected`, `--graph-node-locked`, `--graph-link-open`, `--graph-link-closed`, `--graph-label`, `--graph-badge-bg`, `--graph-badge-ready-bg`, `--graph-badge-text`, `--graph-focus`) et celles du panneau, du pied d'étape et du bloc « Laissés en route »
- [x] 1.4 Extraire de `progress-ring` la fonction pure `ringGeometry(value, size, stroke)` (rayon, circonférence, décalage, valeur bornée entre 0 et 1), l'utiliser dans `ProgressRingComponent` sans changer son rendu, et la tester

## 2. Icônes d'étape

- [x] 2.1 Créer `src/app/domain/step-icons.ts` : liste fermée `STEP_ICON_NAMES` (une trentaine de noms Lucide, dont toutes les icônes des modèles livrés après conversion, `flag`, `goal` et `git-merge`), table `LEGACY_STEP_ICONS` (anciens noms Heroicons, dont `document-text`, `circle-stack`, `archive-box` et `cube`), `DEFAULT_STEP_ICON` (`list-checks`) et `resolveStepIcon(name)`
- [x] 2.2 Tester `resolveStepIcon` : nom de la liste, ancien nom converti, nom inconnu, nom absent ou vide, et vérifier que chaque icône de `delivery-audit.json` et de `release-flow.json` se résout sans retomber sur l'icône par défaut
- [x] 2.3 Créer `src/app/components/step-graph/step-icons.ts` (`STEP_ICON_COMPONENTS` et `provideStepIcons()`), l'enregistrer dans `app.config.ts`, et tester que chaque nom de `STEP_ICON_NAMES` produit une icône non vide avec `LucideDynamicIcon`

## 3. Placement du graphe (`src/app/domain/step-graph-layout.ts`)

- [x] 3.1 Implémenter `layoutStepGraph(structure, availableWidth)` : largeur de colonne bornée par une largeur minimale, largeur du dessin, abscisse au centre de la colonne, ordonnée par barycentre des dépendances avec écart minimal et recentrage par colonne, décalage final dans la marge et hauteur du dessin (libellés compris)
- [x] 3.2 Calculer le tracé des liens (Bézier cubique entre les bords des nœuds, points de contrôle à mi-distance) et le libellé raccourci d'après la largeur de colonne, avec « … »
- [x] 3.3 Écrire `step-graph-layout.spec.ts` : chemin linéaire, modèle d'exemple (cinq colonnes, « Build » et « Documentation » à des hauteurs différentes, « Tests » à la hauteur de « Build », « Go / no-go » entre les deux branches), conteneur trop étroit (largeur minimale), plusieurs départs, boucle (aucune exception, lien qui revient en arrière), aucune coordonnée `NaN`, positions inchangées quand seul l'état des étapes change

## 4. Règles pures de la vue chemin

- [x] 4.1 Créer `src/app/domain/path-view.ts` : `defaultSelectedStep(flow)`, `lockedSectionIds(flow)`, `stepPrerequisites(section, flow)` (états `ready`, `in-progress`, `not-open` et mode de jonction) et `lockedStepItems(section, session)` (texte de la réponse : « fait », « OK », « KO », « N/A », libellé du choix)
- [x] 4.2 Implémenter `stepFooter(section, session, flow, evidence)` : bloquants non résolus, étapes suivantes avec leur état, étape finale, toutes les étapes franchies, bloquants passés en N/A, preuves à compléter, preuves manquantes (`evidenceState`), forçage pris en compte et possibilité de forcer
- [x] 4.3 Implémenter `newlyUnlocked(previous, current)`, `allStepsPassed(flow)` et `toGraphNodes(flow, template, progress)` (icône résolue, colonne, dépendances, état visuel, progression, anomalie, jonction)
- [x] 4.4 Faire évoluer `src/app/domain/quick-check.ts` : paramètre de portée `{ locked, sectionId }` de `visibleItems` (le verrouillage l'emporte sur le contrôle épinglé par le tiroir ; en vue chemin, seule l'étape sélectionnée), étapes verrouillées ignorées par `nextItemToProcess`, nouvelle fonction `nextItemState` (`available`, `all-done`, `locked-only`) et `missingEvidenceItems(items, answers, evidence)`
- [x] 4.5 Écrire `path-view.spec.ts` et compléter `quick-check.spec.ts` : étape sélectionnée par défaut (ouverte, franchie, tout terminé), prérequis d'une jonction `all` et `any`, réponses d'une étape reverrouillée, pied d'étape (porte ouverte, branche en attente, étape finale, bloquant en N/A, preuve en attente, preuve manquante, forçage, porte redevenue stricte), étapes nouvellement débloquées, contrôles affichés hors étapes verrouillées, prochain item qui saute une étape verrouillée, état `locked-only`, preuves manquantes

## 5. Service de session

- [x] 5.1 Ajouter à `ChecklistSessionService` la garde privée `isItemLocked(itemId)` (lue sur `stepFlow()`) et l'appeler en tête de `updateAnswerStatus`, `updateAnswerCheckbox`, `updateAnswerChoice`, `toggleNa` et `resolveItem`, sans toucher aux opérations exemptées (note, champ additionnel, preuves, lien, restauration, réinitialisation, mise à jour du modèle)
- [x] 5.2 Limiter `markRemainingAsOk` aux sections débloquées selon un `computeStepFlow` calculé une fois au début de la mutation (sans cascade), et ajouter `skippedLocked` à son résultat
- [x] 5.3 Compléter `checklist-session.service.spec.ts` : changement refusé sur une étape verrouillée (réponse et historique inchangés), note acceptée, retrait de l'événement de suppression d'une preuve et restauration des réponses après un reverrouillage, « Passer le reste à OK » sans cascade avec `skippedLocked`, modèle sans dépendance inchangé

## 6. Composant de graphe (`src/app/components/step-graph/`)

- [x] 6.1 Créer `StepGraphComponent` (trois fichiers), sans service injecté : entrées `nodes`, `selectedId`, `pulseIds`, sortie `select` ; `computed` de structure et d'état séparés ; largeur mesurée par `ResizeObserver` (déconnecté par `DestroyRef`), avec repli sur `clientWidth` puis sur la largeur minimale ; conteneur en défilement horizontal
- [x] 6.2 Dessiner dans un seul `<svg>`, en pixels : liens pleins ou en pointillés, nœuds (disque, anneau par `ringGeometry` et tons `--ring-*`, icône d'étape, coche ou cadenas), badge de jonction `n/m` distingué quand il est complet, libellé raccourci avec `<title>`, nœud sélectionné mis en évidence ; aucune couleur en dur
- [x] 6.3 Rendre le graphe accessible : groupe nommé « Chemin des étapes », liens masqués aux technologies d'assistance, nœuds `role="button"` atteignables par Tab dans l'ordre topologique, nom accessible (libellé, état, progression, branches prêtes), `aria-current="step"`, Entrée et Espace (avec `preventDefault()`), focus visible dans les deux thèmes
- [x] 6.4 Ajouter l'animation d'ouverture des nœuds de `pulseIds` et les transitions de l'anneau et des liens, coupées par `prefers-reduced-motion`
- [x] 6.5 Écrire `step-graph.component.spec.ts` : un nœud par étape et un lien par dépendance, état verrouillé (cadenas, pas d'anneau), état terminé (coche), anneau en anomalie, badge de jonction, liens ouverts et fermés, sélection au clic, à Entrée et à Espace, noms accessibles, `aria-current`, aucune position en pourcentage dans le rendu

## 7. Composants d'étape et laissés en route

- [x] 7.1 Créer `StepLockedComponent` : « Cette étape attend : » ou « … l'une de ces étapes : », prérequis avec leur état, contrôles applicables en texte simple, rappel discret des réponses et mention « Réponses conservées… » pour une étape reverrouillée
- [x] 7.2 Créer `StepFooterComponent` : mentions du pied d'étape, étapes suivantes débloquées et libellés de contrôles en boutons, forçage affiché avec sa date et sa justification ; formulaire « Forcer le passage » dans le pied (justification obligatoire, « Forcer » désactivé si vide, « Annuler », Échap traité avec `preventDefault()`), absent sur une porte stricte, une étape franchie ou une session terminée
- [x] 7.3 Créer `StepPanelComponent` : en-tête (icône résolue, titre, état, mention « jonction », compteur et `app-progress-ring`), ancre focalisable `step-panel`, puis `StepLockedComponent`, ou les lignes `app-checklist-item` des contrôles affichés suivies du `StepFooterComponent` ; message quand le filtre masque tout
- [x] 7.4 Créer `LeftBehindComponent` : liste (libellé, titre de l'étape, raison « sans réponse » ou « preuve à compléter ») en boutons, masquée quand elle est vide
- [x] 7.5 Écrire les tests de ces composants : panneau d'étape verrouillée (prérequis et texte sans case ni badge), pied d'étape (mentions, porte souple forcée, « Forcer » désactivé sans justification, Échap qui n'enregistre rien, aucune commande sur une porte stricte ni en lecture seule), bloc « Laissés en route » (affiché ou masqué, clic)

## 8. Contrôleur et page du runner

- [x] 8.1 Étendre `RunnerController` : `viewMode` mémorisé dans `localStorage` (`checklists.runner-view`, dans un `try/catch`), `selectedStepId` initialisé par `defaultSelectedStep` à chaque nouvelle session, `isPathView`, `stepViews`, `selectStep(id)` (premier contrôle affiché du panneau rendu actif) et portée de `visibleItems`
- [x] 8.2 Rendre `focusItem` et `focusSection` sensibles à la vue : sélection de l'étape au lieu du dépliage, focus au panneau pour un contrôle d'une étape verrouillée, défilement jusqu'au panneau au clic sur un anneau
- [x] 8.3 Ajouter l'`effect` de passage des portes : rien au premier calcul d'une session, `pulseIds` pendant environ 700 ms et `announcement` pour les étapes nouvellement débloquées, annonce « Toutes les étapes sont franchies » et `launchConfetti()` quand `allStepsPassed` devient vrai sur une session en cours ; créer `src/app/services/confetti.ts` (pas de chargement si `prefers-reduced-motion`, import dynamique, `disableForReducedMotion: true`, erreur ignorée)
- [x] 8.4 Ajouter l'action `forceGate(sectionId, reason)` du contrôleur, qui appelle `ChecklistSessionService.forceGate`
- [x] 8.5 Adapter `checklist-section` : icône résolue par `resolveStepIcon` via `LucideDynamicIcon`, entrée optionnelle `step` (état dans l'en-tête, `StepLockedComponent` à la place des lignes si l'étape est verrouillée, `StepFooterComponent` sous les lignes sinon)
- [x] 8.6 Adapter `audit-summary` (entrée `showCollapse`, fausse en vue chemin) et `runner-progress-bar` (entrée `nextState` à la place de `nextDisabled`, libellés « Tout est renseigné » et « Contrôles restants dans des étapes verrouillées »)
- [x] 8.7 Adapter `checklist-runner` : bascule « Chemin / Liste » (`aria-pressed`) pour un modèle à dépendances, graphe et panneau en vue chemin, sections en vue liste avec leur `step`, `LeftBehindComponent` après le résumé, région `aria-live="polite"`, avertissement de boucle (`stepFlow().cycle`), sélecteur `onControl` étendu à `[role="button"]`, mention des étapes verrouillées dans le toast de « Passer le reste à OK », et confirmation de clôture avec des preuves manquantes (`missingEvidenceItems` après `flushEvidenceDeletions()`, puis `DialogService.confirm`)
- [x] 8.8 Compléter `runner-controller.spec.ts` : étape sélectionnée par défaut, `selectStep` et item actif, navigation limitée au panneau, `focusItem` en vue chemin (étape débloquée et étape verrouillée), tiroir fermé quand son étape se verrouille avec la note conservée, aucune animation ni annonce au chargement, annonce groupée des portes ouvertes, confettis une seule fois puis de nouveau après un retour en arrière, aucun chargement de la bibliothèque avec `prefers-reduced-motion` (module simulé), préférence de vue mémorisée et `localStorage` indisponible
- [x] 8.9 Compléter `checklist-runner.component.spec.ts` et `runner-progress-bar.component.spec.ts` : bascule absente sans dépendance, Espace sur un nœud qui sélectionne l'étape sans modifier l'item actif, toast de « Passer le reste à OK » avec étapes verrouillées, clôture confirmée et annulée avec une preuve manquante, clôture sans confirmation sinon, libellés de `nextState`

## 9. Documentation et vérification

- [x] 9.1 Mettre à jour le `README.md` : vue chemin et bascule, portes appliquées à la saisie, étape verrouillée, pied d'étape et forçage d'une porte souple, « Laissés en route », confettis, confirmation de clôture avec des preuves manquantes
- [x] 9.2 Consigner dans `openspec/BACKLOG.md` les suites écartées : révocation d'une porte forcée, forçages et bloquants passés en N/A dans les rapports Excel et PDF
- [x] 9.3 Vérifier avec `rg "#[0-9a-fA-F]{3,6}\b" src/app -g "*.css"` qu'aucune couleur n'est codée en dur dans les composants créés ou modifiés, et avec `rg "%" src/app/components/step-graph src/app/domain/step-graph-layout.ts` qu'aucune position n'est exprimée en pourcentage
- [x] 9.4 Lancer `pnpm build` sans erreur et vérifier dans la sortie que `canvas-confetti` est dans un fichier chargé à la demande, pas dans le fichier principal
- [x] 9.5 Lancer `pnpm ng test --watch=false` : tous les tests passent
- [x] 9.6 Vérifier dans l'application (`pnpm start`) :
  - le modèle d'exemple se parcourt de bout en bout en vue chemin : « Build » et « Documentation » s'ouvrent ensemble avec l'animation et l'annonce, « Go / no-go » affiche 1/2 puis attend l'autre branche, la porte souple de « Documentation » se force avec une justification visible dans le pied, et les confettis partent au franchissement de « Déploiement » ;
  - « Passer le reste à OK » ne remplit que les étapes débloquées ;
  - en vue liste, les sections verrouillées montrent leurs prérequis et leurs contrôles en texte ; décocher un bloquant reverrouille l'étape suivante en conservant ses réponses ;
  - le clavier suffit : Tab atteint les nœuds, Entrée et Espace sélectionnent, ↑/↓ restent dans le panneau ;
  - l'audit de livraison garde la vue liste, sans bascule, avec ses icônes converties ;
  - le rendu est correct en thème sombre, en largeur mobile (défilement horizontal du graphe) et avec `prefers-reduced-motion` (ni animation ni confettis)
