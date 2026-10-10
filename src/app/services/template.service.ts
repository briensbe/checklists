import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChecklistTemplate } from '../models/checklist.model';
import { AppDatabaseService } from './app-database.service';

@Injectable({
  providedIn: 'root'
})
export class TemplateService {
  private http = inject(HttpClient);
  private db = inject(AppDatabaseService);

  readonly availableTemplates = signal<ChecklistTemplate[]>([]);
  readonly activeTemplate = signal<ChecklistTemplate | null>(null);

  async initTemplates(): Promise<void> {
    // 1. Charger depuis la BDD IndexedDB
    let dbTemplates = await this.db.templates.toArray();

    // 2. Si la BDD est vide, importer le modèle par défaut
    if (dbTemplates.length === 0) {
      try {
        const defaultTemplate = await this.http.get<ChecklistTemplate>('assets/templates/delivery-audit.json').toPromise();
        if (defaultTemplate) {
          await this.db.templates.put(defaultTemplate);
          dbTemplates = [defaultTemplate];
        }
      } catch (err) {
        console.warn('Impossible de charger assets/templates/delivery-audit.json, utilisation du fallback interne.', err);
      }
    }

    this.availableTemplates.set(dbTemplates);
    if (dbTemplates.length > 0 && !this.activeTemplate()) {
      this.activeTemplate.set(dbTemplates[0]);
    }
  }

  selectTemplate(templateId: string): void {
    const found = this.availableTemplates().find(t => t.id === templateId);
    if (found) {
      this.activeTemplate.set(found);
    }
  }

  async importTemplate(jsonContent: string): Promise<ChecklistTemplate> {
    const parsed = JSON.parse(jsonContent) as ChecklistTemplate;
    this.validateTemplate(parsed);

    await this.db.templates.put(parsed);
    const updated = await this.db.templates.toArray();
    this.availableTemplates.set(updated);
    this.activeTemplate.set(parsed);
    return parsed;
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
}
