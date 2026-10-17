## 1. Socle : dépendance et thème

- [x] 1.1 Installer `@lucide/angular` (`pnpm add @lucide/angular`, plage `^1`), vérifier dans `pnpm-lock.yaml` que `lucide-angular` n'est pas installé, et lancer `pnpm build` sans erreur (ADR 0008)
- [x] 1.2 Ajouter dans `src/styles.css`, pour le thème clair et pour `[data-theme="dark"]`, les variables des badges « bloquant » (`rose`) et « important » (`amber`), de la preuve en attente ou manquante, de la ligne active, du fond du tiroir et des anneaux (`--ring-track`, `--ring-progress`, `--ring-complete`, `--ring-anomaly`)
- [x] 1.3 Créer la variable `--app-header-height` (4rem) dans `src/styles.css` et l'utiliser dans `header.component.css`

## 2. Modèle et règles de session

- [x] 2.1 Ajouter `evidenceLink?: string` à `ItemAnswer` et l'événement `{ at; kind: 'evidence-link'; url: string | null }` à `ItemEvent` (`src/app/models/checklist.model.ts`)
- [x] 2.2 Faire compter `status === 'NA'` comme une réponse pour tous les types dans `isAnswered` (`src/app/domain/session-rules.ts`), puis vérifier dans `session-rules.spec.ts` et `flow-rules.spec.ts` les effets : `computeMetrics` (`naCount`), `isResolved`, `isKo` faux, résolution d'un bloquant de type case à cocher par un N/A
- [x] 2.3 Ajouter la fonction pure `withoutEvidenceRemovedEvent(answer, evidenceId)`, qui retire le dernier événement `evidence-removed` portant cet identifiant, et la tester (événement présent, absent, plusieurs suppressions de la même preuve)
- [x] 2.4 Faire évoluer `itemStateText` et la colonne des observations dans `src/app/domain/report.ts` : `N/A` pour tous les types, mention « preuve à compléter », « Lien de preuve : » après le commentaire ; tester dans `report.spec.ts`

## 3. Règles pures de saisie (`src/app/domain/quick-check.ts`)

- [x] 3.1 Implémenter `EvidenceSummary`, `isEvidenceSatisfied` (commentaire, photo, fichier, lien), `evidenceState` (`not-required`, `satisfied`, `pending`, `missing`) et `isSafeHttpUrl`
- [x] 3.2 Implémenter `primaryGesture` (case à cocher, statut avec correction du KO, choix, N/A, `ask-evidence`) et `choiceGesture` (choix sans anomalie avec preuve manquante, choix en anomalie sans demande de preuve, N/A)
- [x] 3.3 Implémenter `resolveShortcut` : touches ↑, ↓, Espace, K, N, A, ?, Échap ; minuscules et majuscules ; gardes de saisie, de modale, de modificateurs Ctrl/Alt/Méta, de lecture seule (Espace, K, N) et d'Espace sur un bouton ou un lien
- [x] 3.4 Implémenter `nextItemToProcess` (à partir de l'item actif, reprise au début, ordre du modèle), `sectionProgress` (répondus, applicables, anomalie), `unresolvedBlockingCount` et `partitionBySize` (limite de 50 Mo)
- [x] 3.5 Écrire `quick-check.spec.ts` couvrant chaque cas : geste principal selon le type, preuve exigée satisfaite ou non, lien sûr ou non, raccourcis ignorés dans un `input`, dans une modale, avec Ctrl et en lecture seule, prochain item (suivant, reprise au début, tout renseigné), progression par section avec anomalie et section sans contrôle applicable

## 4. Services

- [x] 4.1 Ajouter à `ChecklistSessionService` : `toggleNa(itemId)` (retire coche, choix et preuve en attente ; événements `status` et `evidence-pending`), `resolveItem(itemId, { choiceId?, pending?, link? })` (réponse conforme selon le type, lien, pose ou retrait de `evidencePending`, avec leurs événements), `setEvidenceLink(itemId, url | null)` et `removeEvidenceRemovedEvent(sessionId, itemId, evidenceId)`, tous via `mutate()`
- [x] 4.2 Retirer `evidencePending` (avec son événement) quand `updateAnswerCheckbox`, `updateAnswerStatus` ou `updateAnswerChoice` retirent la réponse
- [x] 4.3 Faire évoluer `markRemainingAsOk(evidence)` : ignorer tout contrôle déjà répondu, N/A de tout type compris ; ignorer un bloquant dont la preuve exigée manque ; répondre à un non bloquant dans ce cas avec `evidencePending` ; renvoyer `{ modified, skippedForEvidence }`
- [x] 4.4 Faire évoluer `EvidenceService` : résumé par item `summaries` (total et images), `evidenceCounts` dérivé, signal `pendingDeletionIds` exclu du résumé, `hideForDeletion`, `restore` et `commitDeletion`
- [x] 4.5 Ajouter `ToastService.commitNow(toastId): Promise<void>`, qui exécute la validation différée d'un toast et le ferme
- [x] 4.6 Tester dans `checklist-session.service.spec.ts` : N/A sur une case à cocher cochée et retrait, événements du lien, « Plus tard » puis preuve complétée, retrait de la réponse d'un contrôle en attente, nouvelles règles de « Passer le reste à OK » et restauration exacte à l'annulation, retrait de l'événement de suppression
- [x] 4.7 Créer `evidence.service.spec.ts` (avec `fake-indexeddb`) : résumé par item, preuve en attente de suppression exclue puis restaurée, suppression exécutée ; compléter `toast.service.spec.ts` pour `commitNow`

## 5. Contrôleur d'interaction du runner (`RunnerController`)

- [x] 5.1 Créer le service à portée de page, avec ses signaux : item actif, tiroir ouvert et mode (`notes` ou `prompt`), suggestion en cours, aide ouverte, preuves du tiroir ouvert ; et le `computed` `visibleItems` (ordre du modèle, sections dépliées, filtre actif, item du tiroir ouvert toujours inclus)
- [x] 5.2 Désigner un nouvel item actif quand l'actif sort de `visibleItems` (position suivante dans la liste précédente, sinon le dernier)
- [x] 5.3 Implémenter les actions de saisie : `primary`, `choose`, `ko` (ouverture du tiroir et focus dans la note), `toggleNa`, `toggleDrawer`, `validatePrompt`, `later` (refusé pour un bloquant), `cancelPrompt`, `setLink`
- [x] 5.4 Implémenter l'ajout de preuves (`partitionBySize`, toast d'avertissement, `recordEvidenceEvent`, rechargement des preuves du tiroir) et la suppression annulable (D6) : masquage immédiat, événement `evidence-removed`, toast de 6 s, annulation qui restaure la preuve et retire l'événement ; puis `flushEvidenceDeletions()` avec `ToastService.commitNow`
- [x] 5.5 Implémenter la navigation : `navigate(+1 | -1)`, `focusItem(itemId)` (factorisée à partir d'`onIssueClick` : dépliage, filtre, défilement `block: 'nearest'`, focus), `goToNext()`, l'exécution d'une `ShortcutAction` et la cascade d'Échap (aide, demande de preuve, tiroir)
- [x] 5.6 Implémenter la suggestion d'ajout : environ 2 s après une réponse conforme donnée par le geste principal à un contrôle sans note ni preuve
- [x] 5.7 Écrire `runner-controller.spec.ts` : geste par type, demande de preuve (bloquant sans « Plus tard », non bloquant en attente, annulation qui garde les preuves, preuve déjà fournie), suppression annulée (compteur et historique), vidage avant clôture, prochain item dans une section repliée et sous le filtre « KO uniquement », item actif qui sort du filtre, item du tiroir maintenu affiché, suggestion

## 6. Ligne et tiroir

- [x] 6.1 Refondre `checklist-item` : rôle de la ligne selon le type (`role="checkbox"` et `aria-checked`, bouton avec état, groupe nommé pour un choix), clic ignoré sur les commandes et pendant une sélection de texte, badges de criticité, choix « anomalie », compteurs, « preuve à compléter » (avec « Compléter ») et « preuve manquante », bouton KO discret, trombone (règles de visibilité, `aria-label`, `aria-expanded`, `aria-controls`), tabulation itinérante, style de ligne active, icônes Lucide ; retirer les anciennes sorties
- [x] 6.2 Créer le composant `item-drawer` (trois fichiers), mode `notes` : note en `textarea` (Entrée, Maj+Entrée, Échap qui rétablit la valeur et arrête la propagation), liste des preuves (miniature, taille, date, téléchargement, suppression), collage, glisser-déposer, Fichier (multiple), Photo (`accept="image/*" capture="environment"`), « Non applicable » et son retrait, région nommée, révocation des URL `blob:`
- [x] 6.3 Ajouter au tiroir le mode `prompt` : consigne `evidenceHint`, saisie selon le type (note, photo, fichier, lien en brouillon local avec message d'adresse invalide), « Valider » désactivé tant que la preuve manque, « Plus tard » réservé aux non bloquants, explication pour un bloquant, « Annuler »
- [x] 6.4 Gérer la lecture seule dans la ligne et le tiroir : aucune commande de saisie, note en lecture seule, preuves téléchargeables ; lien de preuve cliquable (`target="_blank" rel="noopener noreferrer"`) seulement s'il est sûr
- [x] 6.5 Adapter `checklist-section` : recevoir sa part de `visibleItems`, ne plus filtrer, garder le compteur « n/m complétés » sur les items applicables, retirer les sorties relayées, icônes Lucide
- [x] 6.6 Supprimer le composant `evidence-attachment` et son test, et vérifier avec `rg "evidence-attachment|EvidenceAttachment" src` qu'il n'est plus référencé
- [x] 6.7 Mettre à jour `checklist-item.component.spec.ts` (rôles et états annoncés, clics exclus, sélection, N/A sans effet, badges, compteurs, lecture seule) et créer `item-drawer.component.spec.ts` (Entrée et Échap dans la note, boutons de la demande selon la criticité, lien refusé, lien non sûr affiché en texte, lecture seule, fichier de plus de 50 Mo refusé)

## 7. Runner : barre fixée, anneaux, raccourcis

- [x] 7.1 Créer le composant `progress-ring` (SVG en pixels : valeur, ton, taille, nom accessible ; couleurs par variables CSS)
- [x] 7.2 Créer le composant `runner-progress-bar` en `position: sticky` sous l'en-tête (`--app-header-height`) : pourcentage et « n / m », bloquants restants (masqués si le modèle n'en déclare pas), anneaux cliquables, « Prochain item à traiter » (désactivé quand tout est renseigné), bouton d'aide, rangée d'anneaux en défilement horizontal sur écran étroit ; ajouter le `scroll-margin-top` des lignes
- [x] 7.3 Retirer la barre de progression d'`audit-summary` (contexte, exports, puces, « Passer le reste à OK » et filtres restent) et passer ses icônes à Lucide
- [x] 7.4 Créer le composant modal `shortcuts-help` : liste des raccourcis, piégeage du focus, fermeture par Échap, focus rendu à l'élément d'origine
- [x] 7.5 Adapter `checklist-runner` : fournir `RunnerController`, écouter `document:keydown` et construire le `ShortcutContext` (modales ouvertes, cible éditable, bouton ou lien, lecture seule) avec `preventDefault()` sur les raccourcis traités, passer `visibleItems` aux sections, afficher dans le toast de « Passer le reste à OK » les contrôles ignorés faute de preuve, attendre `flushEvidenceDeletions()` avant une clôture acceptée, utiliser `focusItem` pour le panneau d'anomalies, icônes Lucide
- [x] 7.6 Mettre à jour `checklist-runner.component.spec.ts` (raccourcis ignorés dans un `input`, avec une modale ouverte et en lecture seule ; Espace sans défilement ; ? ouvre l'aide ; toast de « Passer le reste à OK ») et tester `runner-progress-bar` (tons des anneaux, section sans contrôle applicable, compteur de bloquants, prochain item désactivé)

## 8. Builder

- [x] 8.1 Ajouter à `template-builder.helpers.ts` les fonctions pures et immuables `nextCriticality`, `setItemCriticality` et `setItemEvidence` (« aucune » retire `evidenceRequired` et `evidenceHint`), et les tester dans `template-builder.helpers.spec.ts`
- [x] 8.2 Dans le builder : pastille de criticité qui change au clic, avec nom accessible ; choix de la preuve exigée (aucune, commentaire, photo, lien, fichier) et consigne affichée seulement si une preuve est exigée ; `criticality: 'optional'` écrit explicitement par `addItem` et pour le premier item d'un nouveau modèle ; libellé « Anomalie » pour `isBlocking` ; badges et indication de preuve dans l'aperçu
- [x] 8.3 Passer toutes les icônes du builder à Lucide
- [x] 8.4 Mettre à jour `template-builder.component.spec.ts` : valeurs par défaut d'un nouvel item, rotation de la criticité, preuve exigée enregistrée puis retirée, aperçu

## 9. Documentation et vérification

- [x] 9.1 Mettre à jour le `README.md` : geste principal, tiroir, preuve exigée, raccourcis clavier, résumé fixé et anneaux, icônes Lucide
- [x] 9.2 Vérifier avec `rg "#[0-9a-fA-F]{3,6}\b" src/app -g "*.css"` qu'aucune couleur n'est codée en dur dans les composants créés ou modifiés
- [x] 9.3 Lancer `pnpm build` sans erreur
- [x] 9.4 Lancer `pnpm ng test --watch=false` : tous les tests passent
- [x] 9.5 Vérifier dans l'application (`pnpm start`) :
  - l'audit de livraison se remplit entièrement au clavier, sans modale ;
  - dans le modèle d'exemple « Mise en production », « Tests automatisés au vert » (bloquant, photo exigée) ne peut pas être validé sans photo ;
  - après avoir exigé, depuis le builder, un commentaire sur « Tests de performance » (important) et appliqué la mise à jour à une session, ce contrôle passe en « preuve à compléter » avec « Plus tard » ;
  - la suppression d'une preuve s'annule, compteur et historique compris ;
  - la barre reste fixée sous l'en-tête et les anneaux suivent les réponses ;
  - le rendu est correct en thème sombre, en largeur mobile et en émulation tactile (trombone visible)
- [x] 9.6 Lancer `openspec validate quick-check-and-drawer` sans erreur
