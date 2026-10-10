import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChecklistSessionService } from '../../services/checklist-session.service';
import { TemplateService } from '../../services/template.service';
import { ChecklistSession, ChecklistTemplate } from '../../models/checklist.model';
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

  async ngOnInit(): Promise<void> {
    await this.templateService.initTemplates();
    await this.sessionService.loadAllSessions();

    const templates = this.templateService.availableTemplates();
    if (templates.length > 0 && !this.selectedTemplateId()) {
      this.selectedTemplateId.set(templates[0].id);
    }
  }

  getTemplateName(templateId: string): string {
    const t = this.templateService.availableTemplates().find(item => item.id === templateId);
    return t ? t.name : 'Modèle personnalisé';
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

  calculateStats(session: ChecklistSession): { total: number; answered: number; percent: number } {
    const answers = Object.values(session.answers);
    const answered = answers.filter(a => a.status !== null || a.checked || a.selectedChoice).length;
    // Estimation basée sur les items de la session ou du template
    const template = this.templateService.availableTemplates().find(t => t.id === session.templateId);
    let total = 0;
    if (template) {
      for (const sec of template.sections) {
        total += sec.items.length;
      }
    } else {
      total = Math.max(answered, Object.keys(session.answers).length);
    }

    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
    return { total, answered, percent };
  }
}
