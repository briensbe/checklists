import { Component, computed, input } from '@angular/core';
import { LucideCircleCheck, LucideHourglass, LucideLock } from '@lucide/angular';
import { LockedStepItem, PrerequisiteState, StepPrerequisites } from '../../domain/path-view';

const PREREQUISITE_LABELS: Record<PrerequisiteState, string> = {
  ready: 'prête',
  'in-progress': 'bloquants en cours',
  'not-open': 'pas encore ouverte'
};

/**
 * Contenu d'une étape verrouillée, en vue chemin comme en vue liste : d'abord le « pourquoi »
 * (prérequis et leur état), puis les contrôles en simple texte, sans case ni badge (on n'affiche
 * de l'interface que là où l'on peut agir). Une étape reverrouillée rappelle ses réponses conservées.
 */
@Component({
  selector: 'app-step-locked',
  standalone: true,
  imports: [LucideCircleCheck, LucideHourglass, LucideLock],
  templateUrl: './step-locked.component.html',
  styleUrl: './step-locked.component.css'
})
export class StepLockedComponent {
  readonly prerequisites = input.required<StepPrerequisites>();
  readonly items = input<LockedStepItem[]>([]);

  protected readonly labels = PREREQUISITE_LABELS;
  protected readonly hasAnswers = computed(() => this.items().some(i => i.answerText !== null));
}
