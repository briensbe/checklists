import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideCircleAlert, LucideHourglass, LucideLock, LucideLockOpen, LucideShieldAlert, LucideTrophy, LucideTriangleAlert } from '@lucide/angular';
import { StepFooter } from '../../domain/path-view';
import { RunnerController } from '../../pages/checklist-runner/runner-controller';

/**
 * Pied d'une étape débloquée (vue chemin et vue liste) : ce qui reste avant d'ouvrir la suite, les portes
 * ouvertes ou en attente d'une autre branche, les points d'attention (bloquants en N/A, preuves à compléter
 * ou manquantes), le forçage enregistré et, pour une porte souple, le formulaire « Forcer le passage ».
 * Ses actions passent par le `RunnerController` de la page, comme celles des lignes.
 */
@Component({
  selector: 'app-step-footer',
  standalone: true,
  imports: [DatePipe, LucideCircleAlert, LucideHourglass, LucideLock, LucideLockOpen, LucideShieldAlert, LucideTrophy, LucideTriangleAlert],
  templateUrl: './step-footer.component.html',
  styleUrl: './step-footer.component.css'
})
export class StepFooterComponent {
  protected readonly controller = inject(RunnerController);
  private readonly injector = inject(Injector);

  readonly sectionId = input.required<string>();
  readonly footer = input.required<StepFooter>();
  readonly readonly = input<boolean>(false);

  private readonly formOpen = signal(false);
  protected readonly reason = signal('');
  /** Le formulaire disparaît dès que le forçage n'est plus possible (enregistré, étape verrouillée ou franchie). */
  protected readonly showForm = computed(() => this.formOpen() && this.canForce());
  protected readonly canForce = computed(() => this.footer().canForce && !this.readonly());

  private readonly reasonInput = viewChild<ElementRef<HTMLTextAreaElement>>('reasonInput');
  private readonly forceButton = viewChild<ElementRef<HTMLButtonElement>>('forceButton');

  protected readonly blockingLabel = computed(() => {
    const count = this.footer().unresolvedBlocking;
    return count === 1 ? '1 bloquant avant d’ouvrir la suite' : `${count} bloquants avant d’ouvrir la suite`;
  });

  protected plural(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  openForm(): void {
    this.reason.set('');
    this.formOpen.set(true);
    afterNextRender({ read: () => this.reasonInput()?.nativeElement.focus() }, { injector: this.injector });
  }

  cancel(event?: Event): void {
    // Échap est traité ici : le runner ne fermera pas en plus un tiroir ouvert ailleurs.
    event?.preventDefault();
    event?.stopPropagation();
    this.formOpen.set(false);
    afterNextRender({ read: () => this.forceButton()?.nativeElement.focus() }, { injector: this.injector });
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    const reason = this.reason().trim();
    if (!reason) return;
    if (await this.controller.forceGate(this.sectionId(), reason)) {
      this.formOpen.set(false);
    }
  }

  onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }
}
