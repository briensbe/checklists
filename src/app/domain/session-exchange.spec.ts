import {
  asImportedCopy,
  buildExchangeHeader,
  exchangeFileParts,
  parseExchangeFile,
  toExchangeEvidence,
  toExchangeEvidenceMeta,
  withImportSuffix
} from './session-exchange';
import { computeMetrics } from './session-rules';
import { blobToBase64 } from '../data/base64';
import { UNAVAILABLE_TEMPLATE_NAME } from '../data/migrations';
import { ChecklistSession, ChecklistTemplate, EvidenceRecord, SessionExchangeFile } from '../models/checklist.model';

const NOW = '2026-10-14T10:00:00.000Z';

const TEMPLATE: ChecklistTemplate = {
  id: 'tpl',
  name: 'Audit',
  description: '',
  version: '2.1',
  updatedAt: '2026-10-01T00:00:00.000Z',
  contextSchema: [{ id: 'owner', label: 'Responsable', type: 'text' }],
  sections: [{ id: 's1', title: 'Section', items: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }]
};

function session(overrides: Partial<ChecklistSession> = {}): ChecklistSession {
  return {
    id: 'sess-1',
    title: 'Audit 1.3',
    templateId: 'tpl',
    templateSnapshot: structuredClone(TEMPLATE),
    status: 'completed',
    closures: [{ closedAt: '2026-10-10T08:00:00.000Z', reopenedAt: '2026-10-11T08:00:00.000Z' }, { closedAt: '2026-10-12T08:00:00.000Z' }],
    contextValues: { owner: 'Benoît' },
    answers: { a: { status: 'OK', comment: '' }, b: { status: 'KO', comment: 'cassé' } },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-12T08:00:00.000Z',
    ...overrides
  };
}

function evidence(itemId: string, content: string, name = 'capture.png'): EvidenceRecord {
  const blob = new Blob([content], { type: 'image/png' });
  return {
    id: `${itemId}_1`,
    sessionId: 'sess-1',
    itemId,
    name,
    type: 'image',
    mimeType: 'image/png',
    size: blob.size,
    blob,
    createdAt: '2026-10-05T00:00:00.000Z'
  };
}

/** Reproduit l'export complet : en-tête + preuves encodées, assemblés en une chaîne. */
async function exportToText(s: ChecklistSession, evidences?: EvidenceRecord[]): Promise<string> {
  const header = buildExchangeHeader(s, computeMetrics(s), NOW);
  const evidenceJson = evidences
    ? await Promise.all(evidences.map(async e => JSON.stringify(toExchangeEvidence(e, await blobToBase64(e.blob)))))
    : undefined;
  return exchangeFileParts(header, evidenceJson).join('');
}

const NO_TEMPLATES = new Map<string, ChecklistTemplate>();

describe('session-exchange', () => {
  describe('export puis import (aller-retour)', () => {
    it('restitue une session terminée à l’identique, sans bloc de preuves si non incluses', async () => {
      const original = session();
      const text = await exportToText(original);
      const file = JSON.parse(text) as SessionExchangeFile;

      expect(file.format).toBe('checklist-session');
      expect(file.formatVersion).toBe(1);
      expect(file.summary.templateVersion).toBe('2.1');
      expect('evidences' in file).toBe(false);

      const parsed = parseExchangeFile(file, NO_TEMPLATES, NOW);
      expect(parsed.session).toEqual(original);
      expect(parsed.evidences).toBeUndefined();
    });

    it('restitue les preuves embarquées en base64', async () => {
      const text = await exportToText(session(), [evidence('a', 'image-a'), evidence('b', 'image-b', 'b.png')]);
      const parsed = parseExchangeFile(JSON.parse(text), NO_TEMPLATES, NOW);

      expect(parsed.evidences).toHaveLength(2);
      const first = parsed.evidences![0];
      expect(first.itemId).toBe('a');
      expect(first.name).toBe('capture.png');
      expect(first.blob.type).toBe('image/png');
      expect(await first.blob.text()).toBe('image-a');
    });

    it('distingue « pièces jointes incluses mais aucune » de « non incluses »', async () => {
      const file = JSON.parse(await exportToText(session(), [])) as SessionExchangeFile;
      expect(file.evidences).toEqual([]);
      expect(parseExchangeFile(file, NO_TEMPLATES, NOW).evidences).toEqual([]);
    });
  });

  it('montre les preuves en métadonnées seules dans l’aperçu', () => {
    const meta = toExchangeEvidenceMeta(evidence('a', 'x'.repeat(2048)));
    expect(meta.data).toBe('<contenu non affiché : 2.0 Ko>');
  });

  describe('anciens formats', () => {
    const legacyDraft = {
      id: 'sess-old',
      title: 'Ancien brouillon',
      templateId: 'tpl',
      templateName: 'Audit',
      contextValues: { owner: 'Benoît' },
      metrics: { total: 2 },
      details: [{ itemId: 'a' }],
      answers: { a: { status: 'OK', comment: '', label: 'A', sectionTitle: 'Section', evidenceCount: 3 } },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z'
    };

    it('reconstruit un ancien brouillon à partir du template de la bibliothèque', () => {
      const { session: s } = parseExchangeFile(legacyDraft, new Map([['tpl', TEMPLATE]]), NOW);
      expect(s.templateSnapshot).toEqual(TEMPLATE);
      expect(s.status).toBe('in_progress');
      expect(s.closures).toEqual([]);
      expect(s.answers).toEqual({ a: { status: 'OK', comment: '' } });
      expect(s).not.toHaveProperty('details');
      expect(s).not.toHaveProperty('templateName');
    });

    it('marque « structure indisponible » un brouillon dont le template est absent', () => {
      const { session: s } = parseExchangeFile(legacyDraft, NO_TEMPLATES, NOW);
      expect(s.structureUnavailable).toBe(true);
      expect(s.templateSnapshot.name).toBe(UNAVAILABLE_TEMPLATE_NAME);
    });

    it('convertit une copie figée à l’ancien format (mode, color)', async () => {
      const file = JSON.parse(await exportToText(session())) as SessionExchangeFile;
      const legacySnapshot = {
        ...TEMPLATE,
        sections: [
          {
            id: 's1',
            title: 'Section',
            items: [
              { id: 'a', label: 'A', mode: 'patch' },
              { id: 'b', label: 'B', controlType: 'choice', customChoices: [{ id: 'c1', label: 'Vert', color: 'green' }] }
            ]
          }
        ]
      };
      (file.session as unknown as Record<string, unknown>)['templateSnapshot'] = legacySnapshot;

      const { session: s } = parseExchangeFile(file, NO_TEMPLATES, NOW);
      const [a, b] = s.templateSnapshot.sections[0].items;
      expect(a.visibleIf).toEqual({ fieldId: 'mode', equals: ['patch'] });
      expect(a).not.toHaveProperty('mode');
      expect(b.customChoices).toEqual([{ id: 'c1', label: 'Vert', tone: 'success' }]);
    });
  });

  describe('refus', () => {
    it('refuse un fichier de template', () => {
      expect(() => parseExchangeFile(TEMPLATE, NO_TEMPLATES, NOW)).toThrow('modèle de checklist');
    });

    it('refuse un JSON quelconque', () => {
      expect(() => parseExchangeFile({ foo: 1 }, NO_TEMPLATES, NOW)).toThrow('pas une session');
      expect(() => parseExchangeFile([1, 2], NO_TEMPLATES, NOW)).toThrow('pas une session');
    });

    it('refuse une version de format future ou absente', async () => {
      const file = JSON.parse(await exportToText(session())) as Record<string, unknown>;
      expect(() => parseExchangeFile({ ...file, formatVersion: 2 }, NO_TEMPLATES, NOW)).toThrow('version plus récente');
      expect(() => parseExchangeFile({ ...file, formatVersion: undefined }, NO_TEMPLATES, NOW)).toThrow('absente ou invalide');
    });

    it('refuse un format inconnu', () => {
      expect(() => parseExchangeFile({ format: 'autre-chose' }, NO_TEMPLATES, NOW)).toThrow('Format de fichier inconnu');
    });

    it('refuse une session sans identifiant', async () => {
      const file = JSON.parse(await exportToText(session())) as SessionExchangeFile;
      (file.session as unknown as Record<string, unknown>)['id'] = '';
      expect(() => parseExchangeFile(file, NO_TEMPLATES, NOW)).toThrow('identifiant manquant');
    });

    it('refuse une pièce jointe corrompue en la nommant', async () => {
      const file = JSON.parse(await exportToText(session(), [evidence('a', 'image-a', 'preuve.png')])) as SessionExchangeFile;
      file.evidences![0].data = '%%%';
      expect(() => parseExchangeFile(file, NO_TEMPLATES, NOW)).toThrow('« preuve.png » corrompue');
    });

    it('refuse une pièce jointe dépassant 50 Mo', async () => {
      const file = JSON.parse(await exportToText(session(), [evidence('a', 'x')])) as SessionExchangeFile;
      file.evidences![0].size = 60 * 1024 * 1024;
      expect(() => parseExchangeFile(file, NO_TEMPLATES, NOW)).toThrow('limite de 50 Mo');
    });
  });

  it('écarte et compte les preuves d’items absents de la copie figée', async () => {
    const text = await exportToText(session(), [evidence('a', 'ok'), evidence('fantome', 'perdu')]);
    const parsed = parseExchangeFile(JSON.parse(text), NO_TEMPLATES, NOW);
    expect(parsed.evidences!.map(e => e.itemId)).toEqual(['a']);
    expect(parsed.droppedEvidenceCount).toBe(1);
  });

  describe('copie', () => {
    it('attribue un nouvel identifiant et suffixe le titre en conservant le reste', () => {
      const original = session();
      const copy = asImportedCopy(original, 'new-id');
      expect(copy.id).toBe('new-id');
      expect(copy.title).toBe('Audit 1.3 (import)');
      expect(copy.status).toBe('completed');
      expect(copy.answers).toEqual(original.answers);
    });

    it('ne répète pas le suffixe', () => {
      expect(withImportSuffix('Audit (import)')).toBe('Audit (import)');
    });
  });
});
