## Context

Application Angular 22 locale, mono-utilisateur, sans backend : les données vivent dans IndexedDB via Dexie (ADR 0001), une session par UUID (ADR 0002). Depuis le change `session-integrity` (ADR 0003), chaque session embarque sa copie figée `templateSnapshot`, un statut `in_progress` / `completed` et un historique `closures` ; les anciens formats sont convertis par `normalizeTemplate` et `migrateSessionV3` (`src/app/data/migrations.ts`), fonctions pures.

État actuel :
- `ExportService.getJsonDraft()` produit un **rapport enrichi** (métriques, `details`, réponses augmentées de `label`, `sectionTitle`, `evidenceCount`) : ni copie figée, ni statut, ni clôtures, ni preuves. Il est affiché dans `json-draft-modal` puis téléchargé ; **aucun import de session n'existe** malgré l'exigence de la spec `audit-persistence-export`.
- `exportExcel()` / `exportPdf()` lisent en dur `contextValues['version' | 'mode' | 'responsible' | 'date']`, affichent l'identifiant des choix personnalisés au lieu du libellé et les clés techniques des champs additionnels.
- `TemplateService.importTemplate()` fait un `put` : un template de même identifiant est **écrasé sans avertissement**.
- Les preuves (`EvidenceRecord`) sont des `Blob` dans la table `evidences`, indexée par `sessionId` ; limite de 50 Mo par preuve.

Contraintes : pnpm, composants standalone, `@if/@for`, typage strict sans `any`, trois fichiers par composant, artefacts en français, **aucune nouvelle dépendance**, `confirm()` / `alert()` natifs tolérés jusqu'au change `ui-dialogs-and-undo`.

## Goals / Non-Goals

**Goals:**
- Un fichier JSON unique, versionné, qui restitue une session à l'identique après un aller-retour export → import, preuves comprises si demandé.
- Un import tolérant aux anciens fichiers (brouillons JSON d'avant ce change, copies figées à l'ancien format) grâce aux fonctions de normalisation existantes.
- Une règle de conflit d'identifiant unique et explicite, appliquée aux sessions et aux templates.
- Des rapports Excel/PDF justes pour n'importe quel template, avec statut, clôture, version du modèle et annexe des preuves (PDF).
- Toute la logique de format (construction, lecture, renommage, lignes de rapport) dans des modules purs testés par Vitest.

**Non-Goals:**
- Dialogues personnalisés et annulation (`ui-dialogs-and-undo`) : on enchaîne deux `confirm()`.
- Export ou import groupé de plusieurs sessions, archive ZIP, chiffrement du fichier.
- Preuves dans l'export Excel (le tableur ne s'y prête pas ; l'annexe PDF couvre le besoin).
- Ajout automatique du template d'origine dans la bibliothèque lors d'un import de session (la session est autoportante, ADR 0003).
- Export d'une session directement depuis la carte du dashboard (l'export reste dans le runner).

## Decisions

### D1 — Enveloppe versionnée plutôt que session « nue »

Le fichier exporté a la forme :

```ts
interface SessionExchangeFile {
  format: 'checklist-session';     // identifie le type de fichier
  formatVersion: 1;                // incrémenté à chaque évolution incompatible
  exportedAt: string;              // ISO
  session: ChecklistSession;       // tel que stocké, copie figée comprise
  summary: {                       // lisible par un humain ou un outil, ignoré à l'import
    templateName: string; templateVersion: string;
    metrics: MetricsSummary;
  };
  evidences?: ExchangeEvidence[];  // absent = non incluses ; [] = incluses, aucune
}

interface ExchangeEvidence {
  itemId: string; name: string; type: EvidenceRecord['type'];
  mimeType: string; size: number; createdAt: string;
  data: string;                    // base64 pur (sans préfixe data:)
}
```

Pourquoi : `format` permet de refuser proprement un fichier de template ou un JSON quelconque déposé par erreur ; `formatVersion` permet à un futur import de savoir quelle conversion appliquer (même logique que les versions Dexie). L'identifiant de preuve n'est **pas** exporté : il est régénéré à l'import (D5), ce qui évite toute collision avec une preuve d'une autre session.

Le bloc `summary` remplace l'ancien rapport enrichi pour qui voudrait lire le fichier à l'œil nu ; il est recalculable, donc jamais relu à l'import (une seule source de vérité : `session`).

Alternative écartée : exporter `ChecklistSession` directement à la racine. Plus simple, mais indiscernable d'un ancien brouillon et sans point d'ancrage pour versionner le format.

### D2 — Preuves en base64 dans le même fichier, sans jszip

Choix : base64 dans le JSON, sur option (case décochée par défaut).

- **Encodage** : `blob.arrayBuffer()` → `Uint8Array` → conversion par tranches de 32 Kio via `String.fromCharCode` puis `btoa`. Subtilité : appeler `String.fromCharCode(...bytes)` sur un tableau de plusieurs Mo dépasse la taille maximale de la pile d'appels (chaque octet devient un argument) ; d'où le découpage en tranches. Cette méthode fonctionne à l'identique dans le navigateur et sous Vitest (Node), contrairement à `FileReader.readAsDataURL`.
- **Décodage** : `atob(data)` → `Uint8Array` → `new Blob([bytes], { type: mimeType })`. Un `atob` qui lève une exception (caractères invalides) ou une taille décodée différente de `size` rend la preuve « corrompue » et fait échouer tout l'import.
- **Assemblage** : le fichier est produit comme un `Blob` composé de morceaux (`new Blob([début, preuve1, ',', preuve2, ..., fin])`) plutôt que par un unique `JSON.stringify` de l'enveloppe complète, pour ne pas construire en mémoire une seconde chaîne géante. Le résultat reste un JSON valide.
- Helpers dans `src/app/data/base64.ts` (purs, testés).

Pourquoi pas jszip : nouvelle dépendance (~100 Ko), format binaire illisible, et la limite pratique (quelques dizaines de Mo de preuves) est acceptable pour un usage d'audit sur poste de bureau. Pourquoi pas des fichiers séparés : la page ne peut ni produire ni relire un dossier sans l'API File System Access, et deux fichiers à garder ensemble sont une source d'erreurs.

### D3 — Module pur `src/app/domain/session-exchange.ts`

Fonctions sans Angular ni Dexie :

- `buildExchangeHeader(session, metrics, now)` : enveloppe sans les preuves (pour l'aperçu et pour l'assemblage D2).
- `toExchangeEvidenceMeta(record)` : métadonnées d'une preuve (l'aperçu affiche `data: "<n Ko non affichés>"`).
- `parseExchangeFile(raw: unknown, templatesById, now): ParsedSessionImport` qui renvoie `{ session, evidences?: ImportedEvidence[], droppedEvidenceCount }` ou lève une `Error` au message en français :
  - **Détection du format** : si `raw.format === 'checklist-session'` → enveloppe (refus si `formatVersion` > 1 ou absent) ; sinon, si l'objet porte `id`, `templateId` et `answers` → **ancien brouillon** traité comme une session v2 ; sinon refus (« Ce fichier n'est pas une session de checklist »). Un fichier de template (`sections` à la racine, pas d'`answers`) est donc refusé avec un message dédié suggérant la page Modèles.
  - **Normalisation** : `migrateSessionV3(rawSession, templatesById, now)` — qui appelle déjà `normalizeTemplate` sur une copie figée présente, ou reprend le template de la bibliothèque, ou produit une structure vide `structureUnavailable`. Pour un ancien brouillon, les champs d'enrichissement sont retirés au préalable : réponses réduites aux clés de `ItemAnswer` (`status`, `checked`, `checkedAt`, `selectedChoice`, `comment`, `extra`), racine débarrassée de `details`, `metrics`, `templateName`.
  - **Validation** : `id`, `title` chaînes non vides ; `answers` et `contextValues` objets ; copie figée validée par la même règle structurelle que les templates (D6), sauf si `structureUnavailable`.
  - **Preuves** : décodées (D2). Une preuve dont l'`itemId` n'existe pas dans la copie figée est écartée et comptée dans `droppedEvidenceCount` (signalé dans le message de succès) plutôt que de bloquer l'import : elle serait de toute façon invisible.
- `asImportedCopy(session, newId)` : nouvel UUID, titre suffixé de « (import) » (suffixe non répété s'il est déjà présent). Le statut, les clôtures et les réponses sont conservés.

### D4 — Résolution de conflit par deux `confirm()` successifs

Règle commune aux sessions et aux templates, pilotée par le composant (dashboard ou page Modèles) :

1. Le fichier est lu et entièrement analysé (`parseExchangeFile` / `parseTemplateFile`) **avant** toute question : un fichier invalide est refusé sans dialogue.
2. Si l'identifiant n'existe pas → import direct (`mode: 'new'`).
3. Sinon : `confirm('Une session « <titre existant> » porte déjà cet identifiant. OK : la remplacer. Annuler : voir les autres options.')` → OK = `'replace'` ; sinon `confirm('Importer le fichier comme une copie (nouvel identifiant, titre suffixé « (import) ») ?')` → OK = `'copy'`, Annuler = abandon sans écriture.

Le type `ImportConflictMode = 'new' | 'replace' | 'copy'` est partagé. Les services reçoivent le mode décidé et n'interagissent jamais avec l'utilisateur : quand `ui-dialogs-and-undo` remplacera `confirm()` par une modale à trois boutons, seuls les composants changeront.

Alternative écartée : une modale dédiée dès maintenant — elle serait jetée au change 3, qui introduit un service de dialogue générique.

### D5 — Import de session transactionnel dans `ChecklistSessionService`

`importSession(parsed, mode)` :
- `flushPendingSave()` d'abord (cohérence avec les autres écritures).
- Une transaction Dexie `rw` sur `sessions` + `evidences` : soit tout est écrit, soit rien.
  - `new` / `copy` : `put` de la session, insertion des preuves décodées.
  - `replace` avec bloc de preuves : suppression de toutes les preuves de la session, puis insertion de celles du fichier.
  - `replace` **sans** bloc de preuves : les preuves locales sont conservées (l'utilisateur a pu exporter sans pièces jointes pour alléger le fichier), sauf celles dont l'item n'existe plus dans la copie figée importée — même purge que `applyTemplateUpdate`.
- Chaque preuve reçoit un **nouvel identifiant** (même schéma que `EvidenceService.addEvidence`, extrait en helper `newEvidenceId(itemId)`) et le `sessionId` final.
- `createdAt` du fichier conservé ; `updatedAt` fixé à maintenant pour que la session importée apparaisse en tête du dashboard (trié par `updatedAt`).
- Mise à jour de `allSessions` via `upsertInList` ; si la session remplacée est la session courante, `currentSession` est rechargée.

La limite de 50 Mo par preuve est revérifiée à l'import (un fichier peut avoir été modifié à la main).

### D6 — Import de template : parsing séparé de l'écriture

`TemplateService` est découpé :
- `parseTemplateFile(json: string): ChecklistTemplate` : `JSON.parse`, `normalizeTemplate`, validation. La validation structurelle (`validateTemplate`) est extraite en fonction pure `validateTemplateStructure` dans `src/app/data/migrations.ts` (ou un module voisin) pour être partagée avec `parseExchangeFile`.
- `importTemplate(template, mode)` : `replace` → `put` avec `updatedAt` = maintenant (déclenche le badge « Modèle mis à jour » sur les sessions en cours, comportement voulu par `session-integrity`) ; `copy` → identifiant `<id d'origine>-import-<6 caractères aléatoires>` (lisible dans le nom du fichier exporté `template-<id>.json`, contrairement à un UUID), nom suffixé « (import) ».
- `templates-list` enchaîne parse → détection via `findTemplate(id)` → D4 → `importTemplate`.

### D7 — Rapports génériques via un module pur `src/app/domain/report.ts`

- `reportHeaderFields(session): { label: string; value: string }[]` dans cet ordre : Modèle, Version du modèle, Statut (« En cours » / « Terminée »), Clôturée le (si terminée : `closedAt` de la dernière entrée de `closures`, date et heure françaises), puis un champ par entrée de `templateSnapshot.contextSchema` (libellé du schéma ; pour `select`, libellé de l'option ; pour `date`, format `jj/mm/aaaa` ; valeur vide → « Non renseigné »).
  - Subtilité date : `new Date('2026-10-14')` est interprété en **UTC minuit**, donc affiché la veille dans un fuseau négatif. On découpe la chaîne `aaaa-mm-jj` au lieu de passer par `Date`.
- `itemStateText(item, answer)` : statut / « FAIT » (avec horodatage) / libellé du choix retrouvé dans `customChoices` par identifiant, avec repli sur la valeur brute (d'anciennes réponses stockaient le libellé).
- `itemObservations(item, answer)` : commentaire + champ additionnel préfixé de son **libellé** (`extraField.label`) et non de sa clé.
- Excel : cartouche en paires `libellé | valeur` sur deux colonnes, nombre de lignes variable. PDF : cartouche à deux colonnes dont la hauteur est calculée à partir du nombre de champs ; le tableau démarre sous le cartouche (`startY` dynamique) au lieu de la valeur fixe 62 mm.

### D8 — Annexe des preuves dans le PDF

`exportPdf()` devient `async`. Après le tableau, si la session a des preuves : nouvelle page « Annexe — Preuves », puis pour chaque item applicable (ordre de la checklist) ayant des preuves, un intertitre « Section — Libellé de l'item » :
- **Images** : décodage via `createImageBitmap(blob)`, réduction sur un `<canvas>` (côté max ~600 px) puis `canvas.toDataURL('image/jpeg', 0.8)` et `doc.addImage(...)` en grille de miniatures (3 par ligne, ~55 mm de large, ratio conservé, nom sous l'image). Passer par le canvas a deux avantages : jsPDF ne gère nativement que JPEG/PNG (le canvas convertit aussi WebP, GIF, BMP...) et la réduction évite un PDF de plusieurs dizaines de Mo avec des captures d'écran pleine résolution.
- **Échec de décodage** (format non supporté, fichier corrompu) : la preuve est listée comme un fichier.
- **Autres fichiers** : ligne « nom — type — taille ».
- Gestion manuelle du saut de page en suivant la position verticale courante.

Les preuves d'items non applicables ne figurent pas dans l'annexe, par cohérence avec le tableau des contrôles. Ce code dépend du DOM (canvas) et n'est pas testé unitairement ; la mise en page repose sur des fonctions de calcul simples.

### D9 — Fenêtre d'export JSON

`json-draft-modal` reçoit `evidenceCount` et `evidenceTotalSize` en entrées et émet `exportFile` avec `{ includeEvidence: boolean }`. L'aperçu affiche l'en-tête D3 (preuves en métadonnées seules) : afficher plusieurs Mo de base64 dans un `<pre>` bloquerait l'interface. Le runner charge la liste des preuves de la session (`EvidenceService.getSessionEvidences(sessionId)`) à l'ouverture de la fenêtre. Un helper `downloadBlob(blob, filename)` remplace les trois implémentations actuelles du téléchargement par lien temporaire.

## Risks / Trade-offs

- [Fichiers volumineux : base64 ajoute ~33 % et l'import doit lire tout le fichier en mémoire (`file.text()` puis `JSON.parse`)] → case décochée par défaut, taille totale affichée avant export, assemblage par morceaux à l'export ; au-delà de quelques centaines de Mo le navigateur peut échouer, ce qui est hors de l'usage visé (le message d'erreur est alors affiché).
- [Fichier modifié ou malveillant] → validation complète avant écriture, transaction, contrôle de taille des preuves ; les données importées sont affichées via l'interpolation Angular (échappement automatique) et les images via `<img>` (un SVG n'y exécute pas de script).
- [Ergonomie des deux `confirm()` successifs] → libellés explicites ; remplacés par une vraie modale au change `ui-dialogs-and-undo`.
- [Remplacement sans pièces jointes qui conserve les preuves locales] → comportement documenté dans la spec ; c'est le cas d'usage « je renvoie une version allégée ».
- [Rupture du format du fichier JSON exporté] → l'ancien brouillon reste importable ; le bloc `summary` couvre le besoin de lecture humaine, et les rapports Excel/PDF restent les formats de restitution.
- [PDF lourd ou lent avec beaucoup d'images] → miniatures réduites en JPEG ; génération séquentielle avec libération des `ImageBitmap` (`close()`).
- [Compatibilité future] → tout nouveau `formatVersion` devra rester lisible par l'import (engagement porté par l'ADR 0004).

## Migration Plan

- Aucune migration Dexie : seul le format des fichiers change.
- Déploiement par simple mise à jour de l'application. Retour arrière : revenir à la version précédente ; les fichiers au format v1 ne seraient alors plus importables (l'ancienne version n'a pas d'import), sans impact sur les données en base.

## Open Questions

- Aucune question bloquante. Pistes notées pour plus tard : bouton d'export directement sur la carte du dashboard, export groupé de plusieurs sessions, utilisation de `Uint8Array.prototype.toBase64()` / `fromBase64()` lorsque le support navigateur sera généralisé (supprimerait le découpage par tranches).
- Les ADR en vigueur (0001, 0002, 0003) restent valides ; aucune révision proposée.
