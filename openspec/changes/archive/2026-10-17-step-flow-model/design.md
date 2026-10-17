## Context

L'application exécute des checklists dont la structure est une liste de sections (`ChecklistSectionTemplate`) contenant des contrôles (`ChecklistItemTemplate`). Les règles métier sont des fonctions pures dans `src/app/domain/session-rules.ts` (applicabilité, métriques, validation de clôture, comparaison et application de versions). Toute modification d'une session passe par `ChecklistSessionService.mutate()`, qui protège les sessions terminées et regroupe les écritures des saisies texte.

La vision UX de `docs/design/checklist-ux.md` introduit des étapes reliées en graphe, des portes, des jonctions, une criticité des contrôles et un historique. Sa section « Écarts retenus » fixe l'arbitrage : on étend le modèle existant au lieu d'adopter le modèle de son §7. Ce change pose les données et les règles ; il ne crée aucun écran (la vue chemin et l'éditeur de chemin viennent avec `runner-path-view` et `builder-flow-editor`, la saisie rapide avec `quick-check-and-drawer`).

ADR en vigueur qui contraignent ce design (aucun n'est remplacé) :
- ADR 0001 : persistance locale Dexie ; une nouvelle version de base impose une migration.
- ADR 0003 : chaque session lit sa structure uniquement dans sa copie figée ; la mise à jour de version est manuelle et conserve les réponses par identifiant d'item.
- ADR 0004 : le fichier d'échange n'incrémente `formatVersion` qu'en cas d'évolution incompatible ; tout import passe par la normalisation commune.
- ADR 0005 : les suppressions annulables sont différées pendant 6 secondes.
- ADR 0006 : le builder fait des mises à jour immuables de son signal et protège les identifiants existants.

## Goals / Non-Goals

**Goals:**
- Décrire étapes, dépendances, portes, jonctions et criticité dans le modèle, sans casser aucun modèle ni aucune session existante.
- Calculer en fonctions pures, testables sans Angular, l'état de chaque étape et les contrôles laissés en route.
- Historiser les changements d'état des contrôles.
- Retirer le motif N/A obligatoire.
- Faire évoluer la clôture (politique `all` ou `blocking`, bloquant en anomalie).
- Fournir un modèle d'exemple à branches pour les changes suivants.

**Non-Goals:**
- Aucun nouvel écran : pas de graphe, pas de verrouillage visible dans le runner, pas d'édition des dépendances dans le builder.
- Pas de saisie de la preuve exigée ni de l'état « preuve à compléter » (change `quick-check-and-drawer`).
- Pas de phases (grand périmètre, reporté au BACKLOG).
- Pas d'auteur dans l'historique : l'application est mono-utilisateur.
- Pas de révocation d'une porte forcée.

## Decisions

### D1. Étendre le modèle existant plutôt qu'adopter celui de la vision

Une section **est** une étape. On ajoute des champs optionnels au lieu de remplacer `sections` par `phases/steps` et `ItemAnswer` par `ItemState`.

- **Pourquoi** : le modèle de la vision a été écrit sans connaître l'application. L'adopter imposerait :
  - une migration Dexie v4 ;
  - un fichier d'échange v2, que l'import devrait savoir convertir ;
  - la réécriture des règles, des rapports, du builder et de la comparaison de versions.

  Et ce, pour des concepts qui existent déjà : `answers` a la même forme que `ChecklistRun.items`, et `templateSnapshot` assure déjà la version figée.
- **Alternative écartée** : un modèle parallèle propre aux checklists « à étapes ». Il dupliquerait tout le cycle de vie et ferait cohabiter deux types de modèles dans la bibliothèque.

### D2. Uniquement des champs optionnels, avec la règle « absent = ancien comportement »

```ts
export type Criticality = 'blocking' | 'important' | 'optional';
export type EvidenceKind = 'comment' | 'photo' | 'link' | 'file';
export type JoinMode = 'all' | 'any';
export type GateKind = 'hard' | 'soft';
export type CompletionPolicy = 'all' | 'blocking';

// ChecklistTemplate      + completionPolicy?: CompletionPolicy      (absent = 'all')
// ChecklistSectionTemplate + dependsOn?: string[]; joinMode?: JoinMode; gate?: GateKind
// ChecklistItemTemplate  + criticality?: Criticality; evidenceRequired?: EvidenceKind; evidenceHint?: string
//                        - requireNaReason (retiré, voir D9)
// ItemAnswer             + evidencePending?: boolean; history?: ItemEvent[]
// ChecklistSession       + forcedGates?: ForcedGate[]
```

Un champ absent garde toujours le comportement actuel :
- section sans `dependsOn` = départ ;
- `joinMode` absent = `all` ;
- `gate` absent = `hard` ;
- `criticality` absente = `optional` ;
- `completionPolicy` absente = `all` ;
- `controlType` absent = `status` (règle existante, inchangée).

Ce sont le builder et les nouveaux modèles qui écriront explicitement les nouvelles valeurs par défaut (case à cocher, politique `blocking`) dans les changes suivants.

- **Pourquoi** :
  - Dexie stocke des objets sans schéma de contenu, donc pas de nouvelle version de base ni de migration.
  - `normalizeItem` recopie déjà les champs inconnus (`...rest`).
  - L'ADR 0004 ne demande pas d'incrémenter `formatVersion` pour des champs optionnels.
  - Une ancienne version de l'application relit ces données en ignorant les nouveaux champs.
- **Alternative écartée** : une migration qui écrirait les valeurs par défaut partout. Elle réécrirait chaque modèle et chaque copie figée. Et comme les copies figées anciennes et les modèles récents n'auraient pas la même forme, la comparaison de versions afficherait de faux changements.

### D3. Règles pures dans `flow-rules.ts`, calculées en un seul passage

Un nouveau fichier `src/app/domain/flow-rules.ts`, sur le modèle de `session-rules.ts`, sans dépendance à Angular ni à Dexie :

```ts
export interface StepState {
  sectionId: string;
  unlocked: boolean;
  blockingResolved: boolean;
  forced: boolean;
  passed: boolean;                  // unlocked && (blockingResolved || forced)
  visual: 'locked' | 'open' | 'passed' | 'done';
  join: { ready: number; total: number } | null;   // si au moins 2 dépendances
  next: { sectionId: string; unlocked: boolean }[];
}
export interface StepFlow {
  hasFlow: boolean;                 // au moins une section déclare une dépendance
  order: string[];                  // ordre topologique
  columns: Record<string, number>;  // plus long chemin depuis un départ
  steps: Record<string, StepState>;
  leftBehind: ApplicableItem[];
  cycle: string[] | null;           // sections impliquées dans une boucle (données invalides)
}
export function computeStepFlow(session: ChecklistSession): StepFlow;
export function wouldCreateCycle(sections: readonly ChecklistSectionTemplate[], sectionId: string, dependencyId: string): boolean;
export function validateFlow(template: ChecklistTemplate): FlowIssue[];
export function isResolved(item: ChecklistItemTemplate, answer: ItemAnswer | undefined): boolean;
export function criticalityOf(item: ChecklistItemTemplate): Criticality;
```

`computeStepFlow` trie les sections (algorithme de Kahn), puis les parcourt une seule fois dans cet ordre. Quand on arrive sur une section, l'état de toutes ses dépendances est donc déjà connu, et on en déduit le sien.

`isResolved` réutilise `isAnswered` et `isKo` de `session-rules.ts` : un contrôle répondu et non KO est résolu. Ainsi, N/A et un choix sans anomalie sont résolus sans règle supplémentaire. L'applicabilité vient de `applicableItems()`.

- **Pourquoi un seul passage** : les maquettes calculent `unlocked` par récursion. Sur des données contenant une boucle, ce calcul ne s'arrête jamais. Le tri topologique détecte la boucle et calcule chaque section une seule fois, avec un coût proportionnel au nombre de sections et de dépendances.
- **Pourquoi une seule fonction** pour tout le graphe : le service l'expose en un `computed`, et chaque composant (résumé, futur graphe, panneau d'étape) lit le même résultat. Deux écrans ne peuvent donc pas calculer des états différents, le même principe que celui de `computeMetrics`.
- **Alternative écartée** : calculer l'état dans chaque composant. Cela duplique la logique et rend les tests dépendants d'Angular.

### D4. La résolution ne dépend que de la réponse

Un bloquant est résolu selon l'état de sa réponse, jamais selon la présence de preuves. La preuve exigée par le modèle sera garantie au moment du geste par `quick-check-and-drawer` : impossible de valider un bloquant sans preuve, « Plus tard » réservé aux non bloquants.

- **Pourquoi** : les preuves vivent dans une autre table Dexie (`evidences`), lue de façon asynchrone. Les faire entrer dans la résolution rendrait les règles impures ou obligerait à passer partout l'ensemble des preuves.
- **Conséquence** : `evidencePending` n'agit que sur l'état visuel (`passed` au lieu de `done`) et sur les contrôles laissés en route.

### D5. Portes forcées : une liste dans la session, interprétée au calcul

```ts
export interface ForcedGate { sectionId: string; reason: string; at: string; }
```

`forceGate(sectionId, reason)` (service, via `mutate()`) ajoute une entrée à condition que :
- la session soit en cours ;
- la section existe dans la copie figée, soit débloquée et ait une porte `soft` ;
- la justification ne soit pas vide.

Au calcul, une section est forcée si une entrée existe **et** que sa porte est toujours `soft` dans la copie figée.

- **Pourquoi une liste plutôt qu'un dictionnaire** : on historise sans écraser, et un second forçage ajoute une entrée.
- **Pourquoi interpréter au calcul** : si une nouvelle version du modèle rend la porte stricte, le forçage cesse d'agir sans qu'on ait à modifier les données.

### D6. Données invalides : on laisse passer plutôt que de bloquer

Si une copie figée contient une boucle ou une dépendance inconnue, malgré les validations de D10 (fichier édité à la main, par exemple) :
- les sections de la boucle sont traitées comme débloquées ;
- les dépendances inconnues sont ignorées ;
- `cycle` est renseigné pour que l'interface puisse le signaler.

- **Pourquoi** : une session bloquée par un modèle invalide serait impossible à terminer. Laisser passer dégrade vers le comportement actuel, sans aucun verrou.
- **Alternative écartée** : tout verrouiller (blocage sans issue) ou lever une exception (runner inutilisable).

### D7. Clôture : politique du modèle et bloquant en anomalie

`validateForCompletion` applique, dans l'ordre :
1. les champs de contexte requis ;
2. les réponses manquantes : tous les contrôles applicables avec la politique `all`, les seuls bloquants avec la politique `blocking` ;
3. le KO sans commentaire ;
4. **le bloquant en anomalie**, nouvelle anomalie `blocking-unresolved` (« Bloquant non résolu »), sauf porte souple forcée sur sa section.

L'anomalie `na-without-reason` disparaît.

- **Pourquoi la règle 4 vaut quelle que soit la politique** : un bloquant en anomalie, c'est un « no-go ». La politique ne décide que de l'obligation de répondre aux non bloquants. Les modèles existants n'ont aucun contrôle bloquant : leur clôture est inchangée.
- **Alternative écartée** : appliquer la règle 4 seulement avec la politique `blocking`. Un même contrôle bloquant autoriserait alors ou non la clôture selon un réglage sans rapport avec lui.

### D8. Historique : une liste d'événements sur la réponse

```ts
export type ItemEvent =
  | { at: string; kind: 'status'; status: ControlStatus | null }
  | { at: string; kind: 'checked'; checked: boolean }
  | { at: string; kind: 'choice'; choiceId: string | null }
  | { at: string; kind: 'evidence-added'; evidenceId: string; name: string }
  | { at: string; kind: 'evidence-removed'; evidenceId: string; name: string }
  | { at: string; kind: 'evidence-pending'; pending: boolean };
```

- **Où sont ajoutés les événements** : une fonction pure `appendItemEvent(answer, event)` dans `session-rules.ts` produit une nouvelle réponse. Elle est appelée par les méthodes du service qui changent un état : `updateAnswerStatus`, `updateAnswerCheckbox`, `updateAnswerChoice` et `markRemainingAsOk` (un événement par contrôle modifié). Pas par `mutate()` lui-même, qui ne sait pas ce qu'il modifie.
- **Saisies de texte** : `updateAnswerComment` et `updateAnswerExtra` n'ajoutent rien, sinon chaque frappe produirait un événement.
- **Preuves** : l'événement est ajouté au moment de l'action, dans la session courante, via une méthode `recordEvidenceEvent`.
  - Pourquoi au moment de l'action : avec l'annulation différée de l'ADR 0005, la suppression réelle n'a lieu qu'après 6 secondes, éventuellement après un changement de page. À ce moment, la session courante peut ne plus être la bonne.
  - **Retrait à l'annulation, reporté** : constaté à l'implémentation, la suppression d'une preuve est aujourd'hui immédiate dans le code. L'annulation de 6 s, pourtant exigée par la spec `evidence-attachment`, n'a jamais été implémentée. L'événement de suppression est donc ajouté au moment où la preuve disparaît vraiment, ce qui est exact. Le retrait de l'événement quand l'utilisateur annule (en le retrouvant par son `evidenceId`) sera fait par `quick-check-and-drawer`, qui remplace la fenêtre des preuves par le tiroir et implémente cette annulation.
- **Annulations et transformations** :
  - L'annulation de « Passer le reste à OK » restaure le cliché des réponses, historiques compris : l'action annulée n'a jamais existé.
  - `resetSession` efface tout, historiques compris : c'est l'objet d'une réinitialisation confirmée.
  - `rebaseSessionOnTemplate` garde l'historique, même quand il réinitialise une réponse devenue incompatible.
- **Taille** : aucune limite. Quelques dizaines d'octets par événement, quelques événements par contrôle, c'est négligeable à côté des preuves.

### D9. Retrait de `requireNaReason`

- Le champ disparaît de `ChecklistItemTemplate`. Le type hérité `LegacyItem` de `migrations.ts` le déclare encore, et `normalizeItem` le retire, comme il retire `mode` et `color`.
- Le builder normalise le modèle avant de l'enregistrer : un modèle chargé avec ce champ est enregistré sans lui.
- Le champ est aussi retiré de la ligne de contrôle (`checklist-item` : `requireNaReason`, placeholder et mise en évidence), du volet d'options avancées et de l'aperçu du builder, de `validateForCompletion` et de `diffSingleItem`.
- Les copies figées existantes gardent la propriété, que plus aucun code ne lit. La retirer de la comparaison de versions évite qu'un ancien cliché comparé à un modèle réenregistré affiche un faux changement.

### D10. Une seule validation du graphe, partagée

`validateFlow(template)` renvoie la liste des problèmes trouvés :
- identifiant de section en double ;
- section qui dépend d'elle-même ou d'une section inconnue ;
- boucle (sections nommées) ;
- valeur hors liste pour `joinMode`, `gate`, `criticality`, `evidenceRequired` ou `completionPolicy`.

Elle est appelée par :
- `validateTemplateStructure` (import de modèle et import de session), qui lève une erreur avec le premier problème ;
- `validateTemplateIntegrity` (builder), qui ajoute tous les problèmes à ses erreurs affichées en toast.

- **Pourquoi** : l'import et le builder acceptent exactement les mêmes modèles.

### D11. Builder : suppression et duplication de section

- **Suppression** : `removeSection` retire aussi l'identifiant supprimé des `dependsOn` des autres sections, par une mise à jour immuable (ADR 0006). L'annulation restaure l'état d'avant suppression, section et dépendances comprises.
- **Duplication** : `duplicateSection` copie les dépendances de l'originale. Aucune section ne dépend de la copie.
- **Identifiants** : les identifiants de sections ne sont déjà pas modifiables dans l'interface ; la spec l'exige désormais, puisqu'ils servent de références.

### D12. Comparaison et application de versions

- **`diffSingleItem`** signale les changements de criticité (avec les libellés « bloquant », « important », « optionnel »), de preuve exigée et de consigne.
- **`diffStructureAndMetadata`** signale, pour chaque section conservée :
  - un changement de dépendances, en nommant les sections par leur titre ;
  - un changement de porte ou de mode de jonction.

  Elle signale aussi le changement de politique de clôture.

  Ces lignes entrent dans `structureChanges` et `modified`, que la fenêtre « Modèle mis à jour » affiche déjà : aucune modification de l'interface n'est nécessaire.
- **`rebaseSessionOnTemplate`** :
  - garde `history` sur les réponses conservées ou réinitialisées ;
  - purge de `forcedGates` les sections supprimées.

### D13. Service

`ChecklistSessionService` expose :
- `stepFlow = computed(() => computeStepFlow(session))` ;
- `leftBehind`, dérivé de `stepFlow` ;
- `forceGate(sectionId, reason)`, qui renvoie `false` si une condition de D5 n'est pas remplie ;
- `recordEvidenceEvent(...)`.

Aucun composant ne consomme encore `stepFlow` : il est couvert par les tests du service et de `flow-rules.ts`.

### D14. Modèle d'exemple ajouté une seule fois

- **Contenu** : un fichier `src/assets/templates/release-flow.json`, identifiant `release-flow-example`. C'est la « Mise en production » de la maquette 03 :
  - sections Préparation → Build et Documentation en parallèle → Tests (après Build) → Go / no-go (jonction de Tests et Documentation) → Déploiement ;
  - contrôles de type case à cocher, criticité bloquante ou optionnelle ;
  - une porte souple sur Documentation ;
  - une preuve exigée sur « Tests auto OK » (photo) et sur « Plan de rollback » (commentaire) ;
  - icônes de section en noms Lucide ;
  - politique de clôture `blocking`.
- **Mécanisme d'ajout** : `TemplateService.initTemplates` parcourt une liste de modèles livrés. Une clé `localStorage` (`bundled_templates_seeded`) mémorise les identifiants déjà ajoutés. Un modèle livré est ajouté s'il n'est ni mémorisé ni présent en base, puis il est mémorisé.
- **Cas d'une bibliothèque existante** : si la clé n'existe pas encore et que la base contient déjà des modèles, on considère l'audit de livraison comme déjà ajouté. Sans cette précaution, un utilisateur qui l'avait supprimé le verrait réapparaître.
- **Pourquoi `localStorage`** : il est déjà utilisé pour la préférence de thème, et une table Dexie dédiée imposerait une nouvelle version de base. Les accès sont protégés par `try/catch`. Si le stockage est vidé, un modèle d'exemple ne réapparaît que s'il a été supprimé de la base.
- **Alternatives écartées** :
  - ajouter tout modèle livré absent de la base : un modèle supprimé reviendrait à chaque démarrage ;
  - import manuel par l'utilisateur : friction inutile pour un exemple.

## Risks / Trade-offs

- [Un N/A sans justification suffit à résoudre un bloquant] → l'événement est historisé (D8), et `runner-path-view` signalera les bloquants passés en N/A dans le pied d'étape.
- [Les sessions en cours qui comptaient sur le motif N/A obligatoire ne l'exigent plus] → c'est un assouplissement : aucune donnée perdue, aucune clôture rendue impossible.
- [Un bloquant en anomalie empêche désormais la clôture] → seuls les modèles qui déclarent des bloquants sont concernés, et aucun modèle existant n'en a. La porte souple offre une issue tracée.
- [Jusqu'à `runner-path-view`, les sections d'un modèle à dépendances restent toutes saisissables dans la vue liste] → c'est un état transitoire assumé, et la validation de clôture ne dépend pas du verrouillage.
- [Laisser passer en cas de boucle peut masquer des données invalides] → validation à l'import et à l'enregistrement (D10), et `cycle` exposé pour un signalement.
- [La clé `localStorage` peut être effacée] → l'effet est limité à la réapparition d'un exemple supprimé.

## Migration Plan

- Aucune migration de base ni de fichier d'échange : il suffit de déployer le build (`pnpm build`, puis `pnpm deploy`).
- Retour arrière : la version précédente relit les données. Elle ignore les nouveaux champs, et lit un `requireNaReason` absent comme « non exigé ». Les événements d'historique et les portes forcées sont simplement ignorés.

## Open Questions

- Affichage des réponses d'une étape reverrouillée dans la liste de texte d'une étape verrouillée : à trancher dans `runner-path-view`.
- Révocation d'une porte forcée : à trancher dans `runner-path-view`.
- Stockage d'une preuve de type `link` (champ dédié sur la réponse ou pièce jointe) : à trancher dans `quick-check-and-drawer`.
- Aucun ADR en vigueur n'est à réviser.
