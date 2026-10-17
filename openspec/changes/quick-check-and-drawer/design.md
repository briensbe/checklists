## Context

Le runner affiche les sections de la copie figée (`checklist-section`), chacune listant ses contrôles (`checklist-item`). Une ligne de contrôle propose aujourd'hui :
- trois boutons OK, KO et N/A pour un statut, une case native pour une case à cocher, des boutons pour un choix ;
- un trombone qui ouvre la fenêtre modale `evidence-attachment` ;
- un bouton qui déplie une zone de commentaire.

Les événements remontent par `output()` de la ligne vers la section, puis vers `ChecklistRunnerComponent`, qui appelle `ChecklistSessionService`. Toute modification de session passe par `mutate()`, qui protège les sessions terminées et diffère de 400 ms l'écriture des saisies de texte.

Ce que `step-flow-model` a laissé en place, sans écran :
- la criticité (`criticalityOf`), la preuve exigée (`evidenceRequired`, `evidenceHint`) et l'indicateur `evidencePending` ;
- l'historique (`appendItemEvent`, `recordEvidenceEvent`) et les règles d'étapes (`computeStepFlow`).

État constaté dans le code :
- `EvidenceService.deleteEvidence` supprime immédiatement en base : l'annulation de 6 s exigée par la spec `evidence-attachment` n'existe pas.
- Le runner n'écoute aucun raccourci. Seules les modales gèrent Échap.
- `onIssueClick()` sait déplier une section, repasser le filtre à « Tous », faire défiler et donner le focus à l'ancre `item-<id>`.
- Le builder crée déjà les nouveaux items en case à cocher (`addItem`), mais n'a aucune interface pour la criticité ni la preuve exigée.
- `isAnswered` ne regarde que `checked` pour une case à cocher et `selectedChoice` pour un choix : un N/A n'y est possible que pour un statut.
- Les icônes sont des SVG Heroicons recopiés dans les templates (environ 70). L'application est sans zone (`zone.js` absent) et en Angular 22.

ADR en vigueur qui contraignent ce design (aucun n'est remplacé) :
- **ADR 0001** : persistance Dexie. Une nouvelle version de base impose une migration.
- **ADR 0003** : la structure d'une session vient uniquement de sa copie figée.
- **ADR 0004** : `formatVersion` n'augmente qu'en cas d'évolution incompatible du fichier d'échange.
- **ADR 0005** : dialogues maison, toasts, annulation par écriture différée de 6 s, vidage à la sortie de page.
- **ADR 0006** : mises à jour immuables du modèle dans le builder, identifiants protégés.
- **ADR 0007** : états d'étape calculés ; historique en ajout seul, qu'on ne peut réduire que par réinitialisation ou annulation de l'action qui l'a produit ; règle « absent = ancien comportement ».

## Goals / Non-Goals

**Goals:**
- Un geste unique sur toute la ligne, selon le type de contrôle, et un tiroir sous la ligne pour tout le reste (note, preuves, N/A).
- Remplir l'audit de livraison entièrement au clavier, sans modale.
- Faire respecter la preuve exigée au moment du geste, avec « Plus tard » pour les non bloquants.
- Rendre la suppression d'une preuve annulable, historique compris.
- Donner un retour visuel immédiat : compteurs, suggestion d'ajout, badges, anneaux par section, résumé fixé.
- Configurer criticité et preuve exigée dans le builder.
- Adopter Lucide pour les composants touchés.

**Non-Goals:**
- Vue chemin, verrouillage visible des étapes, pied d'étape, « Laissés en route » affiché (change `runner-path-view`).
- Icônes d'étape tirées des données (`section.icon`) et conversion des noms Heroicons (change `runner-path-view`).
- Édition des dépendances et de la politique de clôture dans le builder (change `builder-flow-editor`).
- Balayage mobile, panneau en bas d'écran, compression des photos (BACKLOG).
- Raccourcis pour sélectionner un choix (touches 1 à 9) et annulation générale du dernier geste.
- Migration vers Lucide des composants que ce change ne modifie pas (dashboard, liste des modèles, en-tête, dialogues, toasts, fenêtres JSON et de mise à jour).
- Refonte immuable complète du builder : seules les nouvelles opérations sur l'item suivent l'ADR 0006.

## Decisions

### D1. Un contrôleur d'interaction à portée de page

Un service `RunnerController` est fourni dans les `providers` de `ChecklistRunnerComponent` : une instance par page de runner, détruite avec elle.

Il porte l'**état d'interface éphémère**, sous forme de signaux :
- l'item actif ;
- le tiroir ouvert et son mode (`notes` ou `prompt`, voir D7) ;
- la suggestion d'ajout en cours ;
- l'aide ouverte ;
- les preuves du tiroir ouvert.

Il porte aussi les **actions**, que la ligne et le clavier appellent de la même façon : geste principal, KO, N/A, tiroir, ajout et suppression de preuves, validation et report de la preuve exigée, navigation, prochain item à traiter.

Il délègue les données à `ChecklistSessionService` et à `EvidenceService`, et les décisions aux fonctions pures de D2.

La ligne et le tiroir injectent le contrôleur pour l'interaction, mais reçoivent toujours leurs données (`item`, `answer`) en `input()` : ils restent testables avec un faux contrôleur. Les sorties `statusChange`, `checkboxChange`, `choiceChange`, `commentChange`, `extraChange` et `openEvidence` de la ligne et de la section disparaissent.

- **Pourquoi** :
  - le clic et le clavier passent par un seul chemin d'exécution ;
  - on évite de faire transiter une dizaine de nouveaux événements et l'état du tiroir par la section ;
  - le panneau d'étape de `runner-path-view` affichera les mêmes lignes dans un autre conteneur, sans rien recâbler.
- **Alternatives écartées** :
  - **une seule sortie typée qui remonte** (`itemIntent`) : l'état du tiroir, l'item actif et les preuves devraient quand même descendre par la section, puis par le futur panneau d'étape ;
  - **l'état d'interface dans `ChecklistSessionService`** : ce service est un singleton racine. Il mélangerait données persistées et état éphémère, qui survivrait au changement de session.

### D2. Règles pures de saisie dans `src/app/domain/quick-check.ts`

Sur le modèle de `session-rules.ts` et `flow-rules.ts`, sans Angular ni Dexie :

```ts
export interface EvidenceSummary { total: number; images: number }

export type PrimaryOutcome = 'check' | 'uncheck' | 'ok' | 'clear' | 'ask-evidence' | 'none';
export function primaryGesture(item: ChecklistItemTemplate, answer: ItemAnswer | undefined, evidence: EvidenceSummary): PrimaryOutcome;
export function choiceGesture(item: ChecklistItemTemplate, answer: ItemAnswer | undefined, choiceId: string, evidence: EvidenceSummary): 'select' | 'deselect' | 'ask-evidence' | 'none';

export function isEvidenceSatisfied(item: ChecklistItemTemplate, answer: ItemAnswer | undefined, evidence: EvidenceSummary): boolean;
// `required` (ajouté à l'implémentation) : preuve exigée, pas encore de réponse conforme.
export type EvidenceState = 'not-required' | 'required' | 'satisfied' | 'pending' | 'missing';
export function evidenceState(item: ChecklistItemTemplate, answer: ItemAnswer | undefined, evidence: EvidenceSummary): EvidenceState;
export function isSafeHttpUrl(value: string): boolean;

export type ShortcutAction = 'next' | 'previous' | 'primary' | 'ko' | 'na' | 'drawer' | 'help' | 'escape';
export interface ShortcutContext { editable: boolean; modalOpen: boolean; readonly: boolean; onControl: boolean }
export function resolveShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'>, ctx: ShortcutContext): ShortcutAction | null;

export function nextItemToProcess(items: readonly ApplicableItem[], answers: Record<string, ItemAnswer>, fromItemId: string | null): ApplicableItem | null;
export interface SectionProgress { sectionId: string; title: string; answered: number; total: number; hasAnomaly: boolean }
export function sectionProgress(session: ChecklistSession): SectionProgress[];
export function unresolvedBlockingCount(session: ChecklistSession): number;
```

Ce que décide `primaryGesture` :
- un contrôle `N/A` ou de type choix : `none` ;
- une case à cocher : `uncheck` si elle est cochée, sinon `check` ;
- un statut : `clear` s'il est `OK`, sinon `ok` (un KO est donc corrigé en OK) ;
- si la réponse à donner est conforme, qu'une preuve est exigée et qu'elle n'est pas fournie : `ask-evidence` au lieu de `check` ou `ok`.

Ce que fait `resolveShortcut` :
- elle renvoie `null` en cas de modificateur Ctrl, Alt ou Méta, de saisie en cours ou de modale ouverte ;
- elle compare `event.key` en minuscules (la touche « ? » est donc reconnue quelle que soit la disposition du clavier) ;
- en lecture seule, elle renvoie `null` pour `primary`, `ko` et `na` ;
- quand le focus est sur un bouton ou un lien (`onControl`), elle renvoie `null` pour Espace, qui garde son comportement natif.

- **Pourquoi** : toutes les décisions sont testables sans DOM, comme les règles d'étapes, et la ligne comme le clavier les appellent.

### D3. N/A pour tous les types, sur le champ `status` existant

`isAnswered` renvoie vrai dès que `answer.status === 'NA'`, quel que soit le type du contrôle. On ne crée pas de nouveau champ : un N/A s'écrit `status: 'NA'`, y compris sur une case à cocher ou un choix.

`toggleNa(itemId)`, dans le service, fait tout en une seule mutation :
- **poser le N/A** : retire `checked`, `checkedAt`, `selectedChoice` et `evidencePending`, et ajoute un événement `status: 'NA'`, plus un événement `evidence-pending: false` si une preuve était en attente ;
- **le retirer** : remet `status` à `null` et ajoute l'événement correspondant.

Effets en cascade, sans autre règle nouvelle :
- `computeMetrics` compte le N/A dans `naCount` ;
- `isResolved` le considère comme résolu, ce qui est cohérent avec la spec `step-flow` ;
- le filtre « À traiter » le masque ;
- `isKo` reste faux.

À adapter : « Passer le reste à OK » (D11) et `itemStateText` dans `report.ts`, qui affiche `N/A` pour tous les types.

- **Pourquoi `status`** : ce champ existe sur toutes les réponses et signifie déjà N/A. Un nouveau champ `na` donnerait deux sources de vérité pour les contrôles de type statut. Le format d'échange ne change pas (voir ADR 0009).
- **Conséquence** : une version antérieure de l'application lit une case à cocher N/A comme « non faite ». La donnée est conservée, seul l'affichage est dégradé.

### D4. La preuve exigée se vérifie au geste, jamais dans la résolution

On prolonge la décision D4 de `step-flow-model` : la résolution des bloquants et la validation de clôture ne lisent jamais la table `evidences`.

La preuve exigée est vérifiée **au moment du geste**, par `isEvidenceSatisfied`, à partir :
- de la réponse : `comment` pour un commentaire, `evidenceLink` pour un lien ;
- du résumé des preuves de l'item (`EvidenceSummary` : nombre total et nombre d'images), tenu à jour par `EvidenceService` (D6).

Les cas :
- **Preuve déjà fournie** : le geste répond directement.
- **Preuve manquante** : le tiroir s'ouvre en mode `prompt` (D7).
  - « Valider » appelle `resolveItem(itemId, …)`, qui donne la réponse conforme et retire `evidencePending` si besoin.
  - « Plus tard », absent pour un bloquant, appelle `resolveItem` avec `pending: true`.
- **Retirer la réponse** (décocher, retirer le OK ou le choix) retire aussi `evidencePending`, avec son événement.
- **Preuve supprimée après la validation** : rien n'est modifié. `evidenceState` renvoie `missing`, et la ligne affiche « preuve manquante ».

- **Pourquoi** : les preuves sont lues de façon asynchrone dans une autre table. Les faire entrer dans la résolution rendrait les règles impures. Et une suppression tardive bloquerait une porte ou une clôture sans que l'utilisateur comprenne pourquoi.
- **Alternative écartée** : décocher automatiquement un bloquant dont la preuve disparaît. C'est surprenant, et l'annulation de la suppression devrait alors aussi rétablir la réponse.

### D5. Le lien de preuve est stocké sur la réponse

On ajoute :
- `ItemAnswer.evidenceLink?: string` ;
- un nouvel événement d'historique `{ at; kind: 'evidence-link'; url: string | null }`.

Seules les adresses dont `new URL(value).protocol` vaut `http:` ou `https:` sont acceptées (`isSafeHttpUrl`). Le tiroir affiche le lien avec `target="_blank" rel="noopener noreferrer"` seulement s'il est sûr, et du texte sinon (cas d'un fichier importé modifié à la main). La saisie du lien est un brouillon local : seule sa validation écrit dans la session et ajoute un événement.

Le champ de lien n'est proposé que pour un item dont la preuve exigée est un lien. Un lien libre trouve sa place dans la note.

- **Pourquoi sur la réponse** : un lien est un texte court. Il doit voyager avec la session même quand l'export exclut les pièces jointes, et il satisfait l'exigence sans lecture asynchrone. Ce choix tranche la question laissée ouverte par `step-flow-model`.
- **Alternatives écartées** :
  - **une preuve de type `link` dans la table `evidences`** : le lien serait perdu à l'export sans pièces jointes, et il faudrait un nouveau type de preuve dans les rapports et l'annexe PDF ;
  - **le lien dans la note** : il ne serait ni structuré ni validable.

### D6. Suppression de preuve différée, dans `EvidenceService` et le contrôleur

`EvidenceService` :
- remplace le simple compteur par un résumé par item, `summaries` (`Record<itemId, EvidenceSummary>`), chargé avec les métadonnées des preuves de la session ;
- conserve `evidenceCounts`, dérivé de ce résumé ;
- tient un signal `pendingDeletionIds`. Le résumé et la liste du tiroir excluent ces preuves ;
- expose `hideForDeletion(id)`, `restore(id)` et `commitDeletion(sessionId, id)`, qui appelle `deleteEvidence`.

Déroulement d'une suppression, dans `RunnerController.deleteEvidence(record)` :
1. `hideForDeletion` : la preuve disparaît aussitôt du tiroir et du compteur.
2. `recordEvidenceEvent(…, 'evidence-removed', record)` : l'événement est ajouté **tout de suite**, dans la session courante.
3. `ToastService.showDeferred` :
   - `onCommit` appelle `commitDeletion` ;
   - `onUndo` appelle `restore`, puis `removeEvidenceRemovedEvent(sessionId, itemId, evidenceId)`, qui passe par `mutate()` et la fonction pure `withoutEvidenceRemovedEvent(answer, evidenceId)` de `session-rules.ts`. Celle-ci retire le dernier événement `evidence-removed` portant cet identifiant.

Le vidage :
- **sortie de page** : le vidage existant de l'ADR 0005 suffit (`ngOnDestroy` du runner, `visibilitychange`, `beforeunload`) ;
- **avant la clôture** : quand la clôture va être acceptée (`completionIssues()` vide), le runner attend `RunnerController.flushEvidenceDeletions()`. Celui-ci exécute les suppressions en attente et ferme leurs toasts grâce à une nouvelle méthode `ToastService.commitNow(toastId): Promise<void>`. Sans cela, `deleteEvidence` échouerait sur une session terminée, et la preuve réapparaîtrait.

- **Pourquoi l'événement au moment de l'action** : la suppression réelle peut avoir lieu après un changement de page, quand la session courante n'est plus la même. `recordEvidenceEvent` ignorerait alors l'événement. L'annulation n'est possible que tant que le runner de la session est affiché, puisque le départ de la page exécute la suppression. Retirer l'événement est autorisé par l'ADR 0007, point 5.
- **Cas limites** :
  - une réinitialisation pendant le délai a déjà effacé l'historique : le retrait est sans effet et la preuve réapparaît ;
  - une mise à jour du modèle pendant le délai : l'exécution de la suppression sur une preuve déjà purgée est sans effet.

### D7. La ligne et le tiroir

**`checklist-item` est refondu.** La ligne contient :
- le libellé, l'aide, le badge « Conditionnel », l'horodatage et le champ additionnel (inchangés) ;
- les badges de criticité, les compteurs, l'état de la preuve (`pending` ou `missing`) ;
- le bouton KO (statut uniquement), les boutons de choix (choix uniquement) et le trombone.

Rôle de la ligne selon le type, porté par sa zone principale focalisable (`item-<id>`), et non par toute la ligne, pour ne pas imbriquer de commandes dans un élément interactif :
- case à cocher : `role="checkbox"` et `aria-checked` ;
- statut : `role="button"`, avec un nom accessible qui contient le libellé et l'état ;
- choix : `role="group"` nommé par le libellé, car la zone reste focalisable pour la navigation (les boutons portent `aria-pressed`).

Un clic sur la ligne appelle `controller.primary(itemId)`. Il est ignoré si :
- la cible est dans `button, a, input, textarea, select, label` ;
- une sélection de texte est en cours (`getSelection()`).

**Le tiroir est un nouveau composant `item-drawer`**, en trois fichiers, rendu par `checklist-item` à côté de la ligne et non dedans : ses clics ne remontent donc jamais au geste principal. Il a deux modes :
- `notes` :
  - la note, une `textarea` liée au `comment` et enregistrée au fil de la saisie, comme aujourd'hui ;
  - les preuves : liste, miniature, téléchargement, suppression ;
  - les commandes Coller, Fichier (multiple), Photo (`accept="image/*" capture="environment"`) ;
  - « Non applicable » ;
- `prompt` :
  - la consigne `evidenceHint` ;
  - la saisie propre au type de preuve : note, photo, fichier ou lien ;
  - les preuves déjà jointes ;
  - les boutons « Valider », « Plus tard » (non bloquant seulement) et « Annuler ».

Le tiroir reprend d'`evidence-attachment` :
- le collage d'image ;
- le glisser-déposer sur toute sa surface ;
- la limite de 50 Mo, signalée par un toast d'avertissement (extraite en fonction pure `partitionBySize`) ;
- le cache des URL `blob:`, révoquées à sa destruction.

Le composant `evidence-attachment` et ses tests sont supprimés.

Dans la note :
- Entrée sans Maj termine la saisie et rend le focus à la ligne ;
- Échap rétablit la valeur mémorisée à l'entrée dans le champ, puis arrête la propagation de l'événement, pour que le runner ne ferme pas le tiroir en même temps.

À l'ouverture par KO, le focus est placé dans la note après le rendu (`afterNextRender`).

- **Pourquoi un seul tiroir pour les deux modes** : la maquette 06 place la demande de preuve sous la ligne, au même endroit que le tiroir de la maquette 07. Un seul emplacement, c'est un seul focus à gérer et une seule règle « un tiroir ouvert à la fois ».

### D8. Une seule liste d'items affichés, partagée par le rendu et le clavier

`RunnerController.visibleItems` est un `computed`, dans l'ordre du modèle, qui retient les items applicables :
- des sections non repliées ;
- qui passent le filtre actif ;
- **plus l'item dont le tiroir est ouvert**, même si le filtre devrait le masquer.

Le runner passe à chaque section sa part de cette liste. La section ne filtre plus elle-même, mais garde son compteur « n/m complétés » calculé sur les items applicables.

**Item actif** :
- signal mis à jour au clic, au focus (`focusin`) et à la navigation ;
- tabulation itinérante (*roving tabindex*) : seule la ligne active a `tabindex="0"`, les autres `-1` ;
- quand l'item actif disparaît de `visibleItems`, un `effect` désigne celui qui occupait la position suivante dans la liste précédente, ou à défaut le dernier.

**Mise au point** : une méthode `focusItem(itemId)`, factorisée à partir d'`onIssueClick`, déplie la section, ajuste le filtre, fait défiler (`block: 'nearest'`) et donne le focus. Elle sert à la navigation, au « Prochain item à traiter », aux anneaux et au panneau d'anomalies.

- **Pourquoi** : si la navigation et l'affichage calculaient chacun leur liste, ↓ pourrait viser un item masqué.

### D9. Raccourcis clavier

`ChecklistRunnerComponent` écoute `document:keydown` et construit le `ShortcutContext` :
- `editable` : la cible est un `input`, un `textarea`, un `select` ou un élément `[contenteditable]` ;
- `modalOpen` : `DialogService.activeDialog()`, la fenêtre de mise à jour du modèle, la fenêtre d'export JSON ou l'aide est ouverte, ou bien la cible est dans un `[aria-modal="true"]` ;
- `onControl` : la cible est un bouton ou un lien ;
- `readonly` : `isReadonly()`.

`resolveShortcut` renvoie l'action, que le contrôleur exécute sur l'item actif, et le runner appelle alors `preventDefault()`. Pour Espace et les flèches, cela évite le défilement de la page.

Échap suit une cascade : aide, demande de preuve, tiroir. La note gère son propre Échap (D7).

Les alias **j/k** de la feuille de route sont abandonnés : k ferait double emploi avec K (KO). Distinguer la minuscule de la majuscule serait fragile (verrouillage des majuscules).

L'aide est un nouveau composant modal `shortcuts-help`. Il reprend le piégeage du focus et la restitution du focus de `dialog-modal`.

### D10. Résumé fixé et anneaux

**Un nouveau composant `runner-progress-bar`**, en `position: sticky` et `top: var(--app-header-height)`, affiché sous `audit-summary`. Il contient :
- le pourcentage et « n / m » ;
- « k bloquants restants », si le modèle en déclare ;
- un anneau par section ;
- « Prochain item à traiter » ;
- le bouton d'aide.

La barre de progression d'`audit-summary` y est déplacée. Le contexte, les exports, les puces OK/KO/N/A/Restants, « Passer le reste à OK » et les filtres restent dans `audit-summary`, qui défile avec la page.

**Hauteurs** : on crée la variable `--app-header-height` (4rem) dans `styles.css`, et `header.component.css` l'utilise. Les lignes reçoivent un `scroll-margin-top` égal à l'en-tête plus la barre, pour qu'un item atteint au clavier ne passe pas sous la barre.

**En-tête de l'application (constaté à l'implémentation)** : son `position: sticky` était posé sur l'élément interne, dans un hôte de même hauteur, donc sans effet : l'en-tête défilait. Le `sticky` passe sur l'hôte du composant, à partir de 768 px seulement : en dessous, l'en-tête, non adapté à cette largeur, défile, et la barre se fixe en haut de l'écran. Le décalage passe par la variable `--sticky-header-offset` (hauteur de l'en-tête, ou 0 sur écran étroit). Sur écran étroit, les anneaux passent sur une seconde ligne de la barre et le libellé « Prochain item à traiter » ne garde que son icône (nom accessible conservé).

**Les anneaux** : un composant `progress-ring`, en SVG, avec les entrées valeur, ton, taille et nom accessible. Il pourra être réutilisé par `runner-path-view`.
- Ils sont dessinés par `stroke-dasharray` et `stroke-dashoffset`, en pixels.
- Les données viennent de `sectionProgress`.
- Couleur : `--ring-progress` (marque) en cours, `--ring-complete` (`emerald`) à 100 %, `--ring-anomaly` (`rose`) dès qu'un contrôle est en anomalie.
- Sur un écran étroit, la rangée d'anneaux défile horizontalement dans la barre.

- **Pourquoi une barre distincte** : rendre fixe tout le résumé (champs de contexte compris) occuperait la moitié d'un écran portable.

### D11. « Passer le reste à OK »

La signature devient :

```ts
markRemainingAsOk(evidence: Record<string, EvidenceSummary>): Promise<{ modified: number; skippedForEvidence: number }>
```

Règles :
- tout contrôle déjà répondu est ignoré, y compris un N/A de n'importe quel type (aujourd'hui, une case à cocher N/A serait cochée) ;
- un contrôle sans réponse dont la preuve exigée manque :
  - bloquant : il est ignoré et compté dans `skippedForEvidence` ;
  - non bloquant : il reçoit sa réponse avec `evidencePending: true` et l'événement correspondant ;
- le choix retenu reste le premier choix sans anomalie.

Le toast mentionne les contrôles ignorés faute de preuve. L'annulation restaure toujours le cliché des réponses.

### D12. Builder

On ajoute à `template-builder.helpers.ts` des fonctions pures et immuables, conformes à l'ADR 0006 :
- `nextCriticality(c)` : bloquant → important → optionnel → bloquant ;
- `setItemCriticality(template, itemId, criticality)` ;
- `setItemEvidence(template, itemId, kind | null, hint)`, qui retire les deux champs pour `null`.

`addItem` et la première section d'un nouveau modèle écrivent `criticality: 'optional'` à côté de `controlType: 'checkbox'`. La case `isBlocking` d'une option de choix est libellée « Anomalie ». L'aperçu affiche les badges et l'icône de preuve exigée.

`diffSingleItem` compare déjà la criticité effective (`criticalityOf`) : écrire `optional` explicitement ne crée donc pas de faux changement face à une ancienne copie figée.

### D13. Icônes Lucide

Le paquet officiel `@lucide/angular` est adopté (voir l'ADR 0008).
- **Import** : chaque icône est un composant autonome, importé dans les `imports` du composant qui l'utilise, par exemple `LucidePaperclip`, rendu par `<svg lucidePaperclip></svg>`.
- **Accessibilité** : les icônes sont masquées par défaut (`aria-hidden="true"`). Un bouton qui n'a qu'une icône garde son `aria-label`, conformément au socle d'accessibilité.
- **Périmètre** : les composants modifiés par ce change passent entièrement à Lucide : `checklist-item`, `item-drawer`, `checklist-section`, `audit-summary`, `runner-progress-bar`, `shortcuts-help`, `checklist-runner`, `template-builder`, ainsi que `header` (modifié pour le `sticky`, voir D10). Les autres gardent leurs SVG.
- **Classes dynamiques** : un composant d'icône réécrit son propre attribut `class` ; une classe conditionnelle (rotation d'un chevron, par exemple) se pose donc sur un élément enveloppe, jamais sur le `<svg>` de l'icône.
- Icônes envisagées, à confirmer sur lucide.dev à l'implémentation : `paperclip`, `circle`, `circle-check`, `circle-x`, `circle-off`, `message-square`, `camera`, `file`, `image`, `link`, `trash-2`, `download`, `circle-alert`, `triangle-alert`, `keyboard`, `list-checks`.

### D14. Couleurs et thème

Nouvelles variables dans `styles.css`, définies pour le thème clair et pour `[data-theme="dark"]` :
- badges « bloquant » (`rose`) et « important » (`amber`) ;
- preuve en attente ou manquante (`amber`) ;
- ligne active (marque) ;
- fond du tiroir ;
- anneaux.

Aucune couleur n'est codée en dur dans les composants. La suggestion d'ajout est une animation CSS, remplacée par une simple mise en évidence statique sous `@media (prefers-reduced-motion: reduce)`.

À l'implémentation, s'y ajoutent `--overlay-bg` (fond des fenêtres modales), `--text-on-accent` (texte sur un bouton plein, identique dans les deux thèmes) et une classe globale `criticality-badge` (`is-blocking`, `is-important`), partagée par la ligne du runner, la pastille et l'aperçu du builder. Elle évite de dupliquer ces styles et de dépasser le budget de style par composant (12 ko).

## Risks / Trade-offs

- [Un clic sur la ligne répond par inadvertance] → Les clics sur les commandes et les sélections de texte sont ignorés. Un second clic défait le geste, et l'historique en garde la trace.
- [Un raccourci à une lettre se déclenche pendant une saisie] → Gardes de D9 (saisie, modale, modificateurs), testées par `resolveShortcut`.
- [Une version antérieure de l'application lit une case à cocher ou un choix N/A comme « non répondu »] → Affichage dégradé sans perte de donnée, consigné dans l'ADR 0009.
- [Un bloquant validé peut perdre sa preuve après coup] → Signalé « preuve manquante » sur la ligne. Un blocage de la clôture est laissé en question ouverte.
- [La barre fixe réduit la hauteur utile sur un petit écran] → Barre compacte sur une ligne, anneaux en défilement horizontal, contexte laissé hors de la barre.
- [Le contrôleur n'existe que dans le runner] → La ligne n'est utilisée que dans le runner (puis dans le panneau d'étape, qui y sera aussi). Les tests fournissent un faux contrôleur.
- [`@lucide/angular` publie très souvent (une version par jour en octobre 2026)] → Plage `^1.x` figée par le `pnpm-lock.yaml`. Seuls des composants d'icônes sont utilisés, sans configuration globale.
- [Une suppression de preuve encore en attente lors de la clôture] → Vidage attendu avant la clôture effective (D6).
- [Le focus est perdu au re-rendu des lignes] → `@for` suivi par `item.id`, qui conserve les éléments du DOM ; focus redonné après le rendu.

## Migration Plan

- Aucune migration de base ni du fichier d'échange : `evidenceLink`, l'événement `evidence-link` et le N/A sur tout type sont des données optionnelles.
- Installer la dépendance (`pnpm add @lucide/angular`), puis déployer comme d'habitude (`pnpm build`, puis `pnpm deploy`).
- Retour arrière : la version précédente relit les données. Elle ignore `evidenceLink` et l'événement de lien, affiche une case à cocher ou un choix N/A comme sans réponse, et retrouve la fenêtre modale des preuves.

## Open Questions

- Faut-il empêcher la clôture lorsqu'un bloquant validé a perdu sa preuve exigée (« preuve manquante ») ? Proposé : non pour l'instant, à rediscuter avec le pied d'étape de `runner-path-view`.
- Faut-il des raccourcis pour les choix (touches 1 à 9) ? Non prévus, à décider selon l'usage.
- Aucun ADR en vigueur n'est à réviser. L'adoption de Lucide (ADR 0008) et les règles de saisie (ADR 0009) font l'objet de nouveaux ADR.
