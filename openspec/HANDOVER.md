# Notes de passation : améliorations restantes

État au 16/10/2026. Feuille de route validée en cadrage (grilling) le 14/10/2026 : cinq changes OpenSpec, à livrer dans l'ordre.

| # | Change | État |
|---|--------|------|
| 1 | `session-integrity` | Livré, archivé (`openspec/changes/archive/2026-10-14-session-integrity/`), PR #1 fusionnée |
| 2 | `session-exchange` | Livré, archivé (`openspec/changes/archive/2026-10-14-session-exchange/`), fusionné |
| 3 | `ui-dialogs-and-undo` | **À faire** : section 1 ci-dessous |
| 4 | `template-builder-v2` | **À faire** : section 2 (dépend du 3) |
| 5 | `runner-and-dashboard-productivity` | **À faire** : section 3 (dépend du 3) |
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
- **Vérification** : `pnpm build` et `pnpm ng test --watch=false` (Vitest ; `fake-indexeddb` sert pour les tests Dexie). Le serveur de dev se lance via `.claude/launch.json` (`pnpm start`, port 4200).
- **Travail en cours non commité** : sur `main`, quelqu'un a commencé l'**édition du titre** de la session dans le runner (`ChecklistSessionService.updateTitle`, champ éditable dans `checklist-runner`). Cette fonctionnalité ne fait partie d'aucun des trois changes ci-dessous. À commiter ou à abandonner avant de démarrer le change 3.

---

## 1. `ui-dialogs-and-undo` : dialogues maison, toasts, annulation, accessibilité

**À faire en premier** : les changes 4 et 5 réutilisent ses dialogues et ses toasts.

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

**Dépend du change 1** : il utilise ses dialogues, son annulation et sa garde de sortie.

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

## 3. `runner-and-dashboard-productivity` : productivité au quotidien

**Dépend du change 1** : il utilise ses toasts et l'accessibilité des sections.

### Objectif

Accélérer les audits répétés : retrouver une session, refaire un audit, et remplir une checklist au clavier.

### Décisions validées

- **Dashboard** :
  - recherche par titre ;
  - filtre par modèle, à combiner avec le filtre par statut qui existe déjà ;
  - tri par date de modification ou par progression.
- **« Dupliquer / Refaire l'audit »** :
  - crée une nouvelle session à partir d'une session existante ;
  - reprend le contexte en vidant les champs date (qui reprennent la date du jour) ;
  - laisse choisir de reprendre ou non les réponses.
- **Raccourcis clavier dans le runner** :
  - `↑/↓` ou `j/k` pour passer d'un item à l'autre, l'item actif étant mis en surbrillance ;
  - `O`, `K`, `N` pour répondre OK, KO ou N/A ; un KO place directement le curseur dans le commentaire ;
  - `C` pour le commentaire, `P` pour les preuves ;
  - `?` pour afficher l'aide des raccourcis.
- **Bouton « Prochain item à traiter »**.
- **Résumé fixé en haut de l'écran** pendant le défilement : progression et compteurs OK/KO/N/A.

### État actuel du code

- `src/app/pages/checklists-dashboard/` :
  - filtre par statut (`statusFilter`, `filteredSessions`) et progression via `computeMetrics` ;
  - import d'une session et modale « Nouvelle checklist » ;
  - **ni recherche, ni tri, ni duplication**.
- Le runner n'écoute aucun raccourci clavier. Seules les modales gèrent la touche Échap.
- Points réutilisables :
  - chaque item porte déjà une ancre `id="item-<itemId>"` avec `tabindex="-1"` ;
  - `onIssueClick()` dans `checklist-runner.component.ts` sait déjà déplier une section, repasser le filtre à « Tous », faire défiler et donner le focus. C'est la mécanique de « Prochain item à traiter ».
- `ChecklistSessionService.createSession()` construit une session à partir d'un modèle de la bibliothèque. La duplication doit partir de la **copie figée de la session source**, pas de la bibliothèque : le modèle d'origine a pu être modifié ou supprimé entre-temps.

### Points délicats

- **Les raccourcis à une lettre ne doivent jamais se déclencher pendant une saisie.** Il faut les ignorer quand le focus est dans un `input`, un `textarea`, un `select` ou un élément `contenteditable`, ou quand une modale est ouverte.
- **La session terminée** (`isReadonly()`) désactive `O`, `K`, `N`, mais garde la navigation et `P` (consultation des preuves).
- **L'item actif** doit être un signal dans le runner, ou dans un petit service. Il se calcule sur les items **visibles**, c'est-à-dire après filtre et repli des sections : naviguer vers un item replié doit déplier sa section.
- **Dupliquer** :
  - nouvel UUID et `status: 'in_progress'` ;
  - `closures: []` ;
  - `templateSnapshot` copié avec `structuredClone` ;
  - **ne pas copier les preuves** par défaut (elles sont lourdes ; à confirmer si besoin).
  - Les champs de type `date` reprennent la date du jour via `defaultContextValues`.
- **Le tri par progression** appelle `computeMetrics` pour chaque carte. C'est acceptable pour quelques dizaines de sessions, mais mieux vaut le calculer une seule fois dans un `computed()` plutôt que dans le template HTML.
- **Le résumé fixé** : `position: sticky` sur `app-audit-summary` (ou sur une version compacte), en tenant compte du header de l'application, qui est déjà en `sticky` (`header.component.css`).

### Critères de fin

- Sur le dashboard, rechercher, filtrer (statut et modèle) et trier se combinent.
- « Refaire l'audit » crée une session en cours, pré-remplie selon le choix fait, et ouvre le runner.
- Un audit complet peut être rempli sans souris.
- `?` affiche l'aide des raccourcis.
- Aucun raccourci ne se déclenche pendant une saisie.
- Tests :
  - helpers purs (filtre et tri des sessions, duplication d'une session, calcul du prochain item à traiter) ;
  - gestion des raccourcis (ignorés dans un `input` ou en lecture seule).

---

## Backlog (hors feuille de route)

Idées reportées volontairement, avec pour chacune la raison du report et le déclencheur de reconsidération : voir [BACKLOG.md](BACKLOG.md).
- Comparaison de deux sessions d'un même modèle.
- PWA et fonctionnement hors ligne.
- Synchronisation entre appareils ou partage en équipe.
- Photo directe depuis la caméra comme preuve.
