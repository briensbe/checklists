import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EvidenceRecord } from '../../models/checklist.model';

@Component({
  selector: 'app-evidence-attachment',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './evidence-attachment.component.html',
  styleUrl: './evidence-attachment.component.css'
})
export class EvidenceAttachmentComponent {
  readonly itemId = input.required<string>();
  readonly itemLabel = input.required<string>();
  readonly evidences = input<EvidenceRecord[]>([]);

  readonly close = output<void>();
  readonly fileAdded = output<{ file: File | Blob; filename: string; type: 'image' | 'file' | 'log' }>();
  readonly deleteEvidence = output<string>();

  private urlCache = new Map<string, string>();

  getBlobUrl(evidence: EvidenceRecord): string {
    if (!this.urlCache.has(evidence.id)) {
      this.urlCache.set(evidence.id, URL.createObjectURL(evidence.blob));
    }
    return this.urlCache.get(evidence.id)!;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          this.fileAdded.emit({
            file,
            filename: `capture_${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
            type: 'image'
          });
          return;
        }
      }
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      const type = file.type.startsWith('image/') ? 'image' : file.name.endsWith('.log') ? 'log' : 'file';
      this.fileAdded.emit({ file, filename: file.name, type });
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const type = file.type.startsWith('image/') ? 'image' : file.name.endsWith('.log') ? 'log' : 'file';
      this.fileAdded.emit({ file, filename: file.name, type });
      input.value = '';
    }
  }
}
