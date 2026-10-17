import { Component, ElementRef, HostListener, OnDestroy, afterNextRender, output, viewChild } from '@angular/core';
import { LucideKeyboard, LucideX } from '@lucide/angular';

export interface ShortcutHelpEntry {
  keys: string[];
  description: string;
}

export const RUNNER_SHORTCUTS: readonly ShortcutHelpEntry[] = [
  { keys: ['↑', '↓'], description: 'Contrôle précédent ou suivant' },
  { keys: ['Espace'], description: 'Geste principal : cocher, ou mettre OK' },
  { keys: ['K'], description: 'Mettre en KO (ouvre la note, obligatoire)' },
  { keys: ['N'], description: 'Non applicable, ou retirer le N/A' },
  { keys: ['A'], description: 'Ouvrir ou fermer le tiroir (note, preuves, N/A)' },
  { keys: ['Entrée'], description: 'Enregistrer la note' },
  { keys: ['Échap'], description: 'Annuler : rétablir la note, fermer la demande de preuve ou le tiroir' },
  { keys: ['?'], description: 'Afficher cette aide' }
];

/** Fenêtre modale listant les raccourcis du runner : focus piégé, Échap pour fermer, focus restitué. */
@Component({
  selector: 'app-shortcuts-help',
  standalone: true,
  imports: [LucideKeyboard, LucideX],
  templateUrl: './shortcuts-help.component.html',
  styleUrl: './shortcuts-help.component.css'
})
export class ShortcutsHelpComponent implements OnDestroy {
  readonly close = output<void>();

  protected readonly shortcuts = RUNNER_SHORTCUTS;
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly previousFocus = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

  constructor() {
    afterNextRender(() => this.focusable()[0]?.focus());
  }

  ngOnDestroy(): void {
    this.previousFocus?.focus?.();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close.emit();
    } else if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }

  private trapFocus(event: KeyboardEvent): void {
    const elements = this.focusable();
    if (elements.length === 0) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    const inside = this.dialog()?.nativeElement.contains(document.activeElement) ?? false;
    if (event.shiftKey && (document.activeElement === first || !inside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusable(): HTMLElement[] {
    const root = this.dialog()?.nativeElement;
    return root ? Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]')) : [];
  }
}
