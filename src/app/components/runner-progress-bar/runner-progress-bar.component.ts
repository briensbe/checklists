import { Component, computed, input, output } from '@angular/core';
import { LucideKeyboard, LucideLock, LucideLockOpen, LucideSkipForward } from '@lucide/angular';
import { MetricsSummary } from '../../models/checklist.model';
import { NextItemState, SectionProgress } from '../../domain/quick-check';
import { ProgressRingComponent, RingTone } from '../progress-ring/progress-ring.component';
import { ringToneOf } from '../progress-ring/ring-geometry';

const NEXT_LABELS: Record<NextItemState, string> = {
  available: 'Prochain item à traiter',
  'all-done': 'Tout est renseigné',
  'locked-only': 'Contrôles restants dans des étapes verrouillées'
};

/**
 * Résumé de progression du runner, fixé sous l'en-tête pendant le défilement : avancement global,
 * bloquants restants, un anneau par section, « Prochain item à traiter » et aide des raccourcis.
 */
@Component({
  selector: 'app-runner-progress-bar',
  standalone: true,
  imports: [ProgressRingComponent, LucideKeyboard, LucideLock, LucideLockOpen, LucideSkipForward],
  templateUrl: './runner-progress-bar.component.html',
  styleUrl: './runner-progress-bar.component.css'
})
export class RunnerProgressBarComponent {
  readonly metrics = input.required<MetricsSummary>();
  readonly sections = input<SectionProgress[]>([]);
  /** Bloquants non résolus ; `null` quand le modèle ne déclare aucun bloquant. */
  readonly unresolvedBlocking = input<number | null>(null);
  /** « Prochain item à traiter » : accessible, tout renseigné, ou restes dans des étapes verrouillées. */
  readonly nextState = input<NextItemState>('available');

  readonly next = output<void>();
  readonly help = output<void>();
  readonly sectionClick = output<string>();

  protected readonly blockingLabel = computed(() => {
    const count = this.unresolvedBlocking();
    if (count === null) return '';
    if (count === 0) return 'Aucun bloquant restant';
    return count === 1 ? '1 bloquant restant' : `${count} bloquants restants`;
  });

  protected readonly nextLabel = computed(() => NEXT_LABELS[this.nextState()]);

  protected ringTone(section: SectionProgress): RingTone {
    return ringToneOf(section.answered, section.total, section.hasAnomaly);
  }

  protected ringLabel(section: SectionProgress): string {
    return `${section.title} : ${section.answered} sur ${section.total}`;
  }
}
