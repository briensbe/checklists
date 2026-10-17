import { colorToTone, migrateSessionV3, normalizeTemplate, UNAVAILABLE_TEMPLATE_NAME } from './migrations';
import { ChecklistTemplate } from '../models/checklist.model';

const NOW = '2026-10-14T10:00:00.000Z';

function legacyTemplate(): unknown {
  return {
    id: 'tpl-1',
    name: 'Audit',
    description: 'desc',
    version: '1.0.0',
    contextSchema: [{ id: 'mode', label: 'Mode', type: 'select' }],
    sections: [
      {
        id: 'sec-1',
        title: 'Section',
        items: [
          { id: 'all-item', label: 'Toujours', mode: 'all' },
          { id: 'patch-item', label: 'Patch', mode: 'patch' },
          {
            id: 'choice-item',
            label: 'Choix',
            controlType: 'choice',
            customChoices: [
              { id: 'c1', label: 'Vert', color: 'green' },
              { id: 'c2', label: 'Jaune', color: 'yellow', isBlocking: true },
              { id: 'c3', label: 'Gris', color: 'slate' },
              { id: 'c4', label: 'Hex', color: '#ff00ff' },
              { id: 'c5', label: 'Bleu', color: 'blue' }
            ]
          }
        ]
      }
    ]
  };
}

describe('colorToTone', () => {
  it('convertit les couleurs connues et retombe sur neutral', () => {
    expect(colorToTone('green')).toBe('success');
    expect(colorToTone('Emerald')).toBe('success');
    expect(colorToTone('red')).toBe('danger');
    expect(colorToTone('amber')).toBe('warning');
    expect(colorToTone('orange')).toBe('warning');
    expect(colorToTone('sky')).toBe('info');
    expect(colorToTone('slate')).toBe('neutral');
    expect(colorToTone('#123456')).toBe('neutral');
    expect(colorToTone(undefined)).toBe('neutral');
  });
});

describe('normalizeTemplate', () => {
  it('convertit un template à l’ancien format', () => {
    const t = normalizeTemplate(legacyTemplate(), NOW);
    const [allItem, patchItem, choiceItem] = t.sections[0].items;

    expect(t.updatedAt).toBe(NOW);
    expect(allItem.visibleIf).toBeUndefined();
    expect('mode' in allItem).toBe(false);
    expect(patchItem.visibleIf).toEqual({ fieldId: 'mode', equals: ['patch'] });
    expect('mode' in patchItem).toBe(false);

    expect(choiceItem.customChoices?.map(c => c.tone)).toEqual(['success', 'warning', 'neutral', 'neutral', 'info']);
    expect(choiceItem.customChoices?.some(c => 'color' in c)).toBe(false);
    expect(choiceItem.customChoices?.[1].isBlocking).toBe(true);
  });

  it('laisse inchangé un template déjà au format courant (idempotence)', () => {
    const once = normalizeTemplate(legacyTemplate(), NOW);
    const twice = normalizeTemplate(structuredClone(once), '2030-01-01T00:00:00.000Z');
    expect(twice).toEqual(once);
  });

  it('conserve un visibleIf existant et un updatedAt existant', () => {
    const current: ChecklistTemplate = {
      id: 't',
      name: 'n',
      description: '',
      version: '2',
      updatedAt: '2025-01-01T00:00:00.000Z',
      contextSchema: [],
      sections: [{ id: 's', title: 'S', items: [{ id: 'i', label: 'I', visibleIf: { fieldId: 'type', equals: ['a', 'b'] } }] }]
    };
    expect(normalizeTemplate(current, NOW)).toEqual(current);
  });

  it('complète les tableaux manquants et rejette une entrée non objet', () => {
    const t = normalizeTemplate({ id: 'x', name: 'X', description: '', version: '1' }, NOW);
    expect(t.contextSchema).toEqual([]);
    expect(t.sections).toEqual([]);
    expect(() => normalizeTemplate('oops', NOW)).toThrow();
    expect(() => normalizeTemplate(null, NOW)).toThrow();
  });

  it('retire le motif N/A obligatoire (option supprimée)', () => {
    const raw = {
      id: 't',
      name: 'n',
      description: '',
      version: '1',
      sections: [{ id: 's', title: 'S', items: [{ id: 'i', label: 'I', requireNaReason: true }] }]
    };
    const item = normalizeTemplate(raw, NOW).sections[0].items[0];
    expect('requireNaReason' in item).toBe(false);
  });

  it('conserve les champs d’enchaînement et de criticité', () => {
    const current: ChecklistTemplate = {
      id: 't',
      name: 'n',
      description: '',
      version: '1',
      updatedAt: '2025-01-01T00:00:00.000Z',
      contextSchema: [],
      completionPolicy: 'blocking',
      sections: [
        { id: 'a', title: 'A', items: [{ id: 'a1', label: 'A1', criticality: 'blocking' }] },
        {
          id: 'b',
          title: 'B',
          dependsOn: ['a'],
          joinMode: 'any',
          gate: 'soft',
          items: [{ id: 'b1', label: 'B1', evidenceRequired: 'photo', evidenceHint: 'Capture du rapport' }]
        }
      ]
    };
    expect(normalizeTemplate(structuredClone(current), NOW)).toEqual(current);
  });
});

describe('migrateSessionV3', () => {
  const template = normalizeTemplate(legacyTemplate(), NOW);
  const templates = new Map([[template.id, template]]);

  function legacySession(templateId = 'tpl-1'): unknown {
    return {
      id: 'sess-1',
      title: 'Audit du jour',
      templateId,
      contextValues: { mode: 'patch' },
      answers: { 'patch-item': { status: 'KO', comment: 'cassé' } },
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z'
    };
  }

  it('crée une copie figée du template d’origine et initialise le cycle de vie', () => {
    const s = migrateSessionV3(legacySession(), templates, NOW);
    expect(s.templateSnapshot).toEqual(template);
    expect(s.templateSnapshot).not.toBe(template);
    expect(s.templateSnapshot.updatedAt).toBe(template.updatedAt);
    expect(s.status).toBe('in_progress');
    expect(s.closures).toEqual([]);
    expect(s.structureUnavailable).toBeUndefined();
  });

  it('conserve les réponses et le contexte (session en mode patch)', () => {
    const s = migrateSessionV3(legacySession(), templates, NOW);
    expect(s.contextValues).toEqual({ mode: 'patch' });
    expect(s.answers['patch-item']).toEqual({ status: 'KO', comment: 'cassé' });
    const patchItem = s.templateSnapshot.sections[0].items.find(i => i.id === 'patch-item');
    expect(patchItem?.visibleIf).toEqual({ fieldId: 'mode', equals: ['patch'] });
  });

  it('marque une session orpheline comme structure indisponible', () => {
    const s = migrateSessionV3(legacySession('deleted-tpl'), templates, NOW);
    expect(s.structureUnavailable).toBe(true);
    expect(s.templateSnapshot.name).toBe(UNAVAILABLE_TEMPLATE_NAME);
    expect(s.templateSnapshot.sections).toEqual([]);
    expect(s.answers['patch-item'].status).toBe('KO');
  });

  it('est idempotente sur une session déjà migrée', () => {
    const once = migrateSessionV3(legacySession(), templates, NOW);
    const twice = migrateSessionV3(structuredClone(once), new Map(), '2030-01-01T00:00:00.000Z');
    expect(twice).toEqual(once);
  });
});
