## 1. Fondations pures

- [x] 1.1 Créer `src/app/data/base64.ts` : `blobToBase64(blob)` (encodage par tranches de 32 Kio via `String.fromCharCode` + `btoa`) et `base64ToBlob(data, mimeType, expectedSize?)` (lève une erreur si `atob` échoue ou si la taille décodée diffère)
- [x] 1.2 Tests Vitest de `base64.ts` : aller-retour sur un Blob binaire de plusieurs Mo, chaîne invalide, taille incohérente
- [x] 1.3 Extraire la validation structurelle de `TemplateService.validateTemplate` en fonction pure `validateTemplateStructure` partagée (dans `src/app/data/`), et faire déléguer `TemplateService` à cette fonction
- [x] 1.4 Définir dans `src/app/models/checklist.model.ts` (ou le module d'échange) les types `SessionExchangeFile`, `ExchangeEvidence`, `ImportConflictMode = 'new' | 'replace' | 'copy'`
- [x] 1.5 Ajouter un helper `newEvidenceId(itemId)` dans `evidence.service.ts` et l'utiliser dans `addEvidence`
- [x] 1.6 Créer un helper `downloadBlob(blob, filename)` et remplacer les téléchargements par lien temporaire de `export.service.ts` et `templates-list.component.ts`

## 2. Module d'échange de session (`src/app/domain/session-exchange.ts`)

- [x] 2.1 `buildExchangeHeader(session, metrics, now)` : enveloppe `format`, `formatVersion: 1`, `exportedAt`, `session`, `summary` (nom et version du modèle, métriques)
- [x] 2.2 `toExchangeEvidenceMeta(record)` pour l'aperçu (métadonnées, contenu non affiché)
- [x] 2.3 `parseExchangeFile(raw, templatesById, now)` : détection enveloppe / ancien brouillon / fichier de template / inconnu, refus d'un `formatVersion` absent ou supérieur à 1, nettoyage des champs d'enrichissement d'un ancien brouillon, `migrateSessionV3`, validation (`id`, `title`, `answers`, `contextValues`, copie figée via `validateTemplateStructure` sauf `structureUnavailable`)
- [x] 2.4 Dans `parseExchangeFile` : décodage des preuves via `base64ToBlob`, contrôle de la limite de 50 Mo, mise à l'écart des preuves d'items absents de la copie figée (`droppedEvidenceCount`), message d'erreur nommant une preuve corrompue
- [x] 2.5 `asImportedCopy(session, newId)` : nouvel UUID, suffixe « (import) » non répété
- [x] 2.6 Tests Vitest : aller-retour build → parse (avec et sans preuves, `evidences` absent vs vide), session terminée avec clôtures, ancien brouillon avec template présent / absent de la bibliothèque, copie figée à l'ancien format (`mode`, `color`), fichier de template refusé, version de format future refusée, preuve corrompue, preuve d'item inconnu écartée, suffixe de copie

## 3. Export du fichier d'échange

- [x] 3.1 `EvidenceService.getSessionEvidences(sessionId)` (liste complète des preuves d'une session)
- [x] 3.2 `ExportService.getExchangePreview()` remplaçant `getJsonDraft()` : en-tête + métadonnées des preuves, formaté pour l'aperçu
- [x] 3.3 `ExportService.exportSessionFile(includeEvidence)` (async) : assemblage du JSON en `Blob` par morceaux (en-tête puis une preuve encodée à la fois), téléchargement via `downloadBlob`
- [x] 3.4 `json-draft-modal` : entrées `evidenceCount` / `evidenceTotalSize`, case « Inclure les pièces jointes » décochée par défaut (désactivée avec « Aucune pièce jointe » si 0), sortie `exportFile` portant `{ includeEvidence }`
- [x] 3.5 Runner : charger la liste des preuves à l'ouverture de la fenêtre et brancher la nouvelle sortie
- [x] 3.6 Mettre à jour `export.service.spec.ts` (le test du brouillon enrichi devient un test du fichier d'échange)

## 4. Import de session

- [x] 4.1 `ChecklistSessionService.importSession(parsed, mode)` : `flushPendingSave`, transaction `rw` sessions + évidences selon le mode (`new`/`copy` : insertion ; `replace` avec preuves : purge puis insertion ; `replace` sans preuves : conservation sauf items absents), nouveaux identifiants de preuve, `updatedAt` = maintenant, `upsertInList`, rechargement de la session courante si remplacée
- [x] 4.2 Tests Vitest de `importSession` avec `fake-indexeddb` : les trois modes, atomicité (aucune écriture si une insertion échoue), conservation/purge des preuves en remplacement sans pièces jointes
- [x] 4.3 Dashboard : bouton « Importer une session » (`input type="file" accept=".json"` masqué), lecture du fichier, `parseExchangeFile` avec la carte des templates de la bibliothèque, détection de conflit, enchaînement des deux `confirm()` (D4), message de succès (mentionnant les preuves écartées le cas échéant) ou d'erreur, réinitialisation de l'input
- [x] 4.4 Vérifier qu'une session terminée importée s'ouvre en lecture seule et qu'une session dont le template existe dans la bibliothèque affiche le badge « Modèle mis à jour » si celui-ci est plus récent

## 5. Conflits à l'import de template

- [x] 5.1 `TemplateService.parseTemplateFile(json)` (parse + `normalizeTemplate` + validation) et `importTemplate(template, mode)` (`replace` : `updatedAt` = maintenant ; `copy` : identifiant `<id>-import-<6 car.>` et nom suffixé « (import) »)
- [x] 5.2 `templates-list` : parse → détection via `findTemplate` → double `confirm()` → import ; annulation sans écriture
- [x] 5.3 Tests Vitest du `TemplateService` : import sans conflit, remplacement, copie (nouvel id, nom suffixé, original intact), fichier invalide

## 6. Rapports Excel et PDF génériques

- [x] 6.1 Créer `src/app/domain/report.ts` : `reportHeaderFields(session)` (modèle, version, statut, date de dernière clôture, champs de `contextSchema` avec libellé d'option et date `jj/mm/aaaa` sans passer par `Date`, « Non renseigné »), `itemStateText(item, answer)` (libellé du choix avec repli sur la valeur brute), `itemObservations(item, answer)` (libellé du champ additionnel)
- [x] 6.2 Tests Vitest de `report.ts` : template sans champ `version`/`mode`, liste de choix, date, champ vide, session terminée puis rouverte puis terminée (dernière clôture), choix par identifiant et par ancien libellé
- [x] 6.3 `exportExcel()` : cartouche en paires libellé/valeur issu de `reportHeaderFields`, colonnes d'état et d'observations issues du module de rapport
- [x] 6.4 `exportPdf()` : cartouche à deux colonnes de hauteur calculée, `startY` dynamique du tableau, textes d'état et d'observations issus du module de rapport

## 7. Annexe des preuves du PDF

- [x] 7.1 Rendre `exportPdf()` asynchrone (et adapter l'appel depuis le runner / `audit-summary`)
- [x] 7.2 Générer une miniature JPEG par image (`createImageBitmap` → canvas réduit → `toDataURL('image/jpeg', 0.8)`), avec repli en « fichier » si le décodage échoue, et `close()` des bitmaps
- [x] 7.3 Mettre en page l'annexe : nouvelle page, intertitre « Section — Item » par item applicable ayant des preuves, grille de 3 miniatures avec nom, lignes « nom — type — taille » pour les autres fichiers, saut de page manuel ; pas d'annexe sans preuve
- [x] 7.4 Vérifier manuellement dans l'application : PDF d'une session avec PNG, JPEG, WebP, un `.log` et une image corrompue

## 8. Finitions

- [x] 8.1 Vérifier dans l'application l'aller-retour complet : export avec pièces jointes → suppression de la session → import → session identique (réponses, statut, clôtures, preuves visibles) ; puis import en copie et en remplacement
- [x] 8.2 Vérifier l'import d'un brouillon JSON exporté avant ce change
- [x] 8.3 `pnpm test` et `pnpm build` sans erreur ni `any` introduit
- [x] 8.4 Mettre à jour le README (échange de sessions et de templates par fichier, option pièces jointes, règles de conflit)
