import { Component, computed, input, output } from '@angular/core';
import { LucideChevronDown, LucideListChecks } from '@lucide/angular';
import { ChecklistSectionTemplate, ChecklistItemTemplate, ItemAnswer } from '../../models/checklist.model';
import { ChecklistItemComponent } from '../checklist-item/checklist-item.component';
import { SectionProgress } from '../../domain/quick-check';

/**
 * Section du runner. Elle affiche les contrôles que lui confie le `RunnerController`
 * (filtre et repli déjà appliqués), et sa progression calculée sur ses contrôles applicables.
 */
@Component({
  selector: 'app-checklist-section',
  standalone: true,
  imports: [ChecklistItemComponent, LucideChevronDown, LucideListChecks],
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

  readonly toggleCollapse = output<void>();

  readonly answeredCount = computed(() => this.progress()?.answered ?? 0);
  readonly totalCount = computed(() => this.progress()?.total ?? 0);
  readonly isComplete = computed(() => this.totalCount() > 0 && this.answeredCount() === this.totalCount());
}
