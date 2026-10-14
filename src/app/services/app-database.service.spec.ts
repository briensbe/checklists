import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { AppDatabaseService } from './app-database.service';

// IndexedDB n'existe pas dans jsdom : on branche l'implémentation en mémoire de fake-indexeddb.
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const DB_NAME = 'ChecklistDatabase';

/** Reproduit le schéma v2 tel qu'il existait avant ce change, avec des données représentatives. */
async function seedV2Database(): Promise<void> {
  const legacy = new Dexie(DB_NAME);
  legacy.version(1).stores({
    templates: 'id, name, version',
    sessions: 'id, templateId, updatedAt',
    evidences: 'id, sessionId, itemId, createdAt'
  });
  legacy.version(2).stores({
    templates: 'id, name, version',
    sessions: 'id, templateId, title, updatedAt, createdAt',
    evidences: 'id, sessionId, itemId, createdAt'
  });
  await legacy.open();

  await legacy.table('templates').put({
    id: 'tpl-1',
    name: 'Audit livraison',
    description: '',
    version: '1.0.0',
    contextSchema: [{ id: 'mode', label: 'Mode', type: 'select' }],
    sections: [
      {
        id: 'sec-1',
        title: 'Section',
        items: [
          { id: 'patch-item', label: 'Patch', mode: 'patch' },
          { id: 'choice-item', label: 'Choix', controlType: 'choice', customChoices: [{ id: 'c1', label: 'Jaune', color: 'yellow' }] }
        ]
      }
    ]
  });
  await legacy.table('sessions').bulkPut([
    {
      id: 'sess-ok',
      title: 'Session nominale',
      templateId: 'tpl-1',
      contextValues: { mode: 'patch' },
      answers: { 'patch-item': { status: 'OK', comment: '' } },
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z'
    },
    {
      id: 'sess-orphan',
      title: 'Session orpheline',
      templateId: 'deleted',
      contextValues: {},
      answers: { x: { status: 'KO', comment: 'garde-moi' } },
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z'
    }
  ]);
  legacy.close();
}

describe('AppDatabaseService — migration v2 → v3', () => {
  let db: AppDatabaseService;

  beforeEach(async () => {
    await Dexie.delete(DB_NAME);
    await seedV2Database();
    db = new AppDatabaseService();
    await db.open();
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(DB_NAME);
  });

  it('passe la base en version 3', () => {
    expect(db.verno).toBe(3);
  });

  it('normalise les templates stockés', async () => {
    const tpl = await db.templates.get('tpl-1');
    const [patchItem, choiceItem] = tpl!.sections[0].items;
    expect(tpl!.updatedAt).toBeTruthy();
    expect(patchItem.visibleIf).toEqual({ fieldId: 'mode', equals: ['patch'] });
    expect(choiceItem.customChoices?.[0].tone).toBe('warning');
  });

  it('ajoute copie figée, statut et clôtures aux sessions', async () => {
    const tpl = await db.templates.get('tpl-1');
    const sess = await db.sessions.get('sess-ok');
    expect(sess!.templateSnapshot).toEqual(tpl);
    expect(sess!.status).toBe('in_progress');
    expect(sess!.closures).toEqual([]);
    expect(sess!.answers['patch-item'].status).toBe('OK');
  });

  it('conserve les sessions orphelines en les marquant', async () => {
    const sess = await db.sessions.get('sess-orphan');
    expect(sess!.structureUnavailable).toBe(true);
    expect(sess!.templateSnapshot.sections).toEqual([]);
    expect(sess!.answers['x'].comment).toBe('garde-moi');
  });
});
