## 1. Mises à jour immuables du builder (design D1)

- [x] 1.1 Écrire d'abord, dans `template-builder.component.spec.ts`, un test rouge qui modifie seulement le libellé d'un contrôle existant par son champ et vérifie que `isDirty()` passe à vrai, puis qu'il repasse à faux quand la valeur d'origine est rétablie
- [x] 1.2 Ajouter à `template-builder.helpers.ts` les helpers immuables : `updateTemplate`, `updateSection(t, sectionId, change)`, `updateItem` (rendu public), `updateContextField(t, index, change)`, `addItem`, `insertItemAt`, `removeItemAt`, `moveItemWithin`, `moveItemBetween` (sur `reorderArray` et `transferItemBetweenLists`), et les tester (seul le chemin modifié est recréé, les autres références sont conservées) ; la duplication et l'annulation d'une suppression passent par `insertItemAt`
- [x] 1.3 Convertir les informations générales et le schéma de contexte : `[(ngModel)]` → `[ngModel]` + `(ngModelChange)`, type, options, libellés d'options, valeurs par défaut, sans écriture en place
- [x] 1.4 Convertir les sections (titre) et les items : libellé, aide, type, horodatage, choix (libellé, ton, anomalie, ajout, retrait), champ additionnel, condition d'affichage, ajout, duplication, suppression avec annulation, ↑/↓ et `onItemDrop` (sans `transferArrayItem` ni `moveItemInArray` sur les tableaux du signal)
- [x] 1.5 Faire construire par `save()` une copie portant `updatedAt` au lieu d'écrire dans l'objet du signal, et vérifier par `rg "\.push\(|\.splice\(|delete " src/app/pages/template-builder/template-builder.component.ts` qu'il ne reste aucune mutation en place
- [x] 1.6 Faire passer le test 1.1 et ajouter un test par zone (contexte, choix d'un item, option avancée, titre de section) : la modification rend `isDirty()` vrai et arrive dans le modèle enregistré

## 2. Règles d'édition de l'enchaînement (`flow-editor.helpers.ts`, design D2, D4, D5)

- [x] 2.1 Créer `src/app/pages/template-builder/flow-editor.helpers.ts` avec `toggleDependency` (anti-boucle par `wouldCreateCycle`, `dependsOn` retiré quand il est vide, `joinMode` retiré sous deux dépendances), `setSectionGate`, `setSectionJoinMode`, `setSectionIcon` et `setCompletionPolicy` (valeurs écrites explicitement)
- [x] 2.2 Ajouter `newSectionDependencies(t)`, `dependencyChips(t, sectionId)` (ordre de la liste, « Sans titre », `selected`, `disabled`) et `sectionsWithDependents(t)`
- [x] 2.3 Ajouter `summarizeFlow(t)` (`hasFlow`, `starts`, `ends`, `emptySections`, `errors` filtrées de `validateFlow` : `self-dependency`, `unknown-dependency`, `cycle`, `duplicate-section-id`)
- [x] 2.4 Ajouter `toPreviewNodes(t)` : ordre topologique (sections d'une boucle en fin), colonnes, dépendances connues seulement, icône de rôle (`flag`, `git-merge`, `goal`, sinon `resolveStepIcon`), légende « n items · m bloq. », nom accessible (rôle, nombre d'items et de bloquants), « Sans titre », champs de progression neutres
- [x] 2.5 Écrire `flow-editor.helpers.spec.ts` : ajout et retrait d'une dépendance, puce et ajout refusés pour une boucle directe et indirecte, puce active toujours désactivable, `dependsOn` et `joinMode` retirés, porte conservée sans dépendante, dépendances d'une nouvelle section (avec et sans dépendances), suppression d'une section référencée (`removeSectionFromDependencies` puis restauration), bandeau (modèle d'exemple : 1 départ, 1 fin ; étape vide ; dépendance inconnue ; boucle importée), nœuds de l'aperçu du modèle d'exemple (icônes de rôle, `hammer` pour « Build », légende « 3 items · 2 bloq. » pour « Préparation »)

## 3. Graphe : variante « structure », légende et nom accessible (design D3)

- [x] 3.1 Ajouter à `StepGraphNode` les champs facultatifs `caption` et `ariaLabel`, et à `StepGraphComponent` l'`input` `variant: 'progress' | 'structure'` (défaut `'progress'`)
- [x] 3.2 Dans la variante « structure » : disque bordé et `node.icon` seuls (ni anneau, ni cadenas, ni coche, ni badge de jonction), liens pleins en `--graph-link-structure` ; légende raccourcie par `truncateLabel` sous le libellé ; `labelSpace` augmenté d'une ligne quand un nœud a une légende ; `ariaLabel` fourni prioritaire sur le nom calculé
- [x] 3.3 Ajouter `--graph-link-structure` (et, si besoin, `--graph-caption`) dans `src/styles.css`, thème clair et `[data-theme="dark"]`
- [x] 3.4 Compléter `step-graph.component.spec.ts` : variante par défaut inchangée (états du runner), variante « structure » (aucun anneau, cadenas, coche ni badge ; liens pleins), légende affichée sans chevauchement de la rangée suivante, nom accessible fourni annoncé, sélection au clavier dans les deux variantes

## 4. Icônes d'étape : libellés et palette (design D7)

- [x] 4.1 Ajouter `STEP_ICON_LABELS: Record<StepIconName, string>` (libellés français) dans `src/app/domain/step-icons.ts` et tester qu'il couvre toute la liste fermée sans libellé vide ni en double
- [x] 4.2 Créer le composant `src/app/components/step-icon-picker/` (trois fichiers) : bouton (icône résolue, `aria-expanded`, nom « Icône de l'étape : <libellé> »), panneau dépliant en grille de boutons nommés (`aria-pressed` sur l'icône courante), `output` du nom choisi, fermeture par choix ou Échap avec retour du focus sur le bouton, entièrement en Lucide
- [x] 4.3 Tester le composant : icône résolue pour un ancien nom Heroicons et pour un nom inconnu, choix émis et panneau refermé, Échap sans émission, focus rendu au bouton

## 5. Aperçu et réglages d'enchaînement d'une section (design D4 à D6)

- [x] 5.1 Créer le composant `src/app/components/flow-preview/` : `input` du modèle, nœuds en `computed` (`toPreviewNodes`), `app-step-graph` en variante « structure », bandeau `role="status"` (`summarizeFlow` : erreurs, sinon « n départ(s), m fin(s), pas de boucle », puis étapes sans contrôle), phrase d'aide quand le modèle n'a aucune dépendance, `output` de la section choisie
- [x] 5.2 Créer le composant `src/app/components/section-flow-settings/` : puces « Après : » (`aria-pressed`, puce désactivée avec « Créerait une boucle » en `title` et en texte pour lecteurs d'écran), mention « étape de départ », porte (radios « Stricte » / « Souple ») si la section a des dépendantes, jonction (radios « Toutes les étapes précédentes » / « Au moins une ») à partir de deux dépendances ; `output` pour chaque réglage
- [x] 5.3 Tester les deux composants : bandeau dans ses trois états, phrase d'aide sans dépendance, sélection d'un nœud émise ; puces actives, désactivées et expliquées, choix de porte et de jonction affichés seulement quand ils s'appliquent, événements émis
- [x] 5.4 Ajouter les variables de couleur des puces, du bandeau et de la palette dans `src/styles.css` (thèmes clair et sombre), sans couleur en dur dans les composants

## 6. Intégration dans le builder (design D4, D6 à D9)

- [x] 6.1 Ajouter le choix de la politique de clôture dans les informations générales (`completionPolicy ?? 'all'` affiché, `setCompletionPolicy` au changement) et créer le nouveau modèle par défaut avec `completionPolicy: 'blocking'` dans l'instantané initial
- [x] 6.2 Insérer `app-flow-preview` au-dessus de la liste des sections (hors mode Aperçu) ; à la sélection d'un nœud, faire défiler jusqu'à l'ancre `section-<id>` de la carte et donner le focus au champ du titre
- [x] 6.3 Insérer `app-step-icon-picker` dans l'en-tête de chaque carte de section et `app-section-flow-settings` sous cet en-tête, branchés sur les helpers de `flow-editor.helpers.ts` par `template.update()`
- [x] 6.4 Faire écrire par `addSection()` les dépendances de `newSectionDependencies` ; vérifier que la duplication, la suppression avec annulation et le réordonnancement (glisser-déposer et ↑/↓) conservent les dépendances comme spécifié
- [x] 6.5 Ajouter `provideStepIcons()` aux `providers` du `TestBed` du builder et compléter `template-builder.component.spec.ts` : nouveau modèle en « Seuls les bloquants » sans être signalé modifié, modèle existant sans politique enregistré sans `completionPolicy`, nouvelle section dépendante de la dernière, puce de boucle désactivée, aperçu mis à jour après renommage d'une section, icône Heroicons conservée sans choix dans la palette

## 7. Recréation du modèle d'exemple et vérifications

- [x] 7.1 Écrire un test qui reconstruit « Mise en production » uniquement par les helpers du builder (sections, icônes, dépendances, porte souple de « Documentation », criticités, preuves exigées, contexte, politique) et vérifie l'équivalence avec `release-flow.json` aux identifiants près et aux criticités « optionnel » explicites près : mêmes colonnes (`computeColumns`), mêmes jonctions, aucune erreur de `validateFlow`
- [x] 7.2 Vérifier que `diffTemplates` signale bien, pour un modèle modifié dans le builder, les changements de dépendances, de porte, de jonction, de criticité et de politique, et qu'un changement d'icône seul n'est pas signalé (comportement existant, test à ajouter s'il manque)
- [x] 7.3 Lancer `pnpm build` (sans erreur ni alerte de budget) et `pnpm ng test --watch=false` (suite complète au vert)
- [x] 7.4 Vérifier dans le navigateur (`pnpm start`) : recréer « Mise en production » depuis un nouveau modèle, puis l'exécuter dans le runner (branches, jonction, porte souple) ; puce de boucle grisée ; bandeau sur un modèle importé avec une dépendance inconnue ; palette au clavier ; garde de navigation après une seule modification de libellé ; audit de livraison ouvert et enregistré sans changement de ses icônes ni de sa politique ; thèmes clair et sombre ; largeur mobile (défilement horizontal de l'aperçu)
- [x] 7.5 Consigner dans `design.md` les écarts éventuels constatés pendant l'implémentation
