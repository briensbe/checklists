## Why

Remplir une checklist reste lent : chaque contrôle demande de viser un petit bouton (OK, KO, N/A ou une case native), les preuves s'ajoutent dans une fenêtre modale qui masque la liste, et rien ne se fait au clavier. Le change `step-flow-model` a posé la criticité, la preuve exigée et l'historique, sans écran pour s'en servir. Ce change rend le remplissage instantané et le retour visuel immédiat (maquettes 01, 06 et 07 de `docs/design/mockups/`), dès les modèles existants, sans attendre la vue chemin de `runner-path-view`.

Il corrige aussi un écart constaté pendant `step-flow-model` : la spec `evidence-attachment` exige une annulation de 6 secondes de la suppression d'une preuve, mais la suppression est aujourd'hui immédiate.

## What Changes

- **Geste principal sur toute la ligne** :
  - case à cocher : un clic n'importe où sur la ligne coche ou décoche ;
  - statut : un clic met `OK` ; un bouton discret (ou la touche K) met `KO` et ouvre le tiroir sur la note, obligatoire pour un KO ;
  - choix personnalisé : les boutons restent ; un choix `isBlocking` s'affiche « anomalie ».
- **Tiroir sous la ligne**, ouvert par le trombone (visible au survol, en permanence sur écran tactile) : note (le `comment` existant), preuves (coller, glisser-déposer, fichier, photo via `capture="environment"`), N/A sans justification. **Il remplace la fenêtre modale des preuves** (`evidence-attachment`), dont on reprend la logique et la limite de 50 Mo.
- **N/A pour tous les types de contrôle** (case à cocher et choix compris), posé et retiré dans le tiroir. Un N/A compte comme une réponse pour tous les types.
- **Suppression d'une preuve annulable pendant 6 secondes** (ADR 0005), avec le retrait de l'événement d'historique `evidence-removed` (retrouvé par son `evidenceId`) quand l'utilisateur annule.
- **Compteurs** de note et de preuves sur la ligne, et **suggestion douce** : le trombone s'allume environ 2 secondes après une réponse donnée sans note ni preuve.
- **Preuve obligatoire au geste** (maquette 06) : quand le modèle exige une preuve (`evidenceRequired`), le geste principal ouvre la demande de preuve dans la ligne, avec la consigne `evidenceHint`. Un contrôle bloquant ne peut pas être validé sans preuve ; un contrôle non bloquant peut passer en « preuve à compléter » (`evidencePending`) avec « Plus tard ». Une preuve de type lien est stockée sur la réponse (`evidenceLink`).
- **Badges** « bloquant » et « important » sur la ligne (pas de badge « optionnel »).
- **Résumé de progression fixé en haut** pendant le défilement, avec un **anneau par section** dessiné en SVG (maquette 01), le nombre de bloquants restants et un bouton **« Prochain item à traiter »**.
- **Raccourcis clavier** : ↑/↓ pour naviguer, Espace pour le geste principal, K pour KO, N pour N/A, A pour le tiroir, Entrée pour enregistrer une note, Échap pour annuler, ? pour l'aide. Ils sont ignorés pendant une saisie, quand une modale est ouverte, et, pour ceux qui modifient une réponse, sur une session terminée. Les alias j/k de la feuille de route sont abandonnés : k entrerait en conflit avec K (KO).
- **« Passer le reste à OK »** ne touche plus aux contrôles N/A, quel que soit leur type, ni aux bloquants dont la preuve exigée manque ; un non bloquant dont la preuve manque passe en « preuve à compléter ».
- **Builder** : sur chaque item, criticité qui change au clic (bloquant → important → optionnel), preuve exigée et sa consigne ; un nouvel item est une case à cocher optionnelle, écrite explicitement ; l'option `isBlocking` d'un choix s'appelle « Anomalie ».
- **Rapports** Excel et PDF : N/A affiché pour tous les types, mention « preuve à compléter », lien de preuve dans les observations.
- **Icônes** : adoption de Lucide via le paquet officiel `@lucide/angular` (l'ancien `lucide-angular` est déprécié et limité à Angular 21). Les composants modifiés par ce change passent entièrement à Lucide ; les autres gardent leurs SVG jusqu'à leur prochaine modification.

## Capabilities

### New Capabilities
- `quick-check`: remplissage rapide d'un contrôle : geste principal sur toute la ligne selon le type, KO discret, tiroir sous la ligne (note, N/A, preuves), compteurs, suggestion douce, badges de criticité, accessibilité de la ligne et comportement en lecture seule.
- `runner-keyboard-shortcuts`: item actif et raccourcis clavier du runner (navigation, geste principal, KO, N/A, tiroir, note, annulation, aide), avec leurs gardes (saisie en cours, modale ouverte, session terminée).

### Modified Capabilities
- `checklist-execution-runner`: évaluation d'un contrôle par la ligne et le tiroir ; « Passer le reste à OK » respecte les N/A de tous les types et la preuve exigée ; ajout du résumé fixé, des anneaux par section et du « Prochain item à traiter ».
- `interactive-checklist-execution`: case à cocher sur toute la ligne, choix « anomalie », N/A possible et compté comme une réponse pour tous les types.
- `evidence-attachment`: les preuves s'ajoutent dans le tiroir (plus de fenêtre modale), photo par l'appareil, compteurs ; suppression annulable avec retrait de l'événement d'historique ; preuve exigée au geste principal ; preuve de type lien.
- `item-state-history`: événements du lien de preuve et du N/A sur tous les types ; retrait de l'événement de suppression quand la suppression d'une preuve est annulée.
- `template-builder`: criticité et preuve exigée par item, valeurs par défaut écrites explicitement pour un nouvel item, libellé « Anomalie » pour un choix.
- `audit-persistence-export`: les rapports affichent le N/A de tous les types, la preuve à compléter et le lien de preuve.

## Impact

- **Dépendance** : `@lucide/angular` (1.x, compatible Angular 17 et plus, donc Angular 22). Aucune autre.
- **Modèle** : `src/app/models/checklist.model.ts` : champ optionnel `evidenceLink` sur la réponse, événement d'historique du lien. **Aucune nouvelle version de base Dexie** et **aucune nouvelle version du fichier d'échange** (ADR 0003, ADR 0004).
- **Règles métier** : nouveau `src/app/domain/quick-check.ts` (geste principal, preuve satisfaite, raccourcis, navigation, prochain item, progression par section) ; `src/app/domain/session-rules.ts` (N/A pour tous les types dans `isAnswered`, retrait d'un événement de suppression de preuve) ; `src/app/domain/report.ts`.
- **Services** : `ChecklistSessionService` (N/A, preuve en attente, lien de preuve, « Passer le reste à OK »), `EvidenceService` (résumé par item, suppression différée), nouveau contrôleur d'interaction du runner à portée de page.
- **Interface** : `checklist-item` (refonte de la ligne), nouveau tiroir, `checklist-section`, `audit-summary` et nouvelle barre de progression fixée, nouvelle aide des raccourcis, `checklist-runner`, `template-builder`. **Suppression** du composant `evidence-attachment`. Nouvelles couleurs uniquement via les variables de `src/styles.css`.
- **Tests** : nouveaux tests de `quick-check.ts`, du contrôleur, de la ligne et du tiroir ; mise à jour des tests de `session-rules`, `report`, `checklist-session.service`, `checklist-item`, `checklist-runner` et du builder ; suppression des tests de `evidence-attachment`.
