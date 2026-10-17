import { describe, expect, it } from 'vitest';
import {
  duplicateItem,
  duplicateSection,
  findVisibleIfOrphans,
  removeSectionFromDependencies,
  reorderArray,
  transferItemBetweenLists,
  validateTemplateIntegrity
} from './template-builder.helpers';
import { ChecklistItemTemplate, ChecklistSectionTemplate, ChecklistTemplate, ContextFieldSchema } from '../../models/checklist.model';

describe('template-builder.helpers', () => {
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
