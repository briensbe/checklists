import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { TestBed } from '@angular/core/testing';
import { EvidenceService } from './evidence.service';
import { AppDatabaseService } from './app-database.service';
import { ChecklistSession } from '../models/checklist.model';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const SESSION: ChecklistSession = {
  id: 'sess',
  title: 'Audit',
  templateId: 'tpl',
  templateSnapshot: {
    id: 'tpl',
    name: 'Audit',
    description: '',
    version: '1',
    updatedAt: '2026-10-17T00:00:00.000Z',
    contextSchema: [],
    sections: [{ id: 's1', title: 'Section', items: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }]
  },
  status: 'in_progress',
  closures: [],
  contextValues: {},
  answers: {},
  createdAt: '2026-10-17T00:00:00.000Z',
  updatedAt: '2026-10-17T00:00:00.000Z'
};

describe('EvidenceService', () => {
  let service: EvidenceService;
  let db: AppDatabaseService;

  beforeEach(async () => {
    await Dexie.delete('ChecklistDatabase');
    TestBed.configureTestingModule({});
    service = TestBed.inject(EvidenceService);
    db = TestBed.inject(AppDatabaseService);
    await db.sessions.put(SESSION);
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete('ChecklistDatabase');
  });

  it('résume les preuves par item : nombre total et nombre d’images', async () => {
    await service.addEvidence('sess', 'a', new Blob(['png'], { type: 'image/png' }), 'capture.png', 'image');
    await service.addEvidence('sess', 'a', new Blob(['log']), 'build.log', 'log');
    await service.addEvidence('sess', 'b', new Blob(['pdf']), 'rapport.pdf', 'file');

    expect(service.summaries()).toEqual({ a: { total: 2, images: 1 }, b: { total: 1, images: 0 } });
    expect(service.evidenceCounts()).toEqual({ a: 2, b: 1 });
  });

  it('masque une preuve en attente de suppression, puis la restaure à l’annulation', async () => {
    const record = await service.addEvidence('sess', 'a', new Blob(['png'], { type: 'image/png' }), 'capture.png', 'image');

    service.hideForDeletion(record.id);
    expect(service.summaries()).toEqual({});
    expect(service.evidenceCounts()).toEqual({});
    expect(await db.evidences.count()).toBe(1);

    service.restore(record.id);
    expect(service.summaries()).toEqual({ a: { total: 1, images: 1 } });
  });

  it('supprime définitivement une preuve masquée', async () => {
    const record = await service.addEvidence('sess', 'a', new Blob(['x']), 'x.txt', 'file');
    service.hideForDeletion(record.id);

    await service.commitDeletion('sess', record.id);
    expect(await db.evidences.count()).toBe(0);
    expect(service.pendingDeletionIds().size).toBe(0);
    expect(service.summaries()).toEqual({});
  });

  it('réaffiche la preuve si la suppression définitive échoue (session terminée)', async () => {
    const record = await service.addEvidence('sess', 'a', new Blob(['x']), 'x.txt', 'file');
    service.hideForDeletion(record.id);
    await db.sessions.put({ ...SESSION, status: 'completed' });

    await expect(service.commitDeletion('sess', record.id)).rejects.toThrow();
    expect(await db.evidences.count()).toBe(1);
    expect(service.summaries()).toEqual({ a: { total: 1, images: 0 } });
  });
});
