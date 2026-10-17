import { describe, expect, it } from 'vitest';
import {
  addItem,
  duplicateItem,
  duplicateSection,
  findVisibleIfOrphans,
  insertItemAt,
  moveItemBetween,
  moveItemWithin,
  nextCriticality,
  removeItemAt,
  removeSectionFromDependencies,
  reorderArray,
  setItemCriticality,
  setItemEvidence,
  transferItemBetweenLists,
  updateContextField,
  updateItem,
  updateSection,
  updateTemplate,
  validateTemplateIntegrity
} from './template-builder.helpers';
import { ChecklistItemTemplate, ChecklistSectionTemplate, ChecklistTemplate, ContextFieldSchema } from '../../models/checklist.model';

describe('template-builder.helpers', () => {
  describe('mises à jour immuables', () => {
    const base = (): ChecklistTemplate => ({
      id: 't',
      name: 'Modèle',
      description: '',
      version: '1.0.0',
      updatedAt: '',
      contextSchema: [
        { id: 'env', label: 'Environnement', type: 'text' },
        { id: 'ver', label: 'Version', type: 'text' }
      ],
      sections: [
        { id: 's1', title: 'Un', items: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }] },
        { id: 's2', title: 'Deux', items: [{ id: 'd', label: 'D' }] }
      ]
    });
    const ids = (t: ChecklistTemplate, sectionIndex: number) => t.sections[sectionIndex].items.map(i => i.id);

    it('updateTemplate remplace les propriétés de premier niveau sans toucher aux sections', () => {
      const t = base();
      const next = updateTemplate(t, { name: 'Autre' });
      expect(next).not.toBe(t);
      expect(next.name).toBe('Autre');
      expect(next.sections).toBe(t.sections);
      expect(t.name).toBe('Modèle');
    });

    it('updateSection ne recrée que la section visée', () => {
      const t = base();
      const next = updateSection(t, 's2', s => ({ ...s, title: 'Deux bis' }));
      expect(next.sections[1].title).toBe('Deux bis');
      expect(next.sections[0]).toBe(t.sections[0]);
      expect(t.sections[1].title).toBe('Deux');
    });

    it('updateItem ne recrée que l’item et sa section', () => {
      const t = base();
      const next = updateItem(t, 'b', i => ({ ...i, label: 'B modifié' }));
      expect(next.sections[0].items[1].label).toBe('B modifié');
      expect(next.sections[0].items[0]).toBe(t.sections[0].items[0]);
      expect(next.sections[1]).toBe(t.sections[1]);
      expect(t.sections[0].items[1].label).toBe('B');
    });

    it('updateContextField ne recrée que le champ visé et ignore un index hors bornes', () => {
      const t = base();
      const next = updateContextField(t, 1, f => ({ ...f, label: 'Version livrée' }));
      expect(next.contextSchema[1].label).toBe('Version livrée');
      expect(next.contextSchema[0]).toBe(t.contextSchema[0]);
      expect(updateContextField(t, 5, f => f)).toBe(t);
    });

    it('ajoute, insère et retire des items', () => {
      const t = base();
      expect(ids(addItem(t, 's2', { id: 'e', label: 'E' }), 1)).toEqual(['d', 'e']);
      expect(ids(insertItemAt(t, 's1', 1, { id: 'x', label: 'X' }), 0)).toEqual(['a', 'x', 'b', 'c']);
      expect(ids(insertItemAt(t, 's1', 99, { id: 'x', label: 'X' }), 0)).toEqual(['a', 'b', 'c', 'x']);
      expect(ids(removeItemAt(t, 's1', 1), 0)).toEqual(['a', 'c']);
      expect(removeItemAt(t, 's1', 7)).toBe(t);
      expect(ids(t, 0)).toEqual(['a', 'b', 'c']);
    });

    it('déplace un item dans sa section ou vers une autre section', () => {
      const t = base();
      expect(ids(moveItemWithin(t, 's1', 0, 2), 0)).toEqual(['b', 'c', 'a']);
      const moved = moveItemBetween(t, 's1', 's2', 1, 0);
      expect(ids(moved, 0)).toEqual(['a', 'c']);
      expect(ids(moved, 1)).toEqual(['b', 'd']);
      expect(ids(moveItemBetween(t, 's1', 's1', 2, 0), 0)).toEqual(['c', 'a', 'b']);
      expect(ids(t, 0)).toEqual(['a', 'b', 'c']);
      expect(ids(t, 1)).toEqual(['d']);
    });
  });

  describe('duplicateItem', () => {
    it('devrait dupliquer un item avec un nouvel UUID distinct', () => {
      const original: ChecklistItemTemplate = {
        id: 'item-1',
        label: 'Tâche de test',
        controlType: 'choice',
        customChoices: [
          { id: 'opt-1', label: 'Oui', tone: 'success' },
          { id: 'opt-2', label: 'Non', tone: 'danger' }
        ],
        withTimestamp: false,
        criticality: 'blocking',
        extraField: { id: 'ext-1', label: 'Détail' }
      };

      const copy = duplicateItem(original);

      expect(copy.id).not.toBe(original.id);
      expect(copy.id).toMatch(/^item-[a-f0-9-]+$/);
      expect(copy.label).toBe(original.label);
      expect(copy.criticality).toBe('blocking');
      expect(copy.extraField).toEqual(original.extraField);
      expect(copy.customChoices?.[0].id).not.toBe(original.customChoices?.[0].id);
      expect(copy.customChoices?.[0].label).toBe('Oui');
    });
  });

  describe('duplicateSection', () => {
    it('devrait dupliquer une section avec un nouvel id et des items dupliqués', () => {
      const original: ChecklistSectionTemplate = {
        id: 'sec-1',
        title: 'Sécurité',
        items: [
          { id: 'item-10', label: 'Firewall actif' },
          { id: 'item-20', label: 'Ports fermés' }
        ]
      };

      const copy = duplicateSection(original);

      expect(copy.id).not.toBe(original.id);
      expect(copy.id).toMatch(/^sec-[a-f0-9-]+$/);
      expect(copy.title).toBe('Sécurité (copie)');
      expect(copy.items.length).toBe(2);
      expect(copy.items[0].id).not.toBe('item-10');
      expect(copy.items[1].id).not.toBe('item-20');
      expect(copy.items[0].label).toBe('Firewall actif');
    });

    it('devrait conserver les dépendances de l’originale sans créer de dépendance vers la copie', () => {
      const sections: ChecklistSectionTemplate[] = [
        { id: 'prep', title: 'Préparation', items: [{ id: 'i1', label: 'Ticket' }] },
        { id: 'build', title: 'Build', dependsOn: ['prep'], joinMode: 'any', gate: 'soft', items: [{ id: 'i2', label: 'Build vert' }] },
        { id: 'tests', title: 'Tests', dependsOn: ['build'], items: [{ id: 'i3', label: 'Tests OK' }] }
      ];

      const copy = duplicateSection(sections[1]);

      expect(copy.dependsOn).toEqual(['prep']);
      expect(copy.dependsOn).not.toBe(sections[1].dependsOn);
      expect(copy.joinMode).toBe('any');
      expect(copy.gate).toBe('soft');
      expect(sections.some(s => s.dependsOn?.includes(copy.id))).toBe(false);
    });
  });

  describe('removeSectionFromDependencies', () => {
    it('devrait retirer la section supprimée des dépendances des autres, sans muter l’entrée', () => {
      const sections: ChecklistSectionTemplate[] = [
        { id: 'build', title: 'Build', dependsOn: ['prep'], items: [] },
        { id: 'go', title: 'Go', dependsOn: ['build', 'doc'], items: [] },
        { id: 'doc', title: 'Doc', items: [] }
      ];

      const result = removeSectionFromDependencies(sections, 'build');

      expect(result.map(s => s.dependsOn)).toEqual([['prep'], ['doc'], undefined]);
      expect(sections[1].dependsOn).toEqual(['build', 'doc']);
      expect(result[0]).toBe(sections[0]);
    });
  });

  describe('validateTemplateIntegrity', () => {
    it('devrait valider un template complet sans erreurs', () => {
      const template: ChecklistTemplate = {
        id: 'tpl-1',
        name: 'Audit Sécurité',
        description: 'Description',
        version: '1.0.0',
        updatedAt: '',
        contextSchema: [],
        sections: [
          {
            id: 'sec-1',
            title: 'Section 1',
            items: [{ id: 'item-1', label: 'Contrôle 1' }]
          }
        ]
      };

      const result = validateTemplateIntegrity(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('devrait rejeter un template sans nom ou sans section', () => {
      const emptyTpl: ChecklistTemplate = {
        id: 'tpl-1',
        name: '   ',
        description: '',
        version: '1.0.0',
        updatedAt: '',
        contextSchema: [],
        sections: []
      };

      const result = validateTemplateIntegrity(emptyTpl);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Veuillez renseigner un nom pour le modèle.');
      expect(result.errors).toContain('Le modèle doit comporter au moins une section.');
    });

    it('devrait détecter les identifiants d\'items en doublon', () => {
      const template: ChecklistTemplate = {
        id: 'tpl-1',
        name: 'Modèle avec doublons',
        description: '',
        version: '1.0.0',
        updatedAt: '',
        contextSchema: [],
        sections: [
          {
            id: 'sec-1',
            title: 'Section 1',
            items: [
              { id: 'duplicate-id', label: 'Item A' },
              { id: 'item-unique', label: 'Item B' }
            ]
          },
          {
            id: 'sec-2',
            title: 'Section 2',
            items: [{ id: 'duplicate-id', label: 'Item C' }]
          }
        ]
      };

      const result = validateTemplateIntegrity(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('duplicate-id'))).toBe(true);
    });

    it('devrait bloquer un enchaînement invalide en nommant les sections', () => {
      const template: ChecklistTemplate = {
        id: 'tpl-1',
        name: 'Modèle en boucle',
        description: '',
        version: '1.0.0',
        updatedAt: '',
        contextSchema: [],
        sections: [
          { id: 'a', title: 'Alpha', dependsOn: ['b'], items: [{ id: 'i1', label: 'Item 1' }] },
          { id: 'b', title: 'Bêta', dependsOn: ['a'], items: [{ id: 'i2', label: 'Item 2' }] },
          { id: 'c', title: 'Gamma', dependsOn: ['c', 'inconnue'], items: [{ id: 'i3', label: 'Item 3' }] }
        ]
      };

      const result = validateTemplateIntegrity(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'La section « Gamma » dépend d\'elle-même.',
          'La section « Gamma » dépend d\'une section inconnue (« inconnue »).',
          'Les dépendances forment une boucle entre les sections « Alpha », « Bêta ».'
        ])
      );
    });
  });

  describe('findVisibleIfOrphans', () => {
    it('devrait détecter les items pointant vers des champs de contexte absents', () => {
      const schema: ContextFieldSchema[] = [
        { id: 'env', label: 'Environnement', type: 'select', options: [{ label: 'Prod', value: 'prod' }] }
      ];

      const template: ChecklistTemplate = {
        id: 'tpl-1',
        name: 'Audit',
        description: '',
        version: '1.0.0',
        updatedAt: '',
        contextSchema: schema,
        sections: [
          {
            id: 'sec-1',
            title: 'Section 1',
            items: [
              {
                id: 'item-1',
                label: 'Item valide',
                visibleIf: { fieldId: 'env', equals: ['prod'] }
              },
              {
                id: 'item-2',
                label: 'Item orphelin',
                visibleIf: { fieldId: 'missing_field', equals: ['xyz'] }
              }
            ]
          }
        ]
      };

      const orphans = findVisibleIfOrphans(template, schema);
      expect(orphans).toEqual([
        {
          itemId: 'item-2',
          itemLabel: 'Item orphelin',
          fieldId: 'missing_field'
        }
      ]);
    });
  });

  describe('reorderArray & transferItemBetweenLists', () => {
    it('devrait réordonner une liste sans la muter', () => {
      const list = ['A', 'B', 'C', 'D'];
      const result = reorderArray(list, 1, 3);
      expect(result).toEqual(['A', 'C', 'D', 'B']);
      expect(list).toEqual(['A', 'B', 'C', 'D']);
    });

    it('devrait transférer un item d\'une liste à une autre', () => {
      const source = ['A', 'B', 'C'];
      const target = ['X', 'Y'];

      const res = transferItemBetweenLists(source, target, 1, 1);
      expect(res.source).toEqual(['A', 'C']);
      expect(res.target).toEqual(['X', 'B', 'Y']);
    });
  });
});

describe('criticité et preuve exigée (quick-check-and-drawer)', () => {
  const template = (): ChecklistTemplate => ({
    id: 'tpl',
    name: 'Modèle',
    description: '',
    version: '1',
    updatedAt: '',
    contextSchema: [],
    sections: [
      { id: 's1', title: 'S1', items: [{ id: 'a', label: 'A', controlType: 'checkbox', criticality: 'optional' }] },
      { id: 's2', title: 'S2', items: [{ id: 'b', label: 'B' }] }
    ]
  });

  it('fait tourner la criticité : bloquant → important → optionnel → bloquant', () => {
    expect(nextCriticality('optional')).toBe('blocking');
    expect(nextCriticality('blocking')).toBe('important');
    expect(nextCriticality('important')).toBe('optional');
  });

  it('change la criticité d’un item sans muter le modèle ni recréer les autres sections', () => {
    const before = template();
    const after = setItemCriticality(before, 'a', 'blocking');
    expect(after.sections[0].items[0].criticality).toBe('blocking');
    expect(before.sections[0].items[0].criticality).toBe('optional');
    expect(after.sections[1]).toBe(before.sections[1]);
  });

  it('enregistre la preuve exigée et sa consigne, puis les retire avec « aucune »', () => {
    const withEvidence = setItemEvidence(template(), 'a', 'photo', 'Capture du rapport de tests');
    expect(withEvidence.sections[0].items[0]).toMatchObject({ evidenceRequired: 'photo', evidenceHint: 'Capture du rapport de tests' });

    const without = setItemEvidence(withEvidence, 'a', null, 'Capture du rapport de tests');
    expect('evidenceRequired' in without.sections[0].items[0]).toBe(false);
    expect('evidenceHint' in without.sections[0].items[0]).toBe(false);
  });

  it('n’écrit pas de consigne vide', () => {
    const t = setItemEvidence(template(), 'b', 'link', '   ');
    expect(t.sections[1].items[0]).toEqual({ id: 'b', label: 'B', evidenceRequired: 'link' });
  });
});
