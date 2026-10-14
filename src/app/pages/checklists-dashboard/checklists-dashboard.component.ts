import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChecklistSessionService } from '../../services/checklist-session.service';
import { TemplateService } from '../../services/template.service';
import { ChecklistSession, MetricsSummary, SessionStatus } from '../../models/checklist.model';
import { computeMetrics } from '../../domain/session-rules';

export type StatusFilter = 'all' | SessionStatus;
import { DatePipe } from '@angular/common';

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

  /** Même règle que le runner : seuls les items applicables au contexte de la session comptent. */
  metricsOf(session: ChecklistSession): MetricsSummary {
    return computeMetrics(session);
  }
}
