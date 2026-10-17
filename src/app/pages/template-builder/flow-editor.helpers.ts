/**
 * Édition de l'enchaînement des étapes dans le builder (change builder-flow-editor), en fonctions
 * pures et immuables (ADR 0006).
 *
 * Les règles du graphe (boucles, colonnes, validation) viennent de `domain/flow-rules.ts`, partagées
 * avec le runner et l'import. Ce fichier ne contient que les choix propres à l'édition : quelles
 * propriétés écrire ou retirer, ce que montrent les puces « Après : », le bandeau et l'aperçu.
 */

import {
  ChecklistSectionTemplate,
  ChecklistTemplate,
  CompletionPolicy,
  GateKind,
  JoinMode
} from '../../models/checklist.model';
import { computeColumns, criticalityOf, FlowIssue, topologicalOrder, validateFlow, wouldCreateCycle } from '../../domain/flow-rules';
import { StepGraphNode } from '../../domain/step-graph-layout';
import { resolveStepIcon, StepIconName } from '../../domain/step-icons';
import { updateSection } from './template-builder.helpers';

/** Titre affiché d'une section (puces, aperçu) : jamais vide. */
export function sectionTitle(section: ChecklistSectionTemplate): string {
  return section.title?.trim() || 'Sans titre';
}

function dependenciesOf(section: ChecklistSectionTemplate): string[] {
  return Array.isArray(section.dependsOn) ? section.dependsOn : [];
}

/** Vrai dès qu'une section déclare au moins une dépendance (connue ou non). */
export function hasDependencies(template: ChecklistTemplate): boolean {
  return template.sections.some(s => dependenciesOf(s).length > 0);
}

/**
 * Écrit une liste de dépendances : la propriété disparaît quand la liste est vide (absent = départ),
 * et le mode de jonction disparaît sous deux dépendances, où il n'a plus de sens.
 */
function withDependencies(section: ChecklistSectionTemplate, dependsOn: string[]): ChecklistSectionTemplate {
  const { dependsOn: _deps, joinMode, ...rest } = section;
  return {
    ...rest,
    ...(dependsOn.length > 0 ? { dependsOn } : {}),
    ...(dependsOn.length >= 2 && joinMode !== undefined ? { joinMode } : {})
  };
}

/**
 * Ajoute ou retire `dependencyId` des dépendances de `sectionId`. Un ajout qui créerait une boucle
 * est refusé (modèle rendu inchangé) : c'est la garde derrière la puce désactivée.
 */
export function toggleDependency(template: ChecklistTemplate, sectionId: string, dependencyId: string): ChecklistTemplate {
  const section = template.sections.find(s => s.id === sectionId);
  if (!section) return template;
  const current = dependenciesOf(section);
  if (current.includes(dependencyId)) {
    return updateSection(template, sectionId, s => withDependencies(s, current.filter(d => d !== dependencyId)));
  }
  if (!template.sections.some(s => s.id === dependencyId) || wouldCreateCycle(template.sections, sectionId, dependencyId)) {
    return template;
  }
  return updateSection(template, sectionId, s => withDependencies(s, [...current, dependencyId]));
}

/** Porte de la section ; la valeur choisie est toujours écrite, défaut compris (ADR 0007). */
export function setSectionGate(template: ChecklistTemplate, sectionId: string, gate: GateKind): ChecklistTemplate {
  return updateSection(template, sectionId, s => ({ ...s, gate }));
}

/** Mode de jonction ; sans effet sous deux dépendances, où il n'est pas proposé. */
export function setSectionJoinMode(template: ChecklistTemplate, sectionId: string, joinMode: JoinMode): ChecklistTemplate {
  return updateSection(template, sectionId, s => (dependenciesOf(s).length >= 2 ? { ...s, joinMode } : s));
}

/** Icône d'étape choisie dans la palette (nom Lucide de la liste fermée). */
export function setSectionIcon(template: ChecklistTemplate, sectionId: string, icon: StepIconName): ChecklistTemplate {
  return updateSection(template, sectionId, s => ({ ...s, icon }));
}

export function setCompletionPolicy(template: ChecklistTemplate, completionPolicy: CompletionPolicy): ChecklistTemplate {
  return { ...template, completionPolicy };
}

/** Dépendances d'une nouvelle section : la dernière de la liste si le modèle est déjà enchaîné. */
export function newSectionDependencies(template: ChecklistTemplate): string[] | undefined {
  const last = template.sections[template.sections.length - 1];
  return last && hasDependencies(template) ? [last.id] : undefined;
}

export interface DependencyChip {
  id: string;
  title: string;
  selected: boolean;
  /** Ajouter cette dépendance créerait une boucle : la puce est grisée. Une puce active ne l'est jamais. */
  disabled: boolean;
}

/** Puces « Après : » d'une section : une par autre section, dans l'ordre de la liste. */
export function dependencyChips(template: ChecklistTemplate, sectionId: string): DependencyChip[] {
  const section = template.sections.find(s => s.id === sectionId);
  if (!section) return [];
  const current = new Set(dependenciesOf(section));
  return template.sections
    .filter(s => s.id !== sectionId)
    .map(s => {
      const selected = current.has(s.id);
      return {
        id: s.id,
        title: sectionTitle(s),
        selected,
        disabled: !selected && wouldCreateCycle(template.sections, sectionId, s.id)
      };
    });
}

/** Sections dont au moins une autre dépend : seules celles-là proposent le choix de la porte. */
export function sectionsWithDependents(template: ChecklistTemplate): Set<string> {
  const known = new Set(template.sections.map(s => s.id));
  return new Set(template.sections.flatMap(s => dependenciesOf(s).filter(d => d !== s.id && known.has(d))));
}

// --- Bandeau de validation ------------------------------------------------------------

/** Erreurs d'enchaînement montrées par le bandeau (les autres codes concernent des valeurs, pas le graphe). */
const STRUCTURAL_ISSUES: ReadonlySet<FlowIssue['code']> = new Set(['self-dependency', 'unknown-dependency', 'cycle', 'duplicate-section-id']);

export interface FlowSummary {
  hasFlow: boolean;
  /** Sections sans dépendance connue. */
  starts: string[];
  /** Sections dont aucune autre ne dépend. */
  ends: string[];
  /** Sections sans contrôle (avertissement). */
  emptySections: { id: string; title: string }[];
  errors: FlowIssue[];
}

export function summarizeFlow(template: ChecklistTemplate): FlowSummary {
  const sections = template.sections;
  const known = new Set(sections.map(s => s.id));
  const withDependents = sectionsWithDependents(template);
  return {
    hasFlow: hasDependencies(template),
    starts: sections.filter(s => !dependenciesOf(s).some(d => d !== s.id && known.has(d))).map(s => s.id),
    ends: sections.filter(s => !withDependents.has(s.id)).map(s => s.id),
    emptySections: sections.filter(s => (s.items ?? []).length === 0).map(s => ({ id: s.id, title: sectionTitle(s) })),
    errors: validateFlow(template).filter(issue => STRUCTURAL_ISSUES.has(issue.code))
  };
}

// --- Nœuds de l'aperçu ----------------------------------------------------------------

export type PreviewRole = 'start' | 'join' | 'end' | 'step';

const ROLE_ICONS: Record<Exclude<PreviewRole, 'step'>, StepIconName> = {
  start: 'flag',
  join: 'git-merge',
  end: 'goal'
};

/** Rôle d'une étape dans le chemin, par priorité : départ, jonction, fin, sinon étape. */
export function previewRole(dependencyCount: number, hasDependents: boolean): PreviewRole {
  if (dependencyCount === 0) return 'start';
  if (dependencyCount >= 2) return 'join';
  if (!hasDependents) return 'end';
  return 'step';
}

function roleText(role: PreviewRole, dependencyCount: number): string {
  switch (role) {
    case 'start':
      return 'étape de départ';
    case 'join':
      return `jonction de ${dependencyCount} étapes`;
    case 'end':
      return 'fin';
    default:
      return 'étape';
  }
}

/**
 * Nœuds de l'aperçu du builder, dans l'ordre topologique (les sections prises dans une boucle à la fin).
 * Les champs de progression reçoivent des valeurs neutres : la variante « structure » du graphe les ignore.
 */
export function toPreviewNodes(template: ChecklistTemplate): StepGraphNode[] {
  const sections = template.sections;
  const known = new Set(sections.map(s => s.id));
  const byId = new Map(sections.map((s, index) => [s.id, { section: s, index }]));
  const columns = computeColumns(sections);
  const withDependents = sectionsWithDependents(template);
  const { order, unordered } = topologicalOrder(sections);

  return [...order, ...unordered].map(id => {
    const { section, index } = byId.get(id)!;
    const parents = [...new Set(dependenciesOf(section))].filter(d => d !== id && known.has(d));
    const role = previewRole(parents.length, withDependents.has(id));
    const items = section.items ?? [];
    const blocking = items.filter(i => criticalityOf(i) === 'blocking').length;
    const title = sectionTitle(section);
    return {
      id,
      label: title,
      column: columns[id] ?? 0,
      parents,
      order: index,
      icon: role === 'step' ? resolveStepIcon(section.icon) : ROLE_ICONS[role],
      visual: 'open',
      passed: false,
      answered: 0,
      total: items.length,
      anomaly: false,
      join: null,
      caption: `${items.length} ${items.length > 1 ? 'items' : 'item'} · ${blocking} bloq.`,
      ariaLabel: `${title} : ${roleText(role, parents.length)}, ${items.length} ${items.length > 1 ? 'items' : 'item'} dont ${blocking} ${blocking > 1 ? 'bloquants' : 'bloquant'}`
    };
  });
}
