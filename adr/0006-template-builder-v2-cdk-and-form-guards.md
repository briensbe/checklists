# ADR 0006 : Constructeur visuel complet de templates, glisser-déposer CDK et gardes de formulaire

## Statut
Accepté - 2026-10-16

Supersedes: aucun

## Contexte
Le constructeur de templates (`template-builder`) permettait initialement de composer des checklists simples, mais ne proposait aucune interface pour les structures avancées introduites dans les formats Dexie v3 et les ADRs 0002/0003 : variables de contexte (`contextSchema`), conditions d'affichage (`visibleIf`), motifs N/A obligatoires (`requireNaReason`) et champs additionnels (`extraField`). Les concepteurs étaient contraints d'éditer manuellement du JSON.

Par ailleurs, l'édition de templates complexes souffrait de plusieurs écueils d'ergonomie et de robustesse :
- Réordonnancement limité aux boutons de permutation unitaire (↑/↓) sans glisser-déposer.
- Risque élevé de perte accidentelle du travail en cours lors d'un clic de navigation hors du builder ou d'une fermeture d'onglet.
- Risque de rupture de cohérence des données lors de l'attribution d'identifiants en doublon ou lors du renommage d'identifiants d'items existants (qui casserait l'association des réponses lors d'un rebase de session).

## Décision

1. **Adoption ciblée de `@angular/cdk/drag-drop`** :
   - Installation de la dépendance officielle `@angular/cdk` (alignée sur la version majeure d'Angular 22) pour la gestion du glisser-déposer.
   - Utilisation de `cdkDropList` et `cdkDropListConnectedTo` pour permettre le réordonnancement direct au sein d'une section et le déplacement fluide d'items d'une section à une autre.
   - Préservation systématique des boutons de déplacement ↑ et ↓ pour assurer une navigation 100% accessible au clavier.

2. **Garde de navigation (`CanDeactivate`) et détection de modifications (Dirty Checking)** :
   - Capture d'un instantané de référence au chargement du modèle (`initialSnapshot = structuredClone(template())`).
   - Détection des modifications via un signal calculé `isDirty = computed(() => !deepEqual(template(), initialSnapshot))`.
   - Attachement d'un guard fonctionnel `CanDeactivate` sur les routes `/templates/builder` et `/templates/:id/edit` déclenchant une boîte de confirmation modale asynchrone (`DialogService.confirm`) en cas de tentative de navigation interne avec modifications non enregistrées.
   - Écoute de l'événement natif `beforeunload` du navigateur pour intercepter la fermeture d'onglet ou le rechargement.

3. **Immuabilité des mutations et modularisation en helpers purs** :
   - Abandon des mutations directes en place au profit de mises à jour immuables (`template.update(t => ...)`) orchestrées par des fonctions pures dédiées (`template-builder.helpers.ts`).
   - Isolation des algorithmes de duplication (`duplicateItem`, `duplicateSection`), de calcul d'unicité d'identifiants (`crypto.randomUUID()`) et de détection des références orphelines `visibleIf`.

4. **Protection de l'intégrité relationnelle des templates** :
   - En mode édition d'un template existant, interdiction de modifier les `id` des items existants pour garantir la pérennité du rebase des sessions d'audit.
   - Validation stricte avant enregistrement bloquant tout identifiant d'item dupliqué.
   - Prévention des dépendances orphelines : vérification que chaque condition `visibleIf` cible un champ existant dans `contextSchema`.

Alternatives écartées :
- **HTML5 Drag & Drop natif sans CDK** : rejeté car le support cross-navigateur des animations de réordonnancement, des placeholders visuels et des listes connectées est lourd à implémenter et fragile.
- **Ajout d'une suite UI complète (Material/PrimeNG)** : rejeté pour préserver la légèreté de l'application ; seule la sous-partie CDK Drag & Drop sans composant UI visuel lourd est adoptée.
- **Gestion de sauvegarde automatique permanente (Auto-save) dans Dexie** : rejetée car l'utilisateur doit pouvoir tester des configurations de template ou abandonner ses modifications sans écraser le modèle publié en cours d'utilisation par des sessions.

## Conséquences
- **Positives** : configuration 100% visuelle des modèles complexes sans manipulation de JSON ; ergonomie fluide par glisser-déposer sans régression d'accessibilité clavier ; zéro perte accidentelle de saisie ; fiabilité accrue grâce à l'immuabilité et aux helpers purs testables unitairement.
- **Négatives / Précautions** : ajout d'une dépendance npm (`@angular/cdk`) à maintenir en cohérence avec les versions Angular du projet ; les tests du composant builder doivent intégrer les stubs ou providers du CDK et de `DialogService`.
