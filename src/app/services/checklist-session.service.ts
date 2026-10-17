import { Injectable, inject, signal, computed } from '@angular/core';
import {
  ChecklistItemTemplate,
  ChecklistSession,
  ControlStatus,
  ChecklistTemplate,
  EvidenceRecord,
  ImportConflictMode,
  ItemAnswer
} from '../models/checklist.model';
import { asImportedCopy, ParsedSessionImport } from '../domain/session-exchange';
import { newEvidenceId } from './evidence.service';
import { AppDatabaseService } from './app-database.service';
import { TemplateService } from './template.service';
import {
  appendItemEvent,
  applicableItems,
  CompletionIssue,
  computeMetrics,
  criticalityOf,
  defaultContextValues,
  diffTemplates,
  hasTemplateUpdate,
  isAnswered,
  isKo,
  rebaseSessionOnTemplate,
  TemplateDiff,
  validateForCompletion,
  withoutEvidenceRemovedEvent
} from '../domain/session-rules';
import { computeStepFlow, StepFlow } from '../domain/flow-rules';
import { EvidenceSummary, isEvidenceSatisfied, isSafeHttpUrl, NO_EVIDENCE } from '../domain/quick-check';

export type FilterType = 'all' | 'pending' | 'ko';
export type SessionLoadState = 'loading' | 'ready' | 'not-found';

/** Délai de regroupement des écritures pour les saisies textuelles. */
export const SAVE_DEBOUNCE_MS = 400;

export interface TemplateUpdatePreview {
  template: ChecklistTemplate;
  diff: TemplateDiff;
}

const EMPTY_ANSWER: ItemAnswer = { status: null, comment: '', extra: {} };

/** Options de la réponse conforme donnée par la saisie rapide (validation ou report de la preuve). */
export interface ResolveItemOptions {
  /** Choix retenu, pour un contrôle de type choix. */
  choiceId?: string;
  /** Vrai : réponse donnée avec « Plus tard » ; faux ou absent : la preuve est fournie, l'indicateur est retiré. */
  pending?: boolean;
  /** Lien de preuve validé en même temps que la réponse. */
  link?: string;
}

export interface MarkRemainingResult {
  modified: number;
  /** Bloquants laissés sans réponse parce que leur preuve exigée manque. */
  skippedForEvidence: number;
}

/** Retire l'indicateur « preuve à compléter » en l'historisant ; ne change rien s'il n'est pas posé. */
function withoutPending(answer: ItemAnswer, at: string): ItemAnswer {
  if (!answer.evidencePending) return answer;
  const { evidencePending: _pending, ...rest } = answer;
  return appendItemEvent(rest, { at, kind: 'evidence-pending', pending: false });
}

@Injectable({
  providedIn: 'root'
})
export class ChecklistSessionService {
  private db = inject(AppDatabaseService);
  private templateService = inject(TemplateService);

  readonly allSessions = signal<ChecklistSession[]>([]);
  readonly currentSession = signal<ChecklistSession | null>(null);
  readonly loadState = signal<SessionLoadState>('loading');

  readonly activeFilter = signal<FilterType>('all');
  readonly isSaving = signal<boolean>(false);
  readonly collapsedSections = signal<Record<string, boolean>>({});
  /** Panneau d'anomalies ouvert après une tentative de clôture refusée. */
  readonly issuesPanelOpen = signal<boolean>(false);

  /** Structure de la session courante : toujours sa copie figée, jamais la bibliothèque. */
  readonly currentTemplate = computed<ChecklistTemplate | null>(() => this.currentSession()?.templateSnapshot ?? null);
  readonly isReadonly = computed<boolean>(() => this.currentSession()?.status === 'completed');

  readonly applicableItems = computed(() => {
    const session = this.currentSession();
    return session ? applicableItems(session.templateSnapshot, session.contextValues) : [];
  });

  readonly metrics = computed(() => computeMetrics(this.currentSession()));

  /** États des étapes (portes, jonctions, laissés en route) : calculés, jamais stockés (ADR 0007). */
  readonly stepFlow = computed<StepFlow>(() => computeStepFlow(this.currentSession()));
  readonly leftBehind = computed(() => this.stepFlow().leftBehind);

  /** Anomalies recalculées en direct : la liste se vide au fur et à mesure des corrections. */
  readonly completionIssues = computed<CompletionIssue[]>(() => {
    const session = this.currentSession();
    return session && session.status === 'in_progress' ? validateForCompletion(session) : [];
  });

  readonly currentHasTemplateUpdate = computed<boolean>(() => {
    const session = this.currentSession();
    return !!session && this.hasTemplateUpdate(session);
  });

  // Écriture différée en attente (une seule à la fois : la dernière version de la session gagne).
  private pendingSave: ChecklistSession | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  async loadAllSessions(): Promise<ChecklistSession[]> {
    await this.flushPendingSave();
    const sessions = await this.db.sessions.orderBy('updatedAt').reverse().toArray();
    this.allSessions.set(sessions);
    return sessions;
  }

  async loadSession(sessionId: string): Promise<ChecklistSession | null> {
    await this.flushPendingSave();
    this.loadState.set('loading');
    this.issuesPanelOpen.set(false);
    const session = await this.db.sessions.get(sessionId);
    this.currentSession.set(session ?? null);
    this.loadState.set(session ? 'ready' : 'not-found');
    return session ?? null;
  }

  async createSession(templateId: string, title: string): Promise<ChecklistSession> {
    const template = this.templateService.findTemplate(templateId) ?? (await this.db.templates.get(templateId));
    if (!template) {
      throw new Error(`Modèle introuvable : ${templateId}`);
    }

    const now = new Date().toISOString();
    const newSession: ChecklistSession = {
      id: crypto.randomUUID(),
      title: title.trim() || `Checklist ${new Date().toLocaleDateString('fr-FR')}`,
      templateId,
      // structuredClone = copie profonde : la session ne partage aucune référence avec la bibliothèque.
      templateSnapshot: structuredClone(template),
      status: 'in_progress',
      closures: [],
      contextValues: defaultContextValues(template, now.split('T')[0]),
      answers: {},
      createdAt: now,
      updatedAt: now
    };

    await this.write(newSession);
    this.currentSession.set(newSession);
    this.loadState.set('ready');
    return newSession;
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (this.pendingSave?.id === sessionId) {
      this.clearPending();
    }
    await this.db.transaction('rw', this.db.sessions, this.db.evidences, async () => {
      await this.db.sessions.delete(sessionId);
      await this.db.evidences.where('sessionId').equals(sessionId).delete();
    });
    if (this.currentSession()?.id === sessionId) {
      this.currentSession.set(null);
    }
    this.allSessions.update(list => list.filter(s => s.id !== sessionId));
  }

  // --- Saisies -------------------------------------------------------------

  updateTitle(title: string): Promise<void> {
    if (!title.trim()) return Promise.resolve();
    return this.mutate(s => (s.title === title ? null : { ...s, title }), { debounce: true });
  }

  updateContextValue(key: string, value: string): Promise<void> {
    return this.mutate(s => ({ ...s, contextValues: { ...s.contextValues, [key]: value } }), { debounce: true });
  }

  // Chaque changement d'état est historisé ; les saisies de texte (commentaire, champ additionnel) ne le sont pas.
  // L'indicateur « preuve à compléter » ne survit qu'à une réponse conforme : il est retiré avec elle.

  updateAnswerStatus(itemId: string, status: ControlStatus): Promise<void> {
    return this.mutateAnswer(itemId, ans => {
      const at = new Date().toISOString();
      const next = ans.status === status ? null : status;
      const answer = appendItemEvent({ ...ans, status: next }, { at, kind: 'status', status: next });
      return next === 'OK' ? answer : withoutPending(answer, at);
    });
  }

  updateAnswerCheckbox(itemId: string, checked: boolean, withTimestamp: boolean): Promise<void> {
    const now = new Date().toISOString();
    const checkedAt = checked && withTimestamp ? now : undefined;
    return this.mutateAnswer(itemId, ans => {
      const answer = appendItemEvent({ ...ans, checked, checkedAt }, { at: now, kind: 'checked', checked });
      return checked ? answer : withoutPending(answer, now);
    });
  }

  updateAnswerChoice(itemId: string, choiceId: string): Promise<void> {
    const item = this.findItem(itemId);
    return this.mutateAnswer(itemId, ans => {
      const at = new Date().toISOString();
      const next = ans.selectedChoice === choiceId ? undefined : choiceId;
      const answer = appendItemEvent({ ...ans, selectedChoice: next }, { at, kind: 'choice', choiceId: next ?? null });
      const conforming = !!next && !!item && !isKo(item, answer);
      return conforming ? answer : withoutPending(answer, at);
    });
  }

  /**
   * Pose ou retire le N/A, quel que soit le type du contrôle (ADR 0009). Le poser retire la coche,
   * le choix et la preuve en attente ; le lien de preuve éventuel est conservé.
   */
  toggleNa(itemId: string): Promise<void> {
    return this.mutateAnswer(itemId, ans => {
      const at = new Date().toISOString();
      if (ans.status === 'NA') {
        return appendItemEvent({ ...ans, status: null }, { at, kind: 'status', status: null });
      }
      const { checked: _checked, checkedAt: _checkedAt, selectedChoice: _choice, ...rest } = ans;
      return withoutPending(appendItemEvent({ ...rest, status: 'NA' }, { at, kind: 'status', status: 'NA' }), at);
    });
  }

  /**
   * Donne la réponse conforme d'un contrôle (case cochée, `OK`, ou choix `choiceId`), avec, en une
   * seule écriture, le lien de preuve et la pose (« Plus tard ») ou le retrait de la preuve en attente.
   */
  resolveItem(itemId: string, options: ResolveItemOptions = {}): Promise<void> {
    const item = this.findItem(itemId);
    // Un bloquant ne reçoit jamais de réponse sans sa preuve : « Plus tard » lui est refusé (ADR 0009).
    if (!item || (options.pending && criticalityOf(item) === 'blocking')) return Promise.resolve();
    return this.mutateAnswer(itemId, ans => {
      const at = new Date().toISOString();
      let next = ans;
      const link = options.link?.trim();
      if (link && isSafeHttpUrl(link) && link !== next.evidenceLink) {
        next = appendItemEvent({ ...next, evidenceLink: link }, { at, kind: 'evidence-link', url: link });
      }

      switch (item.controlType ?? 'status') {
        case 'checkbox':
          if (!next.checked) {
            const checkedAt = item.withTimestamp ? at : undefined;
            next = appendItemEvent({ ...next, checked: true, checkedAt }, { at, kind: 'checked', checked: true });
          }
          break;
        case 'choice':
          if (options.choiceId && next.selectedChoice !== options.choiceId) {
            next = appendItemEvent({ ...next, selectedChoice: options.choiceId }, { at, kind: 'choice', choiceId: options.choiceId });
          }
          break;
        default:
          if (next.status !== 'OK') {
            next = appendItemEvent({ ...next, status: 'OK' }, { at, kind: 'status', status: 'OK' });
          }
      }

      if (!options.pending) return withoutPending(next, at);
      if (next.evidencePending) return next;
      return appendItemEvent({ ...next, evidencePending: true }, { at, kind: 'evidence-pending', pending: true });
    });
  }

  /** Renseigne (adresse http ou https uniquement) ou retire le lien de preuve d'un contrôle. */
  setEvidenceLink(itemId: string, url: string | null): Promise<void> {
    const value = url?.trim() || undefined;
    if (value && !isSafeHttpUrl(value)) return Promise.resolve();
    return this.mutateAnswer(itemId, ans => {
      if (value === ans.evidenceLink) return ans;
      const { evidenceLink: _link, ...rest } = ans;
      const next: ItemAnswer = value ? { ...rest, evidenceLink: value } : rest;
      return appendItemEvent(next, { at: new Date().toISOString(), kind: 'evidence-link', url: value ?? null });
    });
  }

  /** Retire l'indicateur « preuve à compléter » (preuve fournie depuis le tiroir). */
  clearEvidencePending(itemId: string): Promise<void> {
    return this.mutateAnswer(itemId, ans => withoutPending(ans, new Date().toISOString()));
  }

  /**
   * Annulation de la suppression d'une preuve : retire l'événement de suppression ajouté au moment
   * de l'action (ADR 0007, point 5). Ignoré si `sessionId` n'est plus la session affichée.
   */
  removeEvidenceRemovedEvent(sessionId: string, itemId: string, evidenceId: string): Promise<void> {
    if (this.currentSession()?.id !== sessionId) return Promise.resolve();
    return this.mutateAnswer(itemId, ans => withoutEvidenceRemovedEvent(ans, evidenceId));
  }

  /**
   * Historise l'ajout ou la suppression d'une preuve sur un contrôle de la session courante.
   * Ignoré si `sessionId` n'est plus la session affichée.
   */
  recordEvidenceEvent(
    sessionId: string,
    itemId: string,
    kind: 'evidence-added' | 'evidence-removed',
    evidence: { id: string; name: string }
  ): Promise<void> {
    if (this.currentSession()?.id !== sessionId) return Promise.resolve();
    return this.mutateAnswer(itemId, ans =>
      appendItemEvent(ans, { at: new Date().toISOString(), kind, evidenceId: evidence.id, name: evidence.name })
    );
  }

  /**
   * Force la porte souple d'une section débloquée, avec une justification non vide.
   * Renvoie `false` (sans rien enregistrer) si l'une de ces conditions n'est pas remplie
   * ou si la session est terminée.
   */
  async forceGate(sectionId: string, reason: string): Promise<boolean> {
    const session = this.currentSession();
    const justification = reason.trim();
    if (!session || session.status === 'completed' || !justification) return false;

    const section = session.templateSnapshot.sections.find(s => s.id === sectionId);
    if (!section || section.gate !== 'soft' || !this.stepFlow().steps[sectionId]?.unlocked) return false;

    await this.mutate(s => ({
      ...s,
      forcedGates: [...(s.forcedGates ?? []), { sectionId, reason: justification, at: new Date().toISOString() }]
    }));
    return true;
  }

  updateAnswerComment(itemId: string, comment: string): Promise<void> {
    return this.mutateAnswer(itemId, ans => ({ ...ans, comment }), { debounce: true });
  }

  updateAnswerExtra(itemId: string, extraKey: string, value: string): Promise<void> {
    return this.mutateAnswer(itemId, ans => ({ ...ans, extra: { ...(ans.extra ?? {}), [extraKey]: value } }), {
      debounce: true
    });
  }

  /**
   * Donne une réponse conforme à chaque contrôle applicable encore sans réponse (N/A de tout type
   * compris comme une réponse). Un bloquant dont la preuve exigée manque est laissé sans réponse ;
   * un non bloquant dans ce cas reçoit sa réponse avec « preuve à compléter » (ADR 0009).
   * `evidence` : résumé des preuves de la session, par identifiant d'item.
   */
  async markRemainingAsOk(evidence: Record<string, EvidenceSummary> = {}): Promise<MarkRemainingResult> {
    let modified = 0;
    let skippedForEvidence = 0;
    await this.mutate(session => {
      modified = 0;
      skippedForEvidence = 0;
      const answers = { ...session.answers };
      const now = new Date().toISOString();

      for (const item of applicableItems(session.templateSnapshot, session.contextValues)) {
        const current = answers[item.id];
        if (isAnswered(item, current)) continue;

        const satisfied = isEvidenceSatisfied(item, current, evidence[item.id] ?? NO_EVIDENCE);
        if (!satisfied && criticalityOf(item) === 'blocking') {
          skippedForEvidence++;
          continue;
        }

        // La réponse existante (commentaire, champ additionnel, lien, historique) est conservée.
        const base: ItemAnswer = current ? { ...current, status: null } : { status: null, comment: '', extra: {} };
        let next: ItemAnswer;
        switch (item.controlType ?? 'status') {
          case 'checkbox':
            next = appendItemEvent(
              { ...base, checked: true, checkedAt: item.withTimestamp ? now : undefined },
              { at: now, kind: 'checked', checked: true }
            );
            break;
          case 'choice': {
            if (!item.customChoices?.length) continue;
            // Premier choix sans anomalie
            const validChoice = item.customChoices.find(c => !c.isBlocking) ?? item.customChoices[0];
            next = appendItemEvent({ ...base, selectedChoice: validChoice.id }, { at: now, kind: 'choice', choiceId: validChoice.id });
            break;
          }
          default:
            next = appendItemEvent({ ...base, status: 'OK' }, { at: now, kind: 'status', status: 'OK' });
        }
        if (!satisfied) {
          next = appendItemEvent({ ...next, evidencePending: true }, { at: now, kind: 'evidence-pending', pending: true });
        }
        answers[item.id] = next;
        modified++;
      }
      return modified > 0 ? { ...session, answers } : null;
    });
    return { modified, skippedForEvidence };
  }

  /**
   * Réinitialisation confirmée : efface les réponses avec leur historique, ainsi que les
   * portes forcées, qui n'ont plus d'objet une fois les réponses effacées.
   */
  resetSession(): Promise<void> {
    return this.mutate(({ forcedGates: _forcedGates, ...s }) => ({ ...s, answers: {} }));
  }

  restoreAnswers(answers: Record<string, ItemAnswer>): Promise<void> {
    return this.mutate(s => ({ ...s, answers }));
  }

  // --- Cycle de vie --------------------------------------------------------

  /**
   * Tente de terminer la session. Renvoie les anomalies bloquantes (et ouvre le panneau)
   * ou une liste vide si la session a été clôturée.
   */
  async completeSession(): Promise<CompletionIssue[]> {
    const current = this.currentSession();
    if (!current || current.status === 'completed') return [];

    const issues = validateForCompletion(current);
    if (issues.length > 0) {
      this.issuesPanelOpen.set(true);
      return issues;
    }

    const now = new Date().toISOString();
    const completed: ChecklistSession = {
      ...current,
      status: 'completed',
      closures: [...current.closures, { closedAt: now }],
      updatedAt: now
    };
    this.currentSession.set(completed);
    this.issuesPanelOpen.set(false);
    await this.write(completed);
    return [];
  }

  /** Rouvre une session terminée (la confirmation est demandée par l'interface). */
  async reopenSession(): Promise<void> {
    const current = this.currentSession();
    if (!current || current.status !== 'completed') return;

    const now = new Date().toISOString();
    const closures = current.closures.map((c, i) =>
      i === current.closures.length - 1 ? { ...c, reopenedAt: now } : c
    );
    const reopened: ChecklistSession = { ...current, status: 'in_progress', closures, updatedAt: now };
    this.currentSession.set(reopened);
    await this.write(reopened);
  }

  // --- Mise à jour vers une nouvelle version du template -------------------

  hasTemplateUpdate(session: ChecklistSession): boolean {
    return hasTemplateUpdate(session, this.templateService.findTemplate(session.templateId));
  }

  async getTemplateUpdatePreview(): Promise<TemplateUpdatePreview | null> {
    const session = this.currentSession();
    if (!session || !this.hasTemplateUpdate(session)) return null;
    const template = this.templateService.findTemplate(session.templateId)!;

    const evidences = await this.db.evidences.where('sessionId').equals(session.id).toArray();
    const evidenceItemIds = new Set(evidences.map(e => e.itemId));
    return { template, diff: diffTemplates(session.templateSnapshot, template, session, evidenceItemIds) };
  }

  /** Remplace la copie figée et purge réponses + preuves des items supprimés, en une transaction. */
  async applyTemplateUpdate(): Promise<void> {
    await this.flushPendingSave();
    const session = this.currentSession();
    if (!session || !this.hasTemplateUpdate(session)) return;
    const template = this.templateService.findTemplate(session.templateId)!;

    const rebased = rebaseSessionOnTemplate(session, template, new Date().toISOString());
    const keptIds = new Set(template.sections.flatMap(s => s.items.map(i => i.id)));

    await this.db.transaction('rw', this.db.sessions, this.db.evidences, async () => {
      await this.db.sessions.put(rebased);
      await this.db.evidences
        .where('sessionId')
        .equals(session.id)
        .filter(e => !keptIds.has(e.itemId))
        .delete();
    });
    this.currentSession.set(rebased);
    this.upsertInList(rebased);
  }

  // --- Import d'un fichier d'échange ---------------------------------------

  /**
   * Enregistre une session importée selon le mode décidé par l'interface, en une transaction
   * (session + preuves : tout ou rien). Renvoie la session telle qu'enregistrée.
   * - `new` / `copy` : insertion (la copie reçoit un nouvel UUID et un titre suffixé) ;
   * - `replace` avec pièces jointes : les preuves existantes sont remplacées par celles du fichier ;
   * - `replace` sans pièces jointes : les preuves existantes sont conservées, sauf celles
   *   d'items absents de la copie figée importée.
   */
  async importSession(parsed: ParsedSessionImport, mode: ImportConflictMode): Promise<ChecklistSession> {
    await this.flushPendingSave();
    const now = new Date().toISOString();
    const base = mode === 'copy' ? asImportedCopy(parsed.session, crypto.randomUUID()) : parsed.session;
    // updatedAt = maintenant : la session importée apparaît en tête du tableau de bord.
    const session: ChecklistSession = { ...base, updatedAt: now };

    const evidences: EvidenceRecord[] = (parsed.evidences ?? []).map(e => ({
      ...e,
      id: newEvidenceId(e.itemId),
      sessionId: session.id
    }));
    const keptIds = new Set(session.templateSnapshot.sections.flatMap(s => s.items.map(i => i.id)));

    await this.db.transaction('rw', this.db.sessions, this.db.evidences, async () => {
      if (mode === 'replace') {
        const existing = this.db.evidences.where('sessionId').equals(session.id);
        await (parsed.evidences ? existing.delete() : existing.filter(e => !keptIds.has(e.itemId)).delete());
      }
      await this.db.sessions.put(session);
      await this.db.evidences.bulkAdd(evidences);
    });

    this.upsertInList(session);
    if (this.currentSession()?.id === session.id) {
      this.currentSession.set(session);
    }
    return session;
  }

  async getStoredSession(sessionId: string): Promise<ChecklistSession | undefined> {
    return this.db.sessions.get(sessionId);
  }

  // --- Affichage -----------------------------------------------------------

  setFilter(filter: FilterType): void {
    this.activeFilter.set(filter);
  }

  toggleSection(sectionId: string): void {
    this.collapsedSections.update(current => ({ ...current, [sectionId]: !current[sectionId] }));
  }

  expandSection(sectionId: string): void {
    this.collapsedSections.update(current => ({ ...current, [sectionId]: false }));
  }

  collapseAll(collapse: boolean): void {
    const template = this.currentTemplate();
    if (!template) return;
    const map: Record<string, boolean> = {};
    for (const s of template.sections) {
      map[s.id] = collapse;
    }
    this.collapsedSections.set(map);
  }

  // --- Persistance ---------------------------------------------------------

  /** Exécute immédiatement l'écriture différée en attente (départ de page, onglet masqué...). */
  async flushPendingSave(): Promise<void> {
    const pending = this.pendingSave;
    this.clearPending();
    if (pending) {
      await this.write(pending);
    }
  }

  /** Modifie la réponse d'un item ; si `change` renvoie la réponse telle quelle, rien n'est écrit. */
  private mutateAnswer(
    itemId: string,
    change: (answer: ItemAnswer) => ItemAnswer,
    options: { debounce?: boolean } = {}
  ): Promise<void> {
    return this.mutate(s => {
      const current = s.answers[itemId] ?? EMPTY_ANSWER;
      const next = change(current);
      return next === current ? null : { ...s, answers: { ...s.answers, [itemId]: next } };
    }, options);
  }

  /** Item de la copie figée de la session courante, qu'il soit applicable ou non. */
  private findItem(itemId: string): ChecklistItemTemplate | undefined {
    for (const section of this.currentSession()?.templateSnapshot.sections ?? []) {
      const item = section.items.find(i => i.id === itemId);
      if (item) return item;
    }
    return undefined;
  }

  /**
   * Point d'entrée unique de toute modification de session :
   * garde lecture seule, mise à jour immédiate de l'état affiché, puis écriture
   * immédiate (actions discrètes) ou différée (saisies textuelles).
   */
  private async mutate(
    change: (session: ChecklistSession) => ChecklistSession | null,
    options: { debounce?: boolean } = {}
  ): Promise<void> {
    const current = this.currentSession();
    if (!current || current.status === 'completed') return;

    const changed = change(current);
    if (!changed) return;
    const next: ChecklistSession = { ...changed, updatedAt: new Date().toISOString() };
    this.currentSession.set(next);

    if (options.debounce) {
      this.pendingSave = next;
      if (this.pendingTimer) clearTimeout(this.pendingTimer);
      this.pendingTimer = setTimeout(() => void this.flushPendingSave(), SAVE_DEBOUNCE_MS);
    } else {
      await this.write(next);
    }
  }

  private async write(session: ChecklistSession): Promise<void> {
    // Une écriture immédiate absorbe l'écriture différée de la même session (elle est plus récente).
    if (this.pendingSave?.id === session.id) {
      this.clearPending();
    }
    this.isSaving.set(true);
    try {
      await this.db.sessions.put(session);
      this.upsertInList(session);
    } finally {
      setTimeout(() => this.isSaving.set(false), 300);
    }
  }

  private clearPending(): void {
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    this.pendingSave = null;
  }

  /** Remplace l'entrée de la liste en mémoire sans relire toute la table. */
  private upsertInList(session: ChecklistSession): void {
    this.allSessions.update(list => {
      const others = list.filter(s => s.id !== session.id);
      return [session, ...others].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }
}
