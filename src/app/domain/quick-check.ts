import { ChecklistItemTemplate, ChecklistSession, ChecklistTemplate, ItemAnswer } from '../models/checklist.model';
import {
  ApplicableItem,
  applicableItems,
  criticalityOf,
  forcedSectionIds,
  isAnswered,
  isApplicable,
  isKo,
  isResolved
} from './session-rules';

/**
 * Règles de la saisie rapide (change `quick-check-and-drawer`), sous forme de fonctions pures.
 *
 * Le clic sur une ligne et les raccourcis clavier passent par les mêmes décisions :
 * quelle réponse donner, faut-il d'abord demander une preuve, quel raccourci appliquer,
 * quel contrôle viser ensuite. Elles ne dépendent ni d'Angular ni de Dexie.
 */

// --- Preuves -----------------------------------------------------------------

/** Preuves d'un contrôle stockées dans la table `evidences` : nombre total et nombre d'images. */
export interface EvidenceSummary {
  total: number;
  images: number;
}

export const NO_EVIDENCE: EvidenceSummary = { total: 0, images: 0 };

/** Vrai pour une adresse absolue en `http` ou `https` : seules ces adresses deviennent des liens cliquables. */
export function isSafeHttpUrl(value: string | null | undefined): boolean {
  const candidate = value?.trim();
  if (!candidate) return false;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** La preuve exigée par le modèle est-elle fournie ? Toujours vrai si aucune preuve n'est exigée. */
export function isEvidenceSatisfied(
  item: ChecklistItemTemplate,
  answer: ItemAnswer | undefined,
  evidence: EvidenceSummary
): boolean {
  switch (item.evidenceRequired) {
    case undefined:
      return true;
    case 'comment':
      return !!answer?.comment?.trim();
    case 'photo':
      return evidence.images > 0;
    case 'file':
      return evidence.total > 0;
    case 'link':
      return isSafeHttpUrl(answer?.evidenceLink);
  }
}

/**
 * État de la preuve exigée d'un contrôle, pour l'affichage de sa ligne :
 * - `not-required` : aucune preuve exigée, ou réponse qui n'en demande pas (N/A, KO, anomalie) ;
 * - `required` : preuve exigée, pas encore de réponse conforme ;
 * - `satisfied` : preuve fournie ;
 * - `pending` : réponse conforme donnée avec « Plus tard » ;
 * - `missing` : réponse conforme donnée, mais la preuve a disparu depuis (ADR 0009).
 */
export type EvidenceState = 'not-required' | 'required' | 'satisfied' | 'pending' | 'missing';

export function evidenceState(
  item: ChecklistItemTemplate,
  answer: ItemAnswer | undefined,
  evidence: EvidenceSummary
): EvidenceState {
  if (!item.evidenceRequired) return 'not-required';
  if (answer?.status === 'NA' || isKo(item, answer)) return 'not-required';
  if (isEvidenceSatisfied(item, answer, evidence)) return 'satisfied';
  if (!isAnswered(item, answer)) return 'required';
  return answer?.evidencePending ? 'pending' : 'missing';
}

/** Sépare les fichiers acceptés de ceux qui dépassent la taille maximale. */
export function partitionBySize<T extends { size: number }>(files: readonly T[], maxSize: number): { accepted: T[]; rejected: T[] } {
  const accepted: T[] = [];
  const rejected: T[] = [];
  for (const file of files) {
    (file.size > maxSize ? rejected : accepted).push(file);
  }
  return { accepted, rejected };
}

// --- Geste principal ---------------------------------------------------------

/**
 * Effet du geste principal (clic sur la ligne ou Espace) :
 * - `check` / `uncheck` : case à cocher ;
 * - `ok` : statut sans réponse ou KO (correction) ; `clear` : retrait d'un OK ;
 * - `ask-evidence` : la réponse conforme exige d'abord une preuve ;
 * - `none` : contrôle de type choix ou N/A.
 */
export type PrimaryOutcome = 'check' | 'uncheck' | 'ok' | 'clear' | 'ask-evidence' | 'none';

export function primaryGesture(
  item: ChecklistItemTemplate,
  answer: ItemAnswer | undefined,
  evidence: EvidenceSummary
): PrimaryOutcome {
  if (answer?.status === 'NA') return 'none';
  switch (item.controlType ?? 'status') {
    case 'choice':
      return 'none';
    case 'checkbox':
      if (answer?.checked) return 'uncheck';
      return isEvidenceSatisfied(item, answer, evidence) ? 'check' : 'ask-evidence';
    default:
      if (answer?.status === 'OK') return 'clear';
      return isEvidenceSatisfied(item, answer, evidence) ? 'ok' : 'ask-evidence';
  }
}

/** Effet d'un clic sur un bouton de choix : un choix en anomalie ne demande jamais de preuve. */
export type ChoiceOutcome = 'select' | 'deselect' | 'ask-evidence' | 'none';

export function choiceGesture(
  item: ChecklistItemTemplate,
  answer: ItemAnswer | undefined,
  choiceId: string,
  evidence: EvidenceSummary
): ChoiceOutcome {
  if (answer?.status === 'NA') return 'none';
  if (answer?.selectedChoice === choiceId) return 'deselect';
  const choice = item.customChoices?.find(c => c.id === choiceId);
  if (!choice) return 'none';
  if (!choice.isBlocking && !isEvidenceSatisfied(item, answer, evidence)) return 'ask-evidence';
  return 'select';
}

// --- Raccourcis clavier ------------------------------------------------------

export type ShortcutAction = 'next' | 'previous' | 'primary' | 'ko' | 'na' | 'drawer' | 'help' | 'escape';

export interface ShortcutContext {
  /** Le focus est dans un `input`, un `textarea`, un `select` ou un élément éditable. */
  editable: boolean;
  /** Une fenêtre modale est ouverte (elle gère elle-même son clavier, Échap compris). */
  modalOpen: boolean;
  /** Session terminée : aucun raccourci ne modifie une réponse. */
  readonly: boolean;
  /** Le focus est sur un bouton ou un lien : Espace garde son comportement natif. */
  onControl: boolean;
}

export type ShortcutKey = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'>;

/** Traduit une touche en action du runner, ou `null` si la touche doit garder son comportement habituel. */
export function resolveShortcut(event: ShortcutKey, ctx: ShortcutContext): ShortcutAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  if (ctx.editable || ctx.modalOpen) return null;

  switch (event.key) {
    case 'Escape':
      return 'escape';
    case 'ArrowDown':
      return 'next';
    case 'ArrowUp':
      return 'previous';
    case ' ':
      return ctx.onControl || ctx.readonly ? null : 'primary';
    case '?':
      return 'help';
  }
  switch (event.key.toLowerCase()) {
    case 'k':
      return ctx.readonly ? null : 'ko';
    case 'n':
      return ctx.readonly ? null : 'na';
    case 'a':
      return 'drawer';
  }
  return null;
}

// --- Items affichés, item actif, prochain item -------------------------------

export type ItemFilter = 'all' | 'pending' | 'ko';

export function matchesFilter(item: ChecklistItemTemplate, answer: ItemAnswer | undefined, filter: ItemFilter): boolean {
  if (filter === 'pending') return !isAnswered(item, answer);
  if (filter === 'ko') return isKo(item, answer);
  return true;
}

/**
 * Portée des contrôles affichés sur un modèle à étapes (change `runner-path-view`) :
 * - `locked` : sections verrouillées, dont les contrôles ne sont jamais des lignes ;
 * - `sectionId` : en vue chemin, la seule étape affichée (son panneau ne se replie pas).
 */
export interface DisplayScope {
  locked?: ReadonlySet<string>;
  sectionId?: string | null;
}

/**
 * Contrôles affichés, dans l'ordre du modèle : sections dépliées (ou étape sélectionnée en vue chemin),
 * filtre actif, plus le contrôle épinglé (tiroir ouvert) même si le filtre devrait le masquer.
 * Le verrouillage d'une étape l'emporte sur l'épinglage.
 */
export function visibleItems(
  items: readonly ApplicableItem[],
  answers: Record<string, ItemAnswer>,
  filter: ItemFilter,
  collapsed: Record<string, boolean>,
  pinnedItemId: string | null,
  scope: DisplayScope = {}
): ApplicableItem[] {
  const pathSection = scope.sectionId ?? null;
  return items.filter(item => {
    if (scope.locked?.has(item.sectionId)) return false;
    const shown = pathSection !== null ? item.sectionId === pathSection : !collapsed[item.sectionId];
    return shown && (item.id === pinnedItemId || matchesFilter(item, answers[item.id], filter));
  });
}

/**
 * Item actif après un changement de la liste affichée : l'actif s'il est toujours affiché,
 * sinon celui qui le suivait dans la liste précédente, sinon le dernier affiché.
 */
export function nextActiveItem(previous: readonly string[], current: readonly string[], activeId: string | null): string | null {
  if (current.length === 0) return null;
  if (activeId && current.includes(activeId)) return activeId;
  if (!activeId) return current[0];
  const shown = new Set(current);
  const index = previous.indexOf(activeId);
  if (index >= 0) {
    const successor = previous.slice(index + 1).find(id => shown.has(id));
    if (successor) return successor;
  }
  return current[current.length - 1];
}

/** Item voisin dans la liste affichée (`delta` = +1 ou -1), sans dépasser les extrémités. */
export function stepItem(ids: readonly string[], activeId: string | null, delta: 1 | -1): string | null {
  if (ids.length === 0) return null;
  const index = activeId ? ids.indexOf(activeId) : -1;
  if (index < 0) return ids[0];
  return ids[Math.min(ids.length - 1, Math.max(0, index + delta))];
}

/**
 * Premier contrôle applicable sans réponse qui suit `fromItemId` dans l'ordre du modèle,
 * en reprenant au début si besoin, hors étapes verrouillées. `null` quand il n'y en a aucun.
 */
export function nextItemToProcess(
  items: readonly ApplicableItem[],
  answers: Record<string, ItemAnswer>,
  fromItemId: string | null,
  locked: ReadonlySet<string> = new Set()
): ApplicableItem | null {
  const start = fromItemId ? items.findIndex(i => i.id === fromItemId) : -1;
  for (let step = 1; step <= items.length; step++) {
    const item = items[(start + step) % items.length];
    if (!locked.has(item.sectionId) && !isAnswered(item, answers[item.id])) return item;
  }
  return null;
}

/**
 * État du bouton « Prochain item à traiter » : un contrôle est accessible, tout est renseigné,
 * ou les seuls contrôles sans réponse attendent l'ouverture de leur étape.
 */
export type NextItemState = 'available' | 'all-done' | 'locked-only';

export function nextItemState(
  items: readonly ApplicableItem[],
  answers: Record<string, ItemAnswer>,
  locked: ReadonlySet<string> = new Set()
): NextItemState {
  const unanswered = items.filter(item => !isAnswered(item, answers[item.id]));
  if (unanswered.length === 0) return 'all-done';
  return unanswered.some(item => !locked.has(item.sectionId)) ? 'available' : 'locked-only';
}

/**
 * Contrôles signalés « preuve manquante » : réponse conforme donnée, preuve exigée plus fournie,
 * sans « preuve à compléter » (ADR 0009). Sert à la confirmation de clôture, jamais à la validation.
 */
export function missingEvidenceItems(
  items: readonly ApplicableItem[],
  answers: Record<string, ItemAnswer>,
  evidence: Readonly<Record<string, EvidenceSummary>>
): ApplicableItem[] {
  return items.filter(item => evidenceState(item, answers[item.id], evidence[item.id] ?? NO_EVIDENCE) === 'missing');
}

// --- Progression -------------------------------------------------------------

export interface SectionProgress {
  sectionId: string;
  title: string;
  answered: number;
  total: number;
  /** Au moins un contrôle en anomalie (KO ou choix en anomalie). */
  hasAnomaly: boolean;
}

/** Progression de chaque section qui a au moins un contrôle applicable. */
export function sectionProgress(session: ChecklistSession | null | undefined): SectionProgress[] {
  if (!session) return [];
  const result: SectionProgress[] = [];
  for (const section of session.templateSnapshot.sections) {
    const items = section.items.filter(item => isApplicable(item, session.contextValues));
    if (items.length === 0) continue;
    let answered = 0;
    let hasAnomaly = false;
    for (const item of items) {
      const answer = session.answers[item.id];
      if (isAnswered(item, answer)) answered++;
      if (isKo(item, answer)) hasAnomaly = true;
    }
    result.push({ sectionId: section.id, title: section.title, answered, total: items.length, hasAnomaly });
  }
  return result;
}

/** Le modèle déclare-t-il au moins un contrôle bloquant ? */
export function declaresBlocking(template: ChecklistTemplate | null | undefined): boolean {
  return !!template?.sections.some(s => s.items.some(i => criticalityOf(i) === 'blocking'));
}

/** Contrôles bloquants applicables non résolus, hors sections dont la porte souple a été forcée. */
export function unresolvedBlockingCount(session: ChecklistSession | null | undefined): number {
  if (!session) return 0;
  const forced = forcedSectionIds(session);
  return applicableItems(session.templateSnapshot, session.contextValues).filter(
    item => criticalityOf(item) === 'blocking' && !forced.has(item.sectionId) && !isResolved(item, session.answers[item.id])
  ).length;
}
