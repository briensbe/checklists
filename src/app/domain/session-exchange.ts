import {
  ChecklistSession,
  ChecklistTemplate,
  EvidenceRecord,
  ExchangeEvidence,
  ItemAnswer,
  MAX_EVIDENCE_SIZE,
  MetricsSummary,
  SESSION_EXCHANGE_FORMAT,
  SESSION_EXCHANGE_FORMAT_VERSION,
  SessionExchangeFile
} from '../models/checklist.model';
import { migrateSessionV3 } from '../data/migrations';
import { validateTemplateStructure } from '../data/template-validation';
import { base64ToBlob } from '../data/base64';

/**
 * Fichier d'échange de session (ADR 0004), sous forme de fonctions pures.
 *
 * Construction de l'enveloppe à l'export, lecture tolérante aux anciens formats
 * à l'import, renommage des copies. Aucune dépendance Angular ni Dexie : les
 * écritures en base et les dialogues restent dans les services et composants.
 */

export const IMPORT_SUFFIX = ' (import)';

/** Ajoute « (import) » à un titre ou un nom, sans le répéter s'il est déjà présent. */
export function withImportSuffix(name: string): string {
  return name.endsWith(IMPORT_SUFFIX) ? name : `${name}${IMPORT_SUFFIX}`;
}

// --- Export ------------------------------------------------------------------

/** Enveloppe sans bloc de preuves (aperçu, et point de départ de l'assemblage). */
export function buildExchangeHeader(
  session: ChecklistSession,
  metrics: MetricsSummary,
  now: string = new Date().toISOString()
): SessionExchangeFile {
  return {
    format: SESSION_EXCHANGE_FORMAT,
    formatVersion: SESSION_EXCHANGE_FORMAT_VERSION,
    exportedAt: now,
    session,
    summary: {
      templateName: session.templateSnapshot.name,
      templateVersion: session.templateSnapshot.version,
      metrics
    }
  };
}

export function toExchangeEvidence(record: EvidenceRecord, data: string): ExchangeEvidence {
  return {
    itemId: record.itemId,
    name: record.name,
    type: record.type,
    mimeType: record.mimeType,
    size: record.size,
    createdAt: record.createdAt,
    data
  };
}

/** Preuve telle que montrée dans l'aperçu : métadonnées seules, contenu remplacé par un libellé. */
export function toExchangeEvidenceMeta(record: EvidenceRecord): ExchangeEvidence {
  return toExchangeEvidence(record, `<contenu non affiché : ${formatBytes(record.size)}>`);
}

/**
 * Morceaux du fichier final. Chaque preuve est sérialisée à part, si bien que le fichier
 * peut être assemblé en `Blob` sans construire une seconde chaîne géante contenant tout.
 * `evidenceJson` absent = bloc de preuves absent (« non incluses »).
 */
export function exchangeFileParts(header: SessionExchangeFile, evidenceJson?: string[]): string[] {
  const { evidences: _ignored, ...withoutEvidences } = header;
  const headerJson = JSON.stringify(withoutEvidences, null, 2);
  if (!evidenceJson) return [headerJson];

  // On retire l'accolade finale de l'en-tête pour y greffer le tableau des preuves.
  const parts: string[] = [headerJson.slice(0, headerJson.lastIndexOf('}')).trimEnd(), ',\n  "evidences": ['];
  evidenceJson.forEach((json, i) => parts.push(i === 0 ? '\n    ' : ',\n    ', json));
  parts.push(evidenceJson.length > 0 ? '\n  ]\n}' : ']\n}');
  return parts;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// --- Import ------------------------------------------------------------------

/** Preuve décodée, prête à être enregistrée (identifiant et session attribués par le service). */
export type ImportedEvidence = Omit<EvidenceRecord, 'id' | 'sessionId'>;

export interface ParsedSessionImport {
  session: ChecklistSession;
  /** Absent = le fichier n'embarquait pas les pièces jointes. */
  evidences?: ImportedEvidence[];
  /** Preuves écartées car rattachées à un item absent de la copie figée. */
  droppedEvidenceCount: number;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const EVIDENCE_TYPES: readonly EvidenceRecord['type'][] = ['image', 'file', 'log'];
const SESSION_STATUSES: readonly string[] = ['in_progress', 'completed'];

/**
 * Lit un fichier de session (déjà passé par `JSON.parse`) et renvoie une session au
 * format courant, ou lève une erreur au message destiné à l'utilisateur.
 *
 * Formats acceptés :
 * - enveloppe `checklist-session` de version ≤ à la version supportée ;
 * - ancien « brouillon JSON » (session à la racine, réponses enrichies, sans copie figée).
 */
export function parseExchangeFile(
  raw: unknown,
  templatesById: ReadonlyMap<string, ChecklistTemplate>,
  now: string = new Date().toISOString()
): ParsedSessionImport {
  if (!isObject(raw)) {
    throw new Error('Ce fichier n’est pas une session de checklist.');
  }

  let rawSession: unknown;
  let rawEvidences: unknown;

  if ('format' in raw) {
    if (raw['format'] !== SESSION_EXCHANGE_FORMAT) {
      throw new Error(`Format de fichier inconnu : « ${String(raw['format'])} ».`);
    }
    const version = raw['formatVersion'];
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      throw new Error('Version du format de fichier absente ou invalide.');
    }
    if (version > SESSION_EXCHANGE_FORMAT_VERSION) {
      throw new Error(
        `Ce fichier a été produit par une version plus récente de l’application (format ${version}, ` +
          `format supporté : ${SESSION_EXCHANGE_FORMAT_VERSION}).`
      );
    }
    rawSession = raw['session'];
    rawEvidences = raw['evidences'];
  } else if (Array.isArray(raw['sections']) && !('answers' in raw)) {
    throw new Error('Ce fichier est un modèle de checklist : importez-le depuis la page « Modèles ».');
  } else if (isNonEmptyString(raw['id']) && 'templateId' in raw && isObject(raw['answers'])) {
    rawSession = cleanLegacyDraft(raw);
  } else {
    throw new Error('Ce fichier n’est pas une session de checklist.');
  }

  const session = toSession(rawSession, templatesById, now);
  const result: ParsedSessionImport = { session, droppedEvidenceCount: 0 };

  if (rawEvidences !== undefined) {
    if (!Array.isArray(rawEvidences)) {
      throw new Error('Bloc de pièces jointes invalide.');
    }
    const knownItemIds = new Set(session.templateSnapshot.sections.flatMap(s => s.items.map(i => i.id)));
    result.evidences = [];
    for (const rawEvidence of rawEvidences) {
      const evidence = toEvidence(rawEvidence, now);
      if (!knownItemIds.has(evidence.itemId)) {
        result.droppedEvidenceCount++;
        continue;
      }
      result.evidences.push(decodeEvidence(evidence));
    }
  }
  return result;
}

/** Copie importée : nouvel identifiant, titre suffixé ; statut, clôtures et réponses conservés. */
export function asImportedCopy(session: ChecklistSession, newId: string): ChecklistSession {
  return { ...session, id: newId, title: withImportSuffix(session.title) };
}

/** Ancien brouillon : on ne garde que les champs de session et les clés réelles des réponses. */
function cleanLegacyDraft(raw: JsonObject): JsonObject {
  const answers: Record<string, ItemAnswer> = {};
  for (const [itemId, value] of Object.entries(raw['answers'] as JsonObject)) {
    if (!isObject(value)) continue;
    const answer: ItemAnswer = {
      status: (value['status'] as ItemAnswer['status']) ?? null,
      comment: typeof value['comment'] === 'string' ? value['comment'] : ''
    };
    if (typeof value['checked'] === 'boolean') answer.checked = value['checked'];
    if (typeof value['checkedAt'] === 'string') answer.checkedAt = value['checkedAt'];
    if (typeof value['selectedChoice'] === 'string') answer.selectedChoice = value['selectedChoice'];
    if (isObject(value['extra'])) answer.extra = value['extra'] as Record<string, string>;
    answers[itemId] = answer;
  }
  return {
    id: raw['id'],
    title: raw['title'],
    templateId: raw['templateId'],
    contextValues: raw['contextValues'] ?? {},
    answers,
    createdAt: raw['createdAt'],
    updatedAt: raw['updatedAt']
  };
}

function toSession(
  rawSession: unknown,
  templatesById: ReadonlyMap<string, ChecklistTemplate>,
  now: string
): ChecklistSession {
  if (!isObject(rawSession)) {
    throw new Error('Le fichier ne contient pas de session.');
  }
  if (!isNonEmptyString(rawSession['id'])) {
    throw new Error('Session invalide : identifiant manquant.');
  }
  if (!isNonEmptyString(rawSession['title'])) {
    throw new Error('Session invalide : titre manquant.');
  }
  if (typeof rawSession['templateId'] !== 'string') {
    throw new Error('Session invalide : référence de modèle manquante.');
  }
  if (!isObject(rawSession['answers']) || !isObject(rawSession['contextValues'])) {
    throw new Error('Session invalide : réponses ou valeurs de contexte manquantes.');
  }
  const status = rawSession['status'];
  if (status !== undefined && !SESSION_STATUSES.includes(status as string)) {
    throw new Error(`Session invalide : statut « ${String(status)} » inconnu.`);
  }
  if (rawSession['closures'] !== undefined && !Array.isArray(rawSession['closures'])) {
    throw new Error('Session invalide : historique des clôtures illisible.');
  }

  const session = migrateSessionV3(rawSession, templatesById, now);
  session.createdAt = isNonEmptyString(session.createdAt) ? session.createdAt : now;
  session.updatedAt = isNonEmptyString(session.updatedAt) ? session.updatedAt : now;

  if (!session.structureUnavailable) {
    try {
      validateTemplateStructure(session.templateSnapshot);
    } catch (err) {
      throw new Error(`Copie du modèle invalide : ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return session;
}

function toEvidence(raw: unknown, now: string): ExchangeEvidence {
  if (!isObject(raw) || !isNonEmptyString(raw['itemId']) || typeof raw['data'] !== 'string') {
    throw new Error('Pièce jointe invalide dans le fichier.');
  }
  const name = isNonEmptyString(raw['name']) ? raw['name'] : 'pièce jointe';
  const size = raw['size'];
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 0) {
    throw new Error(`Pièce jointe « ${name} » invalide : taille absente.`);
  }
  if (size > MAX_EVIDENCE_SIZE) {
    throw new Error(`La pièce jointe « ${name} » dépasse la limite de 50 Mo.`);
  }
  const type = EVIDENCE_TYPES.includes(raw['type'] as EvidenceRecord['type'])
    ? (raw['type'] as EvidenceRecord['type'])
    : 'file';
  return {
    itemId: raw['itemId'],
    name,
    type,
    mimeType: isNonEmptyString(raw['mimeType']) ? raw['mimeType'] : 'application/octet-stream',
    size,
    createdAt: isNonEmptyString(raw['createdAt']) ? raw['createdAt'] : now,
    data: raw['data']
  };
}

function decodeEvidence(evidence: ExchangeEvidence): ImportedEvidence {
  const { data, ...meta } = evidence;
  let blob: Blob;
  try {
    blob = base64ToBlob(data, evidence.mimeType, evidence.size);
  } catch (err) {
    throw new Error(`Pièce jointe « ${evidence.name} » corrompue : ${err instanceof Error ? err.message : String(err)}.`);
  }
  return { ...meta, blob };
}
