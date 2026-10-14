import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ChecklistSessionService, TemplateUpdatePreview } from '../../services/checklist-session.service';
import { TemplateService } from '../../services/template.service';
import { ExportService } from '../../services/export.service';
import { EvidenceService } from '../../services/evidence.service';
import { EvidenceRecord } from '../../models/checklist.model';
import { ApplicableItem, COMPLETION_ISSUE_LABELS, CompletionIssue } from '../../domain/session-rules';
import { AuditSummaryComponent } from '../../components/audit-summary/audit-summary.component';
import { ChecklistSectionComponent } from '../../components/checklist-section/checklist-section.component';
import { EvidenceAttachmentComponent, EvidenceFileEvent } from '../../components/evidence-attachment/evidence-attachment.component';
import { JsonDraftModalComponent } from '../../components/json-draft-modal/json-draft-modal.component';
import { TemplateUpdateModalComponent } from '../../components/template-update-modal/template-update-modal.component';

@Component({
  selector: 'app-checklist-runner',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    AuditSummaryComponent,
    ChecklistSectionComponent,
    EvidenceAttachmentComponent,
    JsonDraftModalComponent,
    TemplateUpdateModalComponent
  ],
  templateUrl: './checklist-runner.component.html',
  styleUrl: './checklist-runner.component.css'
})
export class ChecklistRunnerComponent implements OnInit, OnDestroy {
  protected sessionService = inject(ChecklistSessionService);
  protected templateService = inject(TemplateService);
  protected exportService = inject(ExportService);
  protected evidenceService = inject(EvidenceService);
  private route = inject(ActivatedRoute);

  protected readonly issueLabels = COMPLETION_ISSUE_LABELS;

  activeEvidenceItemId = signal<string | null>(null);
  isJsonDraftModalOpen = signal<boolean>(false);
  activeItemEvidences = signal<EvidenceRecord[]>([]);
  templateUpdatePreview = signal<TemplateUpdatePreview | null>(null);

  async ngOnInit(): Promise<void> {
    await this.templateService.initTemplates();
    const sessionId = this.route.snapshot.paramMap.get('id');
    if (!sessionId) {
      this.sessionService.loadState.set('not-found');
      return;
    }

    const session = await this.sessionService.loadSession(sessionId);
    if (session) {
      await this.evidenceService.loadEvidenceCounts(sessionId);
      // Lien « Appliquer » du tableau de bord : ouvre directement le récapitulatif.
      if (this.route.snapshot.queryParamMap.get('applyUpdate')) {
        await this.openTemplateUpdate();
      }
    }
  }

  ngOnDestroy(): void {
    void this.sessionService.flushPendingSave();
  }

  /** Onglet masqué ou fermé : on n'attend pas la fin du délai de regroupement. */
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      void this.sessionService.flushPendingSave();
    }
  }

  private get sessionId(): string | null {
    return this.sessionService.currentSession()?.id ?? null;
  }

  getItemsForSection(sectionId: string): ApplicableItem[] {
    return this.sessionService.applicableItems().filter(item => item.sectionId === sectionId);
  }

  getActiveItemLabel(itemId: string): string {
    const item = this.sessionService.applicableItems().find(i => i.id === itemId);
    return item ? item.label : 'Élément de checklist';
  }

  // --- Preuves -------------------------------------------------------------

  async onOpenEvidence(itemId: string): Promise<void> {
    const sessionId = this.sessionId;
    if (!sessionId) return;
    this.activeItemEvidences.set(await this.evidenceService.getEvidencesForItem(itemId, sessionId));
    this.activeEvidenceItemId.set(itemId);
  }

  async onEvidenceFileAdded(itemId: string, data: EvidenceFileEvent): Promise<void> {
    const sessionId = this.sessionId;
    if (!sessionId) return;
    try {
      await this.evidenceService.addEvidence(sessionId, itemId, data.file, data.filename, data.type);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    this.activeItemEvidences.set(await this.evidenceService.getEvidencesForItem(itemId, sessionId));
  }

  async onEvidenceDeleted(evidenceId: string): Promise<void> {
    const itemId = this.activeEvidenceItemId();
    const sessionId = this.sessionId;
    if (!sessionId) return;
    await this.evidenceService.deleteEvidence(sessionId, evidenceId);
    if (itemId) {
      this.activeItemEvidences.set(await this.evidenceService.getEvidencesForItem(itemId, sessionId));
    }
  }

  // --- Saisies globales ----------------------------------------------------

  onContextChanged(key: string, value: string): void {
    void this.sessionService.updateContextValue(key, value);
  }

  async onMarkAllOk(): Promise<void> {
    await this.sessionService.markRemainingAsOk();
  }

  async onResetSession(): Promise<void> {
    if (confirm('Voulez-vous vraiment réinitialiser toutes les réponses de cette checklist ?')) {
      await this.sessionService.resetSession();
    }
  }

  // --- Cycle de vie --------------------------------------------------------

  async onComplete(): Promise<void> {
    await this.sessionService.completeSession();
  }

  async onReopen(): Promise<void> {
    if (confirm('Rouvrir cette checklist terminée ? Elle redeviendra modifiable et la réouverture sera tracée.')) {
      await this.sessionService.reopenSession();
    }
  }

  /** Déplie la section, rend l'item visible (filtre « Tous ») puis lui donne le focus. */
  onIssueClick(issue: CompletionIssue): void {
    if (issue.sectionId) {
      this.sessionService.expandSection(issue.sectionId);
      this.sessionService.setFilter('all');
    }
    const targetId = issue.itemId ? `item-${issue.itemId}` : `ctx_${issue.fieldId}`;
    // Attendre le rendu de la section dépliée avant de chercher l'élément.
    setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus({ preventScroll: true });
      }
    });
  }

  // --- Mise à jour du modèle ----------------------------------------------

  async openTemplateUpdate(): Promise<void> {
    this.templateUpdatePreview.set(await this.sessionService.getTemplateUpdatePreview());
  }

  async onConfirmTemplateUpdate(): Promise<void> {
    await this.sessionService.applyTemplateUpdate();
    this.templateUpdatePreview.set(null);
    if (this.sessionId) {
      await this.evidenceService.loadEvidenceCounts(this.sessionId);
    }
  }
}
