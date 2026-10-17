import { computeStepFlow } from './flow-rules';
import {
  allStepsPassed,
  answerText,
  buildStepViews,
  defaultSelectedStep,
  lockedSectionIds,
  lockedStepItems,
  newlyUnlocked,
  stepFooter,
  stepPrerequisites,
  toGraphNodes,
  unlockedSectionIds
} from './path-view';
import { sectionProgress } from './quick-check';
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

/** « Mise en production » : Préparation → Build ∥ Documentation → Tests → Go (jonction) → Déploiement. */
function releaseSections(): ChecklistSectionTemplate[] {
  return [
    { id: 'prep', title: 'Préparation', icon: 'clipboard-list', items: [blocking('prep-ticket'), optional('prep-changelog')] },
    { id: 'build', title: 'Build', icon: 'document-text', dependsOn: ['prep'], items: [blocking('build-green')] },
    { id: 'doc', title: 'Documentation', dependsOn: ['prep'], gate: 'soft', items: [blocking('doc-user'), optional('doc-faq')] },
    { id: 'tests', title: 'Tests', dependsOn: ['build'], items: [blocking('tests-auto', { evidenceRequired: 'photo' })] },
    { id: 'go', title: 'Go / no-go', dependsOn: ['tests', 'doc'], items: [blocking('go-po')] },
    { id: 'deploy', title: 'Déploiement', dependsOn: ['go'], items: [blocking('deploy-prod'), optional('deploy-comm')] }
  ];
}

function template(sections: ChecklistSectionTemplate[]): ChecklistTemplate {
  return {
    id: 'tpl',
    name: 'Mise en production',
    description: '',
    version: '1',
    updatedAt: '2026-10-17T00:00:00.000Z',
    contextSchema: [],
    sections
  };
}

function session(
  answers: Record<string, ItemAnswer> = {},
  overrides: Partial<ChecklistSession> = {},
  sections = releaseSections()
): ChecklistSession {
  return {
    id: 'sess',
    title: 'Session',
    templateId: 'tpl',
    templateSnapshot: template(sections),
    status: 'in_progress',
    closures: [],
    contextValues: {},
    answers,
    createdAt: '2026-10-17T00:00:00.000Z',
    updatedAt: '2026-10-17T00:00:00.000Z',
    ...overrides
  };
}

const checked = (...ids: string[]): Record<string, ItemAnswer> =>
  Object.fromEntries(ids.map(id => [id, { status: null, checked: true, comment: '' }]));
const ALL_BLOCKING = ['prep-ticket', 'build-green', 'doc-user', 'tests-auto', 'go-po', 'deploy-prod'];
const ALL = [...ALL_BLOCKING, 'prep-changelog', 'doc-faq', 'deploy-comm'];
const sectionOf = (s: ChecklistSession, id: string) => s.templateSnapshot.sections.find(x => x.id === id)!;

describe('defaultSelectedStep', () => {
  it('première étape ouverte de l’ordre topologique', () => {
    expect(defaultSelectedStep(computeStepFlow(session()))).toBe('prep');
    expect(defaultSelectedStep(computeStepFlow(session(checked('prep-ticket', 'prep-changelog'))))).toBe('build');
  });

  it('sinon la première étape franchie avec des restes', () => {
    expect(defaultSelectedStep(computeStepFlow(session(checked(...ALL_BLOCKING))))).toBe('prep');
  });

  it('sinon la dernière étape, quand tout est terminé', () => {
    expect(defaultSelectedStep(computeStepFlow(session(checked(...ALL))))).toBe('deploy');
  });

  it('aucune étape : null', () => {
    expect(defaultSelectedStep(computeStepFlow(null))).toBeNull();
  });
});

describe('sections verrouillées, portes ouvertes et fin du chemin', () => {
  it('liste les sections verrouillées et débloquées', () => {
    const flow = computeStepFlow(session());
    expect([...lockedSectionIds(flow)].sort()).toEqual(['build', 'deploy', 'doc', 'go', 'tests']);
    expect([...unlockedSectionIds(flow)]).toEqual(['prep']);
  });

  it('détecte les étapes nouvellement débloquées, dans l’ordre topologique', () => {
    const before = unlockedSectionIds(computeStepFlow(session()));
    expect(newlyUnlocked(before, computeStepFlow(session(checked('prep-ticket'))))).toEqual(['build', 'doc']);
    expect(newlyUnlocked(before, computeStepFlow(session()))).toEqual([]);
  });

  it('toutes les étapes franchies, seulement sur un modèle à dépendances', () => {
    expect(allStepsPassed(computeStepFlow(session(checked(...ALL_BLOCKING))))).toBe(true);
    expect(allStepsPassed(computeStepFlow(session(checked('prep-ticket'))))).toBe(false);
    const flat = releaseSections().map(({ dependsOn: _deps, ...s }) => s);
    expect(allStepsPassed(computeStepFlow(session(checked(...ALL_BLOCKING), {}, flat)))).toBe(false);
  });
});

describe('stepPrerequisites', () => {
  it('prérequis d’une jonction : prête et bloquants en cours', () => {
    const s = session(checked('prep-ticket', 'build-green', 'tests-auto'));
    const prereq = stepPrerequisites(sectionOf(s, 'go'), s.templateSnapshot, computeStepFlow(s));
    expect(prereq).toEqual({
      joinMode: 'all',
      items: [
        { sectionId: 'tests', title: 'Tests', state: 'ready' },
        { sectionId: 'doc', title: 'Documentation', state: 'in-progress' }
      ]
    });
  });

  it('prérequis pas encore ouvert, et jonction en mode « any »', () => {
    const sections = releaseSections();
    sections[4].joinMode = 'any';
    const s = session({}, {}, sections);
    const prereq = stepPrerequisites(sectionOf(s, 'go'), s.templateSnapshot, computeStepFlow(s));
    expect(prereq.joinMode).toBe('any');
    expect(prereq.items.map(p => p.state)).toEqual(['not-open', 'not-open']);
  });
});

describe('lockedStepItems et answerText', () => {
  it('rappelle les réponses d’une étape reverrouillée', () => {
    const s = session(checked('prep-ticket', 'tests-auto'));
    expect(computeStepFlow(s).steps['tests'].unlocked).toBe(false);
    expect(lockedStepItems(sectionOf(s, 'tests'), s)).toEqual([{ id: 'tests-auto', label: 'tests-auto', answerText: 'fait' }]);
    expect(lockedStepItems(sectionOf(s, 'go'), s)).toEqual([{ id: 'go-po', label: 'go-po', answerText: null }]);
  });

  it('texte de chaque type de réponse', () => {
    const status: ChecklistItemTemplate = { id: 'st', label: 'Statut' };
    const choice: ChecklistItemTemplate = {
      id: 'ch',
      label: 'Choix',
      controlType: 'choice',
      customChoices: [{ id: 'go', label: 'Conforme', tone: 'success' }]
    };
    expect(answerText(status, { status: 'OK', comment: '' })).toBe('OK');
    expect(answerText(status, { status: 'KO', comment: 'x' })).toBe('KO');
    expect(answerText(status, { status: 'NA', comment: '' })).toBe('N/A');
    expect(answerText(status, { status: null, comment: '' })).toBeNull();
    expect(answerText(choice, { status: null, selectedChoice: 'go', comment: '' })).toBe('Conforme');
    expect(answerText(optional('c'), { status: null, checked: false, comment: '' })).toBeNull();
    expect(answerText(optional('c'), undefined)).toBeNull();
  });
});

describe('stepFooter', () => {
  const footer = (s: ChecklistSession, id: string, evidence = {}) => stepFooter(sectionOf(s, id), s, computeStepFlow(s), evidence);

  it('bloquants restants avant d’ouvrir la suite', () => {
    expect(footer(session(), 'prep')).toMatchObject({ passed: false, unresolvedBlocking: 1, isFinal: false });
  });

  it('porte ouverte vers les étapes suivantes', () => {
    expect(footer(session(checked('prep-ticket')), 'prep').next).toEqual([
      { sectionId: 'build', title: 'Build', unlocked: true },
      { sectionId: 'doc', title: 'Documentation', unlocked: true }
    ]);
  });

  it('étape suivante qui attend encore une autre branche', () => {
    const f = footer(session(checked('prep-ticket', 'build-green', 'tests-auto')), 'tests');
    expect(f.passed).toBe(true);
    expect(f.next).toEqual([{ sectionId: 'go', title: 'Go / no-go', unlocked: false }]);
  });

  it('étape finale et toutes les étapes franchies', () => {
    expect(footer(session(checked(...ALL_BLOCKING)), 'deploy')).toMatchObject({ isFinal: true, allPassed: true, passed: true });
    expect(footer(session(checked('prep-ticket')), 'deploy').allPassed).toBe(false);
  });

  it('bloquant passé en N/A', () => {
    const f = footer(session({ 'prep-ticket': { status: 'NA', comment: '' } }), 'prep');
    expect(f.naBlocking).toEqual([{ id: 'prep-ticket', label: 'prep-ticket' }]);
    expect(f.passed).toBe(true);
  });

  it('preuve à compléter et preuve manquante', () => {
    const base = checked('prep-ticket', 'build-green');
    const missing = session({ ...base, ...checked('tests-auto') });
    expect(footer(missing, 'tests').missing).toEqual([{ id: 'tests-auto', label: 'tests-auto' }]);
    expect(footer(missing, 'tests', { 'tests-auto': { total: 1, images: 1 } }).missing).toEqual([]);

    const pending = session({ ...base, 'tests-auto': { status: null, checked: true, evidencePending: true, comment: '' } });
    const f = footer(pending, 'tests');
    expect(f.pending).toEqual([{ id: 'tests-auto', label: 'tests-auto' }]);
    expect(f.missing).toEqual([]);
  });

  it('porte souple : forçage proposé, puis affiché une fois enregistré', () => {
    const open = session(checked('prep-ticket'));
    expect(footer(open, 'doc')).toMatchObject({ canForce: true, forced: null });
    expect(footer(open, 'build').canForce).toBe(false);

    const gate = { sectionId: 'doc', reason: 'Validé par le PO', at: '2026-10-17T10:00:00.000Z' };
    const forced = session(checked('prep-ticket'), { forcedGates: [gate] });
    expect(footer(forced, 'doc')).toMatchObject({ canForce: false, forced: gate, passed: true });
  });

  it('aucun forçage sur une étape verrouillée ou une session terminée ; forçage ignoré si la porte redevient stricte', () => {
    expect(footer(session(), 'doc').canForce).toBe(false);
    expect(footer(session(checked('prep-ticket'), { status: 'completed' }), 'doc').canForce).toBe(false);

    const sections = releaseSections();
    sections[2].gate = 'hard';
    const gate = { sectionId: 'doc', reason: 'PO', at: 't' };
    expect(footer(session(checked('prep-ticket'), { forcedGates: [gate] }, sections), 'doc').forced).toBeNull();
  });
});

describe('toGraphNodes', () => {
  it('construit les nœuds dans l’ordre topologique, icône résolue, dépendances, progression et jonction', () => {
    const s = session(checked('prep-ticket'));
    const nodes = toGraphNodes(computeStepFlow(s), s.templateSnapshot, sectionProgress(s));
    expect(nodes.map(n => n.id)).toEqual(['prep', 'build', 'doc', 'tests', 'go', 'deploy']);

    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    expect(byId['prep']).toMatchObject({ icon: 'clipboard-list', column: 0, parents: [], passed: true, answered: 1, total: 2, visual: 'passed' });
    expect(byId['build']).toMatchObject({ icon: 'file-text', column: 1, parents: ['prep'], visual: 'open' });
    expect(byId['doc'].icon).toBe('list-checks');
    expect(byId['go']).toMatchObject({ column: 3, parents: ['tests', 'doc'], visual: 'locked', join: { ready: 0, total: 2 } });
  });
});

describe('buildStepViews', () => {
  it('assemble l’affichage de chaque étape : icône, état, jonction, progression, contenu verrouillé et pied', () => {
    const s = session(checked('prep-ticket'));
    const views = buildStepViews(s, computeStepFlow(s), {}, sectionProgress(s));
    expect(Object.keys(views)).toEqual(['prep', 'build', 'doc', 'tests', 'go', 'deploy']);
    expect(views['build']).toMatchObject({ title: 'Build', icon: 'file-text', visual: 'open', isJoin: false, answered: 0, total: 1, lockedItems: [] });
    expect(views['go']).toMatchObject({ visual: 'locked', isJoin: true });
    expect(views['go'].lockedItems).toEqual([{ id: 'go-po', label: 'go-po', answerText: null }]);
    expect(views['prep'].footer.next.map(n => n.sectionId)).toEqual(['build', 'doc']);
  });
});
