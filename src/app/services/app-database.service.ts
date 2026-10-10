import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';
import { ChecklistTemplate, ChecklistSession, EvidenceRecord } from '../models/checklist.model';

@Injectable({
  providedIn: 'root'
})
export class AppDatabaseService extends Dexie {
  templates!: Table<ChecklistTemplate, string>;
  sessions!: Table<ChecklistSession, string>;
  evidences!: Table<EvidenceRecord, string>;

  constructor() {
    super('ChecklistDatabase');

    this.version(1).stores({
      templates: 'id, name, version',
      sessions: 'id, templateId, updatedAt',
      evidences: 'id, sessionId, itemId, createdAt'
    });

    this.version(2).stores({
      templates: 'id, name, version',
      sessions: 'id, templateId, title, updatedAt, createdAt',
      evidences: 'id, sessionId, itemId, createdAt'
    }).upgrade(async tx => {
      const sessions = await tx.table('sessions').toArray();
      for (const s of sessions) {
        if (!s.title) {
          s.title = 'Checklist sans titre';
        }
        if (s.id === 'current') {
          // Migrer l'ancienne session unique vers un ID UUID
          const newId = crypto.randomUUID();
          s.id = newId;
          await tx.table('sessions').delete('current');
          await tx.table('sessions').put(s);

          // Réassigner les preuves associées
          const evidences = await tx.table('evidences').where('sessionId').equals('current').toArray();
          for (const ev of evidences) {
            ev.sessionId = newId;
            await tx.table('evidences').put(ev);
          }
        } else {
          await tx.table('sessions').put(s);
        }
      }
    });
  }
}
