import { Component, HostListener, OnDestroy, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EvidenceRecord } from '../../models/checklist.model';
import { EvidenceType, MAX_EVIDENCE_SIZE, evidenceTypeOf } from '../../services/evidence.service';
import { ToastService } from '../../services/toast.service';

export interface EvidenceFileEvent {
  file: File | Blob;
  filename: string;
  type: EvidenceType;
}

@Component({
  selector: 'app-evidence-attachment',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './evidence-attachment.component.html',
  styleUrl: './evidence-attachment.component.css'
})
export class EvidenceAttachmentComponent implements OnDestroy {
  private toastService = inject(ToastService);

  readonly itemId = input.required<string>();
  readonly itemLabel = input.required<string>();
  readonly evidences = input<EvidenceRecord[]>([]);
  readonly readonly = input<boolean>(false);

  readonly close = output<void>();
  readonly fileAdded = output<EvidenceFileEvent>();
  readonly deleteEvidence = output<string>();

  // URL blob créées pour l'affichage : chacune réserve de la mémoire tant qu'elle n'est pas révoquée.
  private urlCache = new Map<string, string>();

  getBlobUrl(evidence: EvidenceRecord): string {
    let url = this.urlCache.get(evidence.id);
    if (!url) {
      url = URL.createObjectURL(evidence.blob);
      this.urlCache.set(evidence.id, url);
    }
    return url;
  }

  ngOnDestroy(): void {
    for (const url of this.urlCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.urlCache.clear();
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  onPaste(event: ClipboardEvent): void {
    if (this.readonly()) return;
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          this.emitFiles([
            new File([file], `capture_${new Date().toISOString().replace(/[:.]/g, '-')}.png`, { type: file.type })
          ]);
          return;
        }
      }
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (this.readonly()) return;
    if (event.dataTransfer?.files) {
      this.emitFiles(Array.from(event.dataTransfer.files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onFileSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    if (inputEl.files) {
      this.emitFiles(Array.from(inputEl.files));
      inputEl.value = '';
    }
  }

  onDelete(evidence: EvidenceRecord): void {
    const url = this.urlCache.get(evidence.id);
    if (url) {
      URL.revokeObjectURL(url);
      this.urlCache.delete(evidence.id);
    }
    this.deleteEvidence.emit(evidence.id);
  }

  /** Émet chaque fichier valide ; signale en une fois ceux qui dépassent 50 Mo par un toast d'avertissement. */
  private emitFiles(files: File[]): void {
    const rejected: string[] = [];
    for (const file of files) {
      if (file.size > MAX_EVIDENCE_SIZE) {
        rejected.push(file.name);
        continue;
      }
      this.fileAdded.emit({ file, filename: file.name, type: evidenceTypeOf(file) });
    }
    if (rejected.length > 0) {
      this.toastService.warning(`Fichier(s) refusé(s), limite de 50 Mo dépassée :\n- ${rejected.join('\n- ')}`);
    }
  }
}
