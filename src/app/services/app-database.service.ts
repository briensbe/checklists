import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';
import { ChecklistTemplate, ChecklistSession, EvidenceRecord } from '../models/checklist.model';
import { migrateSessionV3, normalizeTemplate } from '../data/migrations';

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

    // v3 : migration unique des formats (voir ADR 0003 et src/app/data/migrations.ts).
    // Templates normalisés (visibleIf, tons, updatedAt), puis chaque session reçoit
    // sa copie figée, son statut et son historique de clôtures.
    // Aucun changement d'index : seul le contenu des enregistrements évolue.
    this.version(3).stores({
      templates: 'id, name, version',
      sessions: 'id, templateId, title, updatedAt, createdAt',
      evidences: 'id, sessionId, itemId, createdAt'
    }).upgrade(async tx => {
      const now = new Date().toISOString();
      const templatesTable = tx.table<unknown, string>('templates');
      const sessionsTable = tx.table<unknown, string>('sessions');

      const templates = (await templatesTable.toArray()).map(raw => normalizeTemplate(raw, now));
      await templatesTable.bulkPut(templates);

      const templatesById = new Map(templates.map(t => [t.id, t]));
      const sessions = (await sessionsTable.toArray()).map(raw => migrateSessionV3(raw, templatesById, now));
      await sessionsTable.bulkPut(sessions);
    });
  }
}
