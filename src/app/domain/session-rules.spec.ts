import {
  applicableItems,
  computeMetrics,
  diffTemplates,
  hasTemplateUpdate,
  isAnswered,
  rebaseSessionOnTemplate,
  validateForCompletion
} from './session-rules';
import { ChecklistSession, ChecklistTemplate } from '../models/checklist.model';

function template(overrides: Partial<ChecklistTemplate> = {}): ChecklistTemplate {
  return {
    id: 'tpl',
    name: 'Audit',
    description: '',
    version: '1',
    updatedAt: '2026-10-01T00:00:00.000Z',
    contextSchema: [
      { id: 'mode', label: 'Mode', type: 'select', required: true },
      { id: 'note', label: 'Note', type: 'text' }
    ],
    sections: [
      {
        id: 's1',
        title: 'Section 1',
        items: [
          { id: 'always', label: 'Toujours' },
          { id: 'patch', label: 'Patch seulement', visibleIf: { fieldId: 'mode', equals: ['patch'] } },
          { id: 'na-reason', label: 'NA motivé', requireNaReason: true }
        ]
      },
      {
        id: 's2',
        title: 'Section 2',
        items: [
          { id: 'check', label: 'Case', controlType: 'checkbox' },
          {
            id: 'choice',
            label: 'Choix',
            controlType: 'choice',
            customChoices: [
              { id: 'go', label: 'Go', tone: 'success' },
              { id: 'stop', label: 'Stop', tone: 'danger', isBlocking: true }
            ]
          }
        ]
      }
    ],
    ...overrides
  };
}

function session(overrides: Partial<ChecklistSession> = {}): ChecklistSession {
  return {
    id: 'sess',
    title: 'Session',
    templateId: 'tpl',
    templateSnapshot: template(),
    status: 'in_progress',
    closures: [],
    contextValues: { mode: 'full' },
    answers: {},
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides
  };
}

describe('applicableItems (conditionnement contextuel)', () => {
  it('Bascule vers le mode patch : l’item conditionnel devient applicable', () => {
    const ids = applicableItems(template(), { mode: 'patch' }).map(i => i.id);
    expect(ids).toContain('patch');
  });

  it('Bascule vers le mode complet : l’item conditionnel est exclu, y compris si le contexte est vide', () => {
    expect(applicableItems(template(), { mode: 'full' }).map(i => i.id)).not.toContain('patch');
    expect(applicableItems(template(), {}).map(i => i.id)).not.toContain('patch');
  });

  it('Condition à valeurs multiples', () => {
    const t = template();
    t.sections[0].items[1].visibleIf = { fieldId: 'type', equals: ['majeure', 'mineure'] };
    expect(applicableItems(t, { type: 'mineure' }).map(i => i.id)).toContain('patch');
    expect(applicableItems(t, { type: 'hotfix' }).map(i => i.id)).not.toContain('patch');
  });

  it('enrichit les items avec leur section', () => {
    const item = applicableItems(template(), {}).find(i => i.id === 'check');
    expect(item?.sectionId).toBe('s2');
    expect(item?.sectionTitle).toBe('Section 2');
  });

  it('gère la tolérance de format de date (DD/MM/YYYY vs YYYY-MM-DD)', () => {
    const t = template();
    t.sections[0].items[1].visibleIf = { fieldId: 'date_audit', equals: ['15/10/2026'] };

    // Input HTML5 date renvoie "2026-10-15"
    expect(applicableItems(t, { date_audit: '2026-10-15' }).map(i => i.id)).toContain('patch');
    // Saisie texte identique "15/10/2026"
    expect(applicableItems(t, { date_audit: '15/10/2026' }).map(i => i.id)).toContain('patch');
    // Autre date non correspondante
    expect(applicableItems(t, { date_audit: '2026-10-16' }).map(i => i.id)).not.toContain('patch');
  });
});

describe('isAnswered', () => {
  it('applique la règle propre à chaque type de contrôle', () => {
    expect(isAnswered({ id: 'a', label: 'a' }, { status: 'NA', comment: '' })).toBe(true);
    expect(isAnswered({ id: 'a', label: 'a' }, { status: null, comment: 'x' })).toBe(false);
    expect(isAnswered({ id: 'a', label: 'a', controlType: 'checkbox' }, { status: null, checked: false, comment: '' })).toBe(false);
    expect(isAnswered({ id: 'a', label: 'a', controlType: 'checkbox' }, { status: null, checked: true, comment: '' })).toBe(true);
    expect(isAnswered({ id: 'a', label: 'a', controlType: 'choice' }, { status: null, selectedChoice: 'go', comment: '' })).toBe(true);
    expect(isAnswered({ id: 'a', label: 'a' }, undefined)).toBe(false);
  });
});

describe('computeMetrics', () => {
  it('ne compte que les items applicables et classe OK / KO / NA', () => {
    const s = session({
      answers: {
        always: { status: 'OK', comment: '' },
        patch: { status: 'KO', comment: '' }, // masqué en mode full : ignoré
        'na-reason': { status: 'NA', comment: '' },
        check: { status: null, checked: true, comment: '' },
        choice: { status: null, selectedChoice: 'stop', comment: '' }
      }
    });
    expect(computeMetrics(s)).toEqual({ total: 4, answered: 4, okCount: 2, koCount: 1, naCount: 1, pending: 0, percent: 100 });
  });

  it('Réponse conservée sur un item masqué : elle compte à nouveau quand l’item réapparaît', () => {
    const s = session({ answers: { patch: { status: 'OK', comment: '' } } });
    expect(computeMetrics(s).answered).toBe(0);
    expect(computeMetrics({ ...s, contextValues: { mode: 'patch' } }).answered).toBe(1);
  });

  it('renvoie des métriques nulles sans session', () => {
    expect(computeMetrics(null).total).toBe(0);
  });
});

describe('validateForCompletion', () => {
  const complete = {
    always: { status: 'OK' as const, comment: '' },
    'na-reason': { status: 'NA' as const, comment: 'non concerné' },
    check: { status: null, checked: true, comment: '' },
    choice: { status: null, selectedChoice: 'go', comment: '' }
  };

  it('Clôture d’une session conforme : aucune anomalie', () => {
    expect(validateForCompletion(session({ answers: complete }))).toEqual([]);
  });

  it('Clôture refusée : KO sans commentaire et contexte requis vide', () => {
    const s = session({
      contextValues: { mode: '' },
      answers: { ...complete, always: { status: 'KO', comment: '   ' } }
    });
    const issues = validateForCompletion(s);
    expect(issues.map(i => i.kind)).toEqual(['context-required', 'ko-without-comment']);
    expect(issues[0]).toMatchObject({ fieldId: 'mode', label: 'Mode' });
    expect(issues[1]).toMatchObject({ itemId: 'always', sectionId: 's1', sectionTitle: 'Section 1' });
  });

  it('signale les items sans réponse et les N/A sans motif exigé', () => {
    const s = session({
      answers: { ...complete, 'na-reason': { status: 'NA', comment: '' }, check: { status: null, checked: false, comment: '' } }
    });
    expect(validateForCompletion(s).map(i => [i.kind, i.itemId])).toEqual([
      ['na-without-reason', 'na-reason'],
      ['unanswered', 'check']
    ]);
  });

  it('Item masqué non évalué', () => {
    // 'patch' n'a pas de réponse mais il est masqué en mode full.
    expect(validateForCompletion(session({ answers: complete })).some(i => i.itemId === 'patch')).toBe(false);
  });
});

describe('hasTemplateUpdate', () => {
  const newer = template({ updatedAt: '2026-10-05T00:00:00.000Z' });

  it('détecte une version plus récente pour une session en cours', () => {
    expect(hasTemplateUpdate(session(), newer)).toBe(true);
    expect(hasTemplateUpdate(session(), template())).toBe(false);
  });

  it('ignore les sessions terminées, les templates supprimés et les structures indisponibles', () => {
    expect(hasTemplateUpdate(session({ status: 'completed' }), newer)).toBe(false);
    expect(hasTemplateUpdate(session(), undefined)).toBe(false);
    expect(hasTemplateUpdate(session({ structureUnavailable: true }), newer)).toBe(false);
  });
});

describe('diffTemplates et rebaseSessionOnTemplate', () => {
  function nextVersion(): ChecklistTemplate {
    const t = template({ updatedAt: '2026-10-05T00:00:00.000Z', version: '2' });
    t.contextSchema.push({ id: 'owner', label: 'Responsable', type: 'text', defaultValue: 'Benoît' });
    t.sections[1].items = t.sections[1].items.filter(i => i.id !== 'check' && i.id !== 'choice');
    t.sections[1].items.push({ id: 'new-item', label: 'Nouveau' });
    return t;
  }

  it('Récapitulatif : items ajoutés, supprimés et supprimés avec données', () => {
    const s = session({ answers: { check: { status: null, checked: true, comment: '' } } });
    const diff = diffTemplates(s.templateSnapshot, nextVersion(), s, new Set(['choice']));
    expect(diff.added.map(i => i.id)).toEqual(['new-item']);
    expect(diff.removed.map(i => i.id)).toEqual(['check', 'choice']);
    expect(diff.removedWithData.map(i => i.id)).toEqual(['check', 'choice']);
  });

  it('Application confirmée : réponses conservées, purgées et contexte complété', () => {
    const s = session({
      contextValues: { mode: 'patch', note: 'déjà saisi' },
      answers: { always: { status: 'OK', comment: 'ok' }, check: { status: null, checked: true, comment: '' } }
    });
    const next = nextVersion();
    const rebased = rebaseSessionOnTemplate(s, next, '2026-10-06T12:00:00.000Z');

    expect(rebased.templateSnapshot).toEqual(next);
    expect(rebased.templateSnapshot).not.toBe(next);
    expect(rebased.answers).toEqual({ always: { status: 'OK', comment: 'ok' } });
    expect(rebased.contextValues).toEqual({ mode: 'patch', note: 'déjà saisi', owner: 'Benoît' });
    expect(hasTemplateUpdate(rebased, next)).toBe(false);
  });

  it('détecte les modifications d’options sur les contrôles existants, le contexte et la structure', () => {
    const s = session({
      answers: {
        always: { status: 'OK', comment: 'Constaté' },
        choice: { status: null, selectedChoice: 'stop', comment: 'Bloqué' }
      }
    });

    const next = template({
      updatedAt: '2026-10-05T00:00:00.000Z',
      description: 'Nouvelle description',
      contextSchema: [
        { id: 'mode', label: 'Environnement', type: 'select', required: false },
        { id: 'env', label: 'Cible', type: 'text' }
      ]
    });

    // Renommage de section et modification des options des contrôles
    next.sections[0].title = 'Section 1 renommée';
    next.sections[0].items[0] = {
      id: 'always',
      label: 'Toujours vérifié',
      controlType: 'checkbox',
      withTimestamp: true,
      help: 'Nouvelle consigne',
      extraField: { id: 'ext_1', label: 'Numéro de ticket' }
    };
    next.sections[0].items[1] = {
      id: 'patch',
      label: 'Patch seulement',
      visibleIf: { fieldId: 'mode', equals: ['patch', 'hotfix'] },
      requireNaReason: true
    };
    next.sections[1].items[1] = {
      id: 'choice',
      label: 'Choix',
      controlType: 'choice',
      customChoices: [{ id: 'go', label: 'Validé', tone: 'info' }]
    };

    const diff = diffTemplates(s.templateSnapshot, next, s, new Set());

    // Contrôles modifiés
    expect(diff.modified.map(m => m.item.id)).toEqual(['always', 'patch', 'choice']);

    const alwaysDiff = diff.modified.find(m => m.item.id === 'always')!;
    expect(alwaysDiff.answerIncompatible).toBe(true);
    expect(alwaysDiff.changes).toEqual(
      expect.arrayContaining([
        'Libellé : « Toujours » → « Toujours vérifié »',
        'Type de contrôle : Statut (OK/KO/NA) → Case à cocher',
        'Consigne ajoutée : « Nouvelle consigne »',
        'Horodatage automatique : activé',
        'Champ additionnel activé : « Numéro de ticket »'
      ])
    );

    const patchDiff = diff.modified.find(m => m.item.id === 'patch')!;
    expect(patchDiff.answerIncompatible).toBe(false);
    expect(patchDiff.changes).toEqual(
      expect.arrayContaining([
        'Motif N/A obligatoire : activé',
        "Condition d'affichage modifiée : Mode ∈ [patch] → Environnement ∈ [patch, hotfix]"
      ])
    );

    const choiceDiff = diff.modified.find(m => m.item.id === 'choice')!;
    expect(choiceDiff.answerIncompatible).toBe(true);
    expect(choiceDiff.changes).toEqual(
      expect.arrayContaining([
        'Option(s) supprimée(s) : « Stop »',
        'Option « Validé » : libellé « Go » → « Validé », couleur Vert → Bleu'
      ])
    );

    // Contexte
    expect(diff.context.added.map(f => f.id)).toEqual(['env']);
    expect(diff.context.removed.map(f => f.id)).toEqual(['note']);
    expect(diff.context.modified).toHaveLength(1);
    expect(diff.context.modified[0].field.id).toBe('mode');

    // Structure
    expect(diff.structureChanges).toEqual(
      expect.arrayContaining([
        'Description du modèle modifiée',
        'Section renommée : « Section 1 » → « Section 1 renommée »'
      ])
    );

    // Rebase : réinitialise le statut/choix incompatible tout en gardant les commentaires
    const rebased = rebaseSessionOnTemplate(s, next, '2026-10-06T12:00:00.000Z');
    expect(rebased.answers['always']).toEqual({ status: null, comment: 'Constaté' });
    expect(rebased.answers['choice']).toEqual({ status: null, comment: 'Bloqué' });
  });
});
