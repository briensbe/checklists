import { Component, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { ChecklistItemTemplate, ItemAnswer } from '../../models/checklist.model';
import { StepVisual } from '../../domain/flow-rules';
import { StepView } from '../../domain/path-view';
import { ringToneOf } from '../progress-ring/ring-geometry';
import { ProgressRingComponent } from '../progress-ring/progress-ring.component';
import { ChecklistItemComponent } from '../checklist-item/checklist-item.component';
import { StepFooterComponent } from '../step-footer/step-footer.component';
import { StepLockedComponent } from '../step-locked/step-locked.component';

export const STEP_STATE_LABELS: Record<StepVisual, string> = {
  locked: 'Verrouillée',
  open: 'Ouverte',
  passed: 'Franchie',
  done: 'Terminée'
};

/**
 * Panneau de l'étape sélectionnée, sous le graphe de la vue chemin. Une étape débloquée affiche
 * les mêmes lignes que la vue liste (`checklist-item`, pilotées par le `RunnerController`), puis
 * son pied d'étape ; une étape verrouillée affiche ses prérequis et ses contrôles en texte.
 */
@Component({
  selector: 'app-step-panel',
  standalone: true,
  imports: [LucideDynamicIcon, ProgressRingComponent, ChecklistItemComponent, StepFooterComponent, StepLockedComponent],
  templateUrl: './step-panel.component.html',
  styleUrl: './step-panel.component.css'
})
export class StepPanelComponent {
  readonly view = input.required<StepView>();
  /** Contrôles affichés de l'étape (filtre actif appliqué). */
  readonly items = input<ChecklistItemTemplate[]>([]);
  readonly answers = input<Record<string, ItemAnswer>>({});
  readonly readonly = input<boolean>(false);

  protected readonly stateLabels = STEP_STATE_LABELS;
  protected readonly locked = computed(() => this.view().visual === 'locked');
  protected readonly ringValue = computed(() => (this.view().total > 0 ? this.view().answered / this.view().total : 0));
  protected readonly ringTone = computed(() => ringToneOf(this.view().answered, this.view().total, this.view().anomaly));
}
