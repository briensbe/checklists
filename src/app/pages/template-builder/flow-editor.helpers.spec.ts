import { describe, expect, it } from 'vitest';
import releaseFlowJson from '../../../assets/templates/release-flow.json';
import { ChecklistSectionTemplate, ChecklistTemplate } from '../../models/checklist.model';
import {
  dependencyChips,
  newSectionDependencies,
  sectionsWithDependents,
  setCompletionPolicy,
  setSectionGate,
  setSectionIcon,
  setSectionJoinMode,
  summarizeFlow,
  toggleDependency,
  toPreviewNodes
} from './flow-editor.helpers';
import {
  addItem,
  removeSectionFromDependencies,
  setItemCriticality,
  setItemEvidence,
  updateSection,
  updateTemplate
} from './template-builder.helpers';
import { computeColumns, criticalityOf, validateFlow } from '../../domain/flow-rules';
import { resolveStepIcon } from '../../domain/step-icons';

const releaseFlow = releaseFlowJson as ChecklistTemplate;

function template(sections: ChecklistSectionTemplate[]): ChecklistTemplate {
  return { id: 't', name: 'Modèle', description: '', version: '1', updatedAt: '', contextSchema: [], sections };
}

const section = (id: string, dependsOn?: string[], extra: Partial<ChecklistSectionTemplate> = {}): ChecklistSectionTemplate => ({
  id,
  title: id.toUpperCase(),
  items: [{ id: `${id}-1`, label: 'Contrôle' }],
  ...(dependsOn ? { dependsOn } : {}),
  ...extra
});

const byId = (t: ChecklistTemplate, id: string) => t.sections.find(s => s.id === id)!;

describe('flow-editor.helpers', () => {
  describe('toggleDependency', () => {
    it('ajoute puis retire une dépendance, et retire la propriété quand la liste est vide', () => {
      const t = template([section('prep'), section('build')]);
      const added = toggleDependency(t, 'build', 'prep');
      expect(byId(added, 'build').dependsOn).toEqual(['prep']);
      expect(byId(added, 'prep')).toBe(byId(t, 'prep'));

      const removed = toggleDependency(added, 'build', 'prep');
      expect('dependsOn' in byId(removed, 'build')).toBe(false);
      expect(byId(t, 'build').dependsOn).toBeUndefined();
    });

    it('refuse une dépendance qui créerait une boucle directe ou indirecte', () => {
      const t = template([section('prep'), section('build', ['prep']), section('tests', ['build'])]);
      expect(toggleDependency(t, 'prep', 'build')).toBe(t);
      expect(toggleDependency(t, 'prep', 'tests')).toBe(t);
      expect(toggleDependency(t, 'prep', 'prep')).toBe(t);
      expect(toggleDependency(t, 'prep', 'inconnue')).toBe(t);
    });

    it('retire le mode de jonction sous deux dépendances', () => {
      const t = template([section('tests'), section('doc'), section('go', ['tests', 'doc'], { joinMode: 'any' })]);
      const next = toggleDependency(t, 'go', 'doc');
      expect(byId(next, 'go').dependsOn).toEqual(['tests']);
      expect('joinMode' in byId(next, 'go')).toBe(false);
    });

    it('permet toujours de retirer une dépendance d’une boucle importée', () => {
      const t = template([section('a', ['b']), section('b', ['a'])]);
      expect(summarizeFlow(t).errors.map(e => e.code)).toContain('cycle');
      const next = toggleDependency(t, 'a', 'b');
      expect(summarizeFlow(next).errors).toEqual([]);
    });
  });

  describe('porte, jonction, icône et politique de clôture', () => {
    it('écrit les valeurs explicitement, défaut compris', () => {
      const t = template([section('tests'), section('doc'), section('go', ['tests', 'doc'])]);
      expect(byId(setSectionGate(t, 'doc', 'hard'), 'doc').gate).toBe('hard');
      expect(byId(setSectionGate(t, 'doc', 'soft'), 'doc').gate).toBe('soft');
      expect(byId(setSectionJoinMode(t, 'go', 'all'), 'go').joinMode).toBe('all');
      expect(byId(setSectionIcon(t, 'tests', 'flask-conical'), 'tests').icon).toBe('flask-conical');
      expect(setCompletionPolicy(t, 'blocking').completionPolicy).toBe('blocking');
    });

    it('n’écrit pas de mode de jonction sous deux dépendances', () => {
      const t = template([section('prep'), section('build', ['prep'])]);
      expect('joinMode' in byId(setSectionJoinMode(t, 'build', 'any'), 'build')).toBe(false);
    });

    it('conserve la porte d’une section qui n’a plus de dépendante', () => {
      const t = template([section('doc', undefined, { gate: 'soft' }), section('go', ['doc'])]);
      expect(sectionsWithDependents(t).has('doc')).toBe(true);
      const next = toggleDependency(t, 'go', 'doc');
      expect(sectionsWithDependents(next).has('doc')).toBe(false);
      expect(byId(next, 'doc').gate).toBe('soft');
    });
  });

  describe('nouvelle section et suppression', () => {
    it('fait dépendre une nouvelle section de la dernière si le modèle est enchaîné', () => {
      expect(newSectionDependencies(releaseFlow)).toEqual(['rf-deploy']);
      expect(newSectionDependencies(template([section('a'), section('b')]))).toBeUndefined();
      expect(newSectionDependencies(template([]))).toBeUndefined();
    });

    it('retire une section supprimée des dépendances, que l’annulation peut restaurer', () => {
      const sections = [section('prep'), section('build', ['prep']), section('go', ['build', 'prep'])];
      const remaining = removeSectionFromDependencies(sections.slice(1), 'prep');
      expect(remaining.map(s => s.dependsOn)).toEqual([[], ['build']]);
      expect(sections[2].dependsOn).toEqual(['build', 'prep']);
    });
  });

  describe('dependencyChips', () => {
    it('liste les autres sections dans l’ordre, avec l’état et les puces de boucle désactivées', () => {
      const t = template([section('prep'), section('build', ['prep']), section('tests', ['build']), section('doc', [], { title: '' })]);
      expect(dependencyChips(t, 'prep')).toEqual([
        { id: 'build', title: 'BUILD', selected: false, disabled: true },
        { id: 'tests', title: 'TESTS', selected: false, disabled: true },
        { id: 'doc', title: 'Sans titre', selected: false, disabled: false }
      ]);
      expect(dependencyChips(t, 'tests').find(c => c.id === 'build')).toEqual({ id: 'build', title: 'BUILD', selected: true, disabled: false });
    });
  });

  describe('summarizeFlow', () => {
    it('compte départs et fins du modèle d’exemple, sans erreur', () => {
      const summary = summarizeFlow(releaseFlow);
      expect(summary.hasFlow).toBe(true);
      expect(summary.starts).toEqual(['rf-prep']);
      expect(summary.ends).toEqual(['rf-deploy']);
      expect(summary.emptySections).toEqual([]);
      expect(summary.errors).toEqual([]);
    });

    it('signale une étape sans contrôle', () => {
      const t = { ...releaseFlow, sections: [...releaseFlow.sections, { id: 'com', title: 'Communication', items: [], dependsOn: ['rf-deploy'] }] };
      expect(summarizeFlow(t).emptySections).toEqual([{ id: 'com', title: 'Communication' }]);
    });

    it('signale une dépendance inconnue héritée d’un import', () => {
      const summary = summarizeFlow(template([section('a'), section('b', ['fantome'])]));
      expect(summary.hasFlow).toBe(true);
      expect(summary.errors.map(e => e.code)).toEqual(['unknown-dependency']);
      expect(summary.starts).toEqual(['a', 'b']);
    });

    it('n’a pas d’enchaînement pour un modèle sans dépendance', () => {
      expect(summarizeFlow(template([section('a'), section('b')])).hasFlow).toBe(false);
    });
  });

  describe('recréation du modèle « Mise en production » sans JSON', () => {
    /**
     * Rejoue, avec les seuls helpers appelés par le builder, ce que ferait un concepteur :
     * nouveau modèle, contexte, sections (titre, icône), contrôles (criticité, preuve), dépendances,
     * porte souple et politique de clôture. Les identifiants sont ceux que le builder générerait.
     */
    function rebuild(): ChecklistTemplate {
      let t: ChecklistTemplate = template([]);
      t = updateTemplate(t, { name: releaseFlow.name, contextSchema: structuredClone(releaseFlow.contextSchema) });
      t = setCompletionPolicy(t, 'blocking');
      const ids = new Map<string, string>();

      for (const source of releaseFlow.sections) {
        const id = `sec-${crypto.randomUUID()}`;
        ids.set(source.id, id);
        // Nouvelle section : elle suit la dernière dans un modèle déjà enchaîné.
        const dependsOn = newSectionDependencies(t);
        t = { ...t, sections: [...t.sections, { id, title: '', icon: '', items: [], ...(dependsOn ? { dependsOn } : {}) }] };
        t = updateSection(t, id, s => ({ ...s, title: source.title }));
        t = setSectionIcon(t, id, resolveStepIcon(source.icon));

        for (const item of source.items) {
          const itemId = `item-${crypto.randomUUID()}`;
          t = addItem(t, id, { id: itemId, label: item.label, controlType: 'checkbox', criticality: 'optional', withTimestamp: false });
          t = setItemCriticality(t, itemId, criticalityOf(item));
          if (item.evidenceRequired) t = setItemEvidence(t, itemId, item.evidenceRequired, item.evidenceHint);
        }

        // Puces « Après : » : on retire la dépendance automatique si elle ne convient pas, on ajoute les bonnes.
        const wanted = (source.dependsOn ?? []).map(d => ids.get(d)!);
        for (const auto of dependsOn ?? []) if (!wanted.includes(auto)) t = toggleDependency(t, id, auto);
        for (const dep of wanted) if (!(byId(t, id).dependsOn ?? []).includes(dep)) t = toggleDependency(t, id, dep);
        if (source.gate) t = setSectionGate(t, id, source.gate);
      }
      return t;
    }

    it('produit le même enchaînement, les mêmes contrôles et la même clôture', () => {
      const rebuilt = rebuild();
      const titleOf = (t: ChecklistTemplate) => new Map(t.sections.map(s => [s.id, s.title]));
      const shape = (t: ChecklistTemplate) => {
        const titles = titleOf(t);
        return t.sections.map(s => ({
          title: s.title,
          icon: s.icon,
          dependsOn: (s.dependsOn ?? []).map(d => titles.get(d)),
          joinMode: s.joinMode ?? 'all',
          gate: s.gate ?? 'hard',
          items: s.items.map(i => ({
            label: i.label,
            controlType: i.controlType,
            criticality: criticalityOf(i),
            evidenceRequired: i.evidenceRequired,
            evidenceHint: i.evidenceHint
          }))
        }));
      };
      const columnsByTitle = (t: ChecklistTemplate) => {
        const titles = titleOf(t);
        return Object.fromEntries(Object.entries(computeColumns(t.sections)).map(([id, column]) => [titles.get(id), column]));
      };

      expect(shape(rebuilt)).toEqual(shape(releaseFlow));
      expect(columnsByTitle(rebuilt)).toEqual(columnsByTitle(releaseFlow));
      expect(rebuilt.contextSchema).toEqual(releaseFlow.contextSchema);
      expect(rebuilt.completionPolicy).toBe(releaseFlow.completionPolicy);
      expect(validateFlow(rebuilt)).toEqual([]);
      expect(summarizeFlow(rebuilt)).toMatchObject({ errors: [], emptySections: [] });
    });
  });

  describe('toPreviewNodes', () => {
    it('donne les icônes de rôle, les colonnes et les légendes du modèle d’exemple', () => {
      const nodes = toPreviewNodes(releaseFlow);
      const node = (id: string) => nodes.find(n => n.id === id)!;
      expect(nodes.map(n => n.id)).toEqual(['rf-prep', 'rf-build', 'rf-doc', 'rf-tests', 'rf-go', 'rf-deploy']);
      expect(nodes.map(n => n.column)).toEqual([0, 1, 1, 2, 3, 4]);
      expect(node('rf-prep').icon).toBe('flag');
      expect(node('rf-go').icon).toBe('git-merge');
      expect(node('rf-deploy').icon).toBe('goal');
      expect(node('rf-build').icon).toBe('hammer');
      expect(node('rf-doc').icon).toBe('book-open');
      expect(node('rf-prep').caption).toBe('3 items · 2 bloq.');
      expect(node('rf-go').parents).toEqual(['rf-tests', 'rf-doc']);
      expect(node('rf-prep').ariaLabel).toBe('Préparation : étape de départ, 3 items dont 2 bloquants');
      expect(node('rf-go').ariaLabel).toContain('jonction de 2 étapes');
    });

    it('nomme une section sans titre et ignore les dépendances inconnues', () => {
      const nodes = toPreviewNodes(template([section('a', undefined, { title: ' ' }), section('b', ['a', 'fantome'])]));
      expect(nodes[0].label).toBe('Sans titre');
      expect(nodes[1].parents).toEqual(['a']);
      expect(nodes[1].icon).toBe('goal');
    });

    it('place à la fin les sections prises dans une boucle importée', () => {
      const nodes = toPreviewNodes(template([section('a', ['b']), section('b', ['a']), section('c')]));
      expect(nodes.map(n => n.id)).toEqual(['c', 'a', 'b']);
    });
  });
});
