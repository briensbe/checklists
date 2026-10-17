## Context

Le runner affiche les sections de la copie figée l'une sous l'autre (`checklist-section`), chacune avec ses lignes de contrôle (`checklist-item`). Depuis `quick-check-and-drawer`, la saisie passe par le `RunnerController` (`src/app/pages/checklist-runner/runner-controller.ts`), fourni par la page : il porte l'état d'interface (item actif, tiroir, suggestion, aide) et les actions de saisie, et les lignes l'injectent directement. La liste des contrôles affichés (`visibleItems`) est calculée une seule fois et partagée par le rendu et le clavier.

Ce que `step-flow-model` a laissé en place, sans écran :
- `computeStepFlow` (`src/app/domain/flow-rules.ts`), exposé en `computed` par `ChecklistSessionService.stepFlow` : `hasFlow`, ordre topologique, colonnes, état de chaque étape (`unlocked`, `blockingResolved`, `forced`, `passed`, `visual`, `join`, `next`), contrôles laissés en route (`leftBehind`) et boucle éventuelle ;
- `ChecklistSessionService.forceGate(sectionId, reason)`, qui enregistre un forçage dans `session.forcedGates`, sans interface ;
- le modèle d'exemple `src/assets/templates/release-flow.json` (« Mise en production »), seul modèle livré à dépendances.

Ce que `quick-check-and-drawer` a laissé en place :
- le composant `progress-ring` (anneau SVG en pixels, couleurs `--ring-*`) ;
- `evidenceState()` (`src/app/domain/quick-check.ts`), qui sait signaler une preuve `missing` à partir des résumés de preuves (`EvidenceService.summaries()`) ;
- `@lucide/angular` 1.59, avec `LucideDynamicIcon` (`<svg [lucideIcon]>`) et `provideLucideIcons`.

État constaté dans le code :
- **Les portes ne s'appliquent pas à la saisie** : tout contrôle d'une étape verrouillée reste saisissable dans la liste, au clic comme au clavier.
- `markRemainingAsOk` répond à tous les contrôles applicables, étapes verrouillées comprises.
- `section.icon` n'est affiché nulle part : l'en-tête de section montre une icône fixe (`list-checks`). Le modèle de livraison porte des noms Heroicons (`document-text`, `circle-stack`, `archive-box`, `cube`, `ticket`, `code`, `shield-check`, `git-branch`) ; le modèle d'exemple porte déjà des noms Lucide.
- La garde des raccourcis (`ShortcutContext.onControl`) ne reconnaît que `button, a[href], summary` : un élément SVG au rôle de bouton serait pris pour une ligne, et Espace y déclencherait le geste principal.
- L'application est sans zone : un signal modifié dans un rappel de `ResizeObserver` suffit à redessiner.

ADR en vigueur qui contraignent ce design (aucun n'est remplacé) :
- **ADR 0003** : la structure d'une session vient uniquement de sa copie figée.
- **ADR 0004** : pas de nouvelle version du fichier d'échange sans évolution incompatible.
- **ADR 0005** : dialogues maison et toasts ; l'annulation par toast est réservée aux actions destructives listées.
- **ADR 0007** : états d'étape calculés, jamais stockés, sauf le forçage d'une porte souple ; un modèle invalide n'enferme jamais l'utilisateur.
- **ADR 0008** : icônes Lucide ; icônes choisies d'après une donnée via `LucideDynamicIcon` et une liste fermée enregistrée par `provideLucideIcons` ; nom inconnu → icône par défaut.
- **ADR 0009** : preuve exigée garantie au geste, jamais par les règles de résolution ou de clôture ; une action groupée ne doit jamais écraser un N/A ni répondre à un bloquant sans sa preuve.

## Goals / Non-Goals

**Goals:**
- Montrer un modèle à dépendances comme un chemin : graphe, panneau de l'étape sélectionnée, bascule Chemin / Liste.
- Poser un composant de graphe unique, présentationnel et réutilisable par `builder-flow-editor`.
- Faire respecter les portes à la saisie, dans les deux vues, sans perdre de réponse.
- Expliquer une étape verrouillée (prérequis) et le passage des portes (pied d'étape, forçage d'une porte souple).
- Rendre visibles les contrôles laissés en route, et marquer le passage d'une porte et la fin du chemin.
- Trancher les questions laissées ouvertes : réponses d'une étape reverrouillée, révocation d'une porte forcée, clôture avec une preuve manquante.

**Non-Goals:**
- Aperçu du graphe et édition des dépendances dans le builder, palette d'icônes du builder (change `builder-flow-editor`, qui réutilisera le graphe et la liste fermée d'icônes).
- Phases, carte en régions et zoom (BACKLOG, « Grand périmètre »).
- Chemin vertical en zigzag et panneau en bas d'écran sur mobile (BACKLOG) : sur un écran étroit, le graphe défile horizontalement.
- Saisie par anticipation dans une étape verrouillée (`canAnticipate`, BACKLOG).
- Mise en évidence de la branche critique, zoom et déplacement dans le graphe, placement par `dagre`.
- Navigation entre nœuds par les flèches : les nœuds se parcourent avec Tab.
- Forçages de portes et bloquants passés en N/A dans les rapports Excel et PDF (suite possible, voir Open Questions).
- Mémoriser l'étape sélectionnée entre deux ouvertures du runner.

## Decisions

### D1. Un graphe présentationnel, positions calculées par une fonction pure

Le graphe est un composant `StepGraphComponent` (`src/app/components/step-graph/`) **sans aucun service injecté**. Il reçoit :
- `nodes` : pour chaque étape, son identifiant, son libellé, son icône déjà résolue (D3), sa colonne, ses dépendances, son état visuel, sa progression (contrôles répondus / applicables), l'indicateur d'anomalie et la progression de jonction ;
- `selectedId` et `pulseIds` (étapes à animer, D7) ;
- un `output` `select` qui émet l'identifiant de l'étape choisie.

Le runner construit ces nœuds à partir du `StepFlow` ; `builder-flow-editor` les construira à partir du seul modèle. C'est ce qui rend le composant réutilisable sans dépendre de la session.

Le placement est une fonction pure `layoutStepGraph(structure, availableWidth)` dans `src/app/domain/step-graph-layout.ts` :
- **abscisse** : centre de la colonne, `padding + (colonne + 0,5) × largeurColonne`, où `largeurColonne = max(LARGEUR_MIN, (largeurDisponible − 2 × padding) / nbColonnes)` ;
- **largeur du dessin** : `max(largeurDisponible, nbColonnes × LARGEUR_MIN + 2 × padding)`. Quand elle dépasse la largeur disponible, le conteneur défile horizontalement (`overflow-x: auto`) ;
- **ordonnée** : colonne par colonne, de gauche à droite. La hauteur idéale d'un nœud est la moyenne des hauteurs de ses dépendances (barycentre), 0 pour un départ. Dans une colonne, on trie par hauteur idéale (à égalité, ordre du modèle), on impose un écart minimal entre voisins, puis on recentre le groupe sur la moyenne des hauteurs idéales. Enfin, on décale tout le dessin pour que le plus haut nœud tienne dans la marge, et la hauteur du dessin découle du plus bas nœud et de la place des libellés ;
- **liens** : courbe de Bézier cubique du bord droit du nœud de départ au bord gauche du nœud d'arrivée, points de contrôle à mi-distance horizontale (`M ax+r ay C mx ay, mx by, bx−r by`). Une boucle (données invalides) produit un lien qui revient en arrière : il est dessiné tel quel ;
- **libellés** : sous le nœud, raccourcis à un nombre de caractères déduit de la largeur de colonne, avec « … ». Le libellé complet va dans un `<title>` et dans le nom accessible.

Sur le modèle d'exemple, ce placement redonne celui de la maquette 03 : « Tests » à la hauteur de « Build », « Go / no-go » entre « Tests » et « Documentation ».

Le composant mesure la largeur de son conteneur avec un `ResizeObserver` (créé dans le constructeur, déconnecté par `DestroyRef`) qui écrit dans un signal. En l'absence de `ResizeObserver` (jsdom dans les tests), il lit `clientWidth` une fois, ou retombe sur la largeur minimale.

Pour ne pas recalculer le placement à chaque réponse, le composant sépare un `computed` de **structure** (identifiants, colonnes, dépendances, libellés), qui ne change qu'avec la copie figée, d'un `computed` d'**état** (état visuel, progression, jonction). Le placement ne dépend que de la structure et de la largeur.

Alternatives écartées :
- **Nœuds en HTML positionnés en pourcentages et liens en SVG** (maquettes) : deux repères différents, origine du bug documenté dans `checklist-ux.md`.
- **HTML et SVG superposés, en pixels** (option 2 du §9) : deux arbres à synchroniser, et l'aperçu du builder devrait refaire cette synchronisation.
- **`dagre`** : dépendance lourde pour des graphes de 5 à 10 étapes ; le placement par colonnes suffit.
- **Un `viewBox` fixe mis à l'échelle** : les textes et les anneaux rétréciraient sur un écran étroit au lieu de défiler.

### D2. Nœud du graphe : anneau, icône, cadenas, coche, badge

Chaque nœud est un `<g>` translaté à sa position, qui contient :
- un disque de fond ;
- pour une étape débloquée, la piste et l'arc de l'anneau ;
- au centre, l'icône d'étape (`open`, `passed`), une coche (`done`) ou un cadenas (`locked`) ;
- pour une jonction, un badge `n/m` (rectangle arrondi et texte) en haut à droite.

**On réutilise le calcul et les couleurs de `progress-ring`, pas son composant** : son élément hôte (`<app-progress-ring>`) est un élément HTML, qui ne peut pas vivre dans un `<svg>`. Le calcul du rayon, de la circonférence et du décalage du trait est extrait dans une fonction pure `ringGeometry(value, size, stroke)`, utilisée par `ProgressRingComponent` et par le nœud. Les couleurs restent les variables `--ring-track`, `--ring-progress`, `--ring-complete` et `--ring-anomaly`, et le choix de la couleur reprend la règle des anneaux de la barre de progression (`RingTone`).

Les icônes sont des `<svg [lucideIcon]>` imbriqués dans le `<svg>` du graphe, placés par un `<g transform="translate(…)">` englobant plutôt que par des attributs `x`/`y`, que le composant Lucide pourrait réécrire. Un `<svg>` imbriqué reste du SVG : la règle « tout dans le même `<svg>` » est respectée. La première tâche de l'implémentation vérifie ce rendu dans le navigateur. **Vérifié à l'implémentation**, avec le composant réel plutôt qu'un prototype : les icônes s'affichent à la bonne place et à la bonne taille dans les deux thèmes, et le repli n'a pas été nécessaire. Un test vérifie aussi, dans jsdom, que chaque icône de la liste fermée produit un `<svg>` non vide, imbriqué dans l'espace de noms SVG.

Couleurs : nouvelles variables dans `src/styles.css`, dans les deux thèmes : `--graph-node-bg`, `--graph-node-border`, `--graph-node-selected`, `--graph-node-locked`, `--graph-link-open` (vert `emerald`), `--graph-link-closed`, `--graph-label`, `--graph-badge-bg`, `--graph-badge-ready-bg`, `--graph-badge-text`, `--graph-focus`. Aucune couleur dans le composant ni dans le SVG.

### D3. Icônes d'étape : liste fermée, conversion à l'affichage

Une fonction pure `resolveStepIcon(name)` dans `src/app/domain/step-icons.ts` :
1. renvoie le nom s'il figure dans la liste fermée `STEP_ICON_NAMES` ;
2. sinon le convertit s'il figure dans la table `LEGACY_STEP_ICONS` (anciens noms Heroicons) ;
3. sinon renvoie l'icône par défaut `list-checks`, déjà affichée aujourd'hui dans l'en-tête de section.

La liste fermée compte une trentaine d'icônes : toutes celles des modèles livrés (après conversion) et celles qu'utilisera le builder (`flag`, `goal`, `git-merge`). Indicativement : `list-checks`, `clipboard-list`, `clipboard-check`, `flag`, `goal`, `git-merge`, `git-branch`, `hammer`, `wrench`, `book-open`, `file-text`, `flask-conical`, `bug`, `gavel`, `rocket`, `ticket`, `box`, `package`, `archive`, `code`, `terminal`, `database`, `server`, `cloud`, `globe`, `shield-check`, `lock`, `users`, `message-square`, `mail`, `calendar`, `settings`, `search`.

La table de conversion couvre les noms du modèle de livraison (`document-text` → `file-text`, `circle-stack` → `database`, `archive-box` → `archive`, `cube` → `box`) et les équivalents Heroicons courants des icônes de la liste (`beaker` → `flask-conical`, `cog-6-tooth` → `settings`, `command-line` → `terminal`, `server-stack` → `server`, `user-group` → `users`, `envelope` → `mail`, `magnifying-glass` → `search`, `lock-closed` → `lock`…). `ticket`, `code`, `shield-check` et `git-branch` existent sous le même nom.

L'enregistrement : `STEP_ICON_COMPONENTS` (les composants Lucide correspondants) et `provideStepIcons()` dans `src/app/components/step-graph/step-icons.ts`, appelé une fois dans `app.config.ts`, puisque le runner et le builder s'en serviront. Un test vérifie que chaque nom de `STEP_ICON_NAMES` produit une icône non vide avec `LucideDynamicIcon` : il détecte un oubli dans la liste enregistrée ou un renommage chez Lucide.

**Les données ne sont jamais réécrites** : la conversion se fait à l'affichage. Réécrire `section.icon` toucherait la copie figée (ADR 0003) et créerait de faux changements dans la comparaison de versions.

L'en-tête de section de la vue liste et l'en-tête du panneau d'étape utilisent la même résolution.

### D4. Le `RunnerController` pilote les deux vues

Le `RunnerController` reste la seule source de l'état d'interface et des actions de saisie. Il reçoit :
- `viewMode` (`'path' | 'list'`), significatif seulement quand `stepFlow().hasFlow` ; la préférence est lue et écrite dans `localStorage` (clé `checklists.runner-view`), dans un `try/catch` : sans stockage disponible, la vue chemin s'affiche par défaut ;
- `selectedStepId`, initialisé par la fonction pure `defaultSelectedStep(flow)` (D5) au premier calcul pour une session, puis seulement modifié par l'utilisateur ou par une navigation (D8) ;
- `isPathView`, un `computed` vrai quand le modèle a des dépendances et que la vue chemin est choisie ;
- les modèles d'affichage des étapes (`stepViews`) : prérequis, contenu verrouillé et pied d'étape de chaque section, calculés par les fonctions pures de D5 ;
- `pulseIds`, `announcement` et le déclenchement des confettis (D7).

**Contrôles affichés** : `visibleItems` reçoit un paramètre de portée `{ locked, sectionId }`.
- Les contrôles d'une section verrouillée ne sont jamais affichés, même épinglés par un tiroir ouvert : le verrouillage l'emporte sur l'exception du filtre. L'effet existant ferme alors le tiroir, et la note déjà saisie est conservée, puisque `mutate()` l'a appliquée au signal avant l'écriture différée.
- En vue chemin, seuls les contrôles de l'étape sélectionnée sont affichés.

Le rendu, la navigation au clavier, l'item actif et « Prochain item à traiter » partagent toujours cette liste unique.

`selectStep(id)` change l'étape sélectionnée puis fait du premier contrôle affiché du nouveau panneau l'item actif, explicitement : la règle générique de `nextActiveItem` choisirait le dernier.

Les lignes (`checklist-item`) et le tiroir n'ont **aucune modification de câblage** : ils injectent déjà le contrôleur. Le panneau d'étape ne fait que les instancier pour les contrôles affichés de l'étape sélectionnée, avec les mêmes ancres `item-<id>`.

Alternative écartée : **un second contrôleur pour la vue chemin**. Deux sources d'item actif et de tiroir ouvert, et une bascule de vue qui perdrait l'état.

### D5. Règles pures de la vue chemin dans `src/app/domain/path-view.ts`

Sur le modèle de `quick-check.ts`, toutes les décisions sont des fonctions pures, testées sans Angular :
- `defaultSelectedStep(flow)` : première étape `open` de l'ordre topologique, sinon première `passed`, sinon dernière de l'ordre ;
- `stepPrerequisites(section, flow)` : pour chaque dépendance, son état `ready` (franchie), `in-progress` (débloquée, pas franchie) ou `not-open` (verrouillée), et le mode de jonction ;
- `lockedStepItems(section, session)` : contrôles applicables avec, pour ceux qui ont une réponse, son texte (« fait », « OK », « KO », « N/A », libellé du choix) ;
- `stepFooter(section, session, flow, evidence)` : bloquants non résolus, étapes suivantes avec leur état, étape finale, « toutes les étapes franchies », bloquants passés en N/A, preuves à compléter, preuves manquantes (via `evidenceState`, donc avec les résumés de preuves, jamais dans `computeStepFlow`, ADR 0009), forçage enregistré, et possibilité de forcer (porte souple, débloquée, non franchie) ;
- `newlyUnlocked(previous, current)` et `allStepsPassed(flow)` (D7) ;
- `lockedSectionIds(flow)` ;
- `toGraphNodes(flow, template, progress)` : construction des nœuds du graphe pour le runner.

### D6. Les portes s'appliquent à la saisie, au niveau du service

`ChecklistSessionService` reçoit une garde privée `isItemLocked(itemId)`, lue sur `stepFlow()`, appelée en tête de `updateAnswerStatus`, `updateAnswerCheckbox`, `updateAnswerChoice`, `toggleNa` et `resolveItem` : l'opération est ignorée, comme sur une session terminée.

Ne sont **pas** gardés :
- `updateAnswerComment` et `updateAnswerExtra` : une frappe en cours ne doit jamais être perdue parce qu'une autre ligne vient de reverrouiller l'étape ;
- les preuves (`recordEvidenceEvent`, `removeEvidenceRemovedEvent`, `clearEvidencePending`, `setEvidenceLink`) : l'annulation d'une suppression doit aboutir même si l'étape s'est verrouillée entre-temps, et l'interface ne propose de toute façon aucun tiroir sur une étape verrouillée ;
- `restoreAnswers`, `resetSession` et l'application d'une nouvelle version du modèle.

La garde au service plutôt que dans le contrôleur : le contrôleur n'est qu'un appelant parmi d'autres (raccourcis, actions groupées, futures vues). C'est la même logique que la garde de lecture seule de `mutate()`.

**« Passer le reste à OK »** calcule `computeStepFlow(session)` une seule fois au début de la mutation et ne traite que les contrôles des sections alors débloquées. Il n'y a **pas de cascade** : remplir « Préparation » débloque « Build », mais « Build » n'est pas rempli dans la même action. Sinon une seule action franchirait tout le chemin et viderait les portes de leur sens. Le résultat gagne un compteur `skippedLocked` (contrôles sans réponse dans des étapes verrouillées), qui ajoute au toast « Les étapes verrouillées n'ont pas été modifiées. ». Les règles de l'ADR 0009 sont inchangées (N/A jamais écrasé, bloquant sans preuve laissé sans réponse, `evidencePending` pour un non bloquant). L'annulation restaure toujours l'instantané complet des réponses.

**« Prochain item à traiter »** : `nextItemToProcess` reçoit l'ensemble des sections verrouillées et ignore leurs contrôles. Une fonction `nextItemState` renvoie `available`, `all-done` ou `locked-only`, et la barre de progression remplace son entrée `nextDisabled` par cet état pour choisir son libellé.

### D7. Passage d'une porte, fin du chemin et confettis

Un `effect` du contrôleur compare l'ensemble des étapes débloquées au calcul précédent :
- au premier calcul pour une session (chargement, changement de session), il mémorise l'état sans rien produire ;
- ensuite, les étapes nouvellement débloquées vont dans `pulseIds` pendant environ 700 ms, et `announcement` reçoit « Porte ouverte vers « Build » et « Documentation » » ;
- quand `allStepsPassed` passe de faux à vrai sur un modèle à dépendances et une session en cours, `announcement` reçoit « Toutes les étapes sont franchies » et les confettis sont lancés.

Un retour en arrière (bloquant décoché) remet `allStepsPassed` à faux : un nouveau passage relance les confettis, une fois.

L'annonce passe par une région `aria-live="polite"` visuellement masquée, présente dans les deux vues. Pour qu'un même message soit annoncé deux fois de suite, le contrôleur vide la région avant de la remplir au rendu suivant. **À l'implémentation**, le contrôleur ajoute plutôt un espace insécable en fin de message quand il est identique au précédent : le texte change, il est relu, sans dépendre du moment du rendu.

**À l'implémentation**, une nouvelle session (changement de route) remet aussi l'item actif à zéro : il redevient le premier contrôle affiché, au lieu d'un contrôle de la session précédente.

L'animation est une classe CSS posée sur le `<g>` du nœud (`transform-box: fill-box; transform-origin: center`, petite mise à l'échelle), coupée par `@media (prefers-reduced-motion: reduce)`, comme les transitions de l'anneau et des liens.

**Confettis** : une fonction `launchConfetti()` dans `src/app/services/confetti.ts`. **À l'implémentation**, c'est un service injectable `ConfettiService` (méthode `launch()`) : les tests du contrôleur le remplacent par une simulation, et ceux du service remplacent son chargement (`loader`), sans dépendre d'un `vi.mock` de module.
- Si `matchMedia('(prefers-reduced-motion: reduce)')` répond vrai, elle s'arrête sans rien charger.
- Sinon elle fait `await import('canvas-confetti')`, puis lance une salve avec `disableForReducedMotion: true` (double sécurité).
- Toute erreur de chargement est ignorée : l'annonce textuelle suffit.

L'import dynamique place la bibliothèque dans un fichier séparé, absent du chargement initial. Version : `canvas-confetti` 1.9.x, qui publie un module ESM (`dist/confetti.module.mjs`) sans types ; `@types/canvas-confetti` va en dépendance de développement.

Alternatives écartées :
- **Confettis à la clôture** : la clôture peut avoir lieu longtemps après, et une session `completionPolicy: 'all'` n'est pas forcément « terminée » au sens du chemin ; la vision réserve les confettis à la fin du process.
- **Confettis sur tout modèle** : un modèle sans dépendance « franchirait tout » dès le chargement, ou dès son dernier bloquant ; le changement de comportement serait surprenant pour les audits existants.

### D8. Navigation vers une étape ou un contrôle

`focusItem` et `focusSection` deviennent sensibles à la vue :
- **vue liste** : comportement actuel (dépliage de la section, filtre repassé à « Tous », défilement et focus) ;
- **vue chemin** : `selectStep(item.sectionId)` à la place du dépliage, puis la même suite. Si la section du contrôle est verrouillée, le focus va au panneau d'étape (ancre `step-panel` avec `tabindex="-1"`), puisque le contrôle n'a pas de ligne ;
- **clic sur un anneau de la barre de progression, en vue chemin** : sélection de l'étape et défilement jusqu'au panneau.

Tous les appelants existants (`goToNext`, `onIssueClick`) en profitent sans modification, ainsi que les nouveaux (« Laissés en route », libellés du pied d'étape).

### D9. Étape verrouillée, pied d'étape et forçage : trois composants partagés par les deux vues

- `StepLockedComponent` : prérequis puis liste de texte des contrôles applicables (D5), avec le rappel discret des réponses d'une étape reverrouillée et la mention « Réponses conservées : elles redeviendront modifiables à l'ouverture de la porte ». Pas de case, pas de badge, pas de trombone (principe 3 de la vision).
- `StepFooterComponent` : mentions de D5, chaque étape suivante débloquée et chaque libellé de contrôle étant un bouton. **À l'implémentation**, ses actions (sélection d'une étape, navigation vers un contrôle, forçage) passent par le `RunnerController`, qu'il injecte comme les lignes, plutôt que par des sorties relayées par la section et le panneau (ADR 0010, point 2). Le formulaire de forçage est **dans le pied d'étape**, sans fenêtre modale : un `textarea` obligatoire, « Forcer » désactivé tant qu'il est vide, « Annuler » et Échap pour fermer. Échap est traité dans le formulaire avec `preventDefault()`, que le gestionnaire du runner respecte déjà (`event.defaultPrevented`) : il ne fermera pas en plus un tiroir ouvert ailleurs.
- `StepPanelComponent` (vue chemin) : en-tête (icône, titre, état, mention « jonction », compteur et `app-progress-ring`), puis `StepLockedComponent` ou les lignes et le `StepFooterComponent`.

En **vue liste**, `checklist-section` reçoit une entrée optionnelle `step` (absente pour un modèle sans dépendance) : icône résolue et état dans l'en-tête, `StepLockedComponent` à la place des lignes si l'étape est verrouillée, `StepFooterComponent` sous les lignes sinon. Les deux vues présentent donc exactement les mêmes informations.

Les boutons « Tout déplier » et « Tout replier » d'`audit-summary` sont masqués en vue chemin (nouvelle entrée `showCollapse`).

**Forçage** : le contrôleur appelle `ChecklistSessionService.forceGate`, qui vérifie déjà porte souple, étape débloquée, session en cours et justification non vide. Le pied affiche le dernier forçage pris en compte (`forcedSectionIds`, qui ignore un forçage dont la porte est redevenue stricte).

**Pas de révocation** : un forçage est une décision tracée de l'utilisateur, protégée par une justification saisie (ADR 0007). On ne l'annule ni par toast ni par commande ; seule la réinitialisation confirmée l'efface, comme aujourd'hui. Une erreur de forçage se corrige en résolvant les bloquants, et la trace reste lisible dans le pied.

### D10. Laissés en route

Un composant `LeftBehindComponent` est placé dans le résumé qui défile, juste après `app-audit-summary`, dans les deux vues. Il reçoit les entrées (libellé, titre de l'étape, raison) construites à partir de `sessionService.leftBehind()` et émet l'identifiant du contrôle choisi, que le runner passe à `controller.focusItem`. Il ne s'affiche pas quand la liste est vide ; c'est toujours le cas sans dépendance (spec `step-flow`).

Il ne va pas dans la barre fixée : elle doit rester compacte pour ne pas masquer la ligne vers laquelle on navigue (spec `checklist-execution-runner`).

### D11. Clôture avec des preuves manquantes : confirmation, pas blocage

C'est la question laissée ouverte par l'ADR 0009. **La validation de clôture reste pure et ne lit pas les preuves.** Dans `ChecklistRunnerComponent.onComplete`, quand `completionIssues()` est vide :
1. exécuter les suppressions de preuves en attente (déjà fait aujourd'hui) ;
2. compter les contrôles applicables dont `evidenceState` vaut `missing`, avec une fonction pure `missingEvidenceItems` (`quick-check.ts`) ;
3. s'il y en a, demander une confirmation par `DialogService.confirm`, en indiquant le nombre de contrôles concernés et combien sont bloquants ;
4. terminer la session si l'utilisateur confirme.

Une annulation laisse la session en cours. Les suppressions de preuves exécutées à l'étape 1 le restent : elles auraient de toute façon été exécutées à l'expiration de leur toast.

Alternatives écartées :
- **Bloquer la clôture** : il faudrait lire la table `evidences` dans la validation, ce que l'ADR 0009 exclut ; un nouvel ADR serait nécessaire, et la suppression tardive d'un fichier pourrait empêcher de terminer sans explication claire.
- **Ne rien faire de plus** : un rapport pourrait affirmer un bloquant validé sans sa preuve, sans que personne ne l'ait vu au moment de clore.

### D12. Raccourcis : un nœud du graphe est un bouton

La garde `onControl` du runner ajoute `[role="button"]` à son sélecteur (`button, a[href], summary, [role="button"]`). Espace sur un nœud active donc le nœud (sélection de l'étape) au lieu du geste principal. Les flèches gardent leur rôle de navigation entre les lignes, même quand le focus est sur un nœud. Les nœuds gèrent eux-mêmes Entrée et Espace (avec `preventDefault()` pour Espace, qui ferait sinon défiler la page).

**Constaté à l'implémentation** : le gestionnaire du runner ne retenait la cible de la touche que si c'était un `HTMLElement`. Un nœud du graphe est un élément SVG, donc la garde ne le voyait pas. Elle retient désormais tout `Element`.

## Risks / Trade-offs

- [Un `<svg lucideIcon>` imbriqué dans le `<svg>` du graphe ne se rend pas, ou se place mal] → Vérification dans le navigateur en première tâche. Repli : dessiner l'icône avec les nœuds de `LucideIconData` (tracés) dans un `<g>`, toujours sans pourcentage.
- [`ResizeObserver` absent des tests (jsdom)] → Repli sur `clientWidth` puis sur la largeur minimale ; le placement est testé en fonction pure, sans DOM.
- [Le placement par barycentre croise des liens sur un graphe touffu] → Acceptable pour 5 à 10 étapes. Au-delà, la carte en régions (BACKLOG) est la vraie réponse ; `dagre` reste possible derrière la même fonction `layoutStepGraph`.
- [Lisibilité au-delà de 7 ou 8 étapes, par exemple l'audit de livraison s'il reçoit des dépendances] → Largeur minimale de colonne et défilement horizontal ; libellés raccourcis, complets dans le nom accessible.
- [La garde des étapes verrouillées bloque un parcours légitime] → Liste explicite des opérations exemptées (D6), et tests de l'annulation d'un passage groupé et de la suppression d'une preuve après un reverrouillage.
- [Une session d'avant ce change a des réponses dans des étapes verrouillées] → Elles sont conservées et rappelées en texte (D9) ; elles redeviennent modifiables à l'ouverture de la porte. Les règles de clôture ne changent pas.
- [Annonces répétées trop nombreuses (aria-live) lors d'un passage groupé] → Une seule annonce par calcul, qui regroupe toutes les portes ouvertes ensemble.
- [Confettis gênants en contexte professionnel] → Une seule salve, seulement à la fin du chemin, coupée par `prefers-reduced-motion`. Le « mode discret » de la vision reste au BACKLOG.
- [`localStorage` indisponible (navigation privée, stockage bloqué)] → `try/catch`, vue chemin par défaut.
- [Une boucle dans une copie figée importée] → Les étapes concernées sont débloquées (ADR 0007), le graphe dessine le lien qui revient en arrière, et un avertissement signale le chemin invalide.
- [Tests instables (constaté à l'implémentation)] → Trois fichiers de test existants (`checklist-runner`, `checklists-dashboard`, `toast.service`) activaient les minuteurs simulés sans les rétablir, ce qui figeait `fake-indexeddb` dans les fichiers suivants : des tests de migration et de preuves échouaient par dépassement de délai, selon l'ordre d'exécution, que les nouveaux fichiers ont modifié. Chacun rétablit désormais les vrais minuteurs après chaque test.
- [Lecteurs d'écran (constaté à l'implémentation)] → Angular supprime les espaces entre éléments : « Tests » et « prête » se seraient lus « Testsprête ». Les prérequis et le bloc « Laissés en route » ajoutent des séparateurs réservés aux technologies d'assistance.

## Migration Plan

- Aucune migration de données : ni nouveau champ, ni nouvelle version de base Dexie, ni nouvelle version du fichier d'échange. Le choix de vue est une préférence locale du navigateur.
- Nouvelles dépendances : `pnpm add canvas-confetti` et `pnpm add -D @types/canvas-confetti`.
- Retour arrière : revenir au commit précédent. Les sessions et forçages enregistrés entre-temps restent lisibles, puisque le format n'a pas changé ; la préférence de vue est simplement ignorée.

## Open Questions

- **Révocation d'une porte forcée** : écartée dans ce change (D9). À reconsidérer si l'usage montre des forçages faits par erreur. Une annulation par toast de 6 s serait alors la forme la plus cohérente avec l'ADR 0005.
- **Blocage de la clôture par une preuve manquante** : remplacé par une confirmation (D11). Le bloquer vraiment demanderait un ADR qui remplace le point 2 de l'ADR 0009.
- **Rapports** : les forçages de portes (date, justification) et les bloquants passés en N/A n'apparaissent pas encore dans les exports Excel et PDF. C'est utile pour un audit ; à traiter dans un change dédié à `audit-persistence-export`.
- **Ordre de « Prochain item à traiter »** : on garde l'ordre du modèle. L'ordre topologique serait plus naturel pour un chemin, mais les deux coïncident sur le modèle d'exemple ; à revoir avec `builder-flow-editor`, où l'ordre d'affichage et l'ordre du chemin peuvent diverger.
- Aucun ADR en vigueur n'est à remplacer. Les décisions durables de ce change (D1, D3, D4, D6 et D7) sont consignées dans un nouvel ADR à l'étape suivante.
