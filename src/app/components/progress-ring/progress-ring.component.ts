import { Component, computed, input } from '@angular/core';

export type RingTone = 'progress' | 'complete' | 'anomaly';

/**
 * Anneau de progression en SVG, dimensionné en pixels (jamais en pourcentages, voir
 * `docs/design/checklist-ux.md`) et coloré par les variables `--ring-*` des deux thèmes.
 * Sans `label`, il est décoratif et masqué aux technologies d'assistance.
 */
@Component({
  selector: 'app-progress-ring',
  standalone: true,
  templateUrl: './progress-ring.component.html',
  styleUrl: './progress-ring.component.css'
})
export class ProgressRingComponent {
  /** Part remplie, entre 0 et 1. */
  readonly value = input<number>(0);
  readonly tone = input<RingTone>('progress');
  readonly size = input<number>(32);
  readonly stroke = input<number>(4);
  readonly label = input<string>('');
  /** Affiche le pourcentage au centre (anneaux assez grands seulement). */
  readonly showPercent = input<boolean>(false);

  protected readonly center = computed(() => this.size() / 2);
  protected readonly radius = computed(() => (this.size() - this.stroke()) / 2);
  protected readonly circumference = computed(() => 2 * Math.PI * this.radius());
  protected readonly clamped = computed(() => Math.min(1, Math.max(0, this.value())));
  protected readonly dashOffset = computed(() => this.circumference() * (1 - this.clamped()));
  protected readonly percent = computed(() => Math.round(this.clamped() * 100));
}
