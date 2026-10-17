## Why

Le change `step-flow-model` calcule les étapes, les portes, les jonctions et les contrôles laissés en route, mais aucun écran ne les montre : un modèle à dépendances, comme la « Mise en production » livrée (`release-flow.json`), s'affiche comme une liste plate où tout reste saisissable, y compris les étapes encore verrouillées. Ce change rend la progression visible comme un chemin (maquettes 02 et 03 de `docs/design/mockups/`) : étapes, portes qui s'ouvrent, branches parallèles et jonctions. Il pose aussi le composant de graphe que réutilisera `builder-flow-editor`.

## What Changes

- **Composant de graphe des étapes**, unique et réutilisable : tout en SVG (nœuds, anneaux, liens, libellés et icônes dans le même `<svg>`), positions en pixels calculées par une fonction pure à partir des colonnes (plus long chemin) et de la largeur mesurée par `ResizeObserver`, jamais en pourcentages. Nœud : anneau de progression, cadenas, coche, icône de l'étape, badge de jonction n/m. Lien en courbe de Bézier, plein et coloré quand la porte est ouverte, en pointillés gris sinon. Nœuds atteignables au clavier, nommés pour les technologies d'assistance. Défilement horizontal quand les colonnes ne tiennent pas.
- **Icônes d'étape** tirées de `section.icon` : liste fermée d'icônes Lucide enregistrées par `provideLucideIcons` (ADR 0008, point 3), conversion des anciens noms Heroicons du modèle de livraison (`document-text` → `file-text`, `circle-stack` → `database`…) et icône par défaut pour un nom inconnu, sans réécrire les données. L'en-tête de section de la vue liste affiche la même icône.
- **Vue « Chemin » du runner** pour un modèle à dépendances : le graphe, puis le panneau de l'étape sélectionnée, qui affiche les mêmes lignes de contrôle que la liste (geste principal, tiroir, raccourcis), sans recâblage. Bascule **Chemin / Liste**, mémorisée par le navigateur. Un modèle sans dépendance garde exactement la vue actuelle.
- **Étape verrouillée** : d'abord ses prérequis avec leur état (prête, bloquants en cours, pas encore ouverte), puis ses contrôles en simple liste de texte, sans case ni badge. Les réponses d'une étape reverrouillée sont conservées et rappelées en texte discret.
- **Les portes s'appliquent à la saisie**, dans les deux vues : aucun contrôle d'une étape verrouillée ne peut recevoir de réponse. En vue liste, une section verrouillée affiche le même contenu que le panneau d'étape verrouillée.
- **Pied d'étape** : « Porte ouverte vers … » (cliquable), « … attend encore une autre branche », bloquants restants, bloquants passés en N/A, preuves à compléter, preuves manquantes, porte forcée avec sa justification.
- **Porte souple** : bouton « Forcer le passage » avec une justification obligatoire, saisie dans le pied d'étape (sans fenêtre modale), puis enregistrée avec sa date (`forcedGates`, déjà dans le modèle).
- **« Laissés en route »** dans le résumé de la checklist, cliquable pour revenir au contrôle.
- **Passage d'une porte** : petite animation du nœud qui s'ouvre et annonce textuelle aux technologies d'assistance. **Confettis** quand toutes les étapes sont franchies, avec `canvas-confetti` chargé à la demande et coupé si `prefers-reduced-motion`.
- **« Passer le reste à OK »** ne touche que les étapes débloquées au moment de l'action, sans cascade, et respecte toujours l'ADR 0009 (jamais de N/A écrasé, jamais de bloquant sans sa preuve exigée, `evidencePending` pour un non bloquant).
- **« Prochain item à traiter »** ignore les contrôles des étapes verrouillées et, en vue chemin, sélectionne l'étape du contrôle trouvé.
- **Clôture avec preuves manquantes** : la clôture n'est pas bloquée (ADR 0009 maintenu), mais une confirmation est demandée quand des contrôles répondus ont perdu leur preuve exigée.

## Capabilities

### New Capabilities
- `step-graph`: composant de graphe des étapes : placement en pixels par colonnes, liens, états visuels des nœuds, badge de jonction, icônes d'étape (liste fermée, conversion, icône par défaut), clavier, accessibilité, défilement horizontal et rendu dans les deux thèmes.
- `runner-path-view`: vue chemin du runner : bascule Chemin / Liste, étape sélectionnée et panneau d'étape, étape verrouillée, pied d'étape, forçage d'une porte souple, laissés en route, navigation vers un contrôle ou une étape, passage d'une porte et confettis, sections verrouillées de la vue liste.

### Modified Capabilities
- `step-flow`: les portes s'appliquent à la saisie : aucune réponse ne peut être donnée à un contrôle d'une étape verrouillée.
- `checklist-execution-runner`: « Passer le reste à OK » limité aux étapes débloquées ; « Prochain item à traiter » ignore les étapes verrouillées.
- `runner-keyboard-shortcuts`: les contrôles affichés excluent les étapes verrouillées et, en vue chemin, se limitent à l'étape sélectionnée ; un nœud du graphe garde son comportement de bouton pour Espace.
- `session-lifecycle`: confirmation avant de terminer une session dont des contrôles répondus ont perdu leur preuve exigée.

## Impact

- **Dépendances** : `canvas-confetti` (1.9.x, module ESM, importé dynamiquement) et `@types/canvas-confetti` en dépendance de développement. Aucune autre.
- **Modèle et données** : aucun nouveau champ, **aucune nouvelle version de base Dexie** et **aucune nouvelle version du fichier d'échange** (ADR 0003, ADR 0004). Le choix de vue est une préférence locale du navigateur (`localStorage`), hors session.
- **Règles métier** : nouveau `src/app/domain/step-graph-layout.ts` (placement et liens) ; nouveau `src/app/domain/step-icons.ts` (liste fermée, conversion, icône par défaut) ; nouveau `src/app/domain/path-view.ts` (étape sélectionnée par défaut, prérequis, pied d'étape, transitions de portes) ; `src/app/domain/quick-check.ts` (contrôles affichés et prochain item hors étapes verrouillées).
- **Services** : `ChecklistSessionService` (garde des étapes verrouillées sur les changements de réponse, « Passer le reste à OK » limité aux étapes débloquées) ; `RunnerController` (vue courante, étape sélectionnée, navigation vers une étape, détection du passage d'une porte et de la fin du chemin).
- **Interface** : nouveaux composants `step-graph`, `step-panel`, `step-locked`, `step-footer`, `left-behind` ; modification de `checklist-runner` (bascule, vue chemin, confirmation de clôture), `checklist-section` (icône, section verrouillée, pied d'étape) et `runner-progress-bar` (libellé du prochain item). Nouvelles couleurs uniquement via les variables de `src/styles.css`.
- **ADR** : nouvel ADR 0010 sur le graphe d'étapes unique, les vues du runner pilotées par le `RunnerController` et les portes appliquées à la saisie.
- **Tests** : placement et liens du graphe, résolution des icônes, composant de graphe (états, clavier), panneau d'étape verrouillée, pied d'étape, porte souple, garde des étapes verrouillées, « Passer le reste à OK » et prochain item sur un modèle à étapes, confirmation de clôture.
