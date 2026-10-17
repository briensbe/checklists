## Why

Une checklist n'a aujourd'hui aucune notion d'ordre ni d'importance : toutes les sections sont accessibles en même temps et tous les contrôles pèsent autant. Or l'objectif est de passer à des checklists à étapes « façon aviation » (vision décrite dans `docs/design/checklist-ux.md` et ses maquettes) : des étapes qui se déverrouillent quand leurs points bloquants sont résolus, des branches parallèles qui se rejoignent, et des contrôles dont la criticité est visible.

Ce change pose **le socle de données et de règles** de cette vision, sans nouvel écran. Il doit passer en premier : le remplissage rapide (`quick-check-and-drawer`), la vue chemin (`runner-path-view`) et l'éditeur de chemin (`builder-flow-editor`) en dépendent tous. Il applique les décisions consignées dans la section « Écarts retenus » de `docs/design/checklist-ux.md` : on **étend** le modèle existant (une section devient une étape) au lieu d'adopter le modèle du document de vision.

## What Changes

- **Une section devient une étape d'un graphe orienté sans cycle** : champs optionnels `dependsOn` (sections prérequises), `joinMode` (`all` par défaut, ou `any`) et `gate` (porte stricte `hard` par défaut, ou souple `soft`). Un modèle sans dépendance garde exactement le comportement actuel : toutes les sections sont des départs, rien n'est verrouillé.
- **Criticité des contrôles** : champ optionnel `criticality` (`blocking`, `important` ou `optional` ; absent = `optional`). Seuls les contrôles bloquants verrouillent une porte.
- **Preuve exigée par le modèle** : champs optionnels `evidenceRequired` (`comment`, `photo`, `link` ou `file`) et `evidenceHint` (consigne), plus l'état `evidencePending` sur la réponse (fait, preuve à compléter). Ce change ne pose que les données ; la saisie arrive avec `quick-check-and-drawer`.
- **Règles de calcul pures** (nouveau `src/app/domain/flow-rules.ts`) : ordre topologique et détection de cycle, test « cette dépendance créerait-elle une boucle ? », colonnes du graphe, résolution des bloquants (sur les seuls contrôles applicables), étapes débloquées, progression des jonctions, état visuel de chaque étape, étapes suivantes et « Laissés en route ». L'état « débloqué » est toujours calculé, jamais stocké.
- **Portes souples forcées** : une session peut enregistrer le franchissement d'une porte souple avec une justification datée.
- **Historique des changements d'état d'un contrôle** : chaque réponse conserve la liste datée de ses changements d'état (statut, coche, choix, preuves). On historise, on n'écrase pas.
- **Politique de clôture du modèle** : `completionPolicy` (`all` = une réponse partout, comportement actuel et valeur par défaut ; `blocking` = seuls les bloquants doivent être résolus). Un contrôle bloquant en anomalie empêche désormais la clôture, sauf porte souple forcée.
- **BREAKING (comportement)** : le motif N/A obligatoire disparaît. L'option `requireNaReason` est retirée du builder, de la ligne de contrôle, de la validation de clôture et de la comparaison de versions ; le champ est retiré à la normalisation et ignoré dans les données existantes. Un N/A n'exige plus jamais de justification.
- **Validation des modèles** : dépendances vers des sections existantes, absence de cycle et valeurs autorisées pour les nouveaux champs, à l'import comme à l'enregistrement dans le builder. Supprimer une section la retire des dépendances des autres.
- **Comparaison et application de versions** : la fenêtre « Modèle mis à jour » signale les changements de criticité, de preuve exigée, de dépendances, de porte, de jonction et de politique de clôture ; l'application d'une version conserve l'historique et purge les portes forcées des sections supprimées.
- **Modèle d'exemple à branches** « Mise en production » (maquette 03), ajouté à la bibliothèque une seule fois, pour pouvoir tester la future vue chemin avant l'éditeur de chemin.

## Capabilities

### New Capabilities
- `step-flow`: enchaînement des étapes d'une checklist : dépendances entre sections, criticité des contrôles, portes strictes et souples, jonctions, états d'étape, étapes suivantes et « Laissés en route », tous calculés à partir des réponses.
- `item-state-history`: historique daté et non destructif des changements d'état de chaque contrôle d'une session.

### Modified Capabilities
- `session-lifecycle`: la validation à la clôture dépend de la politique de clôture du modèle, refuse un bloquant en anomalie (sauf porte souple forcée) et ne vérifie plus de motif N/A.
- `template-builder`: retrait de l'option « Motif N/A obligatoire » ; intégrité des dépendances entre sections (suppression d'une section référencée, graphe valide à l'enregistrement).
- `checklist-template-management`: validation des nouveaux champs (dépendances, cycle, valeurs autorisées), retrait de `requireNaReason` à la normalisation, ajout unique des modèles d'exemple fournis.
- `session-template-snapshot`: le récapitulatif de mise à jour signale les changements de criticité, de preuve exigée, de dépendances, de porte, de jonction et de politique de clôture ; l'application conserve l'historique et purge les portes forcées devenues sans objet.

## Impact

- **Modèle** : `src/app/models/checklist.model.ts` (nouveaux champs optionnels sur le template, la section, l'item, la réponse et la session ; retrait de `requireNaReason`).
- **Règles métier** : nouveau `src/app/domain/flow-rules.ts` ; `src/app/domain/session-rules.ts` (clôture, comparaison et application de versions).
- **Données** : `src/app/data/migrations.ts` (normalisation), `src/app/data/template-validation.ts` (validation du graphe). **Aucune nouvelle version de base Dexie** et **aucune nouvelle version du fichier d'échange** : il ne s'agit que de champs optionnels (ADR 0003, ADR 0004).
- **Services** : `ChecklistSessionService` (états d'étapes en `computed`, historique, porte forcée), `TemplateService` (ajout unique des modèles d'exemple).
- **Interface** : retrait du motif N/A dans `checklist-item` et dans le builder ; nettoyage des dépendances à la suppression d'une section dans le builder. Aucun nouvel écran.
- **Fichiers** : nouveau modèle d'exemple dans `src/assets/templates/`.
- **Tests** : nouveaux tests de `flow-rules.ts` ; mise à jour des tests qui portent sur `requireNaReason` (`session-rules.spec.ts`, `checklist-item.component.spec.ts`, `template-builder.helpers.spec.ts`).
