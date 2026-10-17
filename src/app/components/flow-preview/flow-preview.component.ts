import { Component, computed, input, output } from '@angular/core';
import { LucideCircleCheck, LucideCircleX, LucideTriangleAlert } from '@lucide/angular';
import { ChecklistTemplate } from '../../models/checklist.model';
import { summarizeFlow, toPreviewNodes } from '../../pages/template-builder/flow-editor.helpers';
import { StepGraphComponent } from '../step-graph/step-graph.component';

/**
 * Aperçu du chemin dans le builder (design D4 et D5) : le graphe des étapes dans sa variante
 * « structure », recalculé à chaque modification du modèle, et le bandeau de validation.
 * Le bandeau informe sans bloquer : seul l'enregistrement refuse un modèle invalide.
 */
@Component({
  selector: 'app-flow-preview',
  standalone: true,
  imports: [StepGraphComponent, LucideCircleCheck, LucideCircleX, LucideTriangleAlert],
  templateUrl: './flow-preview.component.html',
  styleUrl: './flow-preview.component.css'
})
export class FlowPreviewComponent {
  readonly template = input.required<ChecklistTemplate>();
  /** Section choisie dans l'aperçu (clic, Entrée ou Espace sur un nœud). */
  readonly selectSection = output<string>();

  protected readonly summary = computed(() => summarizeFlow(this.template()));
  protected readonly nodes = computed(() => (this.summary().hasFlow ? toPreviewNodes(this.template()) : []));
  protected readonly okText = computed(() => {
    const { starts, ends } = this.summary();
    return `${starts.length} départ(s), ${ends.length} fin(s), pas de boucle`;
  });
  protected readonly emptyText = computed(() => {
    const empty = this.summary().emptySections;
    return `${empty.length} étape(s) sans contrôle : ${empty.map(s => `« ${s.title} »`).join(', ')}`;
  });
}
