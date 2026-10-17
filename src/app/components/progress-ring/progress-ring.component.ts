import { Component, computed, input } from '@angular/core';
import { ringGeometry, RingTone } from './ring-geometry';

export type { RingTone } from './ring-geometry';

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

  private readonly geometry = computed(() => ringGeometry(this.value(), this.size(), this.stroke()));
  protected readonly center = computed(() => this.geometry().center);
  protected readonly radius = computed(() => this.geometry().radius);
  protected readonly circumference = computed(() => this.geometry().circumference);
  protected readonly dashOffset = computed(() => this.geometry().dashOffset);
  protected readonly percent = computed(() => Math.round(this.geometry().value * 100));
}
