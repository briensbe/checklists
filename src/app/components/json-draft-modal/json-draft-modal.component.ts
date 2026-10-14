import { Component, HostListener, computed, input, model, output, signal } from '@angular/core';
import { formatBytes } from '../../domain/session-exchange';

@Component({
  selector: 'app-json-draft-modal',
  standalone: true,
  imports: [],
  templateUrl: './json-draft-modal.component.html',
  styleUrl: './json-draft-modal.component.css'
})
export class JsonDraftModalComponent {
  readonly jsonContent = input.required<string>();
  readonly filename = input<string>('session.json');
  readonly evidenceCount = input<number>(0);
  readonly evidenceTotalSize = input<number>(0);
  /** Liaison bidirectionnelle : le parent recalcule l'aperçu quand la case change. */
  readonly includeEvidence = model<boolean>(false);
  readonly exporting = input<boolean>(false);

  readonly close = output<void>();
  readonly exportFile = output<{ includeEvidence: boolean }>();

  readonly evidenceSizeLabel = computed<string>(() => formatBytes(this.evidenceTotalSize()));

  readonly isCopied = signal<boolean>(false);

  readonly lineCount = computed<number>(() => {
    const content = this.jsonContent();
    if (!content) return 0;
    return content.split('\n').length;
  });

  readonly formattedSize = computed<string>(() => {
    const content = this.jsonContent();
    return formatBytes(new Blob([content]).size);
  });

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  async copyToClipboard(): Promise<void> {
    const text = this.jsonContent();
    let copied = false;

    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (err) {
        console.warn('Clipboard API error, tentative avec fallback :', err);
      }
    }

    if (!copied && typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        if (typeof document.execCommand === 'function') {
          copied = document.execCommand('copy');
        }
        textarea.remove();
      } catch (err) {
        console.error('Erreur lors de la copie dans le presse-papier :', err);
      }
    }

    if (copied) {
      this.isCopied.set(true);
      setTimeout(() => {
        this.isCopied.set(false);
      }, 2500);
    }
  }

  onIncludeEvidenceChange(event: Event): void {
    this.includeEvidence.set((event.target as HTMLInputElement).checked);
  }

  onExportFile(): void {
    this.exportFile.emit({ includeEvidence: this.includeEvidence() });
  }

  onClose(): void {
    this.close.emit();
  }
}
