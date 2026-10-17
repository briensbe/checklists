import {
  ChecklistSectionTemplate,
  ChecklistSession,
  ChecklistTemplate,
  COMPLETION_POLICIES,
  CRITICALITIES,
  EVIDENCE_KINDS,
  GATE_KINDS,
  JOIN_MODES
} from '../models/checklist.model';
import {
  ApplicableItem,
  applicableItems,
  criticalityOf,
  forcedSectionIds,
  isAnswered,
  isResolved
} from './session-rules';

/**
 * Règles d'enchaînement des étapes (ADR 0007), sous forme de fonctions pures.
 *
 * Une section est une étape d'un graphe orienté sans cycle, défini par `dependsOn`.
 * Rien de ce qui est calculé ici n'est stocké : l'état « débloqué » se recalcule à
 * chaque changement de réponse, de contexte ou de copie figée.
 */

export { criticalityOf, isResolved };

export type StepVisual = 'locked' | 'open' | 'passed' | 'done';

export interface StepState {
  sectionId: string;
  unlocked: boolean;
  /** Tous les contrôles bloquants applicables sont résolus (vrai s'il n'y en a aucun). */
  blockingResolved: boolean;
  /** Porte souple forcée (et toujours souple dans la copie figée). */
  forced: boolean;
  /** Porte ouverte vers les étapes suivantes : débloquée et (bloquants résolus ou porte forcée). */
  passed: boolean;
  visual: StepVisual;
  /** Progression d'une jonction (au moins deux dépendances), sinon `null`. */
  join: { ready: number; total: number } | null;
  /** Étapes qui dépendent de celle-ci, avec leur état débloqué. */
  next: { sectionId: string; unlocked: boolean }[];
}

export interface StepFlow {
  /** Au moins une section déclare une dépendance valide. */
  hasFlow: boolean;
  /** Ordre topologique ; les sections prises dans une boucle (ou en aval) sont ajoutées à la fin. */
  order: string[];
  /** Colonne de chaque section : longueur du plus long chemin depuis un départ. */
  columns: Record<string, number>;
  steps: Record<string, StepState>;
  /** Contrôles non bloquants oubliés dans des étapes franchies (voir `leftBehindItems`). */
  leftBehind: ApplicableItem[];
  /** Sections impliquées dans une boucle (données invalides), `null` si aucune. */
  cycle: string[] | null;
}

// --- Graphe -----------------------------------------------------------------

/** Dépendances exploitables d'une section : dédoublonnées, limitées aux sections connues. */
function knownDependencies(section: ChecklistSectionTemplate, knownIds: ReadonlySet<string>): string[] {
  const deps = Array.isArray(section.dependsOn) ? section.dependsOn : [];
  return [...new Set(deps)].filter(d => knownIds.has(d));
}

function dependencyMap(sections: readonly ChecklistSectionTemplate[]): Map<string, string[]> {
  const knownIds = new Set(sections.map(s => s.id));
  return new Map(sections.map(s => [s.id, knownDependencies(s, knownIds)]));
}

function successorMap(sections: readonly ChecklistSectionTemplate[], deps: Map<string, string[]>): Map<string, string[]> {
  const successors = new Map<string, string[]>(sections.map(s => [s.id, []]));
  for (const section of sections) {
    for (const dep of deps.get(section.id) ?? []) {
      successors.get(dep)?.push(section.id);
    }
  }
  return successors;
}

export interface TopologicalOrder {
  /** Sections triées : chacune apparaît après toutes ses dépendances. */
  order: string[];
  /** Sections qui n'ont pas pu être triées : prises dans une boucle ou situées en aval d'une boucle. */
  unordered: string[];
}

/**
 * Tri topologique (algorithme de Kahn) : on retire successivement les sections
 * dont toutes les dépendances ont déjà été retirées. Ce qui reste forme ou suit une boucle.
 * L'ordre des sections du modèle départage les ex aequo, pour un résultat stable.
 */
export function topologicalOrder(sections: readonly ChecklistSectionTemplate[]): TopologicalOrder {
  const deps = dependencyMap(sections);
  const successors = successorMap(sections, deps);
  const remaining = new Map(sections.map(s => [s.id, deps.get(s.id)?.length ?? 0]));
  const queue = sections.filter(s => remaining.get(s.id) === 0).map(s => s.id);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of successors.get(id) ?? []) {
      const left = (remaining.get(next) ?? 0) - 1;
      remaining.set(next, left);
      if (left === 0) queue.push(next);
    }
  }

  const sorted = new Set(order);
  return { order, unordered: sections.map(s => s.id).filter(id => !sorted.has(id)) };
}

/** Ensemble des sections dont `sectionId` dépend, directement ou non. */
function ancestors(sectionId: string, deps: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [...(deps.get(sectionId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(deps.get(id) ?? []));
  }
  return seen;
}

/** Sections réellement prises dans une boucle (une section qui dépend d'elle-même en fait partie). */
export function findCycleMembers(sections: readonly ChecklistSectionTemplate[]): string[] {
  const { unordered } = topologicalOrder(sections);
  if (unordered.length === 0) return [];
  const deps = dependencyMap(sections);
  return unordered.filter(id => ancestors(id, deps).has(id));
}

/**
 * Vrai si ajouter `dependencyId` aux dépendances de `sectionId` créerait une boucle :
 * c'est le cas si `dependencyId` dépend déjà, directement ou non, de `sectionId`.
 */
export function wouldCreateCycle(
  sections: readonly ChecklistSectionTemplate[],
  sectionId: string,
  dependencyId: string
): boolean {
  if (sectionId === dependencyId) return true;
  return ancestors(dependencyId, dependencyMap(sections)).has(sectionId);
}

/** Colonne = longueur du plus long chemin depuis un départ (les départs sont en colonne 0). */
export function computeColumns(sections: readonly ChecklistSectionTemplate[]): Record<string, number> {
  const deps = dependencyMap(sections);
  const { order, unordered } = topologicalOrder(sections);
  const columns: Record<string, number> = {};
  for (const id of [...order, ...unordered]) {
    const parents = (deps.get(id) ?? []).filter(d => d in columns);
    columns[id] = parents.length > 0 ? Math.max(...parents.map(d => columns[d])) + 1 : 0;
  }
  return columns;
}

// --- Validation ---------------------------------------------------------------

export type FlowIssueCode =
  | 'duplicate-section-id'
  | 'invalid-dependencies'
  | 'self-dependency'
  | 'unknown-dependency'
  | 'cycle'
  | 'invalid-join-mode'
  | 'invalid-gate'
  | 'invalid-criticality'
  | 'invalid-evidence'
  | 'invalid-completion-policy';

export interface FlowIssue {
  code: FlowIssueCode;
  message: string;
  sectionId?: string;
  itemId?: string;
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): boolean {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function sectionName(section: ChecklistSectionTemplate): string {
  return `« ${section.title || section.id} »`;
}

/**
 * Valide l'enchaînement et les valeurs des nouveaux champs. Partagée par l'import
 * (modèle et copie figée d'une session) et par l'enregistrement dans le builder.
 */
export function validateFlow(template: ChecklistTemplate): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const sections = template.sections ?? [];
  const byId = new Map<string, ChecklistSectionTemplate>();

  for (const section of sections) {
    if (byId.has(section.id)) {
      issues.push({
        code: 'duplicate-section-id',
        sectionId: section.id,
        message: `Identifiant de section en double : « ${section.id} ».`
      });
    } else {
      byId.set(section.id, section);
    }
  }

  if (template.completionPolicy !== undefined && !isOneOf(COMPLETION_POLICIES, template.completionPolicy)) {
    issues.push({
      code: 'invalid-completion-policy',
      message: `Politique de clôture inconnue : « ${String(template.completionPolicy)} ».`
    });
  }

  for (const section of sections) {
    const name = sectionName(section);
    if (section.dependsOn !== undefined && !Array.isArray(section.dependsOn)) {
      issues.push({ code: 'invalid-dependencies', sectionId: section.id, message: `Les dépendances de la section ${name} doivent être une liste.` });
    }
    for (const dep of Array.isArray(section.dependsOn) ? section.dependsOn : []) {
      if (dep === section.id) {
        issues.push({ code: 'self-dependency', sectionId: section.id, message: `La section ${name} dépend d'elle-même.` });
      } else if (!byId.has(dep)) {
        issues.push({
          code: 'unknown-dependency',
          sectionId: section.id,
          message: `La section ${name} dépend d'une section inconnue (« ${String(dep)} »).`
        });
      }
    }
    if (section.joinMode !== undefined && !isOneOf(JOIN_MODES, section.joinMode)) {
      issues.push({ code: 'invalid-join-mode', sectionId: section.id, message: `Mode de jonction inconnu pour la section ${name}.` });
    }
    if (section.gate !== undefined && !isOneOf(GATE_KINDS, section.gate)) {
      issues.push({ code: 'invalid-gate', sectionId: section.id, message: `Type de porte inconnu pour la section ${name}.` });
    }
    for (const item of section.items ?? []) {
      if (item.criticality !== undefined && !isOneOf(CRITICALITIES, item.criticality)) {
        issues.push({
          code: 'invalid-criticality',
          sectionId: section.id,
          itemId: item.id,
          message: `Criticité inconnue pour le contrôle « ${item.label || item.id} » : « ${String(item.criticality)} ».`
        });
      }
      if (item.evidenceRequired !== undefined && !isOneOf(EVIDENCE_KINDS, item.evidenceRequired)) {
        issues.push({
          code: 'invalid-evidence',
          sectionId: section.id,
          itemId: item.id,
          message: `Type de preuve inconnu pour le contrôle « ${item.label || item.id} » : « ${String(item.evidenceRequired)} ».`
        });
      }
    }
  }

  // Une section qui dépend d'elle-même est déjà signalée : la boucle ne concerne que les autres.
  const withoutSelfLoops = sections.map(s => ({
    ...s,
    dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.filter(d => d !== s.id) : undefined
  }));
  const cycle = findCycleMembers(withoutSelfLoops);
  if (cycle.length > 0) {
    issues.push({
      code: 'cycle',
      message: `Les dépendances forment une boucle entre les sections ${cycle.map(id => sectionName(byId.get(id)!)).join(', ')}.`
    });
  }

  return issues;
}

// --- États des étapes -----------------------------------------------------------

/**
 * Calcule l'état de chaque étape en un seul passage dans l'ordre topologique :
 * quand on arrive sur une section, toutes ses dépendances ont déjà leur état.
 * Les sections prises dans une boucle sont considérées comme débloquées, pour
 * qu'un modèle invalide ne puisse jamais bloquer l'utilisateur.
 */
export function computeStepFlow(session: ChecklistSession | null | undefined): StepFlow {
  const empty: StepFlow = { hasFlow: false, order: [], columns: {}, steps: {}, leftBehind: [], cycle: null };
  if (!session) return empty;

  const sections = session.templateSnapshot.sections;
  const deps = dependencyMap(sections);
  const successors = successorMap(sections, deps);
  const { order, unordered } = topologicalOrder(sections);
  const forced = forcedSectionIds(session);

  const itemsBySection = new Map<string, ApplicableItem[]>(sections.map(s => [s.id, []]));
  for (const item of applicableItems(session.templateSnapshot, session.contextValues)) {
    itemsBySection.get(item.sectionId)?.push(item);
  }

  const sectionsById = new Map(sections.map(s => [s.id, s]));
  const passedById = new Map<string, boolean>();
  const partial = new Map<string, Omit<StepState, 'next'>>();
  const unorderedIds = new Set(unordered);

  for (const id of [...order, ...unordered]) {
    const section = sectionsById.get(id)!;
    const sectionDeps = deps.get(id) ?? [];
    const items = itemsBySection.get(id) ?? [];

    const unlocked =
      unorderedIds.has(id) ||
      sectionDeps.length === 0 ||
      (section.joinMode === 'any'
        ? sectionDeps.some(d => passedById.get(d))
        : sectionDeps.every(d => passedById.get(d)));

    const blockingResolved = items
      .filter(i => criticalityOf(i) === 'blocking')
      .every(i => isResolved(i, session.answers[i.id]));
    const isForced = forced.has(id);
    const passed = unlocked && (blockingResolved || isForced);
    passedById.set(id, passed);

    const allAnswered = items.every(i => {
      const answer = session.answers[i.id];
      return isAnswered(i, answer) && !answer?.evidencePending;
    });
    const visual: StepVisual = !unlocked ? 'locked' : !passed ? 'open' : allAnswered ? 'done' : 'passed';

    partial.set(id, {
      sectionId: id,
      unlocked,
      blockingResolved,
      forced: isForced,
      passed,
      visual,
      join: sectionDeps.length >= 2 ? { ready: sectionDeps.filter(d => passedById.get(d)).length, total: sectionDeps.length } : null
    });
  }

  // Les sections d'une boucle sont calculées après les autres : on recalcule leurs jonctions.
  for (const id of unordered) {
    const state = partial.get(id)!;
    const sectionDeps = deps.get(id) ?? [];
    if (state.join) {
      partial.set(id, { ...state, join: { ready: sectionDeps.filter(d => passedById.get(d)).length, total: sectionDeps.length } });
    }
  }

  const steps: Record<string, StepState> = {};
  for (const [id, state] of partial) {
    steps[id] = {
      ...state,
      next: (successors.get(id) ?? []).map(n => ({ sectionId: n, unlocked: partial.get(n)!.unlocked }))
    };
  }

  const cycle = findCycleMembers(sections);
  const flow: StepFlow = {
    hasFlow: [...deps.values()].some(d => d.length > 0),
    order: [...order, ...unordered],
    columns: computeColumns(sections),
    steps,
    leftBehind: [],
    cycle: cycle.length > 0 ? cycle : null
  };
  flow.leftBehind = leftBehindItems(session, flow, itemsBySection);
  return flow;
}

/**
 * Contrôles « laissés en route » : non bloquants, applicables, sans réponse ou avec une
 * preuve en attente, dans une étape franchie dont au moins une étape suivante est débloquée.
 * Une dernière étape (sans suivante) n'a donc jamais de contrôle laissé en route.
 */
function leftBehindItems(
  session: ChecklistSession,
  flow: Pick<StepFlow, 'steps'>,
  itemsBySection: ReadonlyMap<string, ApplicableItem[]>
): ApplicableItem[] {
  const result: ApplicableItem[] = [];
  for (const section of session.templateSnapshot.sections) {
    const step = flow.steps[section.id];
    if (!step?.passed || !step.next.some(n => n.unlocked)) continue;
    for (const item of itemsBySection.get(section.id) ?? []) {
      const answer = session.answers[item.id];
      if (criticalityOf(item) !== 'blocking' && (!isAnswered(item, answer) || answer?.evidencePending)) {
        result.push(item);
      }
    }
  }
  return result;
}
