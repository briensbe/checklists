## 1. Modèle de données

- [ ] 1.1 Ajouter dans `src/app/models/checklist.model.ts` les types `Criticality`, `EvidenceKind`, `JoinMode`, `GateKind`, `CompletionPolicy`, `ItemEvent` et `ForcedGate`, et les champs optionnels : `completionPolicy` (template), `dependsOn`, `joinMode`, `gate` (section), `criticality`, `evidenceRequired`, `evidenceHint` (item), `evidencePending`, `history` (réponse), `forcedGates` (session)
- [ ] 1.2 Retirer `requireNaReason` de `ChecklistItemTemplate`, le déclarer dans `LegacyItem` (`src/app/data/migrations.ts`) et le retirer dans `normalizeItem`
- [ ] 1.3 Tester la normalisation : ancien fichier avec `requireNaReason` (champ retiré), template au format courant inchangé, conservation des champs d'enchaînement et de criticité

## 2. Règles pures d'enchaînement (`src/app/domain/flow-rules.ts`)

- [ ] 2.1 Implémenter `criticalityOf` (absente = `optional`) et `isResolved` (répondu et non KO, à partir de `isAnswered` et `isKo`)
- [ ] 2.2 Implémenter l'ordre topologique (algorithme de Kahn) avec détection des sections en boucle, le calcul des colonnes (plus long chemin depuis un départ) et `wouldCreateCycle`
- [ ] 2.3 Implémenter `validateFlow` : identifiants de sections en double, dépendance vers soi ou vers une section inconnue, boucle, valeurs hors liste pour `joinMode`, `gate`, `criticality`, `evidenceRequired` et `completionPolicy`, avec des messages qui nomment la section ou l'item
- [ ] 2.4 Implémenter `computeStepFlow` en un passage dans l'ordre topologique : bloquants résolus sur les items applicables, `unlocked` selon `joinMode`, `forced` (forçage enregistré et porte toujours `soft`), `passed`, état visuel, progression des jonctions, étapes suivantes, `hasFlow`, et déblocage des sections en boucle ou des dépendances inconnues ignorées
- [ ] 2.5 Implémenter le calcul des contrôles laissés en route (non bloquants applicables sans réponse ou avec preuve en attente, dans une section franchie dont une étape suivante est débloquée)
- [ ] 2.6 Écrire `flow-rules.spec.ts` couvrant chaque scénario de la spec `step-flow` : modèle sans dépendance, prérequis, bifurcation, criticité absente, N/A et KO sur un bloquant, `visibleIf`, section sans contrôle applicable, jonctions `all` et `any`, reverrouillage, porte souple forcée, porte redevenue stricte, états visuels, étapes suivantes, laissés en route, colonnes, test de boucle, boucle dans les données, preuve en attente

## 3. Règles de session (`src/app/domain/session-rules.ts`)

- [ ] 3.1 Ajouter la fonction pure `appendItemEvent(answer, event)`
- [ ] 3.2 Faire évoluer `validateForCompletion` : politique de clôture (`all` par défaut, `blocking`), nouvelle anomalie `blocking-unresolved` (sauf porte souple forcée), retrait de `na-without-reason` ; mettre à jour `COMPLETION_ISSUE_LABELS`
- [ ] 3.3 Faire évoluer `diffSingleItem` : signaler criticité, preuve exigée et consigne ; retirer la ligne « Motif N/A obligatoire »
- [ ] 3.4 Faire évoluer `diffStructureAndMetadata` : signaler les changements de dépendances (sections nommées par leur titre), de porte, de mode de jonction et de politique de clôture
- [ ] 3.5 Faire évoluer `rebaseSessionOnTemplate` : conserver `history`, y compris sur une réponse réinitialisée pour incompatibilité, et purger les `forcedGates` des sections supprimées
- [ ] 3.6 Mettre à jour `session-rules.spec.ts` : scénarios de clôture de la spec `session-lifecycle`, comparaison de versions et application de version de la spec `session-template-snapshot`, suppression des tests du motif N/A

## 4. Validation des modèles

- [ ] 4.1 Appeler `validateFlow` depuis `validateTemplateStructure` (`src/app/data/template-validation.ts`), qui lève une erreur avec le premier problème (import de modèle et import de session)
- [ ] 4.2 Ajouter les problèmes de `validateFlow` aux erreurs de `validateTemplateIntegrity` (builder)
- [ ] 4.3 Tester le refus à l'import d'un modèle avec boucle, dépendance inconnue ou criticité inconnue, et le blocage de l'enregistrement dans le builder

## 5. Service de session

- [ ] 5.1 Exposer `stepFlow` et `leftBehind` en `computed` dans `ChecklistSessionService`
- [ ] 5.2 Ajouter les événements d'historique dans `updateAnswerStatus`, `updateAnswerCheckbox`, `updateAnswerChoice` et `markRemainingAsOk` (un événement par contrôle modifié), jamais dans `updateAnswerComment` ni `updateAnswerExtra`
- [ ] 5.3 Ajouter `recordEvidenceEvent` (ajout et suppression de preuve, dans la session courante) et le retrait de l'événement de suppression à l'annulation ; brancher les appels dans `checklist-runner` et sur le mécanisme d'annulation de `EvidenceService`
- [ ] 5.4 Ajouter `forceGate(sectionId, reason)`, qui refuse si la session est terminée, si la section est inconnue, verrouillée ou à porte stricte, ou si la justification est vide
- [ ] 5.5 Tester dans `checklist-session.service.spec.ts` : historique des changements d'état, absence d'événement pour un commentaire, restauration exacte à l'annulation de « Passer le reste à OK », réinitialisation qui efface l'historique, conditions de `forceGate`, purge des portes forcées à l'application d'une version

## 6. Retrait du motif N/A dans l'interface

- [ ] 6.1 Retirer de `checklist-item` le signal `requireNaReason`, le placeholder « motif obligatoire » et la mise en évidence d'erreur d'un N/A sans commentaire ; mettre à jour `checklist-item.component.spec.ts`
- [ ] 6.2 Retirer du builder l'option « Motif N/A obligatoire » des options avancées et le badge de l'aperçu ; normaliser le modèle avant l'enregistrement pour qu'il ne contienne plus `requireNaReason`
- [ ] 6.3 Mettre à jour `template-builder.helpers.spec.ts` et `template-builder.component.spec.ts`

## 7. Builder : dépendances entre sections

- [ ] 7.1 Retirer l'identifiant d'une section supprimée des `dependsOn` des autres sections, par mise à jour immuable, l'annulation restaurant section et dépendances
- [ ] 7.2 Vérifier que `duplicateSection` copie les dépendances de l'originale sans créer de dépendance vers la copie
- [ ] 7.3 Tester la suppression d'une section référencée (avec annulation) et la duplication d'une section qui a des dépendances

## 8. Modèle d'exemple

- [ ] 8.1 Créer `src/assets/templates/release-flow.json` (« Mise en production », identifiant `release-flow-example`) : sections à branches et jonction, cases à cocher, criticités, une porte souple, deux preuves exigées, icônes Lucide, politique `blocking`
- [ ] 8.2 Faire ajouter une seule fois les modèles livrés par `TemplateService.initTemplates`, avec la clé `localStorage` `bundled_templates_seeded` (accès protégés par `try/catch`, audit de livraison considéré comme déjà ajouté quand la bibliothèque existe déjà)
- [ ] 8.3 Tester dans `template.service.spec.ts` : bibliothèque vide, bibliothèque existante sans le modèle d'exemple, modèle d'exemple supprimé puis redémarrage, modèle déjà présent non écrasé

## 9. Documentation et vérification

- [ ] 9.1 Mettre à jour le `README.md` : retrait du motif N/A exigé, mention des étapes, de la criticité et de l'historique
- [ ] 9.2 Lancer `pnpm build` sans erreur
- [ ] 9.3 Lancer `pnpm ng test --watch=false` : tous les tests passent
- [ ] 9.4 Vérifier dans l'application : l'audit de livraison se remplit et se clôture comme avant (hors motif N/A), le modèle d'exemple apparaît dans la bibliothèque, et la fenêtre « Modèle mis à jour » signale un changement de criticité et de dépendances
- [ ] 9.5 Lancer `openspec validate step-flow-model` sans erreur
