import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChecklistSessionService } from '../../services/checklist-session.service';
import { TemplateService } from '../../services/template.service';
import { ExportService } from '../../services/export.service';
import { EvidenceService } from '../../services/evidence.service';
import { ChecklistItemTemplate } from '../../models/checklist.model';
import { AuditSummaryComponent } from '../../components/audit-summary/audit-summary.component';
import { ChecklistSectionComponent } from '../../components/checklist-section/checklist-section.component';
import { EvidenceAttachmentComponent } from '../../components/evidence-attachment/evidence-attachment.component';
import { JsonDraftModalComponent } from '../../components/json-draft-modal/json-draft-modal.component';

@Component({
  selector: 'app-checklist-runner',
  standalone: true,
  imports: [
    RouterLink,
    AuditSummaryComponent,
    ChecklistSectionComponent,
    EvidenceAttachmentComponent,
    JsonDraftModalComponent
  ],
  templateUrl: './checklist-runner.component.html',
  styleUrl: './checklist-runner.component.css'
})
export class ChecklistRunnerComponent implements OnInit {
  protected sessionService = inject(ChecklistSessionService);
  protected templateService = inject(TemplateService);
  protected exportService = inject(ExportService);
  protected evidenceService = inject(EvidenceService);
  private route = inject(ActivatedRoute);

  activeEvidenceItemId = signal<string | null>(null);
  isJsonDraftModalOpen = signal<boolean>(false);
  activeItemEvidences = signal<any[]>([]);

  async ngOnInit(): Promise<void> {
    await this.templateService.initTemplates();
    const sessionId = this.route.snapshot.paramMap.get('id');

    if (sessionId) {
      await this.sessionService.loadSession(sessionId);
      await this.evidenceService.loadEvidenceCounts(sessionId);
    }
  }

  getItemsForSection(sectionId: string): (ChecklistItemTemplate & { sectionTitle: string; sectionId: string })[] {
    return this.sessionService.applicableItems().filter(item => item.sectionId === sectionId);
  }

  getActiveItemLabel(itemId: string): string {
    const item = this.sessionService.applicableItems().find(i => i.id === itemId);
    return item ? item.label : 'Élément de checklist';
  }

  async onOpenEvidence(itemId: string): Promise<void> {
    const sessionId = this.sessionService.currentSession()?.id || 'current';
    const list = await this.evidenceService.getEvidencesForItem(itemId, sessionId);
    this.activeItemEvidences.set(list);
    this.activeEvidenceItemId.set(itemId);
  }

  async onEvidenceFileAdded(itemId: string, data: { file: File | Blob; filename: string; type: 'image' | 'file' | 'log' }): Promise<void> {
    const sessionId = this.sessionService.currentSession()?.id || 'current';
    await this.evidenceService.addEvidence(itemId, data.file, data.filename, data.type, sessionId);
    const updated = await this.evidenceService.getEvidencesForItem(itemId, sessionId);
    this.activeItemEvidences.set(updated);
  }

  async onEvidenceDeleted(evidenceId: string): Promise<void> {
    const itemId = this.activeEvidenceItemId();
    const sessionId = this.sessionService.currentSession()?.id || 'current';
    await this.evidenceService.deleteEvidence(evidenceId, sessionId);
    if (itemId) {
      const updated = await this.evidenceService.getEvidencesForItem(itemId, sessionId);
      this.activeItemEvidences.set(updated);
    }
  }

  onContextChanged(key: string, value: string): void {
    this.sessionService.updateContextValue(key, value);
  }

  async onMarkAllOk(): Promise<void> {
    await this.sessionService.markRemainingAsOk();
  }

  async onResetSession(): Promise<void> {
    if (confirm('Voulez-vous vraiment réinitialiser toutes les réponses de cette checklist ?')) {
      await this.sessionService.resetSession();
    }
  }
}
