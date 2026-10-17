import { Component, HostListener, computed, input, output } from '@angular/core';
import { TemplateUpdatePreview } from '../../services/checklist-session.service';

/** Récapitulatif avant de remplacer la copie figée d'une session par la version courante du template. */
@Component({
  selector: 'app-template-update-modal',
  standalone: true,
  templateUrl: './template-update-modal.component.html',
  styleUrl: './template-update-modal.component.css'
})
export class TemplateUpdateModalComponent {
  readonly preview = input.required<TemplateUpdatePreview>();
  readonly currentVersion = input<string>('');

  readonly close = output<void>();
  readonly confirm = output<void>();

  readonly removedWithDataIds = computed(() => new Set(this.preview().diff.removedWithData.map(i => i.id)));

  readonly contextChangesCount = computed(() => {
    const ctx = this.preview().diff.context;
    return ctx.added.length + ctx.modified.length + ctx.removed.length;
  });

  readonly incompatibleAnswersCount = computed(
    () => this.preview().diff.modified.filter(m => m.answerIncompatible).length
  );

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }
}
