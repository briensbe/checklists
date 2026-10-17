import { Component, computed, input, output } from '@angular/core';
import { GateKind, JoinMode } from '../../models/checklist.model';
import { DependencyChip } from '../../pages/template-builder/flow-editor.helpers';

/**
 * Réglages d'enchaînement d'une section dans le builder (design D6) : puces « Après : »,
 * porte (si d'autres sections en dépendent) et mode de jonction (à partir de deux dépendances).
 * Composant présentationnel : le builder calcule les puces et applique les choix émis.
 */
@Component({
  selector: 'app-section-flow-settings',
  standalone: true,
  templateUrl: './section-flow-settings.component.html',
  styleUrl: './section-flow-settings.component.css'
})
export class SectionFlowSettingsComponent {
  readonly sectionId = input.required<string>();
  readonly chips = input.required<DependencyChip[]>();
  readonly dependencyCount = input(0);
  readonly hasDependents = input(false);
  readonly gate = input<GateKind | undefined>(undefined);
  readonly joinMode = input<JoinMode | undefined>(undefined);

  readonly toggleDependency = output<string>();
  readonly gateChange = output<GateKind>();
  readonly joinModeChange = output<JoinMode>();

  /** Valeurs affichées : l'absence vaut la valeur par défaut (ADR 0007). */
  protected readonly currentGate = computed<GateKind>(() => this.gate() ?? 'hard');
  protected readonly currentJoin = computed<JoinMode>(() => this.joinMode() ?? 'all');
  protected readonly ids = computed(() => {
    const id = this.sectionId();
    return { after: `after-${id}`, loop: `loop-${id}`, gate: `gate-${id}`, join: `join-${id}` };
  });
}
