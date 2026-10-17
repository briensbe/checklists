import {
  choiceGesture,
  declaresBlocking,
  EvidenceSummary,
  evidenceState,
  isEvidenceSatisfied,
  isSafeHttpUrl,
  NO_EVIDENCE,
  nextActiveItem,
  nextItemToProcess,
  partitionBySize,
  primaryGesture,
  resolveShortcut,
  sectionProgress,
  ShortcutContext,
  stepItem,
  unresolvedBlockingCount,
  visibleItems
} from './quick-check';
import { applicableItems } from './session-rules';
import { ChecklistItemTemplate, ChecklistSession, ChecklistTemplate, ItemAnswer } from '../models/checklist.model';

const answer = (overrides: Partial<ItemAnswer> = {}): ItemAnswer => ({ status: null, comment: '', ...overrides });
const photos = (images: number): EvidenceSummary => ({ total: images, images });

const statusItem: ChecklistItemTemplate = { id: 'st', label: 'Statut' };
const checkItem: ChecklistItemTemplate = { id: 'ck', label: 'Case', controlType: 'checkbox' };
const choiceItem: ChecklistItemTemplate = {
  id: 'ch',
  label: 'Choix',
  controlType: 'choice',
  customChoices: [
    { id: 'go', label: 'Conforme', tone: 'success' },
    { id: 'stop', label: 'Non conforme', tone: 'danger', isBlocking: true }
  ]
};

function template(): ChecklistTemplate {
  return {
    id: 'tpl',
    name: 'Audit',
    description: '',
    version: '1',
    updatedAt: '2026-10-17T00:00:00.000Z',
    contextSchema: [{ id: 'mode', label: 'Mode', type: 'select' }],
    sections: [
      {
        id: 'prep',
        title: 'Préparation',
        items: [
          { id: 'a', label: 'A', controlType: 'checkbox', criticality: 'blocking' },
          { id: 'b', label: 'B', controlType: 'checkbox' },
          { id: 'c', label: 'C' }
        ]
      },
      { id: 'patch', title: 'Patch', items: [{ id: 'p', label: 'P', visibleIf: { fieldId: 'mode', equals: ['patch'] } }] },
      { id: 'build', title: 'Build', items: [{ id: 'd', label: 'D', criticality: 'blocking' }, { id: 'e', label: 'E' }] }
    ]
  };
}

function session(answers: Record<string, ItemAnswer> = {}, overrides: Partial<ChecklistSession> = {}): ChecklistSession {
  return {
    id: 's',
    title: 'Session',
    templateId: 'tpl',
    templateSnapshot: template(),
    status: 'in_progress',
    closures: [],
    contextValues: { mode: 'full' },
    answers,
    createdAt: '2026-10-17T00:00:00.000Z',
    updatedAt: '2026-10-17T00:00:00.000Z',
    ...overrides
  };
}

describe('isSafeHttpUrl', () => {
  it('n’accepte que les adresses absolues http et https', () => {
    expect(isSafeHttpUrl('https://wiki.example.org/api')).toBe(true);
    expect(isSafeHttpUrl(' http://intra/doc ')).toBe(true);
    expect(isSafeHttpUrl('wiki/api')).toBe(false);
    expect(isSafeHttpUrl('ftp://serveur/doc')).toBe(false);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('')).toBe(false);
    expect(isSafeHttpUrl(undefined)).toBe(false);
  });
});

describe('isEvidenceSatisfied et evidenceState', () => {
  it('est toujours satisfaite sans preuve exigée', () => {
    expect(isEvidenceSatisfied(checkItem, undefined, NO_EVIDENCE)).toBe(true);
    expect(evidenceState(checkItem, answer({ checked: true }), NO_EVIDENCE)).toBe('not-required');
  });

  it('applique la règle propre à chaque type de preuve', () => {
    expect(isEvidenceSatisfied({ ...checkItem, evidenceRequired: 'comment' }, answer({ comment: '  ' }), NO_EVIDENCE)).toBe(false);
    expect(isEvidenceSatisfied({ ...checkItem, evidenceRequired: 'comment' }, answer({ comment: 'Résumé' }), NO_EVIDENCE)).toBe(true);
    expect(isEvidenceSatisfied({ ...checkItem, evidenceRequired: 'photo' }, undefined, { total: 2, images: 0 })).toBe(false);
    expect(isEvidenceSatisfied({ ...checkItem, evidenceRequired: 'photo' }, undefined, photos(1))).toBe(true);
    expect(isEvidenceSatisfied({ ...checkItem, evidenceRequired: 'file' }, undefined, { total: 1, images: 0 })).toBe(true);
    expect(isEvidenceSatisfied({ ...checkItem, evidenceRequired: 'link' }, answer({ evidenceLink: 'wiki/api' }), NO_EVIDENCE)).toBe(false);
    expect(
      isEvidenceSatisfied({ ...checkItem, evidenceRequired: 'link' }, answer({ evidenceLink: 'https://wiki' }), NO_EVIDENCE)
    ).toBe(true);
  });

  it('distingue preuve demandée, en attente, manquante et sans objet', () => {
    const item = { ...checkItem, evidenceRequired: 'photo' as const };
    expect(evidenceState(item, undefined, NO_EVIDENCE)).toBe('required');
    expect(evidenceState(item, answer({ checked: true, evidencePending: true }), NO_EVIDENCE)).toBe('pending');
    expect(evidenceState(item, answer({ checked: true }), NO_EVIDENCE)).toBe('missing');
    expect(evidenceState(item, answer({ checked: true }), photos(1))).toBe('satisfied');
    expect(evidenceState(item, answer({ status: 'NA' }), NO_EVIDENCE)).toBe('not-required');
    expect(evidenceState({ ...statusItem, evidenceRequired: 'photo' }, answer({ status: 'KO' }), NO_EVIDENCE)).toBe('not-required');
  });
});

describe('partitionBySize', () => {
  it('sépare les fichiers trop volumineux', () => {
    const { accepted, rejected } = partitionBySize([{ size: 10 }, { size: 60 }, { size: 50 }], 50);
    expect(accepted.map(f => f.size)).toEqual([10, 50]);
    expect(rejected.map(f => f.size)).toEqual([60]);
  });
});

describe('primaryGesture', () => {
  it('Case à cocher : coche puis décoche', () => {
    expect(primaryGesture(checkItem, undefined, NO_EVIDENCE)).toBe('check');
    expect(primaryGesture(checkItem, answer({ checked: true }), NO_EVIDENCE)).toBe('uncheck');
  });

  it('Statut : OK, retrait du OK, correction d’un KO', () => {
    expect(primaryGesture(statusItem, undefined, NO_EVIDENCE)).toBe('ok');
    expect(primaryGesture(statusItem, answer({ status: 'OK' }), NO_EVIDENCE)).toBe('clear');
    expect(primaryGesture(statusItem, answer({ status: 'KO', comment: 'cassé' }), NO_EVIDENCE)).toBe('ok');
  });

  it('Choix et N/A : aucun effet', () => {
    expect(primaryGesture(choiceItem, undefined, NO_EVIDENCE)).toBe('none');
    expect(primaryGesture(checkItem, answer({ status: 'NA' }), NO_EVIDENCE)).toBe('none');
    expect(primaryGesture(statusItem, answer({ status: 'NA' }), NO_EVIDENCE)).toBe('none');
  });

  it('Preuve exigée manquante : demande de preuve ; preuve fournie : réponse directe', () => {
    const item = { ...checkItem, criticality: 'blocking' as const, evidenceRequired: 'photo' as const };
    expect(primaryGesture(item, undefined, NO_EVIDENCE)).toBe('ask-evidence');
    expect(primaryGesture(item, undefined, photos(1))).toBe('check');
    expect(primaryGesture(item, answer({ checked: true, evidencePending: true }), NO_EVIDENCE)).toBe('uncheck');
    expect(primaryGesture({ ...statusItem, evidenceRequired: 'comment' }, undefined, NO_EVIDENCE)).toBe('ask-evidence');
  });
});

describe('choiceGesture', () => {
  it('sélectionne, désélectionne, ignore un N/A', () => {
    expect(choiceGesture(choiceItem, undefined, 'go', NO_EVIDENCE)).toBe('select');
    expect(choiceGesture(choiceItem, answer({ selectedChoice: 'go' }), 'go', NO_EVIDENCE)).toBe('deselect');
    expect(choiceGesture(choiceItem, answer({ status: 'NA' }), 'go', NO_EVIDENCE)).toBe('none');
    expect(choiceGesture(choiceItem, undefined, 'inconnu', NO_EVIDENCE)).toBe('none');
  });

  it('demande la preuve pour un choix sans anomalie, jamais pour un choix en anomalie', () => {
    const item = { ...choiceItem, evidenceRequired: 'comment' as const };
    expect(choiceGesture(item, undefined, 'go', NO_EVIDENCE)).toBe('ask-evidence');
    expect(choiceGesture(item, undefined, 'stop', NO_EVIDENCE)).toBe('select');
  });
});

describe('resolveShortcut', () => {
  const ctx: ShortcutContext = { editable: false, modalOpen: false, readonly: false, onControl: false };
  const key = (k: string, mods: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'metaKey'>> = {}) => ({
    key: k,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...mods
  });

  it('associe chaque touche à son action, en minuscule comme en majuscule', () => {
    expect(resolveShortcut(key('ArrowDown'), ctx)).toBe('next');
    expect(resolveShortcut(key('ArrowUp'), ctx)).toBe('previous');
    expect(resolveShortcut(key(' '), ctx)).toBe('primary');
    expect(resolveShortcut(key('k'), ctx)).toBe('ko');
    expect(resolveShortcut(key('K'), ctx)).toBe('ko');
    expect(resolveShortcut(key('n'), ctx)).toBe('na');
    expect(resolveShortcut(key('A'), ctx)).toBe('drawer');
    expect(resolveShortcut(key('?'), ctx)).toBe('help');
    expect(resolveShortcut(key('Escape'), ctx)).toBe('escape');
    expect(resolveShortcut(key('j'), ctx)).toBeNull();
  });

  it('ignore toute touche pendant une saisie ou avec une modale ouverte', () => {
    for (const k of ['k', 'n', 'a', '?', ' ', 'ArrowDown', 'Escape']) {
      expect(resolveShortcut(key(k), { ...ctx, editable: true })).toBeNull();
      expect(resolveShortcut(key(k), { ...ctx, modalOpen: true })).toBeNull();
    }
  });

  it('laisse passer les raccourcis du navigateur (Ctrl, Alt, Méta)', () => {
    expect(resolveShortcut(key('a', { ctrlKey: true }), ctx)).toBeNull();
    expect(resolveShortcut(key('k', { altKey: true }), ctx)).toBeNull();
    expect(resolveShortcut(key('n', { metaKey: true }), ctx)).toBeNull();
  });

  it('Session terminée : ni geste principal, ni KO, ni N/A ; navigation, tiroir et aide restent', () => {
    const ro = { ...ctx, readonly: true };
    expect(resolveShortcut(key(' '), ro)).toBeNull();
    expect(resolveShortcut(key('k'), ro)).toBeNull();
    expect(resolveShortcut(key('n'), ro)).toBeNull();
    expect(resolveShortcut(key('ArrowDown'), ro)).toBe('next');
    expect(resolveShortcut(key('a'), ro)).toBe('drawer');
    expect(resolveShortcut(key('?'), ro)).toBe('help');
  });

  it('garde le comportement natif d’Espace sur un bouton ou un lien', () => {
    expect(resolveShortcut(key(' '), { ...ctx, onControl: true })).toBeNull();
    expect(resolveShortcut(key('k'), { ...ctx, onControl: true })).toBe('ko');
  });
});

describe('visibleItems, nextActiveItem et stepItem', () => {
  const items = applicableItems(template(), { mode: 'full' });

  it('applique le filtre et le repli, en gardant le contrôle épinglé', () => {
    const answers = { a: answer({ checked: true }) };
    expect(visibleItems(items, answers, 'pending', {}, null).map(i => i.id)).toEqual(['b', 'c', 'd', 'e']);
    expect(visibleItems(items, answers, 'pending', {}, 'a').map(i => i.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(visibleItems(items, answers, 'all', { prep: true }, null).map(i => i.id)).toEqual(['d', 'e']);
    expect(visibleItems(items, { d: answer({ status: 'KO' }) }, 'ko', {}, null).map(i => i.id)).toEqual(['d']);
  });

  it('Item actif qui sort du filtre : le suivant devient actif, sinon le dernier', () => {
    expect(nextActiveItem(['a', 'b', 'c'], ['b', 'c'], 'a')).toBe('b');
    expect(nextActiveItem(['a', 'b', 'c'], ['a', 'b'], 'c')).toBe('b');
    expect(nextActiveItem(['a', 'b'], ['a', 'b'], 'b')).toBe('b');
    expect(nextActiveItem([], ['a'], null)).toBe('a');
    expect(nextActiveItem(['a'], [], 'a')).toBeNull();
  });

  it('navigue sans dépasser les extrémités', () => {
    expect(stepItem(['a', 'b', 'c'], 'b', 1)).toBe('c');
    expect(stepItem(['a', 'b', 'c'], 'c', 1)).toBe('c');
    expect(stepItem(['a', 'b', 'c'], 'a', -1)).toBe('a');
    expect(stepItem(['a', 'b'], null, 1)).toBe('a');
    expect(stepItem([], 'a', 1)).toBeNull();
  });
});

describe('nextItemToProcess', () => {
  const items = applicableItems(template(), { mode: 'full' });

  it('Contrôle suivant sans réponse, à partir de l’item actif', () => {
    const answers = { d: answer({ status: 'OK' }) };
    expect(nextItemToProcess(items, answers, 'c')?.id).toBe('e');
  });

  it('Reprise au début de la checklist', () => {
    const answers = { b: answer({ checked: true }), c: answer({ status: 'OK' }), d: answer({ status: 'OK' }), e: answer({ status: 'NA' }) };
    expect(nextItemToProcess(items, answers, 'c')?.id).toBe('a');
    expect(nextItemToProcess(items, answers, null)?.id).toBe('a');
  });

  it('Tout est renseigné', () => {
    const answers = Object.fromEntries(items.map(i => [i.id, answer({ status: 'NA' })]));
    expect(nextItemToProcess(items, answers, 'a')).toBeNull();
    expect(nextItemToProcess([], {}, null)).toBeNull();
  });
});

describe('sectionProgress, declaresBlocking et unresolvedBlockingCount', () => {
  it('calcule la progression des sections qui ont un contrôle applicable', () => {
    const progress = sectionProgress(session({ a: answer({ checked: true }), d: answer({ status: 'KO', comment: 'x' }) }));
    expect(progress).toEqual([
      { sectionId: 'prep', title: 'Préparation', answered: 1, total: 3, hasAnomaly: false },
      { sectionId: 'build', title: 'Build', answered: 1, total: 2, hasAnomaly: true }
    ]);
    expect(sectionProgress(null)).toEqual([]);
  });

  it('compte les bloquants applicables non résolus, hors porte souple forcée', () => {
    expect(declaresBlocking(template())).toBe(true);
    expect(declaresBlocking({ ...template(), sections: [{ id: 'x', title: 'X', items: [{ id: 'i', label: 'I' }] }] })).toBe(false);
    expect(unresolvedBlockingCount(session())).toBe(2);
    expect(unresolvedBlockingCount(session({ a: answer({ status: 'NA' }), d: answer({ status: 'KO', comment: 'x' }) }))).toBe(1);

    const soft = session({ d: answer({ status: 'KO', comment: 'x' }) }, { forcedGates: [{ sectionId: 'build', reason: 'PO', at: 't' }] });
    soft.templateSnapshot.sections[2].gate = 'soft';
    expect(unresolvedBlockingCount(soft)).toBe(1);
  });
});
