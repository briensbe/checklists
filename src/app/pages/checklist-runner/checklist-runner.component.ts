import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { LucideArrowLeft, LucideCheck, LucideFileDown, LucidePencil, LucideRotateCcw, LucideSave } from '@lucide/angular';
import { ChecklistSessionService, TemplateUpdatePreview } from '../../services/checklist-session.service';
import { TemplateService } from '../../services/template.service';
import { ExportService } from '../../services/export.service';
import { EvidenceService } from '../../services/evidence.service';
import { DialogService } from '../../services/dialog.service';
import { ToastService } from '../../services/toast.service';
import { EvidenceRecord } from '../../models/checklist.model';
import { COMPLETION_ISSUE_LABELS, CompletionIssue } from '../../domain/session-rules';
import { resolveShortcut, ShortcutContext } from '../../domain/quick-check';
import { AuditSummaryComponent } from '../../components/audit-summary/audit-summary.component';
import { ChecklistSectionComponent } from '../../components/checklist-section/checklist-section.component';
import { JsonDraftModalComponent } from '../../components/json-draft-modal/json-draft-modal.component';
import { TemplateUpdateModalComponent } from '../../components/template-update-modal/template-update-modal.component';
import { RunnerProgressBarComponent } from '../../components/runner-progress-bar/runner-progress-bar.component';
import { ShortcutsHelpComponent } from '../../components/shortcuts-help/shortcuts-help.component';
import { RunnerController } from './runner-controller';

@Component({
  selector: 'app-checklist-runner',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    AuditSummaryComponent,
    ChecklistSectionComponent,
    JsonDraftModalComponent,
    TemplateUpdateModalComponent,
    RunnerProgressBarComponent,
    ShortcutsHelpComponent,
    LucideArrowLeft,
    LucideCheck,
    LucideFileDown,
    LucidePencil,
    LucideRotateCcw,
    LucideSave
  ],
  // Une instance du contrôleur d'interaction par page de runner (état d'interface éphémère).
  providers: [RunnerController],
  templateUrl: './checklist-runner.component.html',
  styleUrl: './checklist-runner.component.css'
})
export class ChecklistRunnerComponent implements OnInit, OnDestroy {
  protected sessionService = inject(ChecklistSessionService);
  protected templateService = inject(TemplateService);
  protected exportService = inject(ExportService);
  protected evidenceService = inject(EvidenceService);
  protected controller = inject(RunnerController);
  private dialogService = inject(DialogService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);

  protected readonly issueLabels = COMPLETION_ISSUE_LABELS;

  isJsonDraftModalOpen = signal<boolean>(false);
  templateUpdatePreview = signal<TemplateUpdatePreview | null>(null);

  // Fenêtre d'export JSON
  includeEvidence = signal<boolean>(false);
  sessionEvidences = signal<EvidenceRecord[]>([]);
  isExporting = signal<boolean>(false);
  readonly evidenceTotalSize = computed(() => this.sessionEvidences().reduce((sum, e) => sum + e.size, 0));
  /** Recalculé quand la session, ses métriques ou la case « pièces jointes » changent. */
  readonly exchangePreview = computed(() =>
    this.exportService.getExchangePreview(this.includeEvidence() ? this.sessionEvidences() : undefined)
  );

  /** Une fenêtre modale est ouverte : elle gère seule son clavier, les raccourcis du runner sont suspendus. */
  readonly isModalOpen = computed(
    () =>
      !!this.dialogService.activeDialog() ||
      !!this.templateUpdatePreview() ||
      this.isJsonDraftModalOpen() ||
      this.controller.helpOpen()
  );

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
    this.toastService.flushPending();
    void this.sessionService.flushPendingSave();
  }

  /** Onglet masqué ou fermé : on n'attend pas la fin du délai de regroupement. */
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      this.toastService.flushPending();
      void this.sessionService.flushPendingSave();
    }
  }

  /** Raccourcis clavier du runner, avec leurs gardes (saisie, modale, lecture seule). */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.sessionService.currentSession() || event.defaultPrevented) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const ctx: ShortcutContext = {
      editable: !!target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'),
      modalOpen: this.isModalOpen() || !!target?.closest('[aria-modal="true"]'),
      readonly: this.sessionService.isReadonly(),
      onControl: !!target?.closest('button, a[href], summary')
    };
    const action = resolveShortcut(event, ctx);
    if (!action) return;
    // Échap sans tiroir ouvert garde son comportement habituel.
    if (action === 'escape' && !this.controller.drawerItemId()) return;
    event.preventDefault();
    void this.controller.handleShortcut(action);
  }

  // --- Saisies globales ----------------------------------------------------

  onTitleInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    void this.sessionService.updateTitle(value);
  }

  onTitleBlur(event: Event): void {
    const input = event.target as HTMLInputElement;
    const trimmed = input.value.trim();
    const currentTitle = this.sessionService.currentSession()?.title ?? '';
    if (!trimmed) {
      input.value = currentTitle;
      return;
    }
    if (trimmed !== input.value) {
      input.value = trimmed;
    }
    if (trimmed !== currentTitle) {
      void this.sessionService.updateTitle(trimmed);
    }
  }

  onContextChanged(key: string, value: string): void {
    void this.sessionService.updateContextValue(key, value);
  }

  async onMarkAllOk(): Promise<void> {
    const current = this.sessionService.currentSession();
    if (!current) return;
    const previousAnswers = structuredClone(current.answers);

    const { modified, skippedForEvidence } = await this.sessionService.markRemainingAsOk(this.evidenceService.summaries());
    const skipped = skippedForEvidence > 0 ? ` ${skippedForEvidence} bloquant(s) laissé(s) sans réponse faute de preuve.` : '';
    if (modified > 0) {
      this.toastService.showDeferred({
        message: `${modified} contrôle(s) passé(s) à OK.${skipped}`,
        durationMs: 6000,
        undoLabel: 'Annuler',
        onCommit: () => {},
        onUndo: async () => {
          await this.sessionService.restoreAnswers(previousAnswers);
        }
      });
    } else if (skippedForEvidence > 0) {
      this.toastService.warning(`Aucun contrôle passé à OK :${skipped}`);
    } else {
      this.toastService.info('Aucun contrôle restant à passer à OK.');
    }
  }

  async onResetSession(): Promise<void> {
    const confirmed = await this.dialogService.confirm({
      title: 'Réinitialiser la checklist',
      message: 'Voulez-vous vraiment réinitialiser toutes les réponses de cette checklist ?',
      confirmLabel: 'Réinitialiser',
      cancelLabel: 'Annuler',
      confirmTone: 'danger'
    });

    if (confirmed) {
      await this.sessionService.resetSession();
      this.toastService.info('Toutes les réponses ont été réinitialisées.');
    }
  }

  // --- Cycle de vie --------------------------------------------------------

  async onComplete(): Promise<void> {
    // Une clôture acceptée exécute d'abord les suppressions de preuves en attente :
    // une fois la session terminée, elles ne pourraient plus être faites.
    if (this.sessionService.completionIssues().length === 0) {
      await this.controller.flushEvidenceDeletions();
    }
    await this.sessionService.completeSession();
  }

  async onReopen(): Promise<void> {
    const confirmed = await this.dialogService.confirm({
      title: 'Rouvrir la checklist',
      message: 'Rouvrir cette checklist terminée ? Elle redeviendra modifiable et la réouverture sera tracée dans l’historique.',
      confirmLabel: 'Rouvrir',
      cancelLabel: 'Annuler',
      confirmTone: 'primary'
    });

    if (confirmed) {
      await this.sessionService.reopenSession();
      this.toastService.success('La checklist a été rouverte.');
    }
  }

  /** Rend visible l'élément en anomalie (contrôle ou champ de contexte) et lui donne le focus. */
  onIssueClick(issue: CompletionIssue): void {
    if (issue.itemId) {
      this.controller.focusItem(issue.itemId, { block: 'center', smooth: true });
      return;
    }
    // Attendre le rendu avant de chercher le champ de contexte.
    setTimeout(() => {
      const el = document.getElementById(`ctx_${issue.fieldId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus({ preventScroll: true });
      }
    });
  }

  // --- Exports -------------------------------------------------------------

  async openJsonModal(): Promise<void> {
    const sessionId = this.sessionService.currentSession()?.id;
    if (!sessionId) return;
    this.sessionEvidences.set(await this.evidenceService.getSessionEvidences(sessionId));
    this.includeEvidence.set(false);
    this.isJsonDraftModalOpen.set(true);
  }

  async onExportJson(includeEvidence: boolean): Promise<void> {
    this.isExporting.set(true);
    try {
      await this.exportService.exportSessionFile(includeEvidence);
    } catch (err) {
      this.toastService.danger(`Export impossible : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.isExporting.set(false);
    }
  }

  async onExportPdf(): Promise<void> {
    try {
      await this.exportService.exportPdf();
    } catch (err) {
      this.toastService.danger(`Export PDF impossible : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Mise à jour du modèle ----------------------------------------------

  async openTemplateUpdate(): Promise<void> {
    this.templateUpdatePreview.set(await this.sessionService.getTemplateUpdatePreview());
  }

  async onConfirmTemplateUpdate(): Promise<void> {
    await this.sessionService.applyTemplateUpdate();
    this.templateUpdatePreview.set(null);
    const sessionId = this.sessionService.currentSession()?.id;
    if (sessionId) {
      await this.evidenceService.loadEvidenceCounts(sessionId);
    }
  }
}
