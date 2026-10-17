import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  LucideCamera,
  LucideChevronUp,
  LucideCircle,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideCircleOff,
  LucideCircleX,
  LucideClock,
  LucideFile,
  LucideLink,
  LucideMessageSquare,
  LucidePaperclip,
  LucideTriangleAlert
} from '@lucide/angular';
import { ChecklistItemTemplate, EvidenceKind, ItemAnswer } from '../../models/checklist.model';
import { criticalityOf, isKo } from '../../domain/session-rules';
import { evidenceState } from '../../domain/quick-check';
import { RunnerController } from '../../pages/checklist-runner/runner-controller';
import { ItemDrawerComponent } from '../item-drawer/item-drawer.component';

/** État affiché d'un contrôle : à traiter, conforme, en anomalie ou non applicable. */
type ItemState = 'todo' | 'ok' | 'ko' | 'na';

const STATE_LABELS: Record<ItemState, string> = {
  todo: 'à traiter',
  ok: 'OK',
  ko: 'KO',
  na: 'non applicable'
};

export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  comment: 'commentaire',
  photo: 'photo',
  link: 'lien',
  file: 'fichier'
};

/**
 * Ligne d'un contrôle (saisie rapide) : toute la ligne porte le geste principal, le reste (note,
 * preuves, N/A) passe par le tiroir. Les données arrivent en entrée ; les interactions passent par
 * le `RunnerController` de la page, partagé avec les raccourcis clavier.
 */
@Component({
  selector: 'app-checklist-item',
  standalone: true,
  imports: [
    DatePipe,
    ItemDrawerComponent,
    LucideCamera,
    LucideChevronUp,
    LucideCircle,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideCircleOff,
    LucideCircleX,
    LucideClock,
    LucideFile,
    LucideLink,
    LucideMessageSquare,
    LucidePaperclip,
    LucideTriangleAlert
  ],
  templateUrl: './checklist-item.component.html',
  styleUrl: './checklist-item.component.css'
})
export class ChecklistItemComponent {
  protected readonly controller = inject(RunnerController);

  readonly item = input.required<ChecklistItemTemplate>();
  readonly answer = input<ItemAnswer | undefined>();
  readonly readonly = input<boolean>(false);

  protected readonly evidenceKindLabels = EVIDENCE_KIND_LABELS;

  protected readonly type = computed(() => this.item().controlType ?? 'status');
  protected readonly isNa = computed(() => this.answer()?.status === 'NA');
  protected readonly isKoStatus = computed(() => this.answer()?.status === 'KO');
  protected readonly state = computed<ItemState>(() => {
    const answer = this.answer();
    if (answer?.status === 'NA') return 'na';
    if (isKo(this.item(), answer)) return 'ko';
    switch (this.type()) {
      case 'checkbox':
        return answer?.checked ? 'ok' : 'todo';
      case 'choice':
        return answer?.selectedChoice ? 'ok' : 'todo';
      default:
        return answer?.status === 'OK' ? 'ok' : 'todo';
    }
  });

  protected readonly criticality = computed(() => criticalityOf(this.item()));
  protected readonly evidence = computed(() => this.controller.evidenceOf(this.item().id));
  protected readonly evidenceState = computed(() => evidenceState(this.item(), this.answer(), this.evidence()));
  protected readonly hasNote = computed(() => !!this.answer()?.comment?.trim());
  /** Preuves du contrôle : fichiers et photos, plus le lien de preuve. */
  protected readonly proofCount = computed(() => this.evidence().total + (this.answer()?.evidenceLink ? 1 : 0));

  protected readonly isActive = computed(() => this.controller.activeItemId() === this.item().id);
  protected readonly drawerOpen = computed(() => this.controller.isDrawerOpen(this.item().id));
  protected readonly hint = computed(() => this.controller.hintItemId() === this.item().id);
  /** Les commandes des lignes inactives sortent de l'ordre de tabulation : on passe de ligne en ligne par ↑/↓. */
  protected readonly innerTabindex = computed(() => (this.isActive() || this.drawerOpen() ? null : -1));

  protected readonly rowRole = computed(() => {
    switch (this.type()) {
      case 'checkbox':
        return 'checkbox';
      case 'choice':
        return 'group';
      default:
        return 'button';
    }
  });
  protected readonly ariaChecked = computed(() => (this.type() === 'checkbox' ? String(!!this.answer()?.checked) : null));
  protected readonly stateLabel = computed(() => STATE_LABELS[this.state()]);

  /** Clic sur la ligne : geste principal, sauf sur une commande ou à la fin d'une sélection de texte. */
  onRowClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    this.controller.setActive(this.item().id);
    if (target?.closest('button, a, input, textarea, select, label')) return;
    if ((window.getSelection()?.toString() ?? '').length > 0) return;
    void this.controller.primary(this.item().id);
  }

  onExtraInput(key: string, event: Event): void {
    this.controller.updateExtra(this.item().id, key, (event.target as HTMLInputElement).value);
  }
}
