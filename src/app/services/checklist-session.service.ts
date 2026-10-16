import { Injectable, inject, signal, computed } from '@angular/core';
import {
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
  applicableItems,
  CompletionIssue,
  computeMetrics,
  defaultContextValues,
  diffTemplates,
  hasTemplateUpdate,
  rebaseSessionOnTemplate,
  TemplateDiff,
  validateForCompletion
} from '../domain/session-rules';

export type FilterType = 'all' | 'pending' | 'ko';
export type SessionLoadState = 'loading' | 'ready' | 'not-found';

/** Délai de regroupement des écritures pour les saisies textuelles. */
export const SAVE_DEBOUNCE_MS = 400;

export interface TemplateUpdatePreview {
  template: ChecklistTemplate;
  diff: TemplateDiff;
}

const EMPTY_ANSWER: ItemAnswer = { status: null, comment: '', extra: {} };

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

  updateAnswerStatus(itemId: string, status: ControlStatus): Promise<void> {
    return this.mutateAnswer(itemId, ans => ({ ...ans, status: ans.status === status ? null : status }));
  }

  updateAnswerCheckbox(itemId: string, checked: boolean, withTimestamp: boolean): Promise<void> {
    const checkedAt = checked && withTimestamp ? new Date().toISOString() : undefined;
    return this.mutateAnswer(itemId, ans => ({ ...ans, checked, checkedAt }));
  }

  updateAnswerChoice(itemId: string, choiceId: string): Promise<void> {
    return this.mutateAnswer(itemId, ans => ({
      ...ans,
      selectedChoice: ans.selectedChoice === choiceId ? undefined : choiceId
    }));
  }

  updateAnswerComment(itemId: string, comment: string): Promise<void> {
    return this.mutateAnswer(itemId, ans => ({ ...ans, comment }), { debounce: true });
  }

  updateAnswerExtra(itemId: string, extraKey: string, value: string): Promise<void> {
    return this.mutateAnswer(itemId, ans => ({ ...ans, extra: { ...(ans.extra ?? {}), [extraKey]: value } }), {
      debounce: true
    });
  }

  async markRemainingAsOk(): Promise<number> {
    let modified = 0;
    await this.mutate(session => {
      const answers = { ...session.answers };
      const now = new Date().toISOString();

      for (const item of applicableItems(session.templateSnapshot, session.contextValues)) {
        const current = answers[item.id];
        const keep = { comment: current?.comment ?? '', extra: current?.extra ?? {} };
        const type = item.controlType ?? 'status';

        if (type === 'checkbox') {
          if (!current?.checked) {
            answers[item.id] = { ...keep, status: null, checked: true, checkedAt: item.withTimestamp ? now : undefined };
            modified++;
          }
        } else if (type === 'choice') {
          if (!current?.selectedChoice && item.customChoices && item.customChoices.length > 0) {
            // Premier choix non bloquant
            const validChoice = item.customChoices.find(c => !c.isBlocking) ?? item.customChoices[0];
            answers[item.id] = { ...keep, status: null, selectedChoice: validChoice.id };
            modified++;
          }
        } else if (!current?.status) {
          answers[item.id] = { ...keep, status: 'OK' };
          modified++;
        }
      }
      return modified > 0 ? { ...session, answers } : null;
    });
    return modified;
  }

  resetSession(): Promise<void> {
    return this.mutate(s => ({ ...s, answers: {} }));
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

  private mutateAnswer(
    itemId: string,
    change: (answer: ItemAnswer) => ItemAnswer,
    options: { debounce?: boolean } = {}
  ): Promise<void> {
    return this.mutate(
      s => ({ ...s, answers: { ...s.answers, [itemId]: change(s.answers[itemId] ?? EMPTY_ANSWER) } }),
      options
    );
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
