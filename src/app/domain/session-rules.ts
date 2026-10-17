import {
  ChecklistItemTemplate,
  ChecklistSession,
  ChecklistTemplate,
  ChoiceTone,
  ContextFieldSchema,
  ContextFieldType,
  ItemAnswer,
  ItemControlType,
  MetricsSummary,
  VisibilityCondition
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

export interface ModifiedItemDiff {
  item: ApplicableItem;
  before: ApplicableItem;
  changes: string[];
  /** Vrai si le changement de type ou la suppression d'une option de choix rend la réponse existante incompatible. */
  answerIncompatible: boolean;
}

export interface ModifiedContextFieldDiff {
  field: ContextFieldSchema;
  before: ContextFieldSchema;
  changes: string[];
}

export interface ContextFieldDiff {
  added: ContextFieldSchema[];
  removed: ContextFieldSchema[];
  modified: ModifiedContextFieldDiff[];
}

export interface TemplateDiff {
  added: ApplicableItem[];
  removed: ApplicableItem[];
  /** Sous-ensemble de `removed` portant une réponse, un commentaire, un champ additionnel ou des preuves. */
  removedWithData: ApplicableItem[];
  /** Contrôles conservés mais dont au moins une option ou propriété a évolué. */
  modified: ModifiedItemDiff[];
  /** Évolutions sur les variables de contexte. */
  context: ContextFieldDiff;
  /** Autres changements de structure ou de métadonnées (sections, ordre, nom/description). */
  structureChanges: string[];
}

const CONTROL_TYPE_LABELS: Record<ItemControlType, string> = {
  status: 'Statut (OK/KO/NA)',
  checkbox: 'Case à cocher',
  choice: 'Choix personnalisé'
};

const CONTEXT_TYPE_LABELS: Record<ContextFieldType, string> = {
  text: 'Texte libre',
  date: 'Date',
  select: 'Liste déroulante'
};

const TONE_LABELS: Record<ChoiceTone, string> = {
  success: 'Vert',
  danger: 'Rouge',
  warning: 'Ambre',
  info: 'Bleu',
  neutral: 'Gris'
};

function formatVisibilityCondition(cond: VisibilityCondition, template: ChecklistTemplate): string {
  const field = (template.contextSchema ?? []).find(f => f.id === cond.fieldId);
  const fieldName = field?.label || cond.fieldId;
  const values = cond.equals.length > 0 ? cond.equals.join(', ') : 'aucune valeur';
  return `${fieldName} ∈ [${values}]`;
}

function diffSingleItem(
  before: ApplicableItem,
  after: ApplicableItem,
  snapshot: ChecklistTemplate,
  current: ChecklistTemplate,
  existingAnswer: ItemAnswer | undefined
): ModifiedItemDiff | null {
  const changes: string[] = [];
  let answerIncompatible = false;

  if (before.label !== after.label) {
    changes.push(`Libellé : « ${before.label} » → « ${after.label} »`);
  }

  if (before.sectionId !== after.sectionId) {
    changes.push(`Section : « ${before.sectionTitle} » → « ${after.sectionTitle} »`);
  }

  const bType: ItemControlType = before.controlType ?? 'status';
  const aType: ItemControlType = after.controlType ?? 'status';
  if (bType !== aType) {
    changes.push(`Type de contrôle : ${CONTROL_TYPE_LABELS[bType]} → ${CONTROL_TYPE_LABELS[aType]}`);
    if (isAnswered(before, existingAnswer)) {
      answerIncompatible = true;
    }
  }

  const bHelp = (before.help ?? '').trim();
  const aHelp = (after.help ?? '').trim();
  if (bHelp !== aHelp) {
    if (!bHelp && aHelp) {
      changes.push(`Consigne ajoutée : « ${aHelp} »`);
    } else if (bHelp && !aHelp) {
      changes.push('Consigne supprimée');
    } else {
      changes.push(`Consigne modifiée : « ${bHelp} » → « ${aHelp} »`);
    }
  }

  if (aType === 'checkbox' && !!before.withTimestamp !== !!after.withTimestamp) {
    changes.push(`Horodatage automatique : ${after.withTimestamp ? 'activé' : 'désactivé'}`);
  }

  if (aType === 'choice') {
    const aChoices = after.customChoices ?? [];
    if (bType !== 'choice') {
      if (aChoices.length > 0) {
        changes.push(`Options de choix : ${aChoices.map(c => `« ${c.label} »`).join(', ')}`);
      }
    } else {
      const bChoices = before.customChoices ?? [];
      const bMap = new Map(bChoices.map(c => [c.id, c]));
      const aMap = new Map(aChoices.map(c => [c.id, c]));

      const addedChoices = aChoices.filter(c => !bMap.has(c.id));
      const removedChoices = bChoices.filter(c => !aMap.has(c.id));

      if (addedChoices.length > 0) {
        changes.push(`Option(s) ajoutée(s) : ${addedChoices.map(c => `« ${c.label} »`).join(', ')}`);
      }
      if (removedChoices.length > 0) {
        changes.push(`Option(s) supprimée(s) : ${removedChoices.map(c => `« ${c.label} »`).join(', ')}`);
        if (
          existingAnswer?.selectedChoice &&
          removedChoices.some(c => c.id === existingAnswer.selectedChoice || c.label === existingAnswer.selectedChoice)
        ) {
          answerIncompatible = true;
        }
      }

      for (const ac of aChoices) {
        const bc = bMap.get(ac.id);
        if (!bc) continue;
        const parts: string[] = [];
        if (bc.label !== ac.label) parts.push(`libellé « ${bc.label} » → « ${ac.label} »`);
        if (bc.tone !== ac.tone) parts.push(`couleur ${TONE_LABELS[bc.tone]} → ${TONE_LABELS[ac.tone]}`);
        if (!!bc.isBlocking !== !!ac.isBlocking) parts.push(ac.isBlocking ? 'devenu bloquant' : 'non bloquant');
        if (parts.length > 0) {
          changes.push(`Option « ${ac.label} » : ${parts.join(', ')}`);
        }
      }
    }
  }

  if (!!before.requireNaReason !== !!after.requireNaReason) {
    changes.push(`Motif N/A obligatoire : ${after.requireNaReason ? 'activé' : 'désactivé'}`);
  }

  if (!before.extraField && after.extraField) {
    changes.push(`Champ additionnel activé : « ${after.extraField.label} »`);
  } else if (before.extraField && !after.extraField) {
    changes.push(`Champ additionnel supprimé (« ${before.extraField.label} »)`);
  } else if (before.extraField && after.extraField) {
    if (before.extraField.label !== after.extraField.label) {
      changes.push(`Champ additionnel renommé : « ${before.extraField.label} » → « ${after.extraField.label} »`);
    } else if ((before.extraField.placeholder ?? '') !== (after.extraField.placeholder ?? '')) {
      changes.push(`Placeholder du champ additionnel « ${after.extraField.label} » modifié`);
    }
  }

  if (!before.visibleIf && after.visibleIf) {
    changes.push(`Condition d'affichage ajoutée : ${formatVisibilityCondition(after.visibleIf, current)}`);
  } else if (before.visibleIf && !after.visibleIf) {
    changes.push("Condition d'affichage supprimée (toujours visible)");
  } else if (before.visibleIf && after.visibleIf) {
    const sameField = before.visibleIf.fieldId === after.visibleIf.fieldId;
    const sameValues =
      before.visibleIf.equals.length === after.visibleIf.equals.length &&
      before.visibleIf.equals.every((v, idx) => v === after.visibleIf!.equals[idx]);
    if (!sameField || !sameValues) {
      changes.push(
        `Condition d'affichage modifiée : ${formatVisibilityCondition(before.visibleIf, snapshot)} → ${formatVisibilityCondition(after.visibleIf, current)}`
      );
    }
  }

  if (changes.length === 0) return null;
  return { item: after, before, changes, answerIncompatible };
}

function diffContextSchema(snapshot: ChecklistTemplate, current: ChecklistTemplate): ContextFieldDiff {
  const bSchema = snapshot.contextSchema ?? [];
  const aSchema = current.contextSchema ?? [];
  const bMap = new Map(bSchema.map(f => [f.id, f]));
  const aMap = new Map(aSchema.map(f => [f.id, f]));

  const added = aSchema.filter(f => !bMap.has(f.id));
  const removed = bSchema.filter(f => !aMap.has(f.id));
  const modified: ModifiedContextFieldDiff[] = [];

  for (const af of aSchema) {
    const bf = bMap.get(af.id);
    if (!bf) continue;
    const changes: string[] = [];

    if (bf.label !== af.label) {
      changes.push(`Libellé : « ${bf.label} » → « ${af.label} »`);
    }
    if (bf.type !== af.type) {
      changes.push(`Type : ${CONTEXT_TYPE_LABELS[bf.type]} → ${CONTEXT_TYPE_LABELS[af.type]}`);
    }
    if (!!bf.required !== !!af.required) {
      changes.push(`Obligatoire : ${af.required ? 'oui' : 'non'}`);
    }
    if ((bf.defaultValue ?? '') !== (af.defaultValue ?? '')) {
      changes.push(`Valeur par défaut : « ${bf.defaultValue || 'aucune'} » → « ${af.defaultValue || 'aucune'} »`);
    }
    if ((bf.placeholder ?? '') !== (af.placeholder ?? '')) {
      changes.push(`Placeholder : « ${bf.placeholder || 'aucun'} » → « ${af.placeholder || 'aucun'} »`);
    }
    if (af.type === 'select') {
      const bOpts = (bf.options ?? []).map(o => o.label);
      const aOpts = (af.options ?? []).map(o => o.label);
      if (bOpts.join('\0') !== aOpts.join('\0')) {
        changes.push(`Options : [${bOpts.join(', ')}] → [${aOpts.join(', ')}]`);
      }
    }

    if (changes.length > 0) {
      modified.push({ field: af, before: bf, changes });
    }
  }

  return { added, removed, modified };
}

function diffStructureAndMetadata(snapshot: ChecklistTemplate, current: ChecklistTemplate): string[] {
  const changes: string[] = [];

  if (snapshot.name !== current.name) {
    changes.push(`Nom du modèle : « ${snapshot.name} » → « ${current.name} »`);
  }
  if ((snapshot.description ?? '').trim() !== (current.description ?? '').trim()) {
    changes.push('Description du modèle modifiée');
  }

  const bSecMap = new Map(snapshot.sections.map(s => [s.id, s]));
  const aSecMap = new Map(current.sections.map(s => [s.id, s]));

  for (const s of current.sections) {
    const bs = bSecMap.get(s.id);
    if (!bs) {
      changes.push(`Section ajoutée : « ${s.title} »`);
    } else if (bs.title !== s.title) {
      changes.push(`Section renommée : « ${bs.title} » → « ${s.title} »`);
    }
  }

  for (const s of snapshot.sections) {
    if (!aSecMap.has(s.id)) {
      changes.push(`Section supprimée : « ${s.title} »`);
    }
  }

  const commonBeforeSecs = snapshot.sections.filter(s => aSecMap.has(s.id)).map(s => s.id);
  const commonAfterSecs = current.sections.filter(s => bSecMap.has(s.id)).map(s => s.id);
  if (commonBeforeSecs.join('\0') !== commonAfterSecs.join('\0')) {
    changes.push('Ordre des sections modifié');
  }

  for (const s of current.sections) {
    const bs = bSecMap.get(s.id);
    if (!bs) continue;
    const aItemIds = new Set(s.items.map(i => i.id));
    const bItemIds = new Set(bs.items.map(i => i.id));
    const commonBeforeItems = bs.items.filter(i => aItemIds.has(i.id)).map(i => i.id);
    const commonAfterItems = s.items.filter(i => bItemIds.has(i.id)).map(i => i.id);
    if (commonBeforeItems.join('\0') !== commonAfterItems.join('\0')) {
      changes.push(`Ordre des contrôles modifié dans « ${s.title} »`);
    }
  }

  return changes;
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
  const beforeById = new Map(before.map(i => [i.id, i]));
  const afterIds = new Set(after.map(i => i.id));

  const added = after.filter(i => !beforeById.has(i.id));
  const removed = before.filter(i => !afterIds.has(i.id));
  const removedWithData = removed.filter(i => answerHasData(session.answers[i.id]) || evidenceItemIds.has(i.id));

  const modified: ModifiedItemDiff[] = [];
  for (const afterItem of after) {
    const beforeItem = beforeById.get(afterItem.id);
    if (!beforeItem) continue;
    const itemDiff = diffSingleItem(beforeItem, afterItem, snapshot, current, session.answers[afterItem.id]);
    if (itemDiff) {
      modified.push(itemDiff);
    }
  }

  const context = diffContextSchema(snapshot, current);
  const structureChanges = diffStructureAndMetadata(snapshot, current);

  return { added, removed, removedWithData, modified, context, structureChanges };
}

/**
 * Remplace la copie figée par la version courante du template :
 * réponses conservées pour les items de même identifiant (réinitialisées si le type de contrôle
 * ou l'option de choix sélectionnée n'est plus compatible, en préservant commentaire et extra),
 * purgées pour les items supprimés, valeurs par défaut posées pour les nouveaux champs de contexte.
 */
export function rebaseSessionOnTemplate(
  session: ChecklistSession,
  current: ChecklistTemplate,
  now: string
): ChecklistSession {
  const afterById = new Map(allItems(current).map(i => [i.id, i]));
  const beforeById = new Map(allItems(session.templateSnapshot).map(i => [i.id, i]));
  const answers: Record<string, ItemAnswer> = {};
  for (const [itemId, answer] of Object.entries(session.answers)) {
    const nextItem = afterById.get(itemId);
    if (!nextItem) continue;
    const prevItem = beforeById.get(itemId);
    const prevType = prevItem?.controlType ?? 'status';
    const nextType = nextItem.controlType ?? 'status';
    if (prevType !== nextType) {
      answers[itemId] = {
        status: null,
        comment: answer.comment ?? '',
        ...(answer.extra ? { extra: answer.extra } : {})
      };
    } else if (
      nextType === 'choice' &&
      answer.selectedChoice &&
      !(nextItem.customChoices ?? []).some(c => c.id === answer.selectedChoice || c.label === answer.selectedChoice)
    ) {
      const { selectedChoice: _, ...rest } = answer;
      answers[itemId] = rest;
    } else {
      answers[itemId] = answer;
    }
  }

  return {
    ...session,
    templateSnapshot: structuredClone(current),
    contextValues: { ...defaultContextValues(current, now.split('T')[0]), ...session.contextValues },
    answers,
    updatedAt: now
  };
}
