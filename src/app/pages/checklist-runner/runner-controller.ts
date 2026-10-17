import { DestroyRef, Injectable, Injector, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { ChecklistSessionService } from '../../services/checklist-session.service';
import { EvidenceService, evidenceTypeOf } from '../../services/evidence.service';
import { ToastService } from '../../services/toast.service';
import { EvidenceRecord, ItemAnswer, MAX_EVIDENCE_SIZE } from '../../models/checklist.model';
import { ApplicableItem, criticalityOf } from '../../domain/session-rules';
import {
  choiceGesture,
  declaresBlocking,
  EvidenceSummary,
  isEvidenceSatisfied,
  matchesFilter,
  nextActiveItem,
  nextItemToProcess,
  NO_EVIDENCE,
  partitionBySize,
  primaryGesture,
  sectionProgress,
  SectionProgress,
  ShortcutAction,
  stepItem,
  unresolvedBlockingCount,
  visibleItems
} from '../../domain/quick-check';

/** `notes` : note, preuves et N/A ; `prompt` : demande de la preuve exigée par le modèle. */
export type DrawerMode = 'notes' | 'prompt';

/** Durée de la mise en évidence du trombone après une réponse sans note ni preuve. */
export const HINT_DURATION_MS = 2000;

/** Durée de la fenêtre d'annulation d'une suppression de preuve (ADR 0005). */
export const UNDO_DURATION_MS = 6000;

interface FocusOptions {
  block?: ScrollLogicalPosition;
  smooth?: boolean;
}

/**
 * Contrôleur d'interaction du runner, fourni par `ChecklistRunnerComponent` : une instance par page.
 *
 * Il porte l'état d'interface éphémère (item actif, tiroir ouvert, suggestion, aide) et les actions
 * de la saisie rapide. Le clic sur une ligne et les raccourcis clavier appellent les mêmes méthodes ;
 * les décisions viennent des fonctions pures de `domain/quick-check.ts`, les données des services.
 */
@Injectable()
export class RunnerController {
  private readonly sessionService = inject(ChecklistSessionService);
  private readonly evidenceService = inject(EvidenceService);
  private readonly toastService = inject(ToastService);
  private readonly injector = inject(Injector);

  readonly activeItemId = signal<string | null>(null);
  readonly drawerItemId = signal<string | null>(null);
  readonly drawerMode = signal<DrawerMode>('notes');
  /** Choix en attente de sa preuve exigée (contrôle de type choix). */
  readonly promptChoiceId = signal<string | null>(null);
  /** Item dont la note doit recevoir le focus au prochain rendu du tiroir (mise en KO). */
  readonly noteFocusRequest = signal<string | null>(null);
  readonly hintItemId = signal<string | null>(null);
  readonly helpOpen = signal<boolean>(false);

  private readonly drawerRecords = signal<EvidenceRecord[]>([]);
  /** Preuves du tiroir ouvert, hors preuves en attente de suppression. */
  readonly drawerEvidences = computed(() => {
    const hidden = this.evidenceService.pendingDeletionIds();
    return this.drawerRecords().filter(e => !hidden.has(e.id));
  });

  readonly isReadonly = this.sessionService.isReadonly;
  readonly items = this.sessionService.applicableItems;

  private readonly answers = computed<Record<string, ItemAnswer>>(() => this.sessionService.currentSession()?.answers ?? {});

  /** Contrôles affichés, partagés par le rendu des sections et la navigation au clavier. */
  readonly visibleItems = computed(() =>
    visibleItems(
      this.items(),
      this.answers(),
      this.sessionService.activeFilter(),
      this.sessionService.collapsedSections(),
      this.drawerItemId()
    )
  );
  readonly visibleIds = computed(() => this.visibleItems().map(i => i.id));
  readonly visibleBySection = computed(() => {
    const map: Record<string, ApplicableItem[]> = {};
    for (const item of this.visibleItems()) {
      (map[item.sectionId] ??= []).push(item);
    }
    return map;
  });

  readonly sectionProgress = computed<SectionProgress[]>(() => sectionProgress(this.sessionService.currentSession()));
  readonly progressBySection = computed(() =>
    Object.fromEntries(this.sectionProgress().map(p => [p.sectionId, p])) as Record<string, SectionProgress>
  );
  readonly declaresBlocking = computed(() => declaresBlocking(this.sessionService.currentTemplate()));
  readonly unresolvedBlocking = computed(() => unresolvedBlockingCount(this.sessionService.currentSession()));
  readonly nextToProcess = computed(() => nextItemToProcess(this.items(), this.answers(), this.activeItemId()));

  // Suppressions de preuves en attente : identifiant de preuve → identifiant du toast d'annulation.
  private readonly pendingDeletions = new Map<string, string>();
  private hintTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // L'item actif suit la liste affichée ; un tiroir dont le contrôle n'est plus affiché se ferme.
    let previous: readonly string[] = [];
    effect(() => {
      const current = this.visibleIds();
      untracked(() => {
        const active = this.activeItemId();
        const next = nextActiveItem(previous, current, active);
        if (next !== active) this.activeItemId.set(next);
        const drawer = this.drawerItemId();
        if (drawer && !current.includes(drawer)) this.resetDrawer();
      });
      previous = current;
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.hintTimer) clearTimeout(this.hintTimer);
    });
  }

  // --- Lecture -------------------------------------------------------------

  answerOf(itemId: string): ItemAnswer | undefined {
    return this.answers()[itemId];
  }

  evidenceOf(itemId: string): EvidenceSummary {
    return this.evidenceService.summaries()[itemId] ?? NO_EVIDENCE;
  }

  isDrawerOpen(itemId: string): boolean {
    return this.drawerItemId() === itemId;
  }

  private itemOf(itemId: string): ApplicableItem | undefined {
    return this.items().find(i => i.id === itemId);
  }

  private get sessionId(): string | null {
    return this.sessionService.currentSession()?.id ?? null;
  }

  setActive(itemId: string): void {
    if (this.activeItemId() !== itemId) this.activeItemId.set(itemId);
  }

  // --- Saisie --------------------------------------------------------------

  /** Geste principal : clic sur la ligne ou Espace. */
  async primary(itemId: string): Promise<void> {
    const item = this.itemOf(itemId);
    if (!item || this.isReadonly()) return;
    this.setActive(itemId);
    switch (primaryGesture(item, this.answerOf(itemId), this.evidenceOf(itemId))) {
      case 'check':
      case 'ok':
        await this.sessionService.resolveItem(itemId);
        this.suggest(itemId);
        break;
      case 'uncheck':
        await this.sessionService.updateAnswerCheckbox(itemId, false, !!item.withTimestamp);
        break;
      case 'clear':
        await this.sessionService.updateAnswerStatus(itemId, 'OK'); // re-clic : retrait du OK
        break;
      case 'ask-evidence':
        await this.openDrawer(itemId, 'prompt');
        break;
    }
  }

  /** Clic sur un bouton de choix. */
  async choose(itemId: string, choiceId: string): Promise<void> {
    const item = this.itemOf(itemId);
    if (!item || this.isReadonly()) return;
    this.setActive(itemId);
    switch (choiceGesture(item, this.answerOf(itemId), choiceId, this.evidenceOf(itemId))) {
      case 'select':
      case 'deselect':
        await this.sessionService.updateAnswerChoice(itemId, choiceId);
        break;
      case 'ask-evidence':
        await this.openDrawer(itemId, 'prompt');
        this.promptChoiceId.set(choiceId);
        break;
    }
  }

  /** Bouton KO ou touche K : met en KO (tiroir ouvert sur la note) ou retire le KO. */
  async ko(itemId: string): Promise<void> {
    const item = this.itemOf(itemId);
    const answer = this.answerOf(itemId);
    if (!item || this.isReadonly() || (item.controlType ?? 'status') !== 'status' || answer?.status === 'NA') return;
    this.setActive(itemId);
    const wasKo = answer?.status === 'KO';
    await this.sessionService.updateAnswerStatus(itemId, 'KO');
    if (!wasKo) {
      // Demande posée avant l'ouverture : le tiroir la voit dès son premier rendu.
      this.noteFocusRequest.set(itemId);
      await this.openDrawer(itemId, 'notes');
    }
  }

  /** « Non applicable » du tiroir ou touche N : pose ou retire le N/A. */
  async toggleNa(itemId: string): Promise<void> {
    if (!this.itemOf(itemId) || this.isReadonly()) return;
    this.setActive(itemId);
    await this.sessionService.toggleNa(itemId);
    if (this.drawerItemId() === itemId && this.drawerMode() === 'prompt') {
      this.drawerMode.set('notes');
      this.promptChoiceId.set(null);
    }
  }

  updateNote(itemId: string, comment: string): void {
    if (this.isReadonly()) return;
    void this.sessionService.updateAnswerComment(itemId, comment);
  }

  updateExtra(itemId: string, key: string, value: string): void {
    if (this.isReadonly()) return;
    void this.sessionService.updateAnswerExtra(itemId, key, value);
  }

  /** Fin de saisie de la note (Entrée) : une note qui fournit la preuve exigée retire « preuve à compléter ». */
  async noteCommitted(itemId: string): Promise<void> {
    await this.sessionService.flushPendingSave();
    await this.syncPending(itemId);
    this.focusRow(itemId);
  }

  // --- Tiroir --------------------------------------------------------------

  async toggleDrawer(itemId: string): Promise<void> {
    if (this.drawerItemId() === itemId) {
      await this.closeDrawer();
    } else {
      await this.openDrawer(itemId, 'notes');
    }
  }

  async openDrawer(itemId: string, mode: DrawerMode): Promise<void> {
    if (!this.itemOf(itemId)) return;
    this.setActive(itemId);
    if (this.drawerItemId() !== itemId) {
      this.drawerRecords.set([]);
      this.drawerItemId.set(itemId);
      await this.reloadDrawerEvidences(itemId);
    }
    this.drawerMode.set(mode);
    this.promptChoiceId.set(null);
  }

  /** Ferme le tiroir et rend le focus à la ligne de son contrôle. */
  async closeDrawer(): Promise<void> {
    const itemId = this.drawerItemId();
    if (!itemId) return;
    await this.sessionService.flushPendingSave();
    await this.syncPending(itemId);
    this.resetDrawer();
    this.focusRow(itemId);
  }

  private resetDrawer(): void {
    this.drawerItemId.set(null);
    this.drawerMode.set('notes');
    this.promptChoiceId.set(null);
    this.drawerRecords.set([]);
  }

  // --- Preuve exigée -------------------------------------------------------

  /** Ligne en « preuve à compléter » : rouvre la demande de preuve. */
  async completeEvidence(itemId: string): Promise<void> {
    if (this.isReadonly()) return;
    await this.openDrawer(itemId, 'prompt');
  }

  /** La preuve exigée du contrôle du tiroir est-elle fournie (avec le lien en brouillon, s'il y en a un) ? */
  isPromptSatisfied(itemId: string, linkDraft?: string): boolean {
    const item = this.itemOf(itemId);
    if (!item) return false;
    const answer = this.answerOf(itemId) ?? { status: null, comment: '' };
    const candidate = linkDraft !== undefined ? { ...answer, evidenceLink: linkDraft.trim() } : answer;
    return isEvidenceSatisfied(item, candidate, this.evidenceOf(itemId));
  }

  /** « Valider » : donne la réponse conforme avec la preuve fournie. */
  async validatePrompt(linkDraft?: string): Promise<void> {
    const itemId = this.drawerItemId();
    if (!itemId || this.isReadonly()) return;
    await this.sessionService.flushPendingSave();
    if (!this.isPromptSatisfied(itemId, linkDraft)) return;
    await this.sessionService.resolveItem(itemId, { choiceId: this.promptChoiceId() ?? undefined, link: linkDraft });
    await this.closeDrawer();
  }

  /** « Plus tard » : réponse conforme avec « preuve à compléter », refusée pour un bloquant. */
  async later(): Promise<void> {
    const itemId = this.drawerItemId();
    const item = itemId ? this.itemOf(itemId) : undefined;
    if (!itemId || !item || this.isReadonly() || criticalityOf(item) === 'blocking') return;
    await this.sessionService.resolveItem(itemId, { pending: true, choiceId: this.promptChoiceId() ?? undefined });
    await this.closeDrawer();
  }

  /** « Annuler » : ferme la demande sans répondre ; les preuves déjà ajoutées restent. */
  async cancelPrompt(): Promise<void> {
    await this.closeDrawer();
  }

  async removeLink(itemId: string): Promise<void> {
    if (this.isReadonly()) return;
    await this.sessionService.setEvidenceLink(itemId, null);
  }

  // --- Preuves -------------------------------------------------------------

  /** Ajoute des preuves au contrôle ; les fichiers de plus de 50 Mo sont refusés par un toast. */
  async addFiles(itemId: string, files: readonly File[]): Promise<void> {
    const sessionId = this.sessionId;
    if (!sessionId || this.isReadonly()) return;
    const { accepted, rejected } = partitionBySize(files, MAX_EVIDENCE_SIZE);
    if (rejected.length > 0) {
      this.toastService.warning(`Fichier(s) refusé(s), limite de 50 Mo dépassée :\n- ${rejected.map(f => f.name).join('\n- ')}`);
    }
    for (const file of accepted) {
      try {
        const record = await this.evidenceService.addEvidence(sessionId, itemId, file, file.name, evidenceTypeOf(file));
        await this.sessionService.recordEvidenceEvent(sessionId, itemId, 'evidence-added', record);
      } catch (err) {
        this.toastService.danger(err instanceof Error ? err.message : String(err));
      }
    }
    if (this.drawerItemId() === itemId) await this.reloadDrawerEvidences(itemId);
    await this.syncPending(itemId);
  }

  /**
   * Suppression annulable (ADR 0005) : la preuve disparaît tout de suite, l'événement d'historique
   * est ajouté tout de suite ; l'annulation restaure la preuve et retire cet événement.
   */
  async deleteEvidence(record: EvidenceRecord): Promise<void> {
    const sessionId = this.sessionId;
    if (!sessionId || this.isReadonly()) return;
    this.evidenceService.hideForDeletion(record.id);
    await this.sessionService.recordEvidenceEvent(sessionId, record.itemId, 'evidence-removed', record);

    const toastId = this.toastService.showDeferred({
      message: `Preuve « ${record.name} » supprimée`,
      durationMs: UNDO_DURATION_MS,
      undoLabel: 'Annuler',
      onCommit: async () => {
        this.pendingDeletions.delete(record.id);
        this.drawerRecords.update(list => list.filter(e => e.id !== record.id));
        await this.evidenceService.commitDeletion(sessionId, record.id);
      },
      onUndo: async () => {
        this.pendingDeletions.delete(record.id);
        this.evidenceService.restore(record.id);
        await this.sessionService.removeEvidenceRemovedEvent(sessionId, record.itemId, record.id);
      }
    });
    this.pendingDeletions.set(record.id, toastId);
  }

  /** Exécute tout de suite les suppressions de preuves en attente (avant une clôture). */
  async flushEvidenceDeletions(): Promise<void> {
    const toastIds = [...this.pendingDeletions.values()];
    for (const toastId of toastIds) {
      try {
        await this.toastService.commitNow(toastId);
      } catch (err) {
        this.toastService.danger(err instanceof Error ? err.message : String(err));
      }
    }
  }

  private async reloadDrawerEvidences(itemId: string): Promise<void> {
    const sessionId = this.sessionId;
    if (!sessionId) return;
    const records = await this.evidenceService.getEvidencesForItem(itemId, sessionId);
    if (this.drawerItemId() === itemId) this.drawerRecords.set(records);
  }

  /** Retire « preuve à compléter » dès que la preuve exigée est fournie. */
  private async syncPending(itemId: string): Promise<void> {
    const item = this.itemOf(itemId);
    const answer = this.answerOf(itemId);
    if (item && answer?.evidencePending && isEvidenceSatisfied(item, answer, this.evidenceOf(itemId))) {
      await this.sessionService.clearEvidencePending(itemId);
    }
  }

  // --- Suggestion d'ajout --------------------------------------------------

  private suggest(itemId: string): void {
    const answer = this.answerOf(itemId);
    if (answer?.comment?.trim() || answer?.evidenceLink || this.evidenceOf(itemId).total > 0) return;
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintItemId.set(itemId);
    this.hintTimer = setTimeout(() => {
      this.hintTimer = null;
      this.hintItemId.set(null);
    }, HINT_DURATION_MS);
  }

  // --- Navigation ----------------------------------------------------------

  navigate(delta: 1 | -1): void {
    const next = stepItem(this.visibleIds(), this.activeItemId(), delta);
    if (next) this.focusItem(next);
  }

  /** « Prochain item à traiter ». */
  goToNext(): void {
    const target = this.nextToProcess();
    if (target) this.focusItem(target.id, { block: 'center', smooth: true });
  }

  /**
   * Rend un contrôle visible et lui donne le focus : déplie sa section, repasse le filtre à « Tous »
   * s'il masque le contrôle, puis, après le rendu, fait défiler et place le focus.
   */
  focusItem(itemId: string, options: FocusOptions = {}): void {
    const item = this.itemOf(itemId);
    if (!item) return;
    this.sessionService.expandSection(item.sectionId);
    const filter = this.sessionService.activeFilter();
    if (!matchesFilter(item, this.answerOf(itemId), filter) && this.drawerItemId() !== itemId) {
      this.sessionService.setFilter('all');
    }
    this.setActive(itemId);
    this.afterRender(() => this.scrollAndFocus(`item-${itemId}`, options));
  }

  /** Déplie une section et la fait défiler dans la zone visible (clic sur un anneau). */
  focusSection(sectionId: string): void {
    this.sessionService.expandSection(sectionId);
    this.afterRender(() => this.scrollAndFocus(`section-${sectionId}`, { block: 'start', smooth: true }));
  }

  /** Rend le focus à la ligne d'un contrôle, sans défilement superflu. */
  focusRow(itemId: string): void {
    this.afterRender(() => this.scrollAndFocus(`item-${itemId}`, {}));
  }

  /** Exécute l'action d'un raccourci sur l'item actif. Renvoie vrai si la touche a été utilisée. */
  async handleShortcut(action: ShortcutAction): Promise<boolean> {
    const active = this.activeItemId();
    switch (action) {
      case 'next':
        this.navigate(1);
        return true;
      case 'previous':
        this.navigate(-1);
        return true;
      case 'help':
        this.helpOpen.set(true);
        return true;
      case 'escape':
        if (!this.drawerItemId()) return false;
        await (this.drawerMode() === 'prompt' ? this.cancelPrompt() : this.closeDrawer());
        return true;
    }
    if (!active) return action === 'primary';
    switch (action) {
      case 'primary':
        await this.primary(active);
        break;
      case 'ko':
        await this.ko(active);
        break;
      case 'na':
        await this.toggleNa(active);
        break;
      case 'drawer':
        await this.toggleDrawer(active);
        break;
    }
    return true;
  }

  private afterRender(callback: () => void): void {
    afterNextRender({ read: callback }, { injector: this.injector });
  }

  private scrollAndFocus(elementId: string, options: FocusOptions): void {
    const el = document.getElementById(elementId);
    if (!el) return;
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // `scrollIntoView` est absent de certains environnements de test (jsdom).
    el.scrollIntoView?.({ block: options.block ?? 'nearest', behavior: options.smooth && !reduceMotion ? 'smooth' : 'auto' });
    el.focus({ preventScroll: true });
  }
}
