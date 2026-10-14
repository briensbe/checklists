import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { TestBed } from '@angular/core/testing';
import { TemplateService } from './template.service';
import { AppDatabaseService } from './app-database.service';
import { ChecklistTemplate } from '../models/checklist.model';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const TEMPLATE: ChecklistTemplate = {
  id: 'audit',
  name: 'Audit',
  description: '',
  version: '1',
  updatedAt: '2026-10-01T00:00:00.000Z',
  contextSchema: [],
  sections: [{ id: 's1', title: 'Section', items: [{ id: 'a', label: 'A' }] }]
};

describe('TemplateService – import', () => {
  let service: TemplateService;
  let db: AppDatabaseService;

  beforeEach(async () => {
    await Dexie.delete('ChecklistDatabase');
    TestBed.configureTestingModule({});
    service = TestBed.inject(TemplateService);
    db = TestBed.inject(AppDatabaseService);
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete('ChecklistDatabase');
  });

  it('normalise et valide un fichier, y compris à l’ancien format', () => {
    const legacy = { ...TEMPLATE, sections: [{ id: 's1', title: 'Section', items: [{ id: 'a', label: 'A', mode: 'patch' }] }] };
    const parsed = service.parseTemplateFile(JSON.stringify(legacy));
    expect(parsed.sections[0].items[0].visibleIf).toEqual({ fieldId: 'mode', equals: ['patch'] });
  });

  it('refuse un fichier invalide', () => {
    expect(() => service.parseTemplateFile('{pas du json')).toThrow('JSON valide');
    expect(() => service.parseTemplateFile(JSON.stringify({ id: 'x' }))).toThrow('Format de template invalide');
  });

  it('importe un nouveau template', async () => {
    await service.importTemplate(TEMPLATE, 'new');
    expect(service.availableTemplates().map(t => t.id)).toEqual(['audit']);
  });

  it('remplace l’existant en mettant à jour son horodatage', async () => {
    await db.templates.put(TEMPLATE);
    const saved = await service.importTemplate({ ...TEMPLATE, name: 'Audit v2' }, 'replace');

    expect(await db.templates.count()).toBe(1);
    expect((await db.templates.get('audit'))?.name).toBe('Audit v2');
    expect(saved.updatedAt > TEMPLATE.updatedAt).toBe(true);
  });

  it('importe comme copie sous un nouvel identifiant sans toucher l’original', async () => {
    await db.templates.put(TEMPLATE);
    const copy = await service.importTemplate(TEMPLATE, 'copy');

    expect(copy.id).toMatch(/^audit-import-[a-z0-9]{6}$/);
    expect(copy.name).toBe('Audit (import)');
    expect(await db.templates.count()).toBe(2);
    expect(await db.templates.get('audit')).toEqual(TEMPLATE);
  });
});
