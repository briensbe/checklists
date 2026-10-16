## Why

De nombreuses fonctionnalités avancées déjà prises en charge par le modèle de données des checklists (`ChecklistTemplate`) ne sont pas encore configurables dans l'interface visuelle du constructeur (`template-builder`). Les concepteurs de modèles sont aujourd'hui contraints d'éditer manuellement le code source JSON pour définir le schéma de contexte (`contextSchema`), les motifs d'inapplicabilité obligatoires (`requireNaReason`), les champs additionnels de saisie (`extraField`) ou les conditions d'affichage dynamique (`visibleIf`).

De plus, l'absence d'outils de productivité (duplication d'items et de sections, réordonnancement interactif par glisser-déposer) et l'absence de protection contre la perte de travail accidentelle (`CanDeactivate` sur navigation ou fermeture d'onglet) ralentissent la conception et créent des risques d'incohérence de données.

## What Changes

- **Éditeur visuel de schéma de contexte (`contextSchema`)** : création et édition des variables de contexte (`text`, `date`, `select`) avec libellé, indicateur obligatoire, valeur par défaut, placeholder et options éditables pour les listes.
- **Panneau « Options avancées » par item de contrôle** :
  - Interrupteur `requireNaReason` pour exiger un motif textuel en cas d'évaluation N/A.
  - Configuration du champ additionnel `extraField` (identifiant, libellé, placeholder).
  - Constructeur visuel de condition d'affichage `visibleIf` permettant de lier l'item à un champ de contexte et de sélectionner ou renseigner les valeurs déclenchantes.
- **Duplication d'éléments** : duplication en un clic d'un item ou d'une section entière, avec génération d'identifiants uniques garantis sans risque de collision (`crypto.randomUUID()`).
- **Réordonnancement interactif (Drag & Drop + Clavier)** :
  - Intégration de `@angular/cdk/drag-drop` pour réordonner les items et les sections par glisser-déposer, y compris le transfert d'items d'une section à une autre.
  - Maintien et fiabilisation des boutons clavier de déplacement (↑/↓) pour l'accessibilité.
- **Validation d'intégrité et protection des identifiants** :
  - Validation bloquante de l'unicité globale des `id` d'items dans l'ensemble du modèle avant enregistrement.
  - Conservation stricte des `id` d'items existants en édition (non éditables) afin de préserver la correspondance des réponses lors de la mise à jour des sessions en cours (`rebaseSessionOnTemplate`).
  - Détection et signalement des dépendances orphelines (ex: tentative de suppression ou de renommage d'un champ de contexte référencé par un `visibleIf`).
- **Garde de navigation (`CanDeactivate` & `beforeunload`)** :
  - Protection contre la perte de modifications non enregistrées via un guard `CanDeactivate` déclenchant une boîte de dialogue modale applicative (`DialogService`) sur les routes `/templates/builder` et `/templates/:id/edit`.
  - Prise en charge de l'événement natif `beforeunload` lors de la fermeture ou du rafraîchissement de la fenêtre de navigation.
- **Immuabilité de l'état du formulaire** : refactorisation des mutations d'état du builder vers des mises à jour immuables (`template.update(...)`) avec snapshot initial (`structuredClone`) pour fiabiliser la détection de modifications (état sale / dirty) et l'annulation.

## Capabilities

### New Capabilities
<!-- Aucune nouvelle capacité distincte ; l'ensemble des exigences étend le constructeur existant -->

### Modified Capabilities
- `template-builder`: Extension du constructeur visuel pour intégrer l'éditeur de schéma de contexte, les options avancées d'items (`visibleIf`, `requireNaReason`, `extraField`), la duplication, le glisser-déposer CDK et clavier, la validation d'intégrité d'identifiants et de dépendances, ainsi que la garde de navigation `CanDeactivate`.

## Impact

- **Dépendances** : ajout de `@angular/cdk` (version alignée sur Angular 22).
- **Routage** : ajout du guard `canDeactivate` sur les routes de constructeur de templates (`/templates/builder` et `/templates/:id/edit`).
- **Composants et Services** :
  - Refonte et découpage ergonomique de [`TemplateBuilderComponent`](src/app/pages/template-builder/template-builder.component.ts) et de ses vues associées.
  - Réutilisation du [`DialogService`](src/app/services/dialog.service.ts) et du [`ToastService`](src/app/services/toast.service.ts) pour les confirmations de navigation et notifications.
- **Modèle de données & Rétrocompatibilité** : aucun changement de schéma de stockage Dexie (Dexie v3 supporte déjà `contextSchema`, `visibleIf`, `requireNaReason`, `extraField`). Les templates existants restent 100% compatibles sans migration de base.
