# ADR 0010 : Graphe d'étapes unique, vues du runner pilotées par le `RunnerController` et portes appliquées à la saisie

## Statut
Accepté - 2026-10-17

Supersedes: aucun (prolonge ADR 0007, ADR 0008 et ADR 0009)

## Contexte
L'ADR 0007 calcule l'état des étapes (débloquée, franchie, jonctions) sans le montrer ni le faire respecter : dans le runner, un contrôle d'une étape verrouillée reste saisissable. Le change `runner-path-view` ajoute une vue « Chemin » (graphe des étapes, puis panneau de l'étape sélectionnée) à côté de la vue liste. Le change suivant, `builder-flow-editor`, doit réutiliser le même graphe pour l'aperçu du builder, et la vision prévoit plus tard des phases dessinées de la même façon.

Plusieurs choix engagent ces changes au-delà de celui-ci :
- **Le rendu du graphe.** Les maquettes placent les nœuds en pourcentages CSS et les liens dans un `viewBox` SVG : deux repères, à l'origine du bug documenté dans `docs/design/checklist-ux.md`.
- **L'état d'interface d'un runner à plusieurs vues.** `quick-check-and-drawer` a introduit un `RunnerController` à portée de page (item actif, tiroir, actions de saisie), en le laissant au rang de décision d'implémentation, à confirmer par la vue chemin.
- **Le respect des portes.** Les ouvrir et les fermer n'a de sens que si l'on ne peut pas répondre derrière une porte fermée, quelle que soit la vue.
- **Les icônes d'étape tirées des données** (`section.icon`), que l'ADR 0008 (point 3) annonçait sans en fixer la liste ni la conversion des anciens noms.
- **Les effets décoratifs** (animation au passage d'une porte, confettis à la fin), qui ne doivent alourdir ni le chargement ni l'expérience des personnes sensibles aux animations.

## Décision
1. **Un seul composant de graphe des étapes, présentationnel, tout en SVG et en pixels.** Nœuds, anneaux, icônes, libellés et liens partagent un unique `<svg>` et un unique repère en pixels ; aucune position n'est exprimée en pourcentage. Les positions sont calculées par une fonction pure à partir des colonnes (plus long chemin depuis un départ, ADR 0007) et de la largeur du conteneur, mesurée par `ResizeObserver`. Sous une largeur minimale de colonne, le graphe défile horizontalement au lieu de rétrécir. Le composant n'injecte aucun service : il reçoit des nœuds et des liens, et émet la sélection. Le runner, l'aperçu du builder et les futures phases l'alimentent chacun depuis leurs données.
2. **Les vues du runner sont des présentations d'un même `RunnerController`.** Ce contrôleur, fourni par la page (une instance par runner), porte tout l'état d'interface (vue courante, étape sélectionnée, item actif, tiroir, aide) et toutes les actions de saisie. Les lignes et le tiroir l'injectent directement. Une vue ne duplique ni la logique de saisie ni la liste des contrôles affichés, qui reste unique et partagée par le rendu et le clavier. Une nouvelle vue (phases, carte) ajoute un mode à ce contrôleur, pas un second contrôleur.
3. **Les portes s'appliquent à la saisie, au niveau du service.** Aucun changement d'état de réponse (statut, coche, choix, N/A, réponse conforme) n'est accepté sur un contrôle d'une étape verrouillée, quelle que soit la vue et quel que soit l'appelant, comme la garde de lecture seule d'une session terminée. En sont exemptés les saisies de texte, les opérations sur les preuves, l'annulation d'une action, la réinitialisation confirmée et l'application d'une nouvelle version du modèle. Les réponses d'une étape qui se verrouille sont conservées. Une action groupée ne traite que les étapes débloquées au moment où elle est lancée, sans cascade. Une future saisie par anticipation (`canAnticipate`) fera l'objet d'un ADR qui précisera cette règle.
4. **Icônes d'étape : une liste fermée unique et une résolution à l'affichage.** Une seule liste de noms d'icônes Lucide sert au runner et à la palette du builder, enregistrée une fois par `provideLucideIcons`. Un nom est résolu à l'affichage : nom de la liste, sinon conversion d'un ancien nom Heroicons connu, sinon icône par défaut. Les données (modèle, copie figée) ne sont jamais réécrites.
5. **Les effets décoratifs sont chargés à la demande et facultatifs.** Une bibliothèque purement décorative (aujourd'hui `canvas-confetti`) est importée dynamiquement au moment de l'effet, jamais dans le chargement initial. Elle n'est pas chargée du tout quand l'utilisateur demande de réduire les animations (`prefers-reduced-motion`), et un échec de chargement est ignoré. Chaque effet est doublé d'une annonce textuelle pour les technologies d'assistance : aucune information ne passe seulement par une animation.

Alternatives écartées :
- **Nœuds HTML positionnés en pourcentages et liens SVG** (maquettes) : deux repères qui divergent au redimensionnement.
- **HTML et SVG superposés, en pixels** : deux arbres à synchroniser, à refaire dans chaque vue qui affiche le graphe.
- **`viewBox` fixe mis à l'échelle** : textes et anneaux illisibles sur un écran étroit.
- **`dagre` pour le placement** : dépendance lourde pour des graphes de quelques étapes.
- **Un contrôleur par vue** : deux items actifs et deux tiroirs ouverts possibles, et un état perdu à chaque bascule de vue.
- **Portes appliquées seulement dans la vue chemin** : la vue liste deviendrait un contournement, et la garde manquerait aux raccourcis et aux actions groupées.
- **Réécrire les noms d'icônes Heroicons dans les données** : modification de la copie figée (ADR 0003) et faux changements dans la comparaison de versions.
- **Importer les bibliothèques décoratives statiquement** : poids ajouté au chargement de toutes les pages pour un effet rare.

## Conséquences
- **Positives** :
  - le graphe se dessine de la même façon dans le runner et dans le builder, sans risque de décalage entre nœuds et liens ;
  - le placement et les états se testent en fonctions pures ;
  - les deux vues du runner restent cohérentes (même item actif, même tiroir, même clavier) ;
  - une porte fermée l'est pour tous les chemins d'accès, raccourcis et actions groupées compris ;
  - les modèles anciens affichent des icônes cohérentes sans migration ;
  - le chargement initial ne grossit pas.
- **Négatives / Précautions** :
  - toute nouvelle opération qui change l'état d'une réponse doit passer par la garde des étapes verrouillées, ou figurer explicitement parmi les exemptions ;
  - le `RunnerController` concentre l'état d'interface de toutes les vues : il faut garder ses décisions dans des fonctions pures (`quick-check.ts`, `path-view.ts`) pour qu'il reste lisible ;
  - la liste fermée d'icônes doit suivre les renommages de Lucide ; un test vérifie que chaque nom produit une icône ;
  - le placement par colonnes peut croiser des liens sur un graphe touffu : au-delà d'une dizaine d'étapes, la réponse prévue est la carte en régions, pas un algorithme de placement plus lourd.
