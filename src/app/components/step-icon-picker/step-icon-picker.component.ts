import { afterNextRender, Component, computed, ElementRef, HostListener, inject, Injector, input, output, signal, viewChild } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { resolveStepIcon, STEP_ICON_LABELS, STEP_ICON_NAMES, StepIconName } from '../../domain/step-icons';

let nextId = 0;

/**
 * Palette d'icônes d'étape du builder (design D7) : un bouton qui montre l'icône courante et déplie,
 * sous lui, la liste fermée des icônes (`STEP_ICON_NAMES`, ADR 0010 point 4). Composant présentationnel :
 * il émet le nom choisi, le builder l'écrit dans le modèle. Les icônes sont déjà enregistrées par
 * `provideStepIcons()` : rien à importer ici, sinon `LucideDynamicIcon`.
 */
@Component({
  selector: 'app-step-icon-picker',
  standalone: true,
  imports: [LucideDynamicIcon],
  templateUrl: './step-icon-picker.component.html',
  styleUrl: './step-icon-picker.component.css'
})
export class StepIconPickerComponent {
  /** Valeur brute de `section.icon` : nom Lucide, ancien nom Heroicons, inconnu ou absent. */
  readonly icon = input<string | null | undefined>(undefined);
  readonly pick = output<StepIconName>();

  protected readonly names = STEP_ICON_NAMES;
  protected readonly labels = STEP_ICON_LABELS;
  protected readonly panelId = `step-icon-panel-${nextId++}`;
  protected readonly open = signal(false);
  /** Icône affichée, résolue comme dans le runner : la donnée n'est jamais réécrite sans choix. */
  protected readonly current = computed(() => resolveStepIcon(this.icon()));
  protected readonly triggerLabel = computed(() => `Icône de l'étape : ${STEP_ICON_LABELS[this.current()]}`);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    // Le focus va sur l'icône courante, pour parcourir la palette au clavier sans détour.
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLButtonElement>('.icon-option[aria-pressed="true"]')?.focus(),
      { injector: this.injector }
    );
  }

  protected choose(name: StepIconName): void {
    this.pick.emit(name);
    this.close();
  }

  /** Ferme la palette sans rien modifier et rend le focus au bouton. */
  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }

  /** Un clic ailleurs referme la palette, sans voler le focus de ce qui a été cliqué. */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && event.target instanceof Node && !this.host.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }
}
