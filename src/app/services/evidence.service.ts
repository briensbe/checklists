import { Injectable, computed, inject, signal } from '@angular/core';
import { AppDatabaseService } from './app-database.service';
import { EvidenceRecord, MAX_EVIDENCE_SIZE } from '../models/checklist.model';
import { EvidenceSummary } from '../domain/quick-check';

export { MAX_EVIDENCE_SIZE };

export type EvidenceType = EvidenceRecord['type'];

/** Identifiant unique d'une preuve (aussi utilisé pour régénérer les identifiants à l'import). */
export function newEvidenceId(itemId: string): string {
  return `${itemId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function evidenceTypeOf(file: File): EvidenceType {
  if (file.type.startsWith('image/')) return 'image';
  return file.name.endsWith('.log') ? 'log' : 'file';
}

@Injectable({
  providedIn: 'root'
})
export class EvidenceService {
  private db = inject(AppDatabaseService);

  // Métadonnées des preuves de la session chargée (sans les Blob), pour les compteurs et la preuve exigée.
  private readonly metas = signal<{ id: string; itemId: string; type: EvidenceType }[]>([]);

  /** Preuves masquées en attendant l'expiration de leur toast d'annulation (ADR 0005). */
  readonly pendingDeletionIds = signal<ReadonlySet<string>>(new Set());

  /** Résumé des preuves par itemId, hors preuves en attente de suppression. */
  readonly summaries = computed<Record<string, EvidenceSummary>>(() => {
    const hidden = this.pendingDeletionIds();
    const result: Record<string, EvidenceSummary> = {};
    for (const meta of this.metas()) {
      if (hidden.has(meta.id)) continue;
      const summary = (result[meta.itemId] ??= { total: 0, images: 0 });
      summary.total++;
      if (meta.type === 'image') summary.images++;
    }
    return result;
  });

  /** Nombre de preuves par itemId, hors preuves en attente de suppression. */
  readonly evidenceCounts = computed<Record<string, number>>(() =>
    Object.fromEntries(Object.entries(this.summaries()).map(([itemId, s]) => [itemId, s.total]))
  );

  async loadEvidenceCounts(sessionId: string): Promise<void> {
    const list = await this.db.evidences.where('sessionId').equals(sessionId).toArray();
    this.metas.set(list.map(e => ({ id: e.id, itemId: e.itemId, type: e.type })));
  }

  /** Masque une preuve tout de suite ; la suppression réelle attend `commitDeletion`. */
  hideForDeletion(id: string): void {
    this.pendingDeletionIds.update(ids => new Set([...ids, id]));
  }

  /** Annulation : la preuve, toujours en base, réapparaît. */
  restore(id: string): void {
    this.pendingDeletionIds.update(ids => new Set([...ids].filter(other => other !== id)));
  }

  /** Suppression définitive d'une preuve masquée (expiration du toast, sortie de page, clôture). */
  async commitDeletion(sessionId: string, id: string): Promise<void> {
    try {
      await this.deleteEvidence(sessionId, id);
    } finally {
      this.restore(id);
    }
  }

  async getEvidencesForItem(itemId: string, sessionId: string): Promise<EvidenceRecord[]> {
    return this.db.evidences
      .where('sessionId')
      .equals(sessionId)
      .filter(e => e.itemId === itemId)
      .toArray();
  }

  /** Toutes les preuves d'une session (export du fichier d'échange, annexe PDF). */
  async getSessionEvidences(sessionId: string): Promise<EvidenceRecord[]> {
    return this.db.evidences.where('sessionId').equals(sessionId).toArray();
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
      id: newEvidenceId(itemId),
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
