import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ChecklistTemplate } from '../models/checklist.model';
import { AppDatabaseService } from './app-database.service';
import { normalizeTemplate } from '../data/migrations';

/**
 * Bibliothèque de templates (liste, constructeur, import/export).
 * Les sessions n'en dépendent plus pour leur structure : elles lisent leur copie figée.
 */
@Injectable({
  providedIn: 'root'
})
export class TemplateService {
  private http = inject(HttpClient);
  private db = inject(AppDatabaseService);

  readonly availableTemplates = signal<ChecklistTemplate[]>([]);

  async initTemplates(): Promise<void> {
    // 1. Charger depuis la BDD IndexedDB
    let dbTemplates = await this.db.templates.toArray();

    // 2. Si la BDD est vide, importer le modèle par défaut (normalisé au cas où il serait à l'ancien format)
    if (dbTemplates.length === 0) {
      try {
        const raw = await firstValueFrom(this.http.get<unknown>('assets/templates/delivery-audit.json'));
        const defaultTemplate = normalizeTemplate(raw);
        await this.db.templates.put(defaultTemplate);
        dbTemplates = [defaultTemplate];
      } catch (err) {
        console.warn('Impossible de charger assets/templates/delivery-audit.json.', err);
      }
    }

    this.availableTemplates.set(dbTemplates);
  }

  findTemplate(templateId: string): ChecklistTemplate | undefined {
    return this.availableTemplates().find(t => t.id === templateId);
  }

  async importTemplate(jsonContent: string): Promise<ChecklistTemplate> {
    const parsed: unknown = JSON.parse(jsonContent);
    // L'import marque toujours le template comme modifié maintenant : les sessions
    // qui en sont issues verront ainsi le badge « Modèle mis à jour ».
    const template = { ...normalizeTemplate(parsed), updatedAt: new Date().toISOString() };
    this.validateTemplate(template);

    await this.db.templates.put(template);
    await this.refresh();
    return template;
  }

  async saveTemplate(template: ChecklistTemplate): Promise<ChecklistTemplate> {
    const toSave: ChecklistTemplate = { ...template, updatedAt: new Date().toISOString() };
    this.validateTemplate(toSave);
    await this.db.templates.put(toSave);
    await this.refresh();
    return toSave;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.db.templates.delete(templateId);
    await this.refresh();
  }

  validateTemplate(template: ChecklistTemplate): void {
    if (!template.id || !template.name || !Array.isArray(template.sections)) {
      throw new Error('Format de template invalide : un identifiant, un nom et des sections sont obligatoires.');
    }
    for (const section of template.sections) {
      if (!section.id || !section.title || !Array.isArray(section.items)) {
        throw new Error(`Section invalide dans le template (${section?.title || 'sans titre'}).`);
      }
      for (const item of section.items) {
        if (!item.id || !item.label) {
          throw new Error(`Contrôle invalide dans la section ${section.title}.`);
        }
      }
    }
  }

  private async refresh(): Promise<void> {
    this.availableTemplates.set(await this.db.templates.toArray());
  }
}
