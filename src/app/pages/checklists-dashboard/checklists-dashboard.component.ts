import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChecklistSessionService } from '../../services/checklist-session.service';
import { TemplateService } from '../../services/template.service';
import { DatePipe } from '@angular/common';
import { ChecklistSession, ImportConflictMode, MetricsSummary, SessionStatus } from '../../models/checklist.model';
import { computeMetrics } from '../../domain/session-rules';
import { parseExchangeFile } from '../../domain/session-exchange';
import { askImportConflict, readJsonFile } from '../../services/import-conflict';

export type StatusFilter = 'all' | SessionStatus;

export interface ImportMessage {
  kind: 'success' | 'error';
  text: string;
}

@Component({
  selector: 'app-checklists-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './checklists-dashboard.component.html',
  styleUrl: './checklists-dashboard.component.css'
})
export class ChecklistsDashboardComponent implements OnInit {
  protected sessionService = inject(ChecklistSessionService);
  protected templateService = inject(TemplateService);
  private router = inject(Router);

  isNewModalOpen = signal<boolean>(false);
  selectedTemplateId = signal<string>('');
  newChecklistTitle = signal<string>('');
  statusFilter = signal<StatusFilter>('all');
  importMessage = signal<ImportMessage | null>(null);
  isImporting = signal<boolean>(false);

  readonly filteredSessions = computed(() => {
    const filter = this.statusFilter();
    const sessions = this.sessionService.allSessions();
    return filter === 'all' ? sessions : sessions.filter(s => s.status === filter);
  });

  readonly statusCounts = computed(() => {
    const sessions = this.sessionService.allSessions();
    const completed = sessions.filter(s => s.status === 'completed').length;
    return { all: sessions.length, in_progress: sessions.length - completed, completed };
  });

  async ngOnInit(): Promise<void> {
    await this.templateService.initTemplates();
    await this.sessionService.loadAllSessions();

    const templates = this.templateService.availableTemplates();
    if (templates.length > 0 && !this.selectedTemplateId()) {
      this.selectedTemplateId.set(templates[0].id);
    }
  }

  openSession(sessionId: string, applyUpdate = false): void {
    this.router.navigate(['/checklists', sessionId], applyUpdate ? { queryParams: { applyUpdate: 1 } } : {});
  }

  onApplyUpdate(event: Event, sessionId: string): void {
    event.stopPropagation();
    this.openSession(sessionId, true);
  }

  openNewModal(): void {
    const templates = this.templateService.availableTemplates();
    if (templates.length > 0) {
      this.selectedTemplateId.set(templates[0].id);
    }
    this.newChecklistTitle.set(`Checklist du ${new Date().toLocaleDateString('fr-FR')}`);
    this.isNewModalOpen.set(true);
  }

  closeNewModal(): void {
    this.isNewModalOpen.set(false);
  }

  async createAndStart(): Promise<void> {
    const templateId = this.selectedTemplateId();
    if (!templateId) return;

    const newSess = await this.sessionService.createSession(templateId, this.newChecklistTitle());
    this.isNewModalOpen.set(false);
    this.router.navigate(['/checklists', newSess.id]);
  }

  async deleteSession(event: Event, sessionId: string): Promise<void> {
    event.stopPropagation();
    if (confirm('Voulez-vous vraiment supprimer cette checklist et ses preuves ?')) {
      await this.sessionService.deleteSession(sessionId);
    }
  }

  /**
   * Import d'un fichier de session : analyse complète avant toute question (un fichier
   * invalide est refusé sans dialogue), puis résolution d'un éventuel conflit d'UUID.
   */
  async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permet de réimporter le même fichier
    if (!file) return;

    this.importMessage.set(null);
    this.isImporting.set(true);
    try {
      const templatesById = new Map(this.templateService.availableTemplates().map(t => [t.id, t]));
      const parsed = parseExchangeFile(await readJsonFile(file), templatesById);

      let mode: ImportConflictMode = 'new';
      const existing = await this.sessionService.getStoredSession(parsed.session.id);
      if (existing) {
        const choice = askImportConflict(
          `Une session « ${existing.title} »`,
          'nouvel identifiant, titre suffixé « (import) »'
        );
        if (!choice) return;
        mode = choice;
      }

      const session = await this.sessionService.importSession(parsed, mode);
      let text = `Session « ${session.title} » importée`;
      if (parsed.evidences?.length) text += ` avec ${parsed.evidences.length} pièce(s) jointe(s)`;
      text += '.';
      if (parsed.droppedEvidenceCount > 0) {
        text += ` ${parsed.droppedEvidenceCount} pièce(s) jointe(s) ignorée(s) : rattachée(s) à des items absents du modèle.`;
      }
      this.statusFilter.set('all');
      this.importMessage.set({ kind: 'success', text });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.importMessage.set({ kind: 'error', text: `Import impossible : ${reason}` });
    } finally {
      this.isImporting.set(false);
    }
  }

  /** Même règle que le runner : seuls les items applicables au contexte de la session comptent. */
  metricsOf(session: ChecklistSession): MetricsSummary {
    return computeMetrics(session);
  }
}
