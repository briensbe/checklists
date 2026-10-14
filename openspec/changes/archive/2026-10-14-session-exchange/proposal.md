## Why

L'application est mono-utilisateur et locale : le seul moyen de partager un audit, de l'archiver hors du navigateur ou de le reprendre sur un autre poste est l'échange de fichiers. Or l'export JSON actuel (« Brouillon JSON ») est un rapport enrichi **non ré-importable**, sans structure ni preuves, et les exports Excel/PDF codent en dur les champs de contexte du modèle « Audit de livraison » (`version`, `mode`, `responsible`, `date`), ce qui les rend faux pour tout autre template. Le change `session-integrity` a rendu chaque session autoportante (copie figée du template, statut, clôtures) : c'est le moment d'en tirer un vrai format d'échange et des rapports génériques.

## What Changes

- **Fichier d'échange de session ré-importable** : l'export JSON produit une enveloppe versionnée (`format: "checklist-session"`, `formatVersion: 1`) contenant la session complète — copie figée `templateSnapshot`, statut, historique `closures`, contexte, réponses, dates — plus un bloc de synthèse lisible (métriques) ignoré à l'import. **BREAKING** (format du fichier JSON exporté) : l'ancien format « brouillon enrichi » n'est plus produit ; il reste importable.
- **Option « Inclure les pièces jointes »** : case à cocher dans la fenêtre d'export ; si cochée, les preuves sont embarquées en base64 dans le même fichier (Blob → base64 à l'export, base64 → Blob à l'import). Un seul fichier, aucune nouvelle dépendance (pas de jszip). La taille totale des preuves est affichée à côté de la case.
- **Import de session depuis le dashboard** : bouton « Importer une session » ; validation et normalisation du fichier (`normalizeTemplate`, `migrateSessionV3`) pour accepter les fichiers d'anciens formats, y compris les brouillons JSON exportés avant ce change.
- **Gestion des conflits d'identifiant** : si l'UUID de la session importée existe déjà, l'utilisateur choisit « Remplacer l'existante » ou « Importer comme copie » (nouvel UUID, suffixe « (import) » au titre). Les dialogues natifs `confirm()` restent utilisés (remplacés au change `ui-dialogs-and-undo`).
- **Même règle de conflit pour l'import de templates** : `TemplateService.importTemplate` n'écrase plus silencieusement un template de même identifiant ; « Remplacer » ou « Importer comme copie » (nouvel identifiant, suffixe « (import) » au nom).
- **Exports Excel et PDF génériques** : le cartouche itère sur `templateSnapshot.contextSchema` (libellés du schéma, libellé d'option pour les listes, date formatée) au lieu des clés codées en dur ; ajout du nom et de la version du modèle, du statut (en cours / terminée) et de la date de clôture ; les choix personnalisés affichent leur libellé au lieu de leur identifiant.
- **Annexe des preuves dans le PDF** : les preuves images sont reproduites en miniatures groupées par item ; les autres fichiers sont listés par nom, type et taille.

Hors périmètre : remplacement des dialogues natifs et annulation (`ui-dialogs-and-undo`), export groupé de plusieurs sessions, archive ZIP, preuves dans l'export Excel, synchronisation entre postes (voir `openspec/BACKLOG.md`).

## Capabilities

### New Capabilities
- `session-exchange` : format de fichier d'échange de session (enveloppe versionnée, preuves base64 optionnelles), export depuis le runner, import depuis le dashboard avec normalisation des anciens formats et résolution des conflits d'identifiant.

### Modified Capabilities
- `audit-persistence-export` : l'exigence « Export et Import JSON de session » est retirée au profit de la capacité `session-exchange` ; les rapports Excel et PDF deviennent génériques (contexte issu du schéma, statut, clôture, version du modèle) et le PDF gagne une annexe des preuves.
- `template-builder` : l'import d'un template dont l'identifiant existe déjà demande « Remplacer » ou « Importer comme copie » au lieu d'écraser silencieusement.

## Impact

- **Nouveau module pur** `src/app/domain/session-exchange.ts` : construction et lecture de l'enveloppe, détection de format, renommage en copie ; testable sans Angular.
- **Nouveau module pur** de préparation des rapports (lignes de contexte, texte d'état d'un item) partagé par Excel et PDF.
- **Utilitaire** de conversion Blob ↔ base64 (API navigateur natives).
- **Services** : `export.service.ts` (export d'échange, Excel/PDF génériques, annexe PDF), `checklist-session.service.ts` (import transactionnel session + preuves), `template.service.ts` (détection de conflit, import en copie), `evidence.service.ts` (lecture des preuves d'une session pour l'export).
- **Composants** : `json-draft-modal` (case « Inclure les pièces jointes »), `checklists-dashboard` (bouton d'import), `templates-list` (choix en cas de conflit).
- **Données** : aucune migration Dexie ; les fichiers JSON déjà exportés (brouillons de session, templates) restent importables.
- **Dépendances** : aucune nouvelle (xlsx, jspdf et jspdf-autotable déjà présents).
- **Tests** Vitest : aller-retour export/import (avec et sans preuves), anciens formats, conflits, lignes de contexte génériques.
- **Documentation** : README (échange de fichiers), ADR 0004 sur le format d'échange.
