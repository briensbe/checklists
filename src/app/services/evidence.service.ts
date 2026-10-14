import { Injectable, inject, signal } from '@angular/core';
import { AppDatabaseService } from './app-database.service';
import { EvidenceRecord } from '../models/checklist.model';

/** Taille maximale d'une preuve (50 Mo). */
export const MAX_EVIDENCE_SIZE = 50 * 1024 * 1024;

export type EvidenceType = EvidenceRecord['type'];

export function evidenceTypeOf(file: File): EvidenceType {
  if (file.type.startsWith('image/')) return 'image';
  return file.name.endsWith('.log') ? 'log' : 'file';
}

@Injectable({
  providedIn: 'root'
})
export class EvidenceService {
  private db = inject(AppDatabaseService);

  // Cache des compteurs de preuves par itemId
  readonly evidenceCounts = signal<Record<string, number>>({});

  async loadEvidenceCounts(sessionId: string): Promise<void> {
    const list = await this.db.evidences.where('sessionId').equals(sessionId).toArray();
    const counts: Record<string, number> = {};
    for (const ev of list) {
      counts[ev.itemId] = (counts[ev.itemId] || 0) + 1;
    }
    this.evidenceCounts.set(counts);
  }

  async getEvidencesForItem(itemId: string, sessionId: string): Promise<EvidenceRecord[]> {
    return this.db.evidences
      .where('sessionId')
      .equals(sessionId)
      .filter(e => e.itemId === itemId)
      .toArray();
  }

  async addEvidence(
    sessionId: string,
    itemId: string,
    file: File | Blob,
    filename: string,
    type: EvidenceType = 'file'
  ): Promise<EvidenceRecord> {
    if (file.size > MAX_EVIDENCE_SIZE) {
      throw new Error(`Le fichier « ${filename} » dépasse la limite de 50 Mo.`);
    }
    await this.assertEditable(sessionId);

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

  async deleteEvidence(sessionId: string, id: string): Promise<void> {
    await this.assertEditable(sessionId);
    await this.db.evidences.delete(id);
    await this.loadEvidenceCounts(sessionId);
  }

  /** Une session terminée est en lecture seule : ses preuves ne peuvent plus changer. */
  private async assertEditable(sessionId: string): Promise<void> {
    const session = await this.db.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session introuvable.');
    }
    if (session.status === 'completed') {
      throw new Error('Session terminée : les preuves ne peuvent plus être modifiées.');
    }
  }
}
