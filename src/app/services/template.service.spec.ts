import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { SEEDED_TEMPLATES_KEY, TemplateService } from './template.service';
import { AppDatabaseService } from './app-database.service';
import { ChecklistTemplate } from '../models/checklist.model';
import { validateFlow } from '../domain/flow-rules';
import releaseFlow from '../../assets/templates/release-flow.json';

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

  it('refuse un enchaînement invalide en nommant la section ou l’item concerné', () => {
    const withSections = (sections: unknown[]) => JSON.stringify({ ...TEMPLATE, sections });
    const looped = withSections([
      { id: 'a', title: 'Alpha', dependsOn: ['b'], items: [{ id: 'a1', label: 'A1' }] },
      { id: 'b', title: 'Bêta', dependsOn: ['a'], items: [{ id: 'b1', label: 'B1' }] }
    ]);
    expect(() => service.parseTemplateFile(looped)).toThrow('« Alpha », « Bêta »');

    const unknown = withSections([{ id: 'a', title: 'Alpha', dependsOn: ['fantome'], items: [{ id: 'a1', label: 'A1' }] }]);
    expect(() => service.parseTemplateFile(unknown)).toThrow('fantome');

    const badCriticality = withSections([{ id: 'a', title: 'Alpha', items: [{ id: 'a1', label: 'Item A1', criticality: 'critique' }] }]);
    expect(() => service.parseTemplateFile(badCriticality)).toThrow('« Item A1 »');
  });

  it('le modèle d’exemple livré est un enchaînement valide', () => {
    const parsed = service.parseTemplateFile(JSON.stringify(releaseFlow));
    expect(validateFlow(parsed)).toEqual([]);
    expect(parsed.sections.find(s => s.id === 'rf-go')?.dependsOn).toEqual(['rf-tests', 'rf-doc']);
    expect(parsed.completionPolicy).toBe('blocking');
  });

  it('enregistre un modèle sans l’ancien motif N/A obligatoire', async () => {
    const legacy = structuredClone(TEMPLATE);
    Object.assign(legacy.sections[0].items[0], { requireNaReason: true });
    await service.saveTemplate(legacy);
    const stored = await db.templates.get('audit');
    expect(stored && 'requireNaReason' in stored.sections[0].items[0]).toBe(false);
  });
});

describe('TemplateService – modèles livrés', () => {
  const DELIVERY: ChecklistTemplate = { ...TEMPLATE, id: 'delivery-audit-standard', name: 'Audit de livraison' };
  const FILES: Record<string, unknown> = {
    'assets/templates/delivery-audit.json': DELIVERY,
    'assets/templates/release-flow.json': releaseFlow
  };

  let service: TemplateService;
  let db: AppDatabaseService;

  beforeEach(async () => {
    await Dexie.delete('ChecklistDatabase');
    localStorage.removeItem(SEEDED_TEMPLATES_KEY);
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: { get: (url: string) => of(structuredClone(FILES[url])) } }]
    });
    service = TestBed.inject(TemplateService);
    db = TestBed.inject(AppDatabaseService);
  });

  afterEach(async () => {
    localStorage.removeItem(SEEDED_TEMPLATES_KEY);
    db.close();
    await Dexie.delete('ChecklistDatabase');
  });

  const storedIds = async () => (await db.templates.toArray()).map(t => t.id).sort();

  it('Première utilisation : tous les modèles livrés sont ajoutés', async () => {
    await service.initTemplates();
    expect(await storedIds()).toEqual(['delivery-audit-standard', 'release-flow-example']);
    expect(service.availableTemplates()).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(SEEDED_TEMPLATES_KEY) ?? '[]')).toEqual(['delivery-audit-standard', 'release-flow-example']);
  });

  it('Bibliothèque existante : seul le nouveau modèle livré est ajouté, l’audit supprimé ne revient pas', async () => {
    await db.templates.put({ ...TEMPLATE, id: 'perso' });
    await service.initTemplates();
    expect(await storedIds()).toEqual(['perso', 'release-flow-example']);
  });

  it('Modèle d’exemple supprimé : il n’est pas ajouté à nouveau au redémarrage', async () => {
    await service.initTemplates();
    await service.deleteTemplate('release-flow-example');
    await service.initTemplates();
    expect(await storedIds()).toEqual(['delivery-audit-standard']);
  });

  it('Modèle déjà présent : il n’est pas écrasé', async () => {
    await db.templates.put({ ...(releaseFlow as unknown as ChecklistTemplate), name: 'Ma version' });
    await service.initTemplates();
    expect((await db.templates.get('release-flow-example'))?.name).toBe('Ma version');
  });
});
