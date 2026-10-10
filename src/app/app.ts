import { Component, OnInit, inject, signal } from '@angular/core';
import { HeaderComponent } from './components/header/header.component';
import { AuditSummaryComponent } from './components/audit-summary/audit-summary.component';
import { ChecklistSectionComponent } from './components/checklist-section/checklist-section.component';
import { EvidenceAttachmentComponent } from './components/evidence-attachment/evidence-attachment.component';
import { JsonDraftModalComponent } from './components/json-draft-modal/json-draft-modal.component';
import { TemplateService } from './services/template.service';
import { ChecklistSessionService } from './services/checklist-session.service';
import { EvidenceService } from './services/evidence.service';
import { ExportService } from './services/export.service';
import { ChecklistItemTemplate, EvidenceRecord, ItemAnswer } from './models/checklist.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    HeaderComponent,
    AuditSummaryComponent,
    ChecklistSectionComponent,
    EvidenceAttachmentComponent,
    JsonDraftModalComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit {
  readonly templateService = inject(TemplateService);
  readonly sessionService = inject(ChecklistSessionService);
  readonly evidenceService = inject(EvidenceService);
  readonly exportService = inject(ExportService);

  readonly activeEvidenceItemId = signal<string | null>(null);
  readonly activeItemEvidences = signal<EvidenceRecord[]>([]);
  readonly isJsonDraftModalOpen = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    await this.templateService.initTemplates();
    await this.sessionService.initSession();
    await this.evidenceService.loadEvidenceCounts();
  }

  getItemsForSection(sectionId: string): ChecklistItemTemplate[] {
    const applicable = this.sessionService.applicableItems();
    return applicable.filter(i => i.sectionId === sectionId);
  }

  getActiveItemLabel(itemId: string): string {
    const item = this.sessionService.applicableItems().find(i => i.id === itemId);
    return item ? item.label : itemId;
  }

  async onTemplateSelected(templateId: string): Promise<void> {
    this.templateService.selectTemplate(templateId);
    await this.sessionService.initSession();
    await this.evidenceService.loadEvidenceCounts();
  }

  async onContextChanged(key: string, value: string): Promise<void> {
    await this.sessionService.updateContextValue(key, value);
  }

  async onMarkAllOk(): Promise<void> {
    await this.sessionService.markRemainingAsOk();
  }

  async onResetSession(): Promise<void> {
    if (confirm('Voulez-vous vraiment réinitialiser toutes les saisies de cette session ?')) {
      await this.sessionService.resetSession();
    }
  }

  async onImportJson(jsonStr: string): Promise<void> {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.answers || parsed.contextValues || parsed.templateId || parsed.details) {
        // C'est un brouillon de session
        const current = this.sessionService.currentSession();
        const answers: Record<string, ItemAnswer> = {};

        if (parsed.answers && typeof parsed.answers === 'object') {
          for (const [id, a] of Object.entries(parsed.answers as Record<string, any>)) {
            answers[id] = {
              status: a.status ?? null,
              comment: a.comment ?? '',
              extra: a.extra ?? {}
            };
          }
        } else if (Array.isArray(parsed.details)) {
          for (const d of parsed.details) {
            if (d.itemId) {
              answers[d.itemId] = {
                status: d.status ?? null,
                comment: d.comment ?? '',
                extra: d.extra ?? {}
              };
            }
          }
        }

        await this.sessionService.currentSession.set({
          ...current,
          contextValues: parsed.contextValues || current.contextValues,
          answers,
          updatedAt: new Date().toISOString()
        });
        await this.onContextChanged('', ''); // force persist
      } else if (parsed.sections && (parsed.id || parsed.contextSchema)) {
        // C'est un nouveau modèle
        await this.templateService.importTemplate(jsonStr);
        await this.sessionService.initSession();
      }
    } catch (e) {
      alert('Format de fichier JSON non reconnu ou invalide.');
    }
  }

  async onOpenEvidence(itemId: string): Promise<void> {
    this.activeEvidenceItemId.set(itemId);
    const evs = await this.evidenceService.getEvidencesForItem(itemId);
    this.activeItemEvidences.set(evs);
  }

  async onEvidenceFileAdded(
    itemId: string,
    event: { file: File | Blob; filename: string; type: 'image' | 'file' | 'log' }
  ): Promise<void> {
    await this.evidenceService.addEvidence(itemId, event.file, event.filename, event.type);
    const updated = await this.evidenceService.getEvidencesForItem(itemId);
    this.activeItemEvidences.set(updated);
  }

  async onEvidenceDeleted(evidenceId: string): Promise<void> {
    await this.evidenceService.deleteEvidence(evidenceId);
    const currentItemId = this.activeEvidenceItemId();
    if (currentItemId) {
      const updated = await this.evidenceService.getEvidencesForItem(currentItemId);
      this.activeItemEvidences.set(updated);
    }
  }
}
