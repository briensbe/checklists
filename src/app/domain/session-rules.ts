import {
  ChecklistItemTemplate,
  ChecklistSession,
  ChecklistTemplate,
  ItemAnswer,
  MetricsSummary
} from '../models/checklist.model';

/**
 * Règles métier des sessions, sous forme de fonctions pures.
 *
 * Elles ne dépendent ni d'Angular ni de Dexie : le service de session, le tableau
 * de bord et les tests appellent exactement le même code, ce qui empêche deux
 * écrans de calculer une progression différente.
 */

export type ApplicableItem = ChecklistItemTemplate & { sectionId: string; sectionTitle: string };

/**
 * Normalise une chaîne de valeur (notamment les dates) afin que les comparaisons
 * de conditions d'affichage (`visibleIf`) soient tolérantes au format (ex: '15/10/2026' vs '2026-10-15').
 */
export function normalizeDateOrValue(val: string | undefined | null): string {
  if (!val) return '';
  const trimmed = val.trim();

  // Format JJ/MM/AAAA ou JJ-MM-AAAA (ex: 15/10/2026 ou 05-04-2026)
  const dmyMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Format AAAA/MM/JJ (ex: 2026/10/15)
  const ymdSlashMatch = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(trimmed);
  if (ymdSlashMatch) {
    const year = ymdSlashMatch[1];
    const month = ymdSlashMatch[2].padStart(2, '0');
    const day = ymdSlashMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

/** Un item sans condition est toujours applicable ; sinon la valeur du champ doit figurer dans `equals`. */
export function isApplicable(item: ChecklistItemTemplate, contextValues: Record<string, string>): boolean {
  if (!item.visibleIf) return true;
  const currentVal = contextValues[item.visibleIf.fieldId] ?? '';
  const normalizedCurrent = normalizeDateOrValue(currentVal);

  return item.visibleIf.equals.some(eq => {
    if (eq === currentVal) return true;
    if (normalizeDateOrValue(eq) === normalizedCurrent) return true;
    return false;
  });
}

export function applicableItems(
  template: ChecklistTemplate | null | undefined,
  contextValues: Record<string, string>
): ApplicableItem[] {
  if (!template) return [];
  const list: ApplicableItem[] = [];
  for (const section of template.sections) {
    for (const item of section.items) {
      if (isApplicable(item, contextValues)) {
        list.push({ ...item, sectionId: section.id, sectionTitle: section.title });
      }
    }
  }
  return list;
}

/** Règle unique de « répondu » : statut posé, case cochée ou choix sélectionné selon le type. */
export function isAnswered(item: ChecklistItemTemplate, answer: ItemAnswer | undefined): boolean {
  if (!answer) return false;
  switch (item.controlType ?? 'status') {
    case 'checkbox':
      return !!answer.checked;
    case 'choice':
      return !!answer.selectedChoice;
    default:
      return !!answer.status;
  }
}

/** Un item est en anomalie s'il est KO ou si le choix sélectionné est bloquant. */
export function isKo(item: ChecklistItemTemplate, answer: ItemAnswer | undefined): boolean {
  if (!answer) return false;
  if ((item.controlType ?? 'status') === 'choice') {
    const choice = item.customChoices?.find(c => c.id === answer.selectedChoice || c.label === answer.selectedChoice);
    return !!choice?.isBlocking;
  }
  return answer.status === 'KO';
}

export function computeMetrics(session: ChecklistSession | null | undefined): MetricsSummary {
  if (!session) {
    return { total: 0, answered: 0, okCount: 0, koCount: 0, naCount: 0, pending: 0, percent: 0 };
  }

  const items = applicableItems(session.templateSnapshot, session.contextValues);
  let okCount = 0;
  let koCount = 0;
  let naCount = 0;

  for (const item of items) {
    const ans = session.answers[item.id];
    if (!isAnswered(item, ans)) continue;
    if (isKo(item, ans)) koCount++;
    else if (ans?.status === 'NA') naCount++;
    else okCount++;
  }

  const total = items.length;
  const answered = okCount + koCount + naCount;
  const pending = total - answered;
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
  return { total, answered, okCount, koCount, naCount, pending, percent };
}

export type CompletionIssueKind = 'context-required' | 'unanswered' | 'ko-without-comment' | 'na-without-reason';

export interface CompletionIssue {
  kind: CompletionIssueKind;
  label: string;
  itemId?: string;
  fieldId?: string;
  sectionId?: string;
  sectionTitle?: string;
}

/** Liste exhaustive des anomalies empêchant de terminer la session (vide = clôture possible). */
export function validateForCompletion(session: ChecklistSession): CompletionIssue[] {
  const issues: CompletionIssue[] = [];

  for (const field of session.templateSnapshot.contextSchema) {
    if (field.required && !(session.contextValues[field.id] ?? '').trim()) {
      issues.push({ kind: 'context-required', label: field.label, fieldId: field.id });
    }
  }

  for (const item of applicableItems(session.templateSnapshot, session.contextValues)) {
    const ans = session.answers[item.id];
    const base = { label: item.label, itemId: item.id, sectionId: item.sectionId, sectionTitle: item.sectionTitle };
    const hasComment = !!ans?.comment?.trim();

    if (!isAnswered(item, ans)) {
      issues.push({ kind: 'unanswered', ...base });
    } else if (ans?.status === 'KO' && !hasComment) {
      issues.push({ kind: 'ko-without-comment', ...base });
    } else if (ans?.status === 'NA' && item.requireNaReason && !hasComment) {
      issues.push({ kind: 'na-without-reason', ...base });
    }
  }
  return issues;
}

export const COMPLETION_ISSUE_LABELS: Record<CompletionIssueKind, string> = {
  'context-required': 'Champ de contexte obligatoire vide',
  unanswered: 'Contrôle sans réponse',
  'ko-without-comment': 'KO sans justification',
  'na-without-reason': 'N/A sans motif'
};

/** Valeurs de contexte initiales : valeur par défaut, ou date du jour pour un champ date. */
export function defaultContextValues(template: ChecklistTemplate, today: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of template.contextSchema) {
    if (field.defaultValue) values[field.id] = field.defaultValue;
    else if (field.type === 'date') values[field.id] = today;
  }
  return values;
}

/** Vrai si le template d'origine existe et a été enregistré après la copie figée d'une session en cours. */
export function hasTemplateUpdate(session: ChecklistSession, current: ChecklistTemplate | undefined): boolean {
  if (!current || session.status !== 'in_progress' || session.structureUnavailable) return false;
  return current.updatedAt > session.templateSnapshot.updatedAt;
}

export interface TemplateDiff {
  added: ApplicableItem[];
  removed: ApplicableItem[];
  /** Sous-ensemble de `removed` portant une réponse, un commentaire, un champ additionnel ou des preuves. */
  removedWithData: ApplicableItem[];
}

function allItems(template: ChecklistTemplate): ApplicableItem[] {
  return template.sections.flatMap(s => s.items.map(i => ({ ...i, sectionId: s.id, sectionTitle: s.title })));
}

function answerHasData(answer: ItemAnswer | undefined): boolean {
  if (!answer) return false;
  return (
    !!answer.status ||
    !!answer.checked ||
    !!answer.selectedChoice ||
    !!answer.comment?.trim() ||
    Object.values(answer.extra ?? {}).some(v => !!v?.trim())
  );
}

export function diffTemplates(
  snapshot: ChecklistTemplate,
  current: ChecklistTemplate,
  session: ChecklistSession,
  evidenceItemIds: ReadonlySet<string>
): TemplateDiff {
  const before = allItems(snapshot);
  const after = allItems(current);
  const beforeIds = new Set(before.map(i => i.id));
  const afterIds = new Set(after.map(i => i.id));

  const added = after.filter(i => !beforeIds.has(i.id));
  const removed = before.filter(i => !afterIds.has(i.id));
  const removedWithData = removed.filter(i => answerHasData(session.answers[i.id]) || evidenceItemIds.has(i.id));
  return { added, removed, removedWithData };
}

/**
 * Remplace la copie figée par la version courante du template :
 * réponses conservées pour les items de même identifiant, purgées pour les autres,
 * valeurs par défaut posées pour les nouveaux champs de contexte (valeurs existantes intactes).
 */
export function rebaseSessionOnTemplate(
  session: ChecklistSession,
  current: ChecklistTemplate,
  now: string
): ChecklistSession {
  const keptIds = new Set(allItems(current).map(i => i.id));
  const answers: Record<string, ItemAnswer> = {};
  for (const [itemId, answer] of Object.entries(session.answers)) {
    if (keptIds.has(itemId)) answers[itemId] = answer;
  }

  return {
    ...session,
    templateSnapshot: structuredClone(current),
    contextValues: { ...defaultContextValues(current, now.split('T')[0]), ...session.contextValues },
    answers,
    updatedAt: now
  };
}
