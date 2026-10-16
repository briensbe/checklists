import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject
} from '@angular/core';
import { DialogChoiceOption, DialogService, DialogTone } from '../../services/dialog.service';

@Component({
  selector: 'app-dialog-modal',
  standalone: true,
  imports: [],
  templateUrl: './dialog-modal.component.html',
  styleUrl: './dialog-modal.component.css'
})
export class DialogModalComponent {
  readonly dialogService = inject(DialogService);
  readonly dialog = this.dialogService.activeDialog;

  @ViewChild('modalDialog') modalDialogRef?: ElementRef<HTMLElement>;

  private previousActiveElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const current = this.dialog();
      if (current) {
        if (typeof document !== 'undefined') {
          this.previousActiveElement = document.activeElement as HTMLElement | null;
        }
        // Donner le focus au dialogue après rendu
        setTimeout(() => {
          this.focusInitialElement();
        }, 0);
      } else {
        if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
          this.previousActiveElement.focus();
          this.previousActiveElement = null;
        }
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.dialog()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.onCancel();
      return;
    }

    if (event.key === 'Tab') {
      this.handleTabKey(event);
    }
  }

  private handleTabKey(event: KeyboardEvent): void {
    if (!this.modalDialogRef?.nativeElement) return;

    const focusableElements = this.getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement || !this.modalDialogRef.nativeElement.contains(document.activeElement)) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement || !this.modalDialogRef.nativeElement.contains(document.activeElement)) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.modalDialogRef?.nativeElement) return [];
    const selector = 'button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';
    return Array.from(this.modalDialogRef.nativeElement.querySelectorAll<HTMLElement>(selector));
  }

  private focusInitialElement(): void {
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      // Si un élément a la classe 'btn-primary' ou 'btn-default', on lui donne la priorité
      const defaultBtn = focusable.find(el => el.classList.contains('btn-primary') || el.classList.contains('btn-danger'));
      (defaultBtn ?? focusable[0]).focus();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }

  onConfirm(): void {
    const current = this.dialog();
    if (current && current.type === 'confirm') {
      current.resolve(true);
    }
  }

  onCancel(): void {
    this.dialogService.close();
  }

  onSelectChoice(choice: DialogChoiceOption<any>): void {
    const current = this.dialog();
    if (current && current.type === 'choice') {
      current.resolve(choice.id);
    }
  }

  getButtonToneClass(tone?: DialogTone): string {
    switch (tone) {
      case 'danger':
        return 'btn-danger';
      case 'warning':
        return 'btn-warning';
      case 'info':
        return 'btn-info';
      case 'secondary':
        return 'btn-secondary';
      case 'primary':
      default:
        return 'btn-primary';
    }
  }
}
