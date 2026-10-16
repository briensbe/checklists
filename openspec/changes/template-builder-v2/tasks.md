## 1. Installation & Dépendances

- [ ] 1.1 Installer `@angular/cdk` via `pnpm add @angular/cdk`
- [ ] 1.2 Importer `DragDropModule` dans `TemplateBuilderComponent`

## 2. Helpers Purs et Logique Métier (`template-builder.helpers.ts`)

- [ ] 2.1 Implémenter les fonctions pures de duplication (`duplicateItem`, `duplicateSection`) avec nouveaux identifiants uniques via `crypto.randomUUID()`
- [ ] 2.2 Implémenter la validation d'intégrité globale du modèle (`validateTemplateIntegrity` : titre, sections, items, unicité globale des `id` d'items)
- [ ] 2.3 Implémenter la détection des dépendances orphelines `visibleIf` (`findVisibleIfOrphans`) ciblant des champs absents de `contextSchema`
- [ ] 2.4 Implémenter les fonctions pures de réordonnancement et déplacement (`reorderSections`, `moveItemInArrayPure`, `transferItemBetweenSections`)
- [ ] 2.5 Écrire la suite de tests unitaires complète `template-builder.helpers.spec.ts`

## 3. Garde de Navigation et Détection de Modifications (`CanDeactivate`)

- [ ] 3.1 Initialiser l'instantané de référence (`initialSnapshot`) et le signal calculé `isDirty` dans `TemplateBuilderComponent`
- [ ] 3.2 Créer le guard fonctionnel `canDeactivateTemplateBuilder` (`src/app/guards/template-builder.guard.ts`) utilisant `DialogService.confirm`
- [ ] 3.3 Attacher le guard `canDeactivate` aux routes `/templates/builder` et `/templates/:id/edit` dans `src/app/app.routes.ts`
- [ ] 3.4 Ajouter l'interception de l'événement `beforeunload` dans `TemplateBuilderComponent` quand `isDirty()` est actif
- [ ] 3.5 Écrire les tests unitaires du guard `template-builder.guard.spec.ts`

## 4. Éditeur de Schéma de Contexte (`contextSchema`)

- [ ] 4.1 Ajouter la section d'édition du schéma de contexte dans `template-builder.component.html` et `.css`
- [ ] 4.2 Implémenter l'ajout, modification et suppression de champs de contexte `text` et `date` (id, label, placeholder, required, defaultValue)
- [ ] 4.3 Implémenter la configuration des champs de contexte de type `select` (options : valeur, libellé, option par défaut)
- [ ] 4.4 Interdire ou alerter lors de la suppression d'une variable de contexte si référencée par une condition `visibleIf`

## 5. Panneau d'Options Avancées par Item (`visibleIf`, `requireNaReason`, `extraField`)

- [ ] 5.1 Ajouter le volet repliable « Options avancées » par item dans `template-builder.component.html` et `.css`
- [ ] 5.2 Implémenter l'interrupteur `requireNaReason` (justification N/A obligatoire)
- [ ] 5.3 Implémenter la configuration de `extraField` (identifiant technique, libellé, placeholder)
- [ ] 5.4 Implémenter le sélecteur visuel de condition `visibleIf` (liaison à un champ du `contextSchema` et sélection des valeurs d'activation)

## 6. Duplication et Réordonnancement Interactif (CDK Drag & Drop + Clavier)

- [ ] 6.1 Ajouter les boutons « Dupliquer » sur les items et sur les sections
- [ ] 6.2 Intégrer les directives CDK (`cdkDropListGroup`, `cdkDropList`, `cdkDrag`, `cdkDropListConnectedTo`) sur les sections et items
- [ ] 6.3 Implémenter les gestionnaires de drop pour le réordonnancement intra-section et inter-sections
- [ ] 6.4 Mettre à jour les contrôles de déplacement au clavier (boutons ↑ et ↓) sur les sections et les items

## 7. Validation d'Enregistrement et Protection des Identifiants

- [ ] 7.1 Figer en lecture seule les identifiants d'items existants lors de l'édition d'un template déjà persisté
- [ ] 7.2 Intégrer la validation d'intégrité avant enregistrement et notifier les erreurs via `ToastService`
- [ ] 7.3 Réinitialiser `initialSnapshot` et `isDirty` après un enregistrement réussi

## 8. Tests d'Intégration et Validation Finale

- [ ] 8.1 Compléter la suite de tests du composant `template-builder.component.spec.ts` (options avancées, duplication, drag & drop, dirty check)
- [ ] 8.2 Valider la suite de tests globale avec `pnpm ng test --watch=false`
- [ ] 8.3 Valider la compilation avec `pnpm build`
