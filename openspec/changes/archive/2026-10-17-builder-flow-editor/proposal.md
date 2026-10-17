## Why

Depuis `step-flow-model` et `runner-path-view`, un modèle à dépendances se parcourt comme un chemin dans le runner, mais il ne se construit qu'en écrivant du JSON : le builder n'offre aucune interface pour les dépendances entre sections (`dependsOn`), la porte (`gate`), le mode de jonction (`joinMode`), l'icône d'étape (`icon`) ni la politique de clôture (`completionPolicy`). Le modèle d'exemple « Mise en production » (`release-flow.json`) ne peut donc pas être recréé depuis l'application. Ce change rend ces réglages éditables dans le builder (maquette 05 de `docs/design/mockups/`) : on édite une liste, on voit le graphe se dessiner.

## What Changes

- **Aperçu du graphe en direct** au-dessus de la liste des sections, avec le composant `step-graph` de `runner-path-view`. Chaque nœud porte une icône de rôle (départ `flag`, jonction `git-merge`, fin `goal`, sinon l'icône de la section) et la légende « n items · m bloq. ». L'aperçu suit chaque modification (titre, dépendance, ajout ou suppression d'un contrôle, criticité). Un clic ou Entrée sur un nœud amène à la section correspondante dans la liste. Sans aucune dépendance, l'aperçu laisse place à une phrase qui explique comment enchaîner les étapes.
- **Variante « structure » du graphe** : sans progression ni cadenas ni coche, liens pleins et neutres, légende sous le libellé et nom accessible fourni par l'appelant. Le composant reste présentationnel ; la variante « progression » du runner est inchangée.
- **Puces « Après : »** sur chaque section, une par autre section : une puce active déclare une dépendance. Une puce qui créerait une boucle est grisée, désactivée et expliquée (« Créerait une boucle »). Une section sans dépendance est signalée « étape de départ ».
- **Porte** (stricte ou souple) sur une section dont d'autres dépendent, et **mode de jonction** (toutes les étapes précédentes ou au moins une) sur une section qui a au moins deux dépendances.
- **Bandeau de validation** dans l'aperçu : nombre de départs et de fins, étapes sans contrôle, absence de boucle, et erreurs d'enchaînement héritées d'un import (dépendance inconnue, boucle).
- **Palette d'icônes d'étape** : la liste fermée d'icônes Lucide de `runner-path-view` (une trentaine), avec un libellé français par icône. Un ancien nom Heroicons s'affiche converti, sans être réécrit tant que le concepteur ne choisit pas une autre icône.
- **Politique de clôture** du modèle : « Seuls les bloquants » ou « Une réponse partout ». Un nouveau modèle est créé avec « Seuls les bloquants » (`completionPolicy: 'blocking'` écrit explicitement) ; un modèle existant sans politique s'affiche « Une réponse partout » et n'est réécrit que si le concepteur change ce choix.
- **Nouvelle section** : elle dépend de la dernière section de la liste si le modèle a déjà des dépendances, d'aucune sinon.
- **Mises à jour immuables du modèle partout dans le builder** : les modifications encore faites en place (libellés et champs liés par `[(ngModel)]`, ajout, duplication, suppression et déplacement d'items, choix, options avancées, champs de contexte) passent par `template.update()` et des fonctions pures. Sans cela, l'aperçu ne suivrait pas la saisie et la détection des modifications non enregistrées (`isDirty`, calculé sur le signal) manquerait les modifications imbriquées.
- Inchangé, mais vérifié : le glisser-déposer CDK fixe toujours l'ordre d'affichage en vue liste sans toucher aux dépendances ; supprimer une section la retire des `dependsOn` des autres, avec l'annulation de 6 s existante ; la fenêtre « Modèle mis à jour » signale déjà les changements de dépendances, de porte, de jonction, de criticité et de politique de clôture (livré par `step-flow-model`).

## Capabilities

### New Capabilities
- `builder-flow-editor`: édition de l'enchaînement des étapes dans le builder : aperçu du graphe en direct, puces « Après : » avec anti-boucle, porte et mode de jonction, bandeau de validation, palette d'icônes d'étape, politique de clôture, dépendance d'une nouvelle section, ordre d'affichage indépendant des dépendances.

### Modified Capabilities
- `step-graph`: ajout d'une variante « structure » (aperçu du builder) et d'une légende sous le libellé d'un nœud, la variante « progression » du runner restant celle par défaut.
- `template-builder`: la garde contre les modifications non enregistrées détecte toute modification, y compris celle d'un champ imbriqué (libellé d'un contrôle, option de choix, champ de contexte).

## Impact

- **Dépendances** : aucune nouvelle. `@lucide/angular` et `@angular/cdk` sont déjà installés.
- **Modèle et données** : aucun nouveau champ (`dependsOn`, `joinMode`, `gate`, `icon` et `completionPolicy` existent depuis `step-flow-model`), **aucune nouvelle version de base Dexie** et **aucune nouvelle version du fichier d'échange** (ADR 0001, ADR 0004).
- **Règles métier** : nouveau `src/app/pages/template-builder/flow-editor.helpers.ts` (bascule d'une dépendance avec anti-boucle, porte, jonction, icône, politique de clôture, dépendances d'une nouvelle section, puces « Après : », résumé du bandeau, nœuds de l'aperçu) ; `template-builder.helpers.ts` complété par les mises à jour immuables des sections, des items, des choix et des champs de contexte ; `src/app/domain/step-icons.ts` complété par les libellés français des icônes ; `src/app/domain/step-graph-layout.ts` accepte une place de libellé plus haute quand les nœuds ont une légende. Réutilisés tels quels : `wouldCreateCycle`, `computeColumns`, `topologicalOrder` et `validateFlow` (`src/app/domain/flow-rules.ts`).
- **Interface** : `step-graph` (variante, légende, nom accessible fourni) ; nouveaux composants `flow-preview` (aperçu et bandeau), `section-flow-settings` (puces, porte, jonction) et `step-icon-picker` (palette) ; `template-builder` (politique de clôture, intégration des trois composants, liaisons `[ngModel]` + `(ngModelChange)`). Nouvelles couleurs uniquement via les variables de `src/styles.css`.
- **ADR** : aucun nouvel ADR ; le change applique les ADR 0006 (helpers purs et immuables), 0007 (le builder refuse les boucles), 0008 et 0010 (graphe unique et présentationnel, liste fermée d'icônes).
- **Tests** : helpers de dépendances (ajout, retrait, anti-boucle, jonction retirée sous deux dépendances, suppression d'une section référencée, nouvelle section), résumé du bandeau, nœuds de l'aperçu, variante « structure » du graphe, palette, détection des modifications imbriquées, recréation du modèle « Mise en production » par les helpers.
