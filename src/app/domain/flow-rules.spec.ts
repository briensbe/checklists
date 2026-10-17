import {
  computeColumns,
  computeStepFlow,
  criticalityOf,
  isResolved,
  topologicalOrder,
  validateFlow,
  wouldCreateCycle
} from './flow-rules';
import {
  ChecklistItemTemplate,
  ChecklistSectionTemplate,
  ChecklistSession,
  ChecklistTemplate,
  ItemAnswer
} from '../models/checklist.model';

const blocking = (id: string, extra: Partial<ChecklistItemTemplate> = {}): ChecklistItemTemplate => ({
  id,
  label: id,
  controlType: 'checkbox',
  criticality: 'blocking',
  ...extra
});
const optional = (id: string, extra: Partial<ChecklistItemTemplate> = {}): ChecklistItemTemplate => ({
  id,
  label: id,
  controlType: 'checkbox',
  ...extra
});

/** « Mise en production » de la maquette 03 : Préparation → Build ∥ Documentation → Tests → Go (jonction) → Déploiement. */
function releaseSections(): ChecklistSectionTemplate[] {
  return [
    { id: 'prep', title: 'Préparation', items: [blocking('prep-ticket'), optional('prep-changelog')] },
    { id: 'build', title: 'Build', dependsOn: ['prep'], items: [blocking('build-green')] },
    { id: 'doc', title: 'Documentation', dependsOn: ['prep'], items: [blocking('doc-user'), optional('doc-faq')] },
    { id: 'tests', title: 'Tests', dependsOn: ['build'], items: [blocking('tests-auto')] },
    { id: 'go', title: 'Go / no-go', dependsOn: ['tests', 'doc'], items: [blocking('go-po')] },
    { id: 'deploy', title: 'Déploiement', dependsOn: ['go'], items: [blocking('deploy-prod'), optional('deploy-comm')] }
  ];
}

function template(sections: ChecklistSectionTemplate[], overrides: Partial<ChecklistTemplate> = {}): ChecklistTemplate {
  return {
    id: 'tpl',
    name: 'Mise en production',
    description: '',
    version: '1',
    updatedAt: '2026-10-17T00:00:00.000Z',
    contextSchema: [{ id: 'mode', label: 'Mode', type: 'select' }],
    sections,
    ...overrides
  };
}

function session(sections: ChecklistSectionTemplate[], answers: Record<string, ItemAnswer> = {}, overrides: Partial<ChecklistSession> = {}): ChecklistSession {
  return {
    id: 'sess',
    title: 'Session',
    templateId: 'tpl',
    templateSnapshot: template(sections),
    status: 'in_progress',
    closures: [],
    contextValues: { mode: 'full' },
    answers,
    createdAt: '2026-10-17T00:00:00.000Z',
    updatedAt: '2026-10-17T00:00:00.000Z',
    ...overrides
  };
}

const checked = (...ids: string[]): Record<string, ItemAnswer> =>
  Object.fromEntries(ids.map(id => [id, { status: null, checked: true, comment: '' }]));

describe('criticalityOf et isResolved', () => {
  it('traite un contrôle sans criticité comme optionnel', () => {
    expect(criticalityOf({ id: 'x', label: 'X' })).toBe('optional');
    expect(criticalityOf(blocking('y'))).toBe('blocking');
  });

  it('résout OK, N/A, coché et choix sans anomalie ; jamais KO ni choix en anomalie', () => {
    const status: ChecklistItemTemplate = { id: 's', label: 'S' };
    const choice: ChecklistItemTemplate = {
      id: 'c',
      label: 'C',
      controlType: 'choice',
      customChoices: [
        { id: 'go', label: 'Go', tone: 'success' },
        { id: 'stop', label: 'Stop', tone: 'danger', isBlocking: true }
      ]
    };
    expect(isResolved(status, { status: 'OK', comment: '' })).toBe(true);
    expect(isResolved(status, { status: 'NA', comment: '' })).toBe(true);
    expect(isResolved(status, { status: 'KO', comment: 'justifié' })).toBe(false);
    expect(isResolved(status, undefined)).toBe(false);
    expect(isResolved(optional('k'), { status: null, checked: true, comment: '' })).toBe(true);
    expect(isResolved(choice, { status: null, selectedChoice: 'go', comment: '' })).toBe(true);
    expect(isResolved(choice, { status: null, selectedChoice: 'stop', comment: '' })).toBe(false);
  });
});

describe('computeStepFlow : dépendances et portes', () => {
  it('Modèle sans dépendance : tout est débloqué, même avec des bloquants non résolus', () => {
    const sections = releaseSections().map(({ dependsOn: _d, ...s }) => s);
    const flow = computeStepFlow(session(sections));
    expect(flow.hasFlow).toBe(false);
    expect(Object.values(flow.steps).every(s => s.unlocked)).toBe(true);
    expect(flow.leftBehind).toEqual([]);
  });

  it('Étape verrouillée par un prérequis', () => {
    const flow = computeStepFlow(session(releaseSections()));
    expect(flow.hasFlow).toBe(true);
    expect(flow.steps['prep'].unlocked).toBe(true);
    expect(flow.steps['build'].unlocked).toBe(false);
    expect(flow.steps['build'].visual).toBe('locked');
  });

  it('Bifurcation implicite : deux étapes de même dépendance s’ouvrent ensemble, un optionnel sans réponse ne bloque pas', () => {
    const flow = computeStepFlow(session(releaseSections(), checked('prep-ticket')));
    expect(flow.steps['build'].unlocked).toBe(true);
    expect(flow.steps['doc'].unlocked).toBe(true);
  });

  it('N/A résout un bloquant, KO ne le résout pas même commenté', () => {
    const sections = releaseSections();
    sections[0].items = [{ id: 'prep-ticket', label: 'Ticket', criticality: 'blocking' }];
    const na = computeStepFlow(session(sections, { 'prep-ticket': { status: 'NA', comment: '' } }));
    expect(na.steps['build'].unlocked).toBe(true);
    const ko = computeStepFlow(session(sections, { 'prep-ticket': { status: 'KO', comment: 'cassé' } }));
    expect(ko.steps['prep'].blockingResolved).toBe(false);
    expect(ko.steps['build'].unlocked).toBe(false);
  });

  it('Bloquant masqué par une condition d’affichage : non pris en compte', () => {
    const sections = releaseSections();
    sections[0].items = [blocking('prep-patch', { visibleIf: { fieldId: 'mode', equals: ['patch'] } })];
    const flow = computeStepFlow(session(sections));
    expect(flow.steps['prep'].blockingResolved).toBe(true);
    expect(flow.steps['build'].unlocked).toBe(true);
  });

  it('Section sans contrôle applicable : franchie d’office', () => {
    const sections = releaseSections();
    sections[0].items = [optional('prep-patch', { visibleIf: { fieldId: 'mode', equals: ['patch'] } })];
    const flow = computeStepFlow(session(sections));
    expect(flow.steps['prep'].passed).toBe(true);
    expect(flow.steps['prep'].visual).toBe('done');
  });

  it('Jonction qui attend toutes les branches, avec sa progression', () => {
    const flow = computeStepFlow(session(releaseSections(), checked('prep-ticket', 'build-green', 'tests-auto')));
    expect(flow.steps['tests'].passed).toBe(true);
    expect(flow.steps['go'].unlocked).toBe(false);
    expect(flow.steps['go'].join).toEqual({ ready: 1, total: 2 });
    expect(flow.steps['build'].join).toBeNull();
  });

  it('Jonction sur une seule branche (joinMode any)', () => {
    const sections = releaseSections();
    sections[4].joinMode = 'any';
    const flow = computeStepFlow(session(sections, checked('prep-ticket', 'build-green', 'tests-auto')));
    expect(flow.steps['go'].unlocked).toBe(true);
  });

  it('Reverrouillage sans perte de réponses', () => {
    const answers = checked('prep-ticket', 'build-green', 'tests-auto');
    const before = computeStepFlow(session(releaseSections(), answers));
    expect(before.steps['tests'].unlocked).toBe(true);

    const withdrawn = { ...answers, 'prep-ticket': { status: null, checked: false, comment: '' } };
    const s = session(releaseSections(), withdrawn);
    const after = computeStepFlow(s);
    expect(after.steps['build'].unlocked).toBe(false);
    expect(after.steps['tests'].unlocked).toBe(false);
    expect(s.answers['tests-auto'].checked).toBe(true);
  });
});

describe('computeStepFlow : portes souples forcées', () => {
  const softDoc = (): ChecklistSectionTemplate[] => {
    const sections = releaseSections();
    sections[2].gate = 'soft';
    sections[2].items = [{ id: 'doc-user', label: 'Doc', criticality: 'blocking' }];
    return sections;
  };
  const forcedDoc = [{ sectionId: 'doc', reason: 'Dérogation validée par le PO', at: '2026-10-17T10:00:00.000Z' }];

  it('Forçage d’une porte souple : la section est franchie et la jonction progresse', () => {
    const answers = { ...checked('prep-ticket', 'build-green', 'tests-auto'), 'doc-user': { status: 'KO' as const, comment: 'incomplète' } };
    const flow = computeStepFlow(session(softDoc(), answers, { forcedGates: forcedDoc }));
    expect(flow.steps['doc'].forced).toBe(true);
    expect(flow.steps['doc'].passed).toBe(true);
    expect(flow.steps['go'].unlocked).toBe(true);
  });

  it('Porte redevenue stricte : le forçage n’a plus d’effet', () => {
    const sections = softDoc();
    sections[2].gate = 'hard';
    const flow = computeStepFlow(session(sections, checked('prep-ticket'), { forcedGates: forcedDoc }));
    expect(flow.steps['doc'].forced).toBe(false);
    expect(flow.steps['doc'].passed).toBe(false);
  });

  it('Un forçage ne franchit pas une section verrouillée', () => {
    const flow = computeStepFlow(session(softDoc(), {}, { forcedGates: forcedDoc }));
    expect(flow.steps['doc'].unlocked).toBe(false);
    expect(flow.steps['doc'].passed).toBe(false);
  });
});

describe('computeStepFlow : états visuels, suites et laissés en route', () => {
  it('distingue ouverte, franchie avec des restes et terminée', () => {
    expect(computeStepFlow(session(releaseSections())).steps['prep'].visual).toBe('open');
    expect(computeStepFlow(session(releaseSections(), checked('prep-ticket'))).steps['prep'].visual).toBe('passed');
    expect(computeStepFlow(session(releaseSections(), checked('prep-ticket', 'prep-changelog'))).steps['prep'].visual).toBe('done');
  });

  it('Étape qui attend une autre branche', () => {
    const flow = computeStepFlow(session(releaseSections(), checked('prep-ticket', 'build-green', 'tests-auto')));
    expect(flow.steps['tests'].next).toEqual([{ sectionId: 'go', unlocked: false }]);
    expect(flow.steps['prep'].next).toEqual([
      { sectionId: 'build', unlocked: true },
      { sectionId: 'doc', unlocked: true }
    ]);
  });

  it('Optionnel oublié dans une étape franchie : laissé en route', () => {
    const flow = computeStepFlow(session(releaseSections(), checked('prep-ticket')));
    expect(flow.leftBehind.map(i => [i.id, i.sectionId])).toEqual([['prep-changelog', 'prep']]);
  });

  it('Dernière étape : jamais de contrôle laissé en route', () => {
    const all = checked('prep-ticket', 'prep-changelog', 'build-green', 'doc-user', 'doc-faq', 'tests-auto', 'go-po', 'deploy-prod');
    const flow = computeStepFlow(session(releaseSections(), all));
    expect(flow.steps['deploy'].visual).toBe('passed');
    expect(flow.leftBehind).toEqual([]);
  });

  it('Preuve en attente : l’étape reste « franchie avec des restes » et le contrôle est laissé en route', () => {
    const sections = releaseSections();
    sections[0].items = [blocking('prep-ticket'), optional('prep-changelog', { criticality: 'important', evidenceRequired: 'comment' })];
    const answers = {
      ...checked('prep-ticket'),
      'prep-changelog': { status: null, checked: true, comment: '', evidencePending: true }
    };
    const flow = computeStepFlow(session(sections, answers));
    expect(flow.steps['prep'].passed).toBe(true);
    expect(flow.steps['prep'].visual).toBe('passed');
    expect(flow.leftBehind.map(i => i.id)).toEqual(['prep-changelog']);
  });
});

describe('Ordre, colonnes et boucles', () => {
  it('trie les sections après leurs dépendances, de façon stable', () => {
    const shuffled = [...releaseSections()].reverse();
    const { order, unordered } = topologicalOrder(shuffled);
    expect(unordered).toEqual([]);
    expect(order.indexOf('prep')).toBeLessThan(order.indexOf('build'));
    expect(order.indexOf('doc')).toBeLessThan(order.indexOf('go'));
    expect(order.indexOf('go')).toBeLessThan(order.indexOf('deploy'));
  });

  it('Colonnes d’un graphe à branches', () => {
    expect(computeColumns(releaseSections())).toEqual({ prep: 0, build: 1, doc: 1, tests: 2, go: 3, deploy: 4 });
  });

  it('Dépendance qui créerait une boucle', () => {
    const sections = releaseSections();
    expect(wouldCreateCycle(sections, 'prep', 'build')).toBe(true);
    expect(wouldCreateCycle(sections, 'prep', 'deploy')).toBe(true);
    expect(wouldCreateCycle(sections, 'prep', 'prep')).toBe(true);
    expect(wouldCreateCycle(sections, 'doc', 'build')).toBe(false);
  });

  it('Boucle présente dans les données : les sections concernées sont débloquées', () => {
    const sections: ChecklistSectionTemplate[] = [
      { id: 'a', title: 'A', dependsOn: ['b'], items: [blocking('a1')] },
      { id: 'b', title: 'B', dependsOn: ['a'], items: [blocking('b1')] },
      { id: 'c', title: 'C', items: [blocking('c1')] }
    ];
    const flow = computeStepFlow(session(sections));
    expect(flow.cycle).toEqual(['a', 'b']);
    expect(flow.steps['a'].unlocked).toBe(true);
    expect(flow.steps['b'].unlocked).toBe(true);
    expect(flow.order).toEqual(['c', 'a', 'b']);
  });

  it('ignore une dépendance vers une section inconnue', () => {
    const sections: ChecklistSectionTemplate[] = [{ id: 'a', title: 'A', dependsOn: ['ghost'], items: [blocking('a1')] }];
    const flow = computeStepFlow(session(sections));
    expect(flow.steps['a'].unlocked).toBe(true);
    expect(flow.hasFlow).toBe(false);
  });

  it('renvoie un résultat vide sans session', () => {
    expect(computeStepFlow(null).steps).toEqual({});
  });
});

describe('validateFlow', () => {
  it('accepte un enchaînement valide', () => {
    expect(validateFlow(template(releaseSections(), { completionPolicy: 'blocking' }))).toEqual([]);
  });

  it('signale doublons, dépendance vers soi, dépendance inconnue et boucle en nommant les sections', () => {
    const sections: ChecklistSectionTemplate[] = [
      { id: 'a', title: 'Alpha', dependsOn: ['b'], items: [] },
      { id: 'b', title: 'Bêta', dependsOn: ['a'], items: [] },
      { id: 'c', title: 'Gamma', dependsOn: ['c', 'ghost'], items: [] },
      { id: 'c', title: 'Gamma bis', items: [] }
    ];
    const issues = validateFlow(template(sections));
    expect(issues.map(i => i.code).sort()).toEqual(['cycle', 'duplicate-section-id', 'self-dependency', 'unknown-dependency']);
    expect(issues.find(i => i.code === 'cycle')?.message).toContain('« Alpha », « Bêta »');
    expect(issues.find(i => i.code === 'unknown-dependency')?.message).toContain('ghost');
  });

  it('signale les valeurs hors liste', () => {
    const raw = {
      ...template([
        {
          id: 'a',
          title: 'A',
          joinMode: 'some',
          gate: 'open',
          items: [{ id: 'i', label: 'Item', criticality: 'critique', evidenceRequired: 'video' }]
        } as unknown as ChecklistSectionTemplate
      ]),
      completionPolicy: 'never'
    } as unknown as ChecklistTemplate;
    const codes = validateFlow(raw).map(i => i.code).sort();
    expect(codes).toEqual(['invalid-completion-policy', 'invalid-criticality', 'invalid-evidence', 'invalid-gate', 'invalid-join-mode']);
    expect(validateFlow(raw).find(i => i.code === 'invalid-criticality')?.message).toContain('« Item »');
  });
});
