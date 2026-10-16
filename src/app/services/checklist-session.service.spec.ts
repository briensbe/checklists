import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { TestBed } from '@angular/core/testing';
import { ChecklistSessionService, SAVE_DEBOUNCE_MS } from './checklist-session.service';
import { TemplateService } from './template.service';
import { AppDatabaseService } from './app-database.service';
import { ChecklistSession, ChecklistTemplate, EvidenceRecord } from '../models/checklist.model';
import { ImportedEvidence, ParsedSessionImport } from '../domain/session-exchange';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const TEMPLATE: ChecklistTemplate = {
  id: 'tpl',
  name: 'Audit',
  description: '',
  version: '1',
  updatedAt: '2026-10-01T00:00:00.000Z',
  contextSchema: [{ id: 'owner', label: 'Responsable', type: 'text', required: true, defaultValue: 'Benoît' }],
  sections: [
    {
      id: 's1',
      title: 'Section',
      items: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' }
      ]
    }
  ]
};

describe('ChecklistSessionService', () => {
  let service: ChecklistSessionService;
  let templates: TemplateService;
  let db: AppDatabaseService;

  beforeEach(async () => {
    await Dexie.delete('ChecklistDatabase');
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChecklistSessionService);
    templates = TestBed.inject(TemplateService);
    db = TestBed.inject(AppDatabaseService);
    await db.templates.put(TEMPLATE);
    templates.availableTemplates.set([TEMPLATE]);
  });

  afterEach(async () => {
    vi.useRealTimers();
    db.close();
    await Dexie.delete('ChecklistDatabase');
  });

  it('crée une session avec copie figée, statut initial et contexte par défaut', async () => {
    const s = await service.createSession('tpl', 'Mon audit');
    expect(s.templateSnapshot).toEqual(TEMPLATE);
    expect(s.templateSnapshot).not.toBe(TEMPLATE);
    expect(s.status).toBe('in_progress');
    expect(s.closures).toEqual([]);
    expect(s.contextValues).toEqual({ owner: 'Benoît' });
    expect((await db.sessions.get(s.id))?.title).toBe('Mon audit');
  });

  it('reste autonome quand le template d’origine est modifié puis supprimé', async () => {
    const s = await service.createSession('tpl', 'Audit');
    await templates.saveTemplate({ ...TEMPLATE, sections: [] });
    expect(service.currentTemplate()?.sections.length).toBe(1);
    expect(service.currentHasTemplateUpdate()).toBe(true);

    await templates.deleteTemplate('tpl');
    await service.loadSession(s.id);
    expect(service.currentTemplate()?.name).toBe('Audit');
    expect(service.metrics().total).toBe(2);
    expect(service.currentHasTemplateUpdate()).toBe(false);
  });

  it('signale une session introuvable', async () => {
    await service.loadSession('inconnue');
    expect(service.loadState()).toBe('not-found');
    expect(service.currentSession()).toBeNull();
  });

  it('regroupe les saisies textuelles en une seule écriture après 400 ms', async () => {
    await service.createSession('tpl', 'Audit');
    const put = vi.spyOn(db.sessions, 'put');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    await service.updateAnswerComment('a', 'p');
    await service.updateAnswerComment('a', 'pr');
    await service.updateAnswerComment('a', 'pre');
    expect(service.currentSession()?.answers['a'].comment).toBe('pre');
    expect(put).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0].answers['a'].comment).toBe('pre');
  });

  it('écrit immédiatement une action discrète en absorbant la saisie en attente', async () => {
    const s = await service.createSession('tpl', 'Audit');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const put = vi.spyOn(db.sessions, 'put');

    await service.updateAnswerComment('a', 'note');
    await service.updateAnswerStatus('a', 'KO');
    expect(put).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(put).toHaveBeenCalledTimes(1);
    const stored = await db.sessions.get(s.id);
    expect(stored?.answers['a']).toMatchObject({ status: 'KO', comment: 'note' });
  });

  it('flushPendingSave exécute immédiatement l’écriture en attente', async () => {
    const s = await service.createSession('tpl', 'Audit');
    await service.updateContextValue('owner', 'Alice');
    expect((await db.sessions.get(s.id))?.contextValues['owner']).toBe('Benoît');
    await service.flushPendingSave();
    expect((await db.sessions.get(s.id))?.contextValues['owner']).toBe('Alice');
  });

  it('modifie le titre de la session en cours et ignore un titre vide', async () => {
    const s = await service.createSession('tpl', 'Titre initial');
    await service.updateTitle('   ');
    expect(service.currentSession()?.title).toBe('Titre initial');

    await service.updateTitle('Nouveau titre');
    expect(service.currentSession()?.title).toBe('Nouveau titre');
    await service.flushPendingSave();
    expect((await db.sessions.get(s.id))?.title).toBe('Nouveau titre');
  });

  it('met à jour la liste en mémoire sans relire la table', async () => {
    const first = await service.createSession('tpl', 'Première');
    await service.createSession('tpl', 'Seconde');
    const toArray = vi.spyOn(db.sessions, 'toArray');
    await service.loadSession(first.id);
    await service.updateAnswerStatus('a', 'OK');

    expect(toArray).not.toHaveBeenCalled();
    expect(service.allSessions().map(s => s.title)).toEqual(['Première', 'Seconde']);
  });

  it('refuse la clôture tant qu’il reste des anomalies, puis clôture', async () => {
    await service.createSession('tpl', 'Audit');
    await service.updateAnswerStatus('a', 'KO');

    const issues = await service.completeSession();
    expect(issues.map(i => i.kind)).toEqual(['ko-without-comment', 'unanswered']);
    expect(service.currentSession()?.status).toBe('in_progress');
    expect(service.issuesPanelOpen()).toBe(true);

    await service.updateAnswerComment('a', 'dérogation');
    await service.updateAnswerStatus('b', 'NA');
    expect(await service.completeSession()).toEqual([]);
    expect(service.currentSession()?.status).toBe('completed');
    expect(service.currentSession()?.closures.length).toBe(1);
    expect((await db.sessions.get(service.currentSession()!.id))?.status).toBe('completed');
  });

  it('ignore toute modification d’une session terminée (garde du service)', async () => {
    await service.createSession('tpl', 'Audit');
    await service.updateAnswerStatus('a', 'OK');
    await service.updateAnswerStatus('b', 'OK');
    await service.completeSession();
    const put = vi.spyOn(db.sessions, 'put');

    await service.updateAnswerStatus('a', 'KO');
    await service.updateAnswerComment('a', 'x');
    await service.markRemainingAsOk();
    await service.resetSession();
    await service.flushPendingSave();

    expect(put).not.toHaveBeenCalled();
    expect(service.currentSession()?.answers['a'].status).toBe('OK');
  });

  it('trace les clôtures successives et la réouverture', async () => {
    await service.createSession('tpl', 'Audit');
    await service.markRemainingAsOk();
    await service.completeSession();
    await service.reopenSession();
    expect(service.currentSession()?.status).toBe('in_progress');
    await service.completeSession();

    const closures = service.currentSession()!.closures;
    expect(closures.length).toBe(2);
    expect(closures[0].reopenedAt).toBeTruthy();
    expect(closures[1].reopenedAt).toBeUndefined();
  });

  it('applique une nouvelle version du template en purgeant les items supprimés et leurs preuves', async () => {
    const s = await service.createSession('tpl', 'Audit');
    await service.updateAnswerStatus('a', 'OK');
    await service.updateAnswerStatus('b', 'KO');
    await db.evidences.put({
      id: 'ev-b', sessionId: s.id, itemId: 'b', name: 'b.png', type: 'image',
      mimeType: 'image/png', size: 1, blob: new Blob(['x']), createdAt: s.createdAt
    });

    await templates.saveTemplate({
      ...TEMPLATE,
      sections: [{ id: 's1', title: 'Section', items: [{ id: 'a', label: 'A' }, { id: 'c', label: 'C' }] }]
    });

    const preview = await service.getTemplateUpdatePreview();
    expect(preview?.diff.added.map(i => i.id)).toEqual(['c']);
    expect(preview?.diff.removedWithData.map(i => i.id)).toEqual(['b']);

    await service.applyTemplateUpdate();
    expect(service.currentSession()?.answers).toEqual({ a: { status: 'OK', comment: '', extra: {} } });
    expect(service.currentHasTemplateUpdate()).toBe(false);
    expect(await db.evidences.count()).toBe(0);
  });

  describe('import d’un fichier d’échange', () => {
    const NOW = '2026-10-14T10:00:00.000Z';

    function stored(id = 'imp'): ChecklistSession {
      return {
        id,
        title: 'Audit importé',
        templateId: 'tpl',
        templateSnapshot: structuredClone(TEMPLATE),
        status: 'completed',
        closures: [{ closedAt: '2026-10-12T08:00:00.000Z' }],
        contextValues: { owner: 'Alice' },
        answers: { a: { status: 'OK', comment: '' } },
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-12T08:00:00.000Z'
      };
    }

    function imported(itemId: string, content: string): ImportedEvidence {
      const blob = new Blob([content], { type: 'text/plain' });
      return { itemId, name: `${itemId}.log`, type: 'log', mimeType: 'text/plain', size: blob.size, blob, createdAt: NOW };
    }

    function localEvidence(sessionId: string, itemId: string, id: string): EvidenceRecord {
      return { id, sessionId, itemId, name: `${id}.png`, type: 'image', mimeType: 'image/png', size: 1, blob: new Blob(['x']), createdAt: NOW };
    }

    it('importe une nouvelle session terminée avec ses preuves, sous de nouveaux identifiants de preuve', async () => {
      const parsed: ParsedSessionImport = { session: stored(), evidences: [imported('a', 'log a')], droppedEvidenceCount: 0 };
      const s = await service.importSession(parsed, 'new');

      expect(s.id).toBe('imp');
      expect(s.status).toBe('completed');
      expect(s.createdAt).toBe('2026-10-01T00:00:00.000Z');
      expect(s.updatedAt > '2026-10-12T08:00:00.000Z').toBe(true);
      expect((await db.sessions.get('imp'))?.closures).toHaveLength(1);

      const evidences = await db.evidences.where('sessionId').equals('imp').toArray();
      expect(evidences).toHaveLength(1);
      expect(evidences[0].itemId).toBe('a');
      expect(evidences[0].id.startsWith('a_')).toBe(true);
      expect(service.allSessions()[0].id).toBe('imp');
    });

    it('importe comme copie sans toucher la session existante', async () => {
      await db.sessions.put(stored());
      await db.evidences.put(localEvidence('imp', 'a', 'ev-local'));

      const copy = await service.importSession({ session: stored(), evidences: [imported('b', 'log b')], droppedEvidenceCount: 0 }, 'copy');

      expect(copy.id).not.toBe('imp');
      expect(copy.title).toBe('Audit importé (import)');
      expect(await db.sessions.count()).toBe(2);
      expect((await db.evidences.where('sessionId').equals('imp').toArray()).map(e => e.id)).toEqual(['ev-local']);
      expect((await db.evidences.where('sessionId').equals(copy.id).toArray()).map(e => e.itemId)).toEqual(['b']);
    });

    it('remplace toutes les preuves quand le fichier embarque les pièces jointes', async () => {
      await db.sessions.put({ ...stored(), title: 'Ancien titre' });
      await db.evidences.bulkPut([localEvidence('imp', 'a', 'ev-a'), localEvidence('imp', 'b', 'ev-b')]);

      await service.importSession({ session: stored(), evidences: [imported('b', 'nouveau')], droppedEvidenceCount: 0 }, 'replace');

      expect((await db.sessions.get('imp'))?.title).toBe('Audit importé');
      const evidences = await db.evidences.where('sessionId').equals('imp').toArray();
      expect(evidences.map(e => e.itemId)).toEqual(['b']);
      expect(evidences[0].size).toBe('nouveau'.length);
    });

    it('conserve les preuves locales des items toujours présents quand le fichier n’embarque pas les pièces jointes', async () => {
      await db.sessions.put(stored());
      await db.evidences.bulkPut([localEvidence('imp', 'a', 'ev-a'), localEvidence('imp', 'gone', 'ev-gone')]);

      await service.importSession({ session: stored(), droppedEvidenceCount: 0 }, 'replace');

      expect((await db.evidences.where('sessionId').equals('imp').toArray()).map(e => e.id)).toEqual(['ev-a']);
    });

    it('n’écrit rien si l’enregistrement des preuves échoue (transaction)', async () => {
      vi.spyOn(db.evidences, 'bulkAdd').mockRejectedValueOnce(new Error('disque plein'));
      await expect(
        service.importSession({ session: stored(), evidences: [imported('a', 'x')], droppedEvidenceCount: 0 }, 'new')
      ).rejects.toThrow('disque plein');
      expect(await db.sessions.get('imp')).toBeUndefined();
    });
  });
});
