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

  readonly currentSession = signal<ChecklistSession>({
    id: 'current',
    templateId: 'delivery-audit-standard',
    contextValues: {},
    answers: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  readonly activeFilter = signal<FilterType>('all');
  readonly isSaving = signal<boolean>(false);
  readonly collapsedSections = signal<Record<string, boolean>>({});

  // Liste des items applicables selon le contexte
  readonly applicableItems = computed(() => {
    const template = this.templateService.activeTemplate();
    if (!template) return [];

    const mode = this.currentSession().contextValues['mode'] || 'full';
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
    const items = this.applicableItems();
    const answers = this.currentSession().answers;
    const total = items.length;

    let okCount = 0;
    let koCount = 0;
    let naCount = 0;

    for (const item of items) {
      const ans = answers[item.id];
      if (ans) {
        if (ans.status === 'OK') okCount++;
        else if (ans.status === 'KO') koCount++;
        else if (ans.status === 'NA') naCount++;
      }
    }

    const answered = okCount + koCount + naCount;
    const pending = total - answered;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

    return { total, answered, okCount, koCount, naCount, pending, percent };
  });

  async initSession(): Promise<void> {
    const existing = await this.db.sessions.get('current');
    const template = this.templateService.activeTemplate();

    if (existing) {
      this.currentSession.set(existing);
    } else if (template) {
      // Initialiser avec les valeurs par défaut du schéma de contexte
      const defaultContext: Record<string, string> = {};
      for (const f of template.contextSchema) {
        if (f.defaultValue) defaultContext[f.id] = f.defaultValue;
        if (f.type === 'date' && !defaultContext[f.id]) {
          defaultContext[f.id] = new Date().toISOString().split('T')[0];
        }
      }

      const newSession: ChecklistSession = {
        id: 'current',
        templateId: template.id,
        contextValues: defaultContext,
        answers: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await this.db.sessions.put(newSession);
      this.currentSession.set(newSession);
    }
  }

  async updateContextValue(key: string, value: string): Promise<void> {
    const sess = { ...this.currentSession() };
    sess.contextValues = { ...sess.contextValues, [key]: value };
    sess.updatedAt = new Date().toISOString();
    await this.persistSession(sess);
  }

  async updateAnswerStatus(itemId: string, status: ControlStatus): Promise<void> {
    const sess = { ...this.currentSession() };
    const currentAns = sess.answers[itemId] || { status: null, comment: '', extra: {} };

    // Bascule off si déjà actif
    const newStatus = currentAns.status === status ? null : status;
    sess.answers = {
      ...sess.answers,
      [itemId]: { ...currentAns, status: newStatus }
    };
    sess.updatedAt = new Date().toISOString();
    await this.persistSession(sess);
  }

  async updateAnswerComment(itemId: string, comment: string): Promise<void> {
    const sess = { ...this.currentSession() };
    const currentAns = sess.answers[itemId] || { status: null, comment: '', extra: {} };
    sess.answers = {
      ...sess.answers,
      [itemId]: { ...currentAns, comment }
    };
    sess.updatedAt = new Date().toISOString();
    await this.persistSession(sess);
  }

  async updateAnswerExtra(itemId: string, extraKey: string, value: string): Promise<void> {
    const sess = { ...this.currentSession() };
    const currentAns = sess.answers[itemId] || { status: null, comment: '', extra: {} };
    sess.answers = {
      ...sess.answers,
      [itemId]: {
        ...currentAns,
        extra: { ...(currentAns.extra || {}), [extraKey]: value }
      }
    };
    sess.updatedAt = new Date().toISOString();
    await this.persistSession(sess);
  }

  async markRemainingAsOk(): Promise<number> {
    const sess = { ...this.currentSession() };
    const items = this.applicableItems();
    let modified = 0;

    for (const item of items) {
      const currentAns = sess.answers[item.id];
      if (!currentAns || !currentAns.status) {
        sess.answers[item.id] = {
          status: 'OK',
          comment: currentAns?.comment || '',
          extra: currentAns?.extra || {}
        };
        modified++;
      }
    }

    if (modified > 0) {
      sess.updatedAt = new Date().toISOString();
      await this.persistSession(sess);
    }
    return modified;
  }

  async resetSession(): Promise<void> {
    const sess = { ...this.currentSession() };
    sess.answers = {};
    sess.updatedAt = new Date().toISOString();
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
    } finally {
      setTimeout(() => this.isSaving.set(false), 500);
    }
  }
}
