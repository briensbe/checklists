import {
  appendItemEvent,
  applicableItems,
  computeMetrics,
  diffTemplates,
  hasTemplateUpdate,
  isAnswered,
  isKo,
  isResolved,
  rebaseSessionOnTemplate,
  validateForCompletion,
  withoutEvidenceRemovedEvent
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
          { id: 'na-reason', label: 'Non applicable possible' }
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

  it('compte un N/A comme une réponse quel que soit le type (ADR 0009)', () => {
    expect(isAnswered({ id: 'a', label: 'a', controlType: 'checkbox' }, { status: 'NA', comment: '' })).toBe(true);
    expect(isAnswered({ id: 'a', label: 'a', controlType: 'choice' }, { status: 'NA', comment: '' })).toBe(true);
  });
});

describe('N/A sur une case à cocher ou un choix', () => {
  const na = { status: 'NA' as const, comment: '' };

  it('est compté dans naCount, résolu et jamais en anomalie', () => {
    const s = session({ answers: { check: na, choice: na } });
    const metrics = computeMetrics(s);
    expect(metrics.naCount).toBe(2);
    expect(metrics.answered).toBe(2);
    const item = { id: 'check', label: 'Case', controlType: 'checkbox' as const };
    expect(isResolved(item, na)).toBe(true);
    expect(isKo(item, na)).toBe(false);
  });

  it('n’est pas signalé sans réponse à la clôture', () => {
    const s = session({
      contextValues: { mode: 'full' },
      answers: {
        always: { status: 'OK', comment: '' },
        'na-reason': { status: 'OK', comment: '' },
        check: na,
        choice: na
      }
    });
    expect(validateForCompletion(s)).toEqual([]);
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

  it('signale les items sans réponse et accepte un N/A sans commentaire', () => {
    const s = session({
      answers: { ...complete, 'na-reason': { status: 'NA', comment: '' }, check: { status: null, checked: false, comment: '' } }
    });
    expect(validateForCompletion(s).map(i => [i.kind, i.itemId])).toEqual([['unanswered', 'check']]);
  });

  it('Item masqué non évalué', () => {
    // 'patch' n'a pas de réponse mais il est masqué en mode full.
    expect(validateForCompletion(session({ answers: complete })).some(i => i.itemId === 'patch')).toBe(false);
  });

  it('Modèle sans politique de clôture : un optionnel sans réponse est une anomalie', () => {
    const { check: _check, ...answers } = complete;
    expect(validateForCompletion(session({ answers })).map(i => [i.kind, i.itemId])).toEqual([['unanswered', 'check']]);
  });

  it('Politique limitée aux bloquants : seuls les bloquants doivent avoir une réponse', () => {
    const t = template({ completionPolicy: 'blocking' });
    t.sections[0].items[0].criticality = 'blocking';
    const blockingOnly = session({ templateSnapshot: t, answers: {} });
    expect(validateForCompletion(blockingOnly).map(i => [i.kind, i.itemId])).toEqual([['unanswered', 'always']]);

    const resolved = session({ templateSnapshot: t, answers: { always: { status: 'OK', comment: '' } } });
    expect(validateForCompletion(resolved)).toEqual([]);
  });

  it('Bloquant en anomalie : refusé même commenté, quelle que soit la politique', () => {
    const t = template();
    t.sections[0].items[0].criticality = 'blocking';
    const s = session({ templateSnapshot: t, answers: { ...complete, always: { status: 'KO', comment: 'Build rouge' } } });
    expect(validateForCompletion(s).map(i => [i.kind, i.itemId])).toEqual([['blocking-unresolved', 'always']]);

    const choiceBlocking = template({ completionPolicy: 'blocking' });
    choiceBlocking.sections[1].items[1].criticality = 'blocking';
    const stopped = session({ templateSnapshot: choiceBlocking, answers: { choice: { status: null, selectedChoice: 'stop', comment: '' } } });
    expect(validateForCompletion(stopped).map(i => i.kind)).toEqual(['blocking-unresolved']);
  });

  it('Bloquant en anomalie avec porte souple forcée : accepté', () => {
    const t = template();
    t.sections[0].items[0].criticality = 'blocking';
    t.sections[0].gate = 'soft';
    const s = session({
      templateSnapshot: t,
      answers: { ...complete, always: { status: 'KO', comment: 'Build rouge' } },
      forcedGates: [{ sectionId: 's1', reason: 'Dérogation', at: '2026-10-17T10:00:00.000Z' }]
    });
    expect(validateForCompletion(s)).toEqual([]);

    // Le forçage n'agit plus si la porte est stricte.
    t.sections[0].gate = 'hard';
    expect(validateForCompletion(s).map(i => i.kind)).toEqual(['blocking-unresolved']);
  });
});

describe('appendItemEvent', () => {
  it('ajoute un événement sans modifier les précédents ni la réponse d’origine', () => {
    const answer = { status: 'OK' as const, comment: '', history: [{ at: 't1', kind: 'status' as const, status: 'OK' as const }] };
    const next = appendItemEvent(answer, { at: 't2', kind: 'status', status: 'KO' });
    expect(next.history).toEqual([
      { at: 't1', kind: 'status', status: 'OK' },
      { at: 't2', kind: 'status', status: 'KO' }
    ]);
    expect(answer.history).toHaveLength(1);
  });
});

describe('withoutEvidenceRemovedEvent', () => {
  const added = { at: 't1', kind: 'evidence-added' as const, evidenceId: 'ev1', name: 'a.png' };
  const removed = { at: 't2', kind: 'evidence-removed' as const, evidenceId: 'ev1', name: 'a.png' };

  it('retire l’événement de suppression de la preuve, et lui seul', () => {
    const answer = { status: 'OK' as const, comment: '', history: [added, removed] };
    expect(withoutEvidenceRemovedEvent(answer, 'ev1').history).toEqual([added]);
    expect(answer.history).toHaveLength(2);
  });

  it('renvoie la réponse inchangée si aucun événement ne correspond', () => {
    const answer = { status: 'OK' as const, comment: '', history: [added] };
    expect(withoutEvidenceRemovedEvent(answer, 'ev1')).toBe(answer);
    expect(withoutEvidenceRemovedEvent({ status: null, comment: '' }, 'ev1').history).toBeUndefined();
  });

  it('ne retire que le dernier événement quand la même preuve a été supprimée plusieurs fois', () => {
    const again = { ...removed, at: 't3' };
    const answer = { status: 'OK' as const, comment: '', history: [added, removed, again] };
    expect(withoutEvidenceRemovedEvent(answer, 'ev1').history).toEqual([added, removed]);
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
      criticality: 'blocking',
      evidenceRequired: 'photo',
      evidenceHint: 'Capture du rapport'
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
        'Criticité : optionnel → bloquant',
        'Preuve exigée : aucune → photo',
        'Consigne de preuve ajoutée : « Capture du rapport »',
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

  it('Ancien motif N/A ignoré : aucun changement signalé', () => {
    const legacy = template();
    Object.assign(legacy.sections[0].items[2], { requireNaReason: true });
    const s = session({ templateSnapshot: legacy });
    const diff = diffTemplates(legacy, template({ updatedAt: '2026-10-05T00:00:00.000Z' }), s, new Set());
    expect(diff.modified).toEqual([]);
  });

  it('signale les changements de dépendances, de jonction, de porte et de politique de clôture', () => {
    const before = template();
    const after = template({ updatedAt: '2026-10-05T00:00:00.000Z', completionPolicy: 'blocking' });
    after.sections[1] = { ...after.sections[1], dependsOn: ['s1'], joinMode: 'any', gate: 'soft' };
    const diff = diffTemplates(before, after, session(), new Set());
    expect(diff.structureChanges).toEqual(
      expect.arrayContaining([
        'Politique de clôture : une réponse partout → seuls les bloquants',
        'Dépendances de « Section 2 » : aucune (départ) → « Section 1 »',
        'Jonction de « Section 2 » : toutes les branches → une seule branche',
        'Porte de « Section 2 » : stricte → souple'
      ])
    );
    // L'ordre des dépendances n'est pas un changement.
    const reordered = structuredClone(after);
    after.sections[1].dependsOn = ['s1', 's0'];
    reordered.sections[1].dependsOn = ['s0', 's1'];
    expect(diffTemplates(after, reordered, session(), new Set()).structureChanges.some(c => c.startsWith('Dépendances'))).toBe(false);
  });

  it('Application : historique conservé, même sur une réponse réinitialisée, et portes forcées purgées', () => {
    const history = [{ at: '2026-10-02T00:00:00.000Z', kind: 'status' as const, status: 'OK' as const }];
    const s = session({
      answers: { always: { status: 'OK', comment: '', history }, 'na-reason': { status: 'NA', comment: '', history } },
      forcedGates: [
        { sectionId: 's1', reason: 'A', at: '2026-10-02T00:00:00.000Z' },
        { sectionId: 's2', reason: 'B', at: '2026-10-02T00:00:00.000Z' }
      ]
    });
    const next = template({ updatedAt: '2026-10-05T00:00:00.000Z' });
    next.sections[0].items[0] = { id: 'always', label: 'Toujours', controlType: 'checkbox' };
    next.sections = [next.sections[0]];

    const rebased = rebaseSessionOnTemplate(s, next, '2026-10-06T12:00:00.000Z');
    expect(rebased.answers['always']).toEqual({ status: null, comment: '', history });
    expect(rebased.answers['na-reason'].history).toEqual(history);
    expect(rebased.forcedGates).toEqual([{ sectionId: 's1', reason: 'A', at: '2026-10-02T00:00:00.000Z' }]);
  });
});
