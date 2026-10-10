import { Injectable, inject, signal } from '@angular/core';
import { AppDatabaseService } from './app-database.service';
import { EvidenceRecord } from '../models/checklist.model';

@Injectable({
  providedIn: 'root'
})
export class EvidenceService {
  private db = inject(AppDatabaseService);

  // Cache des compteurs de preuves par itemId
  readonly evidenceCounts = signal<Record<string, number>>({});

  async loadEvidenceCounts(sessionId = 'current'): Promise<void> {
    const list = await this.db.evidences.where('sessionId').equals(sessionId).toArray();
    const counts: Record<string, number> = {};
    for (const ev of list) {
      counts[ev.itemId] = (counts[ev.itemId] || 0) + 1;
    }
    this.evidenceCounts.set(counts);
  }

  async getEvidencesForItem(itemId: string, sessionId = 'current'): Promise<EvidenceRecord[]> {
    return this.db.evidences
      .where('sessionId')
      .equals(sessionId)
      .filter(e => e.itemId === itemId)
      .toArray();
  }

  async addEvidence(
    itemId: string,
    file: File | Blob,
    filename: string,
    type: 'image' | 'file' | 'log' = 'file',
    sessionId = 'current'
  ): Promise<EvidenceRecord> {
    const record: EvidenceRecord = {
      id: `${itemId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId,
      itemId,
      name: filename,
      type,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      blob: file,
      createdAt: new Date().toISOString()
    };

    await this.db.evidences.put(record);
    await this.loadEvidenceCounts(sessionId);
    return record;
  }

  async deleteEvidence(id: string, sessionId = 'current'): Promise<void> {
    await this.db.evidences.delete(id);
    await this.loadEvidenceCounts(sessionId);
  }

  createBlobUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  revokeBlobUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}
