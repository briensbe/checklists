import { Component, computed, input, output } from '@angular/core';
import { LucideChevronDown, LucideDynamicIcon } from '@lucide/angular';
import { ChecklistSectionTemplate, ChecklistItemTemplate, ItemAnswer } from '../../models/checklist.model';
import { ChecklistItemComponent } from '../checklist-item/checklist-item.component';
import { SectionProgress } from '../../domain/quick-check';
import { StepView } from '../../domain/path-view';
import { resolveStepIcon } from '../../domain/step-icons';
import { StepFooterComponent } from '../step-footer/step-footer.component';
import { StepLockedComponent } from '../step-locked/step-locked.component';
import { STEP_STATE_LABELS } from '../step-panel/step-panel.component';

/**
 * Section du runner (vue liste). Elle affiche les contrôles que lui confie le `RunnerController`
 * (filtre et repli déjà appliqués), et sa progression calculée sur ses contrôles applicables.
 * Sur un modèle à dépendances (`step`), elle montre aussi l'état de l'étape : contenu d'étape
 * verrouillée à la place des lignes, ou pied d'étape sous les lignes.
 */
@Component({
  selector: 'app-checklist-section',
  standalone: true,
  imports: [ChecklistItemComponent, LucideChevronDown, LucideDynamicIcon, StepFooterComponent, StepLockedComponent],
  templateUrl: './checklist-section.component.html',
  styleUrl: './checklist-section.component.css'
})
export class ChecklistSectionComponent {
  readonly section = input.required<ChecklistSectionTemplate>();
  /** Contrôles affichés (filtre actif appliqué). */
  readonly items = input.required<ChecklistItemTemplate[]>();
  /** Progression sur les contrôles applicables ; absente si la section n'en a aucun. */
  readonly progress = input<SectionProgress | undefined>();
  readonly answers = input<Record<string, ItemAnswer>>({});
  readonly isCollapsed = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  /** État de l'étape, pour un modèle à dépendances ; absent sinon. */
  readonly step = input<StepView | null | undefined>(null);

  readonly toggleCollapse = output<void>();

  protected readonly stateLabels = STEP_STATE_LABELS;
  protected readonly icon = computed(() => resolveStepIcon(this.section().icon));
  protected readonly locked = computed(() => this.step()?.visual === 'locked');
  readonly answeredCount = computed(() => this.progress()?.answered ?? 0);
  readonly totalCount = computed(() => this.progress()?.total ?? 0);
  readonly isComplete = computed(() => this.totalCount() > 0 && this.answeredCount() === this.totalCount());
}
