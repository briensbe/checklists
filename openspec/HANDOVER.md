# Notes de passation : améliorations restantes

État au 17/10/2026. Feuille de route validée en cadrage (grilling) le 14/10/2026 : cinq changes OpenSpec, à livrer dans l'ordre. Complétée le 17/10/2026 par l'intégration de la vision UX de [checklist-ux.md](../docs/design/checklist-ux.md) (changes 6 à 9) : lire d'abord sa section « Écarts retenus », qui consigne les décisions prises.

| # | Change | État |
|---|--------|------|
| 1 | `session-integrity` | Livré, archivé (`openspec/changes/archive/2026-10-14-session-integrity/`), PR #1 fusionnée |
| 2 | `session-exchange` | Livré, archivé (`openspec/changes/archive/2026-10-14-session-exchange/`), fusionné |
| 3 | `ui-dialogs-and-undo` | Livré, archivé (`openspec/changes/archive/2026-10-16-ui-dialogs-and-undo/`), fusionné sur `main` |
| 4 | `template-builder-v2` | Livré, archivé (`openspec/changes/archive/2026-10-16-template-builder-v2/`) |
| 5 | `dashboard-productivity` | **À faire** : section 3, indépendant des suivants. Son volet runner est passé dans `quick-check-and-drawer` |
| 6 | `step-flow-model` | Livré, archivé (`openspec/changes/archive/2026-10-17-step-flow-model/`) |
| 7 | `quick-check-and-drawer` | Livré, archivé (`openspec/changes/archive/2026-10-17-quick-check-and-drawer/`) |
| 8 | `runner-path-view` | Livré, archivé (`openspec/changes/archive/2026-10-17-runner-path-view/`) |
| 9 | `builder-flow-editor` | Livré, archivé (`openspec/changes/archive/2026-10-17-builder-flow-editor/`) |
| — | Backlog | Reporté, voir [BACKLOG.md](BACKLOG.md) |

Chaque section ci-dessous se suffit à elle-même : on peut la donner telle quelle à `/opsx:propose <nom-du-change>` dans une session neuve.

## Contexte commun à toutes les sections

- **Application** : Angular 22 (composants standalone, signals, `@if/@for`), sans backend. Données dans IndexedDB via Dexie 4 (ADR 0001). Un seul utilisateur, sur poste de bureau. Partage par fichiers JSON (ADR 0004).
- **Règles du dépôt** ([.agents/AGENTS.md](../.agents/AGENTS.md)) :
  - `pnpm` uniquement ;
  - trois fichiers par composant (`.html`, `.css`, `.ts`) ;
  - aucun `any` ;
  - artefacts OpenSpec et documentation en français ;
  - chemins relatifs dans le Markdown.
- **Architecture à respecter** :
  - chaque session embarque une copie figée de son modèle (`templateSnapshot`, ADR 0003) ;
  - toute modification d'une session passe par `ChecklistSessionService.mutate()`, qui protège les sessions terminées (lecture seule) et différe l'écriture des saisies texte de 400 ms ;
  - les règles métier sont des fonctions pures dans `src/app/domain/` (`session-rules.ts`, `session-exchange.ts`, `report.ts`) ; la normalisation des formats et les migrations sont dans `src/app/data/`.
- **Vérification** : `pnpm build` et `pnpm ng test --watch=false` (Vitest ; `fake-indexeddb` sert pour les tests Dexie). Le serveur de dev se lance avec `pnpm start` (port 4200).

---

## 1. `ui-dialogs-and-undo` : dialogues maison, toasts, annulation, accessibilité

**Livré et archivé** (`openspec/changes/archive/2026-10-16-ui-dialogs-and-undo/`). Section conservée pour mémoire.

### Objectif

Remplacer toutes les fenêtres natives du navigateur (`alert`, `confirm`, `prompt`). Elles ne suivent pas le thème sombre, bloquent la page et s'affichent différemment selon le navigateur. Il s'agit aussi de pouvoir annuler les actions destructives, et de poser un socle d'accessibilité.

### Décisions validées

- **Dialogues** : un `DialogService` maison, sans librairie.
  - `confirm()` renvoie une `Promise<boolean>`, ce qui permet d'écrire `if (await dialog.confirm(...))`.
  - Le service propose aussi un dialogue à **choix multiples**, nécessaire pour les conflits d'import « Remplacer / Importer comme copie / Annuler ».
  - Partir de la modale JSON (`components/json-draft-modal`), qui gère déjà `role="dialog"`, `aria-modal` et la touche Échap.
  - Ajouter le **piégeage du focus** : le focus reste dans la modale tant qu'elle est ouverte et revient sur l'élément d'origine à la fermeture.
- **Toasts** : de petites notifications temporaires dans un coin de l'écran, empilables, avec un bouton d'action optionnel. Elles remplacent les `alert()` d'information et d'erreur.
- **Annulation par toast pendant 6 secondes** pour :
  - la suppression d'une session (dashboard) ;
  - la suppression d'une preuve ;
  - la suppression d'un item ou d'une section dans le builder ;
  - « Passer le reste à OK ».
- **Confirmation préalable** (pas d'annulation possible) réservée à :
  - la réinitialisation d'une session ;
  - la suppression d'un modèle ;
  - la réouverture d'une session terminée, déjà soumise à confirmation.
- Le `prompt()` de lancement depuis la page Modèles est remplacé par la modale « Nouvelle checklist » du dashboard, avec le modèle présélectionné. Par exemple : navigation vers `/checklists?new=<templateId>`, qui ouvre la modale.
- **Socle d'accessibilité**, sans audit WCAG formel :
  - tout utilisable au clavier ;
  - en-têtes de section transformés en `<button aria-expanded>` ;
  - un `aria-label` sur chaque bouton qui n'a qu'une icône ;
  - un focus visible ;
  - le contraste vérifié dans les deux thèmes.

### Inventaire des fenêtres natives à remplacer

| Fichier | Usage | Cible |
|---|---|---|
| `src/app/services/import-conflict.ts` | Deux `confirm()` enchaînés pour simuler trois choix | Dialogue à 3 choix |
| `src/app/pages/checklists-dashboard/checklists-dashboard.component.ts` | `confirm` avant de supprimer une session | Toast avec annulation |
| `src/app/pages/checklist-runner/checklist-runner.component.ts` | `confirm` réinitialisation et réouverture ; `alert` erreurs de preuve et d'export | Dialogue ; toasts d'erreur |
| `src/app/components/evidence-attachment/evidence-attachment.component.ts` | `alert` fichiers de plus de 50 Mo refusés | Toast |
| `src/app/pages/template-builder/template-builder.component.ts` | `confirm` suppression de section ; `alert` validations | Toast avec annulation ; erreurs affichées sur le formulaire ou en toast |
| `src/app/pages/templates-list/templates-list.component.ts` | `prompt` titre au lancement ; `confirm` suppression de modèle | Modale « Nouvelle checklist » ; dialogue |

Pour retrouver toutes les occurrences : `rg "\b(confirm|alert|prompt)\(" src/app -g "*.ts"`.

### Points délicats

- **Annuler, c'est différer la suppression réelle.** On retire tout de suite l'élément de l'affichage (le signal), mais on ne supprime en base qu'à l'expiration du toast.
  - Si l'utilisateur quitte la page entre-temps, il faut **exécuter** les suppressions en attente, et non les perdre. C'est le même principe que `flushPendingSave()` : on vide la file sur `ngOnDestroy` et sur `visibilitychange`.
  - Pour une session, la suppression couvre aussi ses preuves : il faut garder la transaction Dexie existante de `deleteSession`.
- **« Passer le reste à OK » est une action en masse.** Pour pouvoir l'annuler, il faut mémoriser `answers` avant l'action (un snapshot), puis le restaurer via `mutate()`. Ne pas contourner `mutate()`, sinon la garde « lecture seule » saute.
- **Supprimer une preuve exige de l'annuler avant d'écrire.** `EvidenceService.deleteEvidence` supprime immédiatement en base. Il faut soit retarder l'appel, soit garder le `Blob` en mémoire pour pouvoir le réinsérer.
- Les dialogues doivent rester utilisables dans les tests Vitest. Prévoir un `DialogService` facile à remplacer par un faux (méthodes simples renvoyant des `Promise`).

### Critères de fin

- `rg "\b(confirm|alert|prompt)\(" src/app -g "*.ts"` ne renvoie plus rien, en dehors des tests.
- Chaque action destructive listée plus haut est annulable pendant 6 secondes, ou demande confirmation, conformément à la répartition décidée.
- Tous les dialogues piègent le focus et se ferment avec Échap.
- Les en-têtes de section s'utilisent au clavier.
- Tests : `DialogService` et toasts, annulation de « Passer le reste à OK » (restauration exacte des réponses), suppression différée avec exécution à la sortie de page.

---

## 2. `template-builder-v2` : interface complète du constructeur de modèles

**Livré et archivé** (`openspec/changes/archive/2026-10-16-template-builder-v2/`). Section conservée pour mémoire.

### Objectif

Rendre configurables depuis l'interface tous les réglages qui existent déjà dans le modèle de données. Aujourd'hui, il faut les écrire à la main dans le JSON.

### Décisions validées

- **Éditeur du `contextSchema`** : champs de type texte, date ou liste. Pour chacun : libellé, obligatoire ou non, valeur par défaut, texte d'exemple (`placeholder`), et les options pour une liste.
- **Par item**, dans un panneau repliable « Options avancées » :
  - `requireNaReason` ;
  - `extraField` (identifiant, libellé, texte d'exemple) ;
  - la condition d'affichage `visibleIf`, à construire ainsi : choisir un champ de contexte, puis cocher une ou plusieurs de ses valeurs (pour un champ liste) ou les saisir (pour un champ texte).
- **Dupliquer** un item ou une section.
- **Réordonner par glisser-déposer** avec `@angular/cdk/drag-drop`, y compris pour déplacer un item d'une section à une autre. Les boutons ↑/↓ restent disponibles pour le clavier. C'est **la seule nouvelle dépendance** : `pnpm add @angular/cdk`, dans la même version majeure qu'Angular.
- **Garde « modifications non enregistrées »** : un `CanDeactivate` sur les routes `templates/builder` et `templates/:id/edit`, plus l'événement `beforeunload` pour la fermeture de l'onglet.
- **Pas de changement de format de données** : `visibleIf`, `tone`, `updatedAt` existent déjà depuis la migration Dexie v3. Donc pas de version de base v4.

### État actuel du code

- `src/app/pages/template-builder/` :
  - formulaire nom, version et description ;
  - sections avec ↑/↓ et suppression ;
  - items avec libellé, type, aide et horodatage ;
  - choix avec libellé, ton (palette de 5 tons) et option « bloquant » ;
  - un mode Aperçu.
- **Aucune interface** pour `contextSchema`, `requireNaReason`, `extraField` ou `visibleIf`. Ces champs sont seulement conservés tels quels à l'édition (vérifié au change 1).
- Les items ne peuvent pas être réordonnés.
- La suppression d'un item ou d'un choix ne demande aucune confirmation.
- Les `alert()` de validation sont traités par le change 1.

### Points délicats

- **Le builder modifie directement des objets à l'intérieur du signal.** Par exemple `section.items.push(...)` ou `item.customChoices.splice(...)`, avec `[(ngModel)]` sur les champs imbriqués. Ça fonctionne aujourd'hui uniquement parce que le template est redessiné à chaque événement.
  - Il vaut mieux passer à des mises à jour immuables, `template.update(t => ...)` avec copie des tableaux modifiés.
  - Sans cela, la détection des modifications non enregistrées et l'annulation sont peu fiables.
  - Pour la garde : comparer un instantané pris au chargement (`structuredClone`) à l'état courant.
- **Supprimer ou renommer un champ de contexte** peut casser les `visibleIf` qui le référencent.
  - Il faut signaler les items concernés avant la suppression.
  - Il faut aussi empêcher de changer l'identifiant d'un champ déjà utilisé, ou propager le changement.
- **Les identifiants sont générés avec `Date.now()`** (`item-${Date.now()}-…`, `opt-1`). Une duplication rapide peut créer des doublons.
  - Utiliser `crypto.randomUUID()` pour les éléments dupliqués.
  - Vérifier l'unicité des `id` d'items **dans tout le modèle** avant d'enregistrer : `session-rules.ts` et la conservation des réponses à la mise à jour d'un modèle reposent sur l'unicité des `id`.
- **Changer l'`id` d'un item existant** fait perdre ses réponses lors de « Appliquer la mise à jour » sur les sessions en cours (`rebaseSessionOnTemplate`). L'`id` doit donc rester non modifiable dans l'interface.
- **Le glisser-déposer entre sections** demande des listes CDK connectées (`cdkDropListConnectedTo`) et `transferArrayItem` sur des copies des tableaux.

### Critères de fin

- Un modèle complet, comparable à `src/assets/templates/delivery-audit.json` (contexte avec liste, items conditionnels, motif N/A obligatoire, champ additionnel), se crée sans écrire de JSON.
- Les items se réordonnent par glisser-déposer et au clavier, y compris d'une section à l'autre.
- Quitter le builder avec des modifications non enregistrées demande confirmation, que ce soit par navigation interne ou en fermant l'onglet.
- Les `id` en double sont refusés à l'enregistrement.
- Tests :
  - helpers purs du builder (duplication, déplacement, unicité des `id`, détection des `visibleIf` orphelins) ;
  - garde `CanDeactivate`.

---

## 3. `dashboard-productivity` : productivité du tableau de bord

**Indépendant des autres changes à faire.** Ce change s'appelait `runner-and-dashboard-productivity` ; son volet runner (raccourcis clavier, « Prochain item à traiter », résumé fixé en haut) est passé dans `quick-check-and-drawer` (section 5), pour être conçu avec la nouvelle ligne d'item.

### Objectif

Accélérer les audits répétés : retrouver une session et refaire un audit.

### Décisions validées

- **Dashboard** :
  - recherche par titre ;
  - filtre par modèle, à combiner avec le filtre par statut qui existe déjà ;
  - tri par date de modification ou par progression.
- **« Dupliquer / Refaire l'audit »** :
  - crée une nouvelle session à partir d'une session existante ;
  - reprend le contexte en vidant les champs date (qui reprennent la date du jour) ;
  - laisse choisir de reprendre ou non les réponses.

### État actuel du code

- `src/app/pages/checklists-dashboard/` :
  - filtre par statut (`statusFilter`, `filteredSessions`) et progression via `computeMetrics` ;
  - import d'une session et modale « Nouvelle checklist » ;
  - **ni recherche, ni tri, ni duplication**.
- `ChecklistSessionService.createSession()` construit une session à partir d'un modèle de la bibliothèque. La duplication doit partir de la **copie figée de la session source**, pas de la bibliothèque : le modèle d'origine a pu être modifié ou supprimé entre-temps.

### Points délicats

- **Dupliquer** :
  - nouvel UUID et `status: 'in_progress'` ;
  - `closures: []` ;
  - `templateSnapshot` copié avec `structuredClone` ;
  - **ne pas copier les preuves** par défaut (elles sont lourdes ; à confirmer si besoin).
  - Les champs de type `date` reprennent la date du jour via `defaultContextValues`.
- **Le tri par progression** appelle `computeMetrics` pour chaque carte. C'est acceptable pour quelques dizaines de sessions, mais mieux vaut le calculer une seule fois dans un `computed()` plutôt que dans le template HTML.

### Critères de fin

- Sur le dashboard, rechercher, filtrer (statut et modèle) et trier se combinent.
- « Refaire l'audit » crée une session en cours, pré-remplie selon le choix fait, et ouvre le runner.
- Tests : helpers purs (filtre et tri des sessions, duplication d'une session).

---

## 4. `step-flow-model` : modèle et règles des étapes

**Livré et archivé** (`openspec/changes/archive/2026-10-17-step-flow-model/`). Premier change de l'intégration UX, prérequis des sections 5 à 7. Lire d'abord les « Écarts retenus » de [checklist-ux.md](../docs/design/checklist-ux.md).

### Objectif

Poser les données et les règles de calcul des étapes, des portes et des jonctions, sans nouvel écran. Une section devient une étape d'un graphe orienté sans cycle ; un modèle sans dépendance garde exactement le comportement actuel.

### Décisions validées

- **Uniquement des champs optionnels**, donc ni migration Dexie ni nouvelle version du fichier d'échange (ADR 0004) :
  - section : `dependsOn` (id d'autres sections), `joinMode` (`all` par défaut, ou `any`), `gate` (`hard` par défaut, ou `soft`) ;
  - item : `criticality` (`blocking`, `important` ou `optional` ; absent = `optional`), `evidenceRequired` (`comment`, `photo`, `link` ou `file`), `evidenceHint` (consigne affichée au moment de la preuve) ;
  - réponse : `evidencePending` (fait, preuve à compléter) et `history` (événements datés : coché, décoché, OK, KO, N/A, preuve ajoutée ou retirée, porte forcée) ;
  - session : les portes souples forcées, avec leur justification et leur date ;
  - modèle : une politique de clôture, par exemple `completionPolicy: 'all' | 'blocking'`.
- **Règle « absent = ancien comportement »** : un item sans `controlType` reste un « statut », un modèle sans politique de clôture exige une réponse partout. Ce sont le builder et les nouveaux modèles qui écrivent explicitement les nouvelles valeurs par défaut (case à cocher, clôture sur les seuls bloquants).
- **Résolu pour une porte** : OK, coché, choix sans anomalie (`isBlocking` à faux) ou N/A. Un KO n'est pas résolu.
- **`requireNaReason` disparaît** : retiré du builder, de l'item, de la validation de clôture (`na-without-reason`) et de la comparaison de versions. Toléré mais ignoré dans les anciens fichiers.
- **Fonctions pures** dans un nouveau `src/app/domain/flow-rules.ts`, sur le modèle de `session-rules.ts` :
  - tri topologique et détection de cycle ; « ajouter cette dépendance créerait-il une boucle ? » ;
  - colonne de chaque étape (plus long chemin depuis un départ) ;
  - bloquants résolus d'une étape, calculés sur les items **applicables** ;
  - étapes débloquées (`joinMode`, portes souples forcées) et progression d'une jonction (n/m) ;
  - état visuel d'une étape : verrouillée, ouverte, franchie avec optionnels restants, terminée ;
  - étapes suivantes et « Laissés en route » (items non bloquants sans réponse ou avec preuve en attente, dans les étapes franchies).
- **Service** : `ChecklistSessionService` expose ces résultats en `computed`, et l'historique s'alimente dans `mutate()`.
- **Modèle d'exemple à branches** : la « Mise en production » de la maquette 03, livrée à côté de `delivery-audit.json`, pour tester `runner-path-view` avant `builder-flow-editor`.

### État actuel du code

- `src/app/models/checklist.model.ts` : sections sans ordre ni dépendance. Seul `isBlocking` existe, sur une option de choix, au sens « anomalie ».
- `normalizeTemplate` (`src/app/data/migrations.ts`) recopie déjà les champs qu'il ne connaît pas (`...rest`) : les nouveaux champs survivent aux imports, mais ne sont validés ni par `src/app/data/template-validation.ts` ni par `validateTemplateIntegrity` (builder).
- `validateForCompletion`, `diffTemplates` et `rebaseSessionOnTemplate` (`session-rules.ts`) ignorent criticité et dépendances.
- `TemplateService` ne charge que `assets/templates/delivery-audit.json` : il faut lui ajouter le modèle d'exemple.

### Points délicats

- **« Débloqué » ne se stocke jamais.** Seule exception : une porte souple forcée, parce que c'est une décision de l'utilisateur et non un état recalculable.
- **Reverrouillage** : décocher un bloquant d'une étape franchie reverrouille les étapes suivantes, sans effacer leurs réponses.
- **Applicabilité** : un bloquant masqué par `visibleIf` ne bloque pas ; une étape sans item applicable est franchie d'office.
- **N/A sans justification** : un N/A suffit à résoudre un bloquant. Il doit être tracé dans l'historique pour pouvoir être signalé par `runner-path-view`.
- **Historique** : uniquement sur les changements d'état, jamais à chaque frappe dans un commentaire.
- **Les id de sections deviennent des références** (`dependsOn`), comme les id d'items : ils doivent rester non modifiables, et supprimer une section doit la retirer des `dependsOn` des autres.
- **Comparaison de versions** : sans mise à jour de `diffTemplates`, la fenêtre « Modèle mis à jour » n'afficherait pas un changement de criticité ou de dépendance. À l'inverse, la ligne « Motif N/A obligatoire » doit disparaître, sinon une ancienne copie figée qui porte encore `requireNaReason` afficherait un faux changement.

### Critères de fin

- Les modèles existants s'exécutent à l'identique (aucun verrou, clôture inchangée), hormis le motif N/A devenu facultatif.
- Le modèle d'exemple est disponible dans la bibliothèque.
- Tests Vitest de `flow-rules.ts` : chemin linéaire, branches, jonction `all` et `any`, `visibleIf`, étape vide, KO sur un bloquant, porte souple forcée, cycle détecté. Tests de la clôture selon la politique et de la comparaison de versions avec les nouveaux champs.

---

## 5. `quick-check-and-drawer` : remplissage rapide

**Livré et archivé** (`openspec/changes/archive/2026-10-17-quick-check-and-drawer/`), ADR 0008 (Lucide) et 0009 (règles de saisie). Section conservée pour mémoire. Pour la suite (`runner-path-view`) : le `RunnerController` (`pages/checklist-runner/runner-controller.ts`) porte l'état d'interface et les actions de saisie, réutilisables par le panneau d'étape ; le composant `progress-ring` dessine les anneaux en SVG.

**Dépend de `step-flow-model`** (criticité, preuve obligatoire, historique). Reprend le volet runner de l'ancien `runner-and-dashboard-productivity`. Maquettes 01, 06 et 07.

### Objectif

Rendre le remplissage instantané et le retour visuel immédiat, dès les modèles existants, sans attendre le graphe.

### Décisions validées

- **Geste principal sur toute la ligne** :
  - case à cocher : coche ;
  - statut : OK ; KO via un bouton discret ou la touche K, qui ouvre le tiroir sur le commentaire (obligatoire pour un KO) ;
  - choix personnalisé : boutons conservés ; les choix `isBlocking` s'affichent « anomalie ».
- **Tiroir sous la ligne**, ouvert par le trombone (visible au survol, en permanence sur écran tactile) : note (le `comment` existant), preuves (coller, glisser-déposer, fichier, photo via `capture="environment"`), N/A sans justification. Il remplace la modale `evidence-attachment`, dont on reprend la logique (limite de 50 Mo).
- **Annulation de la suppression d'une preuve pendant 6 s** : exigée par la spec `evidence-attachment` mais jamais implémentée (la suppression est aujourd'hui immédiate, constaté pendant `step-flow-model`). À faire dans le tiroir selon l'ADR 0005, avec le **retrait de l'événement d'historique `evidence-removed`** (retrouvé par son `evidenceId`) quand l'utilisateur annule.
- **Compteurs** sur la ligne (note, preuves) et **suggestion douce** : le trombone s'allume environ 2 s après une coche sans pièce jointe.
- **Preuve obligatoire** (maquette 06) : demandée au geste principal, dans la ligne, avec la consigne `evidenceHint`. Item bloquant : impossible de valider sans preuve. Sinon : bouton « Plus tard », qui pose `evidencePending`.
- **Badges** « bloquant » et « important » uniquement.
- **Anneaux par section** dans le résumé (maquette 01), dessinés en SVG.
- **Raccourcis** : ↑/↓ (ou j/k) pour naviguer, Espace pour le geste principal, K pour KO, N pour N/A, A pour le tiroir, Entrée pour enregistrer une note, Échap pour annuler, ? pour l'aide.
- **Bouton « Prochain item à traiter »** et **résumé fixé en haut** pendant le défilement.
- **Builder** : sur chaque item, criticité qui change au clic (bloquant → important → optionnel), preuve obligatoire et sa consigne ; type « case à cocher » par défaut pour un nouvel item.
- **Icônes** : adoption de Lucide via le paquet officiel `@lucide/angular` (ADR du change ; l'ancien `lucide-angular` est déprécié). Les composants touchés passent à Lucide.

### État actuel du code

- `checklist-item` : boutons OK/KO/N/A, case native, trombone qui ouvre la modale de preuves, zone de commentaire.
- Chaque item porte une ancre `id="item-<itemId>"` avec `tabindex="-1"`. `onIssueClick()` (`checklist-runner.component.ts`) sait déplier une section, repasser le filtre à « Tous », faire défiler et donner le focus : c'est la mécanique de « Prochain item à traiter ».
- Le runner n'écoute aucun raccourci ; seules les modales gèrent Échap.
- Icônes : SVG Heroicons recopiés dans les templates HTML.

### Points délicats

- **Raccourcis à une lettre** : jamais pendant une saisie (`input`, `textarea`, `select`, `contenteditable`), ni quand une modale est ouverte.
- **Session terminée** (`isReadonly()`) : ni geste principal, ni KO, ni N/A ; la navigation et la consultation des preuves restent possibles.
- **Item actif** : un signal, calculé sur les items visibles (après filtre et repli des sections) ; naviguer vers un item replié déplie sa section.
- **Clic sur la ligne** : un clic dans le tiroir ou sur un bouton de la ligne ne doit pas déclencher le geste principal.
- **Accessibilité** : la ligne annonce son rôle et son état (`role="checkbox"` et `aria-checked` pour une case, état OK/KO/N/A pour un statut), et le trombone a un `aria-label`.
- **Thème sombre** : nouvelles couleurs uniquement via les variables de `styles.css`, vérifiées dans les deux thèmes (bascule `data-theme="dark"`).
- **Le résumé fixé** : `position: sticky`, en tenant compte du header de l'application, déjà en `sticky` (`header.component.css`).

### Critères de fin

- L'audit de livraison se remplit entièrement au clavier, sans modale.
- Un item bloquant à preuve obligatoire ne peut pas être validé sans preuve ; un item non bloquant peut passer en « preuve à compléter ».
- Tests : geste principal selon le type, raccourcis (ignorés dans un `input` ou en lecture seule), prochain item à traiter, preuve obligatoire.

---

## 6. `runner-path-view` : vue chemin dans le runner

**Livré et archivé** (`openspec/changes/archive/2026-10-17-runner-path-view/`), ADR 0010 (graphe d'étapes unique, vues pilotées par le `RunnerController`, portes appliquées à la saisie). Section conservée pour mémoire. Pour la suite (`builder-flow-editor`) : le composant `step-graph` est présentationnel (il reçoit des `StepGraphNode`, placés par `layoutStepGraph` dans `domain/step-graph-layout.ts`) ; la liste fermée d'icônes d'étape et la conversion des anciens noms sont dans `domain/step-icons.ts`, enregistrées par `provideStepIcons()`. Décisions prises pendant le change : pas de révocation d'une porte forcée, et confirmation (sans blocage) de la clôture quand une preuve exigée manque ; deux suites ont été ajoutées au [BACKLOG](BACKLOG.md).

**Dépend de `step-flow-model`**, à faire après `quick-check-and-drawer`. Maquettes 02 et 03.

### Objectif

Montrer la progression d'un modèle à dépendances comme un chemin : étapes, portes qui s'ouvrent, branches parallèles et jonctions.

### Décisions validées

- **Un seul composant de graphe**, réutilisé par `builder-flow-editor` puis pour les phases :
  - tout en SVG (nœuds, anneaux, liens et libellés dans le même `<svg>`), en pixels, largeur mesurée par `ResizeObserver` ;
  - nœud : anneau de progression, cadenas, coche, icône de l'étape, badge de jonction n/m ;
  - lien en courbe de Bézier : plein et coloré si la porte est ouverte, en pointillés gris sinon ;
  - nœuds atteignables au clavier, avec `aria-label` ; petite animation au passage d'une porte.
- **Runner** : vue « Chemin » quand le modèle a des dépendances (graphe, puis panneau de l'étape sélectionnée), avec une bascule Chemin / Liste. Sans dépendance, la vue actuelle.
- **Étape verrouillée** : d'abord ses prérequis avec leur état (prête, bloquants en cours, pas encore ouverte), puis ses items en simple liste de texte, sans case ni badge.
- **Pied d'étape** : « Porte ouverte vers … », « … attend encore une autre branche », bloquants restants, bloquants passés en N/A, preuves à compléter.
- **Porte souple** : passage forcé avec justification, enregistrée dans l'historique.
- **« Laissés en route »** dans le résumé, cliquable pour revenir à l'item.
- **Icône d'étape** : `section.icon`, avec conversion des anciens noms Heroicons du modèle de livraison (`document-text` → `file-text`, `circle-stack` → `database`…).
- **Confettis** à la fin (`canvas-confetti`, chargé à la demande, coupé si `prefers-reduced-motion`).
- **« Passer le reste à OK »** ne touche que les étapes débloquées.

### Points délicats

- **Ne jamais placer les nœuds en pourcentages** : les maquettes le font, et c'est l'origine du bug cité dans la doc.
- **Couleurs du graphe via des variables CSS**, jamais en dur, pour suivre le thème sombre.
- **Étape reverrouillée qui a déjà des réponses** : choisir comment les montrer dans la liste de texte.
- **Lisibilité au-delà de 7 ou 8 étapes** : l'audit de livraison en compte 8 s'il reçoit des dépendances ; prévoir un défilement horizontal.

### Critères de fin

- Le modèle d'exemple se parcourt de bout en bout : branches ouvertes ensemble, jonction qui attend les deux, porte souple, confettis.
- Tests : composant de graphe (placement, liens, états), panneau d'étape verrouillée, porte souple.

---

## 7. `builder-flow-editor` : construire le chemin dans le builder

**Livré et archivé** (`openspec/changes/archive/2026-10-17-builder-flow-editor/`), sans nouvel ADR. Section conservée pour mémoire. Ce qu'il faut savoir pour la suite :
- **Le builder ne modifie plus jamais son modèle en place** : chaque saisie passe par `template.update()` et un helper immuable (`template-builder.helpers.ts`, `flow-editor.helpers.ts`). Une écriture en place passerait inaperçue de `isDirty` et de l'aperçu du graphe.
- **Le graphe `step-graph` a deux variantes** : `progress` (runner, par défaut) et `structure` (aperçu du builder). En variante `structure`, la légende et le nom accessible de chaque nœud sont fournis par l'appelant.
- **Les libellés français des icônes d'étape** sont dans `STEP_ICON_LABELS` (`domain/step-icons.ts`).
- **Décisions prises pendant le change** :
  - l'aperçu montre des icônes de rôle (départ, jonction, fin), qui peuvent donc différer de celles du runner ;
  - il n'y a pas de graphe tant que le modèle n'a aucune dépendance ;
  - l'aperçu n'est pas fixé en haut de l'écran pendant le défilement.
- **Pistes ouvertes** : un aperçu fixé pendant le défilement et un bouton « Enchaîner les étapes dans l'ordre », restés en questions ouvertes du design.

**Dépend de `runner-path-view`** (composant de graphe). Maquette 05.

### Objectif

Créer et modifier les dépendances sans écrire de JSON : on édite une liste, on voit un graphe.

### Décisions validées

- **Aperçu du graphe en direct** au-dessus de la liste, avec le composant de `runner-path-view` : icônes de départ (`flag`), de jonction (`git-merge`) et de fin (`goal`), et « n items · m bloq. » sous chaque nœud.
- **Puces « Après : »** sur chaque section ; celles qui créeraient une boucle sont grisées et désactivées.
- **Porte** stricte ou souple et **mode de jonction** par section.
- **Bandeau de validation** : nombre de départs et de fins, étapes sans item, absence de cycle.
- **Palette d'icônes d'étape** : une trentaine d'icônes Lucide.
- **Politique de clôture** du modèle ; un nouveau modèle est créé avec « seuls les bloquants ».
- Le glisser-déposer CDK est conservé : il fixe l'ordre d'affichage en vue liste.
- La fenêtre « Modèle mis à jour » affiche les changements de dépendances et de criticité.

### Points délicats

- **Nouvelle section** : elle dépend de la précédente si le modèle a déjà des dépendances, d'aucune sinon.
- **Supprimer une section** la retire des `dependsOn` des autres, avec l'annulation de 6 s existante.
- **Mises à jour immuables du signal** du modèle, pour que la détection des modifications non enregistrées reste fiable.

### Critères de fin

- Le modèle d'exemple de `step-flow-model` se recrée entièrement depuis le builder.
- Il est impossible de créer une boucle.
- Tests : helpers de dépendances (ajout, retrait, anti-cycle, suppression d'une section référencée), bandeau de validation.

---

## Backlog (hors feuille de route)

Idées reportées volontairement, avec pour chacune la raison du report et le déclencheur de reconsidération : voir [BACKLOG.md](BACKLOG.md).
- Comparaison de deux sessions d'un même modèle.
- PWA et fonctionnement hors ligne.
- Synchronisation entre appareils ou partage en équipe.
- Photo directe depuis la caméra comme preuve (en partie reprise par `quick-check-and-drawer`).
- Grand périmètre : phases, carte du projet et zoom.
- Compléments de la vision UX : anticipation, mode discret, vues de synthèse, rapports enrichis.
