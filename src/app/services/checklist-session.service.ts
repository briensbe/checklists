import { Injectable, inject, signal, computed } from '@angular/core';
import { ChecklistSession, ItemAnswer, ControlStatus, MetricsSummary, ChecklistItemTemplate } from '../models/checklist.model';
import { AppDatabaseService } from './app-database.service';
import { TemplateService } from './template.service';

export type FilterType = 'all' | 'pending' | 'ko';

@Injectable({
  providedIn: 'root'
})
export class ChecklistSessionService {
  private db = inject(AppDatabaseService);
  private templateService = inject(TemplateService);

  readonly allSessions = signal<ChecklistSession[]>([]);
  readonly currentSession = signal<ChecklistSession | null>(null);

  readonly activeFilter = signal<FilterType>('all');
  readonly isSaving = signal<boolean>(false);
  readonly collapsedSections = signal<Record<string, boolean>>({});

  // Liste des items applicables selon le contexte
  readonly applicableItems = computed(() => {
    const session = this.currentSession();
    if (!session) return [];

    const template = this.templateService.activeTemplate();
    if (!template || template.id !== session.templateId) return [];

    const mode = session.contextValues['mode'] || 'full';
    const list: (ChecklistItemTemplate & { sectionTitle: string; sectionId: string })[] = [];

    for (const section of template.sections) {
      for (const item of section.items) {
        if (!item.mode || item.mode === 'all' || (item.mode === 'patch' && mode === 'patch')) {
          list.push({ ...item, sectionTitle: section.title, sectionId: section.id });
        }
      }
    }
    return list;
  });

  // Calcul des métriques réactives
  readonly metrics = computed<MetricsSummary>(() => {
    const session = this.currentSession();
    const items = this.applicableItems();
    const total = items.length;

    if (!session) {
      return { total: 0, answered: 0, okCount: 0, koCount: 0, naCount: 0, pending: 0, percent: 0 };
    }

    const answers = session.answers;
    let okCount = 0;
    let koCount = 0;
    let naCount = 0;

    for (const item of items) {
      const ans = answers[item.id];
      if (ans) {
        const type = item.controlType || 'status';
        if (type === 'checkbox') {
          if (ans.checked) okCount++;
        } else if (type === 'choice') {
          if (ans.selectedChoice) {
            const choice = item.customChoices?.find(c => c.id === ans.selectedChoice || c.label === ans.selectedChoice);
            if (choice?.isBlocking) {
              koCount++;
            } else {
              okCount++;
            }
          }
        } else {
          // Mode statut classique OK / KO / NA
          if (ans.status === 'OK') okCount++;
          else if (ans.status === 'KO') koCount++;
          else if (ans.status === 'NA') naCount++;
        }
      }
    }

    const answered = okCount + koCount + naCount;
    const pending = total - answered;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

    return { total, answered, okCount, koCount, naCount, pending, percent };
  });

  async loadAllSessions(): Promise<ChecklistSession[]> {
    const sessions = await this.db.sessions.orderBy('updatedAt').reverse().toArray();
    this.allSessions.set(sessions);
    return sessions;
  }

  async loadSession(sessionId: string): Promise<ChecklistSession | null> {
    const session = await this.db.sessions.get(sessionId);
    if (session) {
      this.currentSession.set(session);
      this.templateService.selectTemplate(session.templateId);
      return session;
    }
    return null;
  }

  async createSession(templateId: string, title: string): Promise<ChecklistSession> {
    const template = this.templateService.availableTemplates().find(t => t.id === templateId)
      || await this.db.templates.get(templateId);

    const defaultContext: Record<string, string> = {};
    if (template) {
      for (const f of template.contextSchema) {
        if (f.defaultValue) defaultContext[f.id] = f.defaultValue;
        if (f.type === 'date' && !defaultContext[f.id]) {
          defaultContext[f.id] = new Date().toISOString().split('T')[0];
        }
      }
    }

    const newSession: ChecklistSession = {
      id: crypto.randomUUID(),
      title: title.trim() || `Checklist ${new Date().toLocaleDateString('fr-FR')}`,
      templateId,
      contextValues: defaultContext,
      answers: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.db.sessions.put(newSession);
    await this.loadAllSessions();
    this.currentSession.set(newSession);
    this.templateService.selectTemplate(templateId);
    return newSession;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.sessions.delete(sessionId);
    await this.db.evidences.where('sessionId').equals(sessionId).delete();
    if (this.currentSession()?.id === sessionId) {
      this.currentSession.set(null);
    }
    await this.loadAllSessions();
  }

  async updateContextValue(key: string, value: string): Promise<void> {
    const current = this.currentSession();
    if (!current) return;

    const sess: ChecklistSession = {
      ...current,
      contextValues: { ...current.contextValues, [key]: value },
      updatedAt: new Date().toISOString()
    };
    await this.persistSession(sess);
  }

  async updateAnswerStatus(itemId: string, status: ControlStatus): Promise<void> {
    const current = this.currentSession();
    if (!current) return;

    const currentAns = current.answers[itemId] || { status: null, comment: '', extra: {} };
    const newStatus = currentAns.status === status ? null : status;
    const sess: ChecklistSession = {
      ...current,
      answers: {
        ...current.answers,
        [itemId]: { ...currentAns, status: newStatus }
      },
      updatedAt: new Date().toISOString()
    };
    await this.persistSession(sess);
  }

  async updateAnswerCheckbox(itemId: string, checked: boolean, withTimestamp: boolean): Promise<void> {
    const current = this.currentSession();
    if (!current) return;

    const currentAns = current.answers[itemId] || { status: null, comment: '', extra: {} };
    const checkedAt = checked && withTimestamp ? new Date().toISOString() : undefined;
    const sess: ChecklistSession = {
      ...current,
      answers: {
        ...current.answers,
        [itemId]: {
          ...currentAns,
          checked,
          checkedAt
        }
      },
      updatedAt: new Date().toISOString()
    };
    await this.persistSession(sess);
  }

  async updateAnswerChoice(itemId: string, choiceId: string): Promise<void> {
    const current = this.currentSession();
    if (!current) return;

    const currentAns = current.answers[itemId] || { status: null, comment: '', extra: {} };
    const newChoice = currentAns.selectedChoice === choiceId ? undefined : choiceId;
    const sess: ChecklistSession = {
      ...current,
      answers: {
        ...current.answers,
        [itemId]: {
          ...currentAns,
          selectedChoice: newChoice
        }
      },
      updatedAt: new Date().toISOString()
    };
    await this.persistSession(sess);
  }

  async updateAnswerComment(itemId: string, comment: string): Promise<void> {
    const current = this.currentSession();
    if (!current) return;

    const currentAns = current.answers[itemId] || { status: null, comment: '', extra: {} };
    const sess: ChecklistSession = {
      ...current,
      answers: {
        ...current.answers,
        [itemId]: { ...currentAns, comment }
      },
      updatedAt: new Date().toISOString()
    };
    await this.persistSession(sess);
  }

  async updateAnswerExtra(itemId: string, extraKey: string, value: string): Promise<void> {
    const current = this.currentSession();
    if (!current) return;

    const currentAns = current.answers[itemId] || { status: null, comment: '', extra: {} };
    const sess: ChecklistSession = {
      ...current,
      answers: {
        ...current.answers,
        [itemId]: {
          ...currentAns,
          extra: { ...(currentAns.extra || {}), [extraKey]: value }
        }
      },
      updatedAt: new Date().toISOString()
    };
    await this.persistSession(sess);
  }

  async markRemainingAsOk(): Promise<number> {
    const current = this.currentSession();
    if (!current) return 0;

    const sess = { ...current };
    const items = this.applicableItems();
    let modified = 0;

    for (const item of items) {
      const currentAns = sess.answers[item.id];
      const type = item.controlType || 'status';

      if (type === 'checkbox') {
        if (!currentAns?.checked) {
          sess.answers[item.id] = {
            status: null,
            checked: true,
            checkedAt: item.withTimestamp ? new Date().toISOString() : undefined,
            comment: currentAns?.comment || '',
            extra: currentAns?.extra || {}
          };
          modified++;
        }
      } else if (type === 'choice') {
        if (!currentAns?.selectedChoice && item.customChoices && item.customChoices.length > 0) {
          // Prendre le premier choix non-bloquant
          const validChoice = item.customChoices.find(c => !c.isBlocking) || item.customChoices[0];
          sess.answers[item.id] = {
            status: null,
            selectedChoice: validChoice.id,
            comment: currentAns?.comment || '',
            extra: currentAns?.extra || {}
          };
          modified++;
        }
      } else {
        if (!currentAns || !currentAns.status) {
          sess.answers[item.id] = {
            status: 'OK',
            comment: currentAns?.comment || '',
            extra: currentAns?.extra || {}
          };
          modified++;
        }
      }
    }

    if (modified > 0) {
      sess.updatedAt = new Date().toISOString();
      await this.persistSession(sess);
    }
    return modified;
  }

  async resetSession(): Promise<void> {
    const current = this.currentSession();
    if (!current) return;

    const sess: ChecklistSession = {
      ...current,
      answers: {},
      updatedAt: new Date().toISOString()
    };
    await this.persistSession(sess);
  }

  setFilter(filter: FilterType): void {
    this.activeFilter.set(filter);
  }

  toggleSection(sectionId: string): void {
    const current = { ...this.collapsedSections() };
    current[sectionId] = !current[sectionId];
    this.collapsedSections.set(current);
  }

  collapseAll(collapse: boolean): void {
    const template = this.templateService.activeTemplate();
    if (!template) return;
    const map: Record<string, boolean> = {};
    for (const s of template.sections) {
      map[s.id] = collapse;
    }
    this.collapsedSections.set(map);
  }

  private async persistSession(session: ChecklistSession): Promise<void> {
    this.isSaving.set(true);
    this.currentSession.set(session);
    try {
      await this.db.sessions.put(session);
      await this.loadAllSessions();
    } finally {
      setTimeout(() => this.isSaving.set(false), 300);
    }
  }
}
