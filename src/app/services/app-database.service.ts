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
  }
}
