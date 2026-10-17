import {
  ChecklistItemTemplate,
  ChecklistSectionTemplate,
  ChecklistSession,
  ChecklistTemplate,
  ForcedGate,
  ItemAnswer,
  JoinMode
} from '../models/checklist.model';
import { StepFlow, StepVisual } from './flow-rules';
import { applicableItems, criticalityOf, isApplicable, isResolved } from './session-rules';
import { EvidenceSummary, evidenceState, NO_EVIDENCE, SectionProgress } from './quick-check';
import { resolveStepIcon, StepIconName } from './step-icons';
import { StepGraphNode } from './step-graph-layout';

/**
 * Règles de la vue chemin du runner (change `runner-path-view`), sous forme de fonctions pures.
 *
 * Elles traduisent les états d'étape calculés par `computeStepFlow` (ADR 0007) en ce que la vue
 * affiche : étape sélectionnée par défaut, prérequis d'une étape verrouillée, pied d'étape,
 * portes qui viennent de s'ouvrir, nœuds du graphe. Elles ne dépendent ni d'Angular ni de Dexie.
 */

// --- Étapes ---------------------------------------------------------------------

/** Première étape ouverte de l'ordre topologique, sinon première franchie avec des restes, sinon la dernière. */
export function defaultSelectedStep(flow: StepFlow): string | null {
  const order = flow.order;
  return (
    order.find(id => flow.steps[id]?.visual === 'open') ??
    order.find(id => flow.steps[id]?.visual === 'passed') ??
    order[order.length - 1] ??
    null
  );
}

/** Sections verrouillées : leurs contrôles ne sont ni affichés en lignes ni saisissables. */
export function lockedSectionIds(flow: StepFlow): Set<string> {
  return new Set(Object.values(flow.steps).filter(s => !s.unlocked).map(s => s.sectionId));
}

export function unlockedSectionIds(flow: StepFlow): Set<string> {
  return new Set(Object.values(flow.steps).filter(s => s.unlocked).map(s => s.sectionId));
}

/** Étapes débloquées maintenant qui ne l'étaient pas, dans l'ordre topologique. */
export function newlyUnlocked(previous: ReadonlySet<string>, flow: StepFlow): string[] {
  return flow.order.filter(id => flow.steps[id]?.unlocked && !previous.has(id));
}

/** Modèle à dépendances dont toutes les étapes sont franchies : c'est la fin du chemin. */
export function allStepsPassed(flow: StepFlow): boolean {
  return flow.hasFlow && flow.order.length > 0 && flow.order.every(id => flow.steps[id]?.passed);
}

// --- Étape verrouillée ----------------------------------------------------------------

/** `ready` : franchie ; `in-progress` : débloquée mais pas franchie ; `not-open` : verrouillée. */
export type PrerequisiteState = 'ready' | 'in-progress' | 'not-open';

export interface StepPrerequisite {
  sectionId: string;
  title: string;
  state: PrerequisiteState;
}

export interface StepPrerequisites {
  joinMode: JoinMode;
  items: StepPrerequisite[];
}

/** Dépendances connues d'une section, dédoublonnées, sans elle-même. */
function dependenciesOf(section: ChecklistSectionTemplate, sections: readonly ChecklistSectionTemplate[]): ChecklistSectionTemplate[] {
  const byId = new Map(sections.map(s => [s.id, s]));
  const ids = Array.isArray(section.dependsOn) ? [...new Set(section.dependsOn)] : [];
  return ids.filter(id => id !== section.id && byId.has(id)).map(id => byId.get(id)!);
}

export function stepPrerequisites(
  section: ChecklistSectionTemplate,
  template: ChecklistTemplate,
  flow: StepFlow
): StepPrerequisites {
  return {
    joinMode: section.joinMode === 'any' ? 'any' : 'all',
    items: dependenciesOf(section, template.sections).map(dep => {
      const step = flow.steps[dep.id];
      const state: PrerequisiteState = step?.passed ? 'ready' : step?.unlocked ? 'in-progress' : 'not-open';
      return { sectionId: dep.id, title: dep.title, state };
    })
  };
}

export interface LockedStepItem {
  id: string;
  label: string;
  /** Rappel de la réponse déjà donnée (étape reverrouillée), sinon `null`. */
  answerText: string | null;
}

/** Texte discret d'une réponse : « fait », « OK », « KO », « N/A » ou le libellé du choix. */
export function answerText(item: ChecklistItemTemplate, answer: ItemAnswer | undefined): string | null {
  if (!answer) return null;
  if (answer.status === 'NA') return 'N/A';
  switch (item.controlType ?? 'status') {
    case 'checkbox':
      return answer.checked ? 'fait' : null;
    case 'choice': {
      if (!answer.selectedChoice) return null;
      const choice = item.customChoices?.find(c => c.id === answer.selectedChoice || c.label === answer.selectedChoice);
      return choice?.label ?? answer.selectedChoice;
    }
    default:
      return answer.status === 'OK' || answer.status === 'KO' ? answer.status : null;
  }
}

/** Contrôles applicables d'une section, en simple texte, avec le rappel de leur réponse. */
export function lockedStepItems(section: ChecklistSectionTemplate, session: ChecklistSession): LockedStepItem[] {
  return section.items
    .filter(item => isApplicable(item, session.contextValues))
    .map(item => ({ id: item.id, label: item.label, answerText: answerText(item, session.answers[item.id]) }));
}

// --- Pied d'étape -----------------------------------------------------------------------

export interface FooterItemRef {
  id: string;
  label: string;
}

export interface StepFooter {
  passed: boolean;
  /** Contrôles bloquants applicables non résolus. */
  unresolvedBlocking: number;
  /** Étapes suivantes, avec leur état débloqué. */
  next: { sectionId: string; title: string; unlocked: boolean }[];
  /** Étape sans suivante. */
  isFinal: boolean;
  /** Toutes les étapes du modèle sont franchies. */
  allPassed: boolean;
  naBlocking: FooterItemRef[];
  pending: FooterItemRef[];
  missing: FooterItemRef[];
  /** Forçage pris en compte (porte toujours souple), le plus récent. */
  forced: ForcedGate | null;
  /** « Forcer le passage » est proposé : porte souple, étape débloquée non franchie, session en cours. */
  canForce: boolean;
}

export function stepFooter(
  section: ChecklistSectionTemplate,
  session: ChecklistSession,
  flow: StepFlow,
  evidence: Readonly<Record<string, EvidenceSummary>>
): StepFooter {
  const step = flow.steps[section.id];
  const titles = new Map(session.templateSnapshot.sections.map(s => [s.id, s.title]));
  const items = applicableItems(session.templateSnapshot, session.contextValues).filter(i => i.sectionId === section.id);
  const ref = (item: ChecklistItemTemplate): FooterItemRef => ({ id: item.id, label: item.label });
  const blocking = items.filter(i => criticalityOf(i) === 'blocking');
  const forcedEntries = step?.forced ? (session.forcedGates ?? []).filter(g => g.sectionId === section.id) : [];

  return {
    passed: !!step?.passed,
    unresolvedBlocking: blocking.filter(i => !isResolved(i, session.answers[i.id])).length,
    next: (step?.next ?? []).map(n => ({ sectionId: n.sectionId, title: titles.get(n.sectionId) ?? n.sectionId, unlocked: n.unlocked })),
    isFinal: (step?.next.length ?? 0) === 0,
    allPassed: allStepsPassed(flow),
    naBlocking: blocking.filter(i => session.answers[i.id]?.status === 'NA').map(ref),
    pending: items.filter(i => evidenceState(i, session.answers[i.id], evidence[i.id] ?? NO_EVIDENCE) === 'pending').map(ref),
    missing: items.filter(i => evidenceState(i, session.answers[i.id], evidence[i.id] ?? NO_EVIDENCE) === 'missing').map(ref),
    forced: forcedEntries.length > 0 ? forcedEntries[forcedEntries.length - 1] : null,
    canForce: section.gate === 'soft' && !!step?.unlocked && !step.passed && session.status === 'in_progress'
  };
}

// --- Graphe ------------------------------------------------------------------------------

/** Nœuds du graphe pour le runner, dans l'ordre topologique (ordre de tabulation des nœuds). */
export function toGraphNodes(flow: StepFlow, template: ChecklistTemplate, progress: readonly SectionProgress[]): StepGraphNode[] {
  const sections = template.sections;
  const byId = new Map(sections.map((s, index) => [s.id, { section: s, index }]));
  const progressById = new Map(progress.map(p => [p.sectionId, p]));

  return flow.order
    .filter(id => byId.has(id) && flow.steps[id])
    .map(id => {
      const { section, index } = byId.get(id)!;
      const step = flow.steps[id];
      const p = progressById.get(id);
      return {
        id,
        label: section.title,
        column: flow.columns[id] ?? 0,
        parents: dependenciesOf(section, sections).map(d => d.id),
        order: index,
        icon: resolveStepIcon(section.icon),
        visual: step.visual,
        passed: step.passed,
        answered: p?.answered ?? 0,
        total: p?.total ?? 0,
        anomaly: p?.hasAnomaly ?? false,
        join: step.join
      };
    });
}

// --- Modèle d'affichage d'une étape (panneau, section de la vue liste) ------------------

export interface StepView {
  sectionId: string;
  title: string;
  icon: StepIconName;
  visual: StepVisual;
  /** Au moins deux dépendances. */
  isJoin: boolean;
  answered: number;
  total: number;
  anomaly: boolean;
  prerequisites: StepPrerequisites;
  /** Contrôles en texte simple, pour une étape verrouillée (vide sinon). */
  lockedItems: LockedStepItem[];
  footer: StepFooter;
}

/** Tout ce que la vue chemin et la vue liste affichent pour chaque étape d'un modèle à dépendances. */
export function buildStepViews(
  session: ChecklistSession,
  flow: StepFlow,
  evidence: Readonly<Record<string, EvidenceSummary>>,
  progress: readonly SectionProgress[]
): Record<string, StepView> {
  const template = session.templateSnapshot;
  const progressById = new Map(progress.map(p => [p.sectionId, p]));
  const views: Record<string, StepView> = {};
  for (const section of template.sections) {
    const step = flow.steps[section.id];
    if (!step) continue;
    const p = progressById.get(section.id);
    views[section.id] = {
      sectionId: section.id,
      title: section.title,
      icon: resolveStepIcon(section.icon),
      visual: step.visual,
      isJoin: !!step.join,
      answered: p?.answered ?? 0,
      total: p?.total ?? 0,
      anomaly: p?.hasAnomaly ?? false,
      prerequisites: stepPrerequisites(section, template, flow),
      lockedItems: step.unlocked ? [] : lockedStepItems(section, session),
      footer: stepFooter(section, session, flow, evidence)
    };
  }
  return views;
}
