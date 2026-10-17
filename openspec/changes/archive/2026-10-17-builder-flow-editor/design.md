## Context

Le builder (`src/app/pages/template-builder/`) édite un signal `template` : informations générales, schéma de contexte, sections (titre, ↑/↓, glisser-déposer CDK, duplication, suppression avec annulation de 6 s) et items (libellé, type, aide, criticité, preuve exigée, choix, options avancées). La détection des modifications non enregistrées compare `JSON.stringify(template())` à un instantané pris au chargement, dans un `computed` (`isDirty`), lu par la garde `canDeactivateTemplateBuilder` et par `beforeunload`.

Ce que les changes précédents ont laissé en place :
- **`step-flow-model`** : les champs `dependsOn`, `joinMode`, `gate`, `icon` et `completionPolicy` existent ; `src/app/domain/flow-rules.ts` fournit `wouldCreateCycle`, `computeColumns`, `topologicalOrder`, `findCycleMembers` et `validateFlow`, déjà appelée par `validateTemplateIntegrity` à l'enregistrement ; `removeSectionFromDependencies` et `duplicateSection` gèrent déjà les dépendances, et la suppression d'une section restaure ses dépendances à l'annulation ; `diffTemplates` signale déjà dans la fenêtre « Modèle mis à jour » les changements de dépendances, de jonction, de porte, de criticité, de preuve et de politique de clôture.
- **`runner-path-view`** : le composant présentationnel `StepGraphComponent` (`src/app/components/step-graph/`) reçoit des `StepGraphNode` et émet `select` ; le placement est fait par `layoutStepGraph` (`src/app/domain/step-graph-layout.ts`) ; la liste fermée d'icônes `STEP_ICON_NAMES`, la conversion `resolveStepIcon` (`src/app/domain/step-icons.ts`) et leur enregistrement `provideStepIcons()` (`app.config.ts`) servent déjà au runner, et contiennent `flag`, `goal` et `git-merge`.

État constaté dans le code :
- **Mises à jour encore faites en place** : les champs liés par `[(ngModel)]` (nom, version, description, titre de section, libellé et aide d'un item, horodatage, choix, champ additionnel, champs de contexte) écrivent directement dans les objets du signal ; `addItem`, `duplicateItem`, `removeItem`, `moveItem`, `onItemDrop` (via `transferArrayItem`), `onControlTypeChange`, les choix, `toggleExtraField`, `toggleVisibleIf` et les options de contexte modifient les tableaux puis appellent `template.update(cur => ({ ...cur }))`, ou rien du tout ; `save()` écrit `t.updatedAt` en place.
- **Conséquence** : un `computed` ne se recalcule que si un signal lu change. Une frappe dans le libellé d'un contrôle ne change pas la référence de `template()` : `isDirty` garde sa valeur précédente, et la garde laisse quitter la page sans confirmation si c'est la seule modification. Un aperçu calculé depuis `template()` ne suivrait pas non plus le titre d'une section.
- **Graphe** : le composant ne connaît qu'une présentation, celle du runner (anneau de progression, cadenas, coche, badge de jonction, liens pleins ou pointillés selon la porte) ; son nom accessible décrit l'état d'une session. Il n'a pas de place pour une seconde ligne sous le libellé.
- Le builder affiche `section.icon` nulle part et n'a aucun contrôle pour la politique de clôture.

ADR en vigueur qui contraignent ce design (aucun n'est remplacé) :
- **ADR 0006** : glisser-déposer CDK, garde `CanDeactivate`, mises à jour immuables par des helpers purs, identifiants non modifiables.
- **ADR 0007** : une section est une étape ; « absent = ancien comportement » ; les nouvelles valeurs par défaut sont écrites par le builder ; le builder refuse les boucles et les dépendances inconnues.
- **ADR 0008** : icônes Lucide, icônes choisies d'après une donnée par `LucideDynamicIcon` et une liste fermée.
- **ADR 0010** : un seul composant de graphe, présentationnel, en SVG et en pixels, alimenté par chaque écran depuis ses données ; une seule liste fermée d'icônes pour le runner et la palette du builder, résolue à l'affichage sans réécrire les données.

## Goals / Non-Goals

**Goals:**
- Construire et modifier l'enchaînement des étapes sans JSON : dépendances, porte, jonction, icône, politique de clôture.
- Voir le graphe se dessiner pendant l'édition, avec le même composant que le runner.
- Rendre la création d'une boucle impossible depuis l'interface, et signaler les défauts d'un modèle importé.
- Fiabiliser la détection des modifications non enregistrées en terminant le passage aux mises à jour immuables.
- Pouvoir recréer le modèle « Mise en production » depuis le builder.

**Non-Goals:**
- Édition directe dans le graphe (tirer un lien d'un nœud à l'autre, déplacer un nœud) : on édite la liste, on voit le graphe.
- Aperçu fixé en haut de l'écran pendant le défilement (voir Open Questions).
- Graphe dans le mode Aperçu existant du builder, qui reste une prévisualisation de la saisie.
- Bouton « Enchaîner toutes les étapes dans l'ordre » pour convertir d'un coup un modèle sans dépendance.
- Signaler un changement d'icône dans la fenêtre « Modèle mis à jour » : l'icône est cosmétique, elle ne change ni les portes ni les réponses.
- Phases, carte en régions, saisie par anticipation (BACKLOG).
- Visualiser les dépendances dans la bibliothèque des modèles (page Modèles).

## Decisions

### D1. Toutes les modifications du modèle passent par `template.update()` et des fonctions pures

Les liaisons `[(ngModel)]="x.y"` deviennent `[ngModel]="x.y"` + `(ngModelChange)="…"`, et chaque méthode du composant appelle `template.update(t => helper(t, …))`. Les helpers recréent uniquement le chemin modifié (modèle → section → item → choix), comme `setItemCriticality` le fait déjà :
- dans `template-builder.helpers.ts` : `updateTemplate` (nom, version, description, politique), `updateSection(t, sectionId, change)`, `updateItem` (rendu public), `updateContextField(t, index, change)`, et les opérations de liste (`addItem`, `insertItemCopy`, `removeItemAt`, `moveItemWithin`, `moveItemBetween`) bâties sur `reorderArray` et `transferItemBetweenLists` (déjà présents) ;
- `onItemDrop` n'utilise plus `transferArrayItem`/`moveItemInArray` sur les tableaux du signal ;
- `save()` construit une copie avec `updatedAt` au lieu d'écrire dans l'objet du signal.

`isDirty` reste un `computed` qui compare `JSON.stringify` à l'instantané : il devient fiable dès que chaque modification produit une nouvelle référence, et un retour manuel à l'état initial le repasse à faux.

*Alternatives écartées* : appeler `template.update(cur => ({ ...cur }))` après chaque mutation en place (oubli facile, et les références imbriquées inchangées empêchent tout `computed` plus fin, comme les nœuds de l'aperçu, de réagir) ; remplacer `isDirty` par un compteur de modifications (un retour à l'état initial resterait « modifié ») ; passer aux formulaires réactifs (`FormGroup`) : réécriture complète du builder pour un gain nul par rapport aux signals.

### D2. Les règles d'édition de l'enchaînement sont des fonctions pures dans `flow-editor.helpers.ts`

Nouveau fichier `src/app/pages/template-builder/flow-editor.helpers.ts`, testé sans Angular :
- `toggleDependency(t, sectionId, dependencyId)` : retire si présente ; sinon ajoute en fin de `dependsOn`, **sauf** si `wouldCreateCycle` (le modèle est rendu inchangé, garde en profondeur derrière la puce désactivée). `dependsOn` vide → propriété retirée ; moins de deux dépendances → `joinMode` retiré.
- `setSectionGate`, `setSectionJoinMode`, `setSectionIcon`, `setCompletionPolicy` : valeur écrite explicitement, défaut compris (ADR 0007, point 2).
- `newSectionDependencies(t)` : `[dernière section]` si une section déclare une dépendance non vide, sinon `undefined`.
- `dependencyChips(t, sectionId)` : une entrée par autre section, dans l'ordre de la liste, `{ id, title, selected, disabled }` avec `disabled = !selected && wouldCreateCycle(…)`.
- `sectionsWithDependents(t)` : ensemble des sections dont au moins une autre dépend (affichage du choix de porte).
- `summarizeFlow(t)` → `{ hasFlow, starts, ends, emptySections, errors }` pour le bandeau (D5).
- `toPreviewNodes(t)` → `StepGraphNode[]` pour l'aperçu (D4).

Les dépendances vers une section inconnue (modèle importé) sont ignorées par le dessin et les puces, mais signalées par le bandeau ; `removeSectionFromDependencies` (existant) continue de nettoyer à la suppression.

*Alternatives écartées* : garder ces règles dans le composant (non testables sans `TestBed`, et le composant dépasse déjà 590 lignes) ; les mettre dans `domain/flow-rules.ts` (ce fichier décrit les règles d'une session et de la validation partagée avec l'import ; les choix d'édition, comme retirer `joinMode` sous deux dépendances, sont propres au builder).

### D3. Le graphe gagne une variante « structure », une légende et un nom accessible fourni

`StepGraphComponent` reçoit un nouvel `input` `variant: 'progress' | 'structure'` (défaut `'progress'`, donc runner inchangé). `StepGraphNode` gagne deux champs facultatifs : `caption` (seconde ligne sous le libellé) et `ariaLabel` (remplace le nom calculé). En variante « structure » :
- le nœud dessine un disque bordé et `node.icon`, sans anneau, cadenas, coche ni badge de jonction ;
- tous les liens sont pleins, couleur `--graph-link-structure` (nouvelle variable, thèmes clair et sombre) ;
- le reste est commun : placement, défilement, `select`, `aria-current`, focus, animations.

`layoutStepGraph(structure, width, options = GRAPH_LAYOUT)` accepte déjà des options : le composant passe un `labelSpace` augmenté d'une ligne quand au moins un nœud a une légende. La légende est raccourcie par `truncateLabel`, comme le libellé.

Le composant reste présentationnel (ADR 0010, point 1) : c'est l'appelant qui choisit l'icône, la légende et le nom accessible.

*Alternatives écartées* : un second composant de graphe pour le builder (deux dessins à maintenir, contraire à l'ADR 0010) ; réutiliser la variante du runner avec l'état `open` et 0 réponse (anneau vide trompeur, nom accessible « ouverte, 0 sur 3 contrôles » faux dans un builder) ; ajouter un état `draft` à `StepVisual` (type du domaine des sessions, pollué par un besoin d'affichage).

### D4. Nœuds de l'aperçu : icône de rôle, légende et nom accessible

`toPreviewNodes(t)` parcourt l'ordre topologique (`topologicalOrder`, sections d'une boucle en fin), avec `computeColumns` pour la colonne et les seules dépendances connues pour `parents`. Icône, par priorité :
1. `flag` si l'étape n'a aucune dépendance (départ) ;
2. `git-merge` si elle en a au moins deux (jonction) ;
3. `goal` si aucune section n'en dépend (fin) ;
4. sinon `resolveStepIcon(section.icon)`.

Légende : `« n items · m bloq. »` (toujours les deux nombres). Nom accessible : `« Titre : étape de départ | jonction de k étapes | fin | étape, n items dont m bloquants »`. Titre vide → « Sans titre ». Les champs de progression (`visual`, `passed`, `answered`, `total`, `anomaly`, `join`) reçoivent des valeurs neutres, ignorées par la variante « structure ».

Le libellé « items » reprend la décision du HANDOVER et la maquette ; « 3 contrôles · 2 bloq. » dépasserait la largeur minimale d'une colonne (128 px) et serait raccourci.

L'aperçu (composant `flow-preview`) prend `template` en entrée, calcule les nœuds en `computed`, et émet la section choisie ; le builder fait défiler jusqu'à l'ancre `section-<id>` de la carte et donne le focus au champ du titre. Sans aucune dépendance, pas de graphe : un modèle à plat donnerait une colonne de nœuds empilés sans information, et la phrase d'aide est plus utile.

*Alternative écartée* : afficher l'icône de la section sur tous les nœuds, comme le runner. Cohérent d'un écran à l'autre, mais l'aperçu sert à lire la structure (où commence et où finit le chemin, où se rejoignent les branches), ce que les icônes de rôle disent d'un coup d'œil ; l'icône de la section reste visible sur la carte de la section (D6) et sur les étapes intermédiaires.

### D5. Bandeau de validation calculé sur le modèle en cours

`summarizeFlow(t)` :
- `hasFlow` : au moins une section a un `dependsOn` non vide ;
- `starts` : sections sans dépendance connue ; `ends` : sections dont aucune ne dépend ;
- `emptySections` : sections sans item (avertissement, comme le refus à l'enregistrement) ;
- `errors` : les problèmes de `validateFlow` de codes `self-dependency`, `unknown-dependency`, `cycle` et `duplicate-section-id`, avec leurs messages existants.

Affichage dans `flow-preview`, `role="status"`, seulement si `hasFlow` : les erreurs (couleur anomalie) ; sinon « n départ(s), m fin(s), pas de boucle » (couleur succès) ; puis l'avertissement des étapes sans contrôle (couleur alerte). Le bandeau informe, il ne bloque pas : `validateTemplateIntegrity` reste le seul verrou, à l'enregistrement.

### D6. Réglages d'enchaînement d'une section : composant `section-flow-settings`

Composant présentationnel placé sous l'en-tête de chaque carte de section (mode édition seulement), avec `section`, `chips`, `hasDependents` en entrée et des `output` (`toggleDependency`, `gateChange`, `joinModeChange`). Le builder appelle les helpers de D2.
- **Puces « Après : »** : `<button aria-pressed>` ; une puce désactivée garde `disabled` et l'explication « Créerait une boucle » en `title` et en texte masqué associé, pour les lecteurs d'écran.
- **Porte** : groupe de deux boutons radio « Stricte » / « Souple », affiché si `hasDependents`.
- **Jonction** : groupe « Toutes les étapes précédentes » / « Au moins une », affiché si la section a au moins deux dépendances.

La porte d'une section qui perd ses dépendantes est conservée sans être affichée : la retirer surprendrait le concepteur qui ré-ajoute la dépendance juste après, et une porte sans dépendante n'a aucun effet.

### D7. Palette d'icônes : composant `step-icon-picker`, panneau dépliant

Bouton dans l'en-tête de la carte de section (icône courante résolue, `aria-expanded`, nom « Icône de l'étape : <libellé> »), qui déplie sous l'en-tête une grille de boutons d'icônes (`aria-pressed` sur l'icône courante). Choisir une icône écrit son nom et referme ; Échap referme sans rien changer ; le focus revient au bouton dans les deux cas.

`src/app/domain/step-icons.ts` reçoit `STEP_ICON_LABELS: Record<StepIconName, string>` (libellés français, par exemple `flask-conical` → « Fiole », `goal` → « Arrivée »), testé pour couvrir toute la liste. Aucun nouvel enregistrement d'icône : `provideStepIcons()` couvre déjà la liste fermée (ADR 0010, point 4).

*Alternatives écartées* : une fenêtre modale (piégeage du focus et fermeture à gérer pour un choix d'un clic) ; un `<select>` (une liste de noms n'aide pas à choisir une icône) ; un menu flottant positionné (gestion de débordement et de focus plus coûteuse qu'un panneau dans le flux).

### D8. Politique de clôture et nouvelle section

- Groupe de deux boutons radio dans les informations générales : « Seuls les bloquants » / « Une réponse partout ». Valeur affichée : `completionPolicy ?? 'all'`. Le modèle par défaut d'un nouveau modèle (`ngOnInit`) porte `completionPolicy: 'blocking'`, dans l'instantané initial, donc sans être signalé comme modifié.
- `addSection()` écrit `dependsOn: newSectionDependencies(t)` quand il n'est pas `undefined`. « Précédente » = dernière section de la liste, comme la maquette ; l'ordre d'affichage étant libre, c'est la règle la plus prévisible.
- Les nouvelles sections gardent `items: []` et `icon: ''` (comportement actuel) : le bandeau signale l'étape vide.

### D9. Ordre d'affichage

Le glisser-déposer et ↑/↓ réordonnent `sections` sans toucher aux dépendances (déjà vrai). Le graphe, lui, ne dépend que des colonnes ; seul l'écart vertical entre deux étapes de même hauteur idéale suit l'ordre de la liste (`order`).

## Risks / Trade-offs

- **[Conversion des liaisons `[(ngModel)]` : régressions discrètes]** → une tâche par zone du formulaire, et un test de composant qui vérifie, pour un champ de chaque zone, que `isDirty` passe à vrai et que la valeur arrive dans le modèle enregistré.
- **[Recalcul de l'aperçu à chaque frappe]** → `layoutStepGraph` ne repart que si la structure (libellés compris) change (`sameStructure`), pour une dizaine d'étapes : coût négligeable. Pas de temporisation.
- **[Puces trop nombreuses au-delà de 8 sections]** → les puces passent à la ligne ; au-delà d'une dizaine d'étapes, la réponse prévue reste la carte en régions (BACKLOG), pas un sélecteur plus complexe.
- **[Aperçu hors de vue pendant l'édition d'une section basse]** → le clic sur un nœud ramène à la section, et le bandeau reste en haut ; un aperçu fixé est laissé en question ouverte.
- **[Icône de rôle différente de l'icône du runner]** → documenté (D4) ; l'icône choisie reste visible sur la carte de section et dans le runner.
- **[Tests de composant qui dessinent le graphe]** → `provideStepIcons()` dans les `providers` du `TestBed` du builder, comme pour le runner ; `ResizeObserver` absent de jsdom est déjà toléré par le graphe.

## Migration Plan

Aucune migration : aucun champ nouveau, aucune version de base ni de fichier d'échange. Un modèle existant ouvert puis enregistré sans modification de l'enchaînement garde exactement ses valeurs (`icon` Heroicons, absence de `completionPolicy`, de `gate`, de `joinMode`). Retour arrière : revenir au commit précédent suffit, les modèles enregistrés restant lisibles par l'ancienne version (champs déjà connus depuis `step-flow-model`).

## Open Questions

- **Aperçu fixé en haut de l'écran** pendant le défilement de la liste : utile pour voir l'effet d'une puce sur une section basse, mais coûteux en hauteur sur un portable. À reconsidérer après usage, éventuellement avec un bouton pour replier l'aperçu.
- **Bouton « Enchaîner les étapes dans l'ordre »** pour donner d'un coup des dépendances linéaires à un modèle à plat (comme l'audit de livraison) : hors périmètre, à ajouter au BACKLOG si le besoin se confirme.
- Aucun ADR en vigueur n'est à revoir.

## Écarts constatés pendant l'implémentation

- **Défaut confirmé avant correction** : le test écrit en premier (tâche 1.1) échouait. Une frappe dans le libellé d'un contrôle laissait `isDirty()` à faux, et la garde laissait quitter le builder sans confirmation. Après le passage aux mises à jour immuables, ce test et un test par zone du formulaire passent ; la garde a été vérifiée dans le navigateur.
- **Helpers** : `insertItemAt` remplace l'`insertItemCopy` prévu. Il sert à la duplication et à l'annulation d'une suppression. Les champs de contexte se modifient par leur index (`updateContextField`) : deux champs créés dans la même milliseconde peuvent partager un identifiant. Le composant expose des méthodes `patchTemplate`, `patchSection`, `patchItem`, `patchChoice`, `patchExtraField` et `patchContextField`, appelées par les `(ngModelChange)`.
- **Glisser-déposer** : `onItemDrop` retrouve la section source par l'identité de `previousContainer.data`. Les listes CDK sont liées aux tableaux du modèle courant.
- **Graphe** : quand des nœuds portent une légende, le placement réserve 16 px de plus sous les nœuds (`labelSpace`) et écarte de 12 px de plus deux nœuds d'une même colonne (`rowGap`). Un test vérifie que la légende ne touche pas le nœud du dessous.
- **Budget CSS du builder (12 ko)** : il était dépassé de 337 octets. Pour rester dessous :
  - les choix de politique de clôture réutilisent la classe existante `.checkbox-label` ;
  - le défilement vers une section centre la carte (`block: 'center'`) au lieu d'ajouter un `scroll-margin-top` ;
  - deux règles inutilisées ont été retirées : `.font-mono` et `.badge-locked-id`, sans aucune référence dans le code.
- **Suppression d'une section** : `removeSectionFromDependencies` (existant) laisse `dependsOn: []` au lieu de retirer la propriété. Les deux formes sont équivalentes pour les règles et pour `diffTemplates`, ce qu'un test vérifie.
- **Vérification dans le navigateur** :
  - **Vérifié** : aperçu du modèle d'exemple dans les deux thèmes, puces (dont celle grisée par une boucle), porte et jonction, palette (souris, Échap, retour du focus), bandeau avec étapes vides, garde après la seule modification d'un libellé, audit de livraison (icônes converties, « Une réponse partout », départ sans confirmation), largeur mobile (aperçu qui défile, page sans débordement) ;
  - **Bout-à-bout réduit** : un modèle à deux sections construit, enregistré et lancé s'ouvre dans le runner en vue Chemin, seconde étape verrouillée ;
  - **Couvert par les tests seulement** : la recréation complète des six sections de « Mise en production » (test 7.1, par les helpers) et le bandeau d'un modèle importé avec une dépendance inconnue (test du composant `flow-preview`).
- **Constaté hors périmètre** : sur un écran étroit, la ligne d'un contrôle du builder (libellé, pastille, type, boutons) déborde de sa carte. C'est antérieur à ce change.
