import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ChecklistTemplate, ImportConflictMode } from '../models/checklist.model';
import { AppDatabaseService } from './app-database.service';
import { normalizeTemplate } from '../data/migrations';
import { validateTemplateStructure } from '../data/template-validation';
import { withImportSuffix } from '../domain/session-exchange';

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

  /** Lit, normalise (anciens formats) et valide un fichier de template, sans rien écrire. */
  parseTemplateFile(jsonContent: string): ChecklistTemplate {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      throw new Error('Le fichier n’est pas un JSON valide.');
    }
    const template = normalizeTemplate(parsed);
    validateTemplateStructure(template);
    return template;
  }

  /**
   * Enregistre un template importé selon le mode décidé par l'interface :
   * - `new` / `replace` : même identifiant (un remplacement écrase l'existant) ;
   * - `copy` : nouvel identifiant et nom suffixé « (import) », l'existant reste intact.
   * L'import marque toujours le template comme modifié maintenant : les sessions
   * issues d'un template remplacé verront ainsi le badge « Modèle mis à jour ».
   */
  async importTemplate(template: ChecklistTemplate, mode: ImportConflictMode = 'new'): Promise<ChecklistTemplate> {
    const now = new Date().toISOString();
    const toSave: ChecklistTemplate =
      mode === 'copy'
        ? { ...template, id: `${template.id}-import-${randomSuffix()}`, name: withImportSuffix(template.name), updatedAt: now }
        : { ...template, updatedAt: now };
    validateTemplateStructure(toSave);

    await this.db.templates.put(toSave);
    await this.refresh();
    return toSave;
  }

  async saveTemplate(template: ChecklistTemplate): Promise<ChecklistTemplate> {
    const toSave: ChecklistTemplate = { ...template, updatedAt: new Date().toISOString() };
    validateTemplateStructure(toSave);
    await this.db.templates.put(toSave);
    await this.refresh();
    return toSave;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.db.templates.delete(templateId);
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    this.availableTemplates.set(await this.db.templates.toArray());
  }
}

/** 6 caractères [a-z0-9] : suffixe lisible pour l'identifiant d'une copie. */
function randomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 6);
}
