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

  /**
   * Charge la bibliothèque et y ajoute, une seule fois chacun, les modèles livrés avec l'application.
   * Un modèle livré supprimé par l'utilisateur ne réapparaît pas ; un modèle déjà présent n'est jamais écrasé.
   */
  async initTemplates(): Promise<void> {
    let dbTemplates = await this.db.templates.toArray();
    const existingIds = new Set(dbTemplates.map(t => t.id));
    const seeded = readSeededIds(dbTemplates.length > 0);

    for (const bundled of BUNDLED_TEMPLATES) {
      if (seeded.has(bundled.id)) continue;
      if (!existingIds.has(bundled.id)) {
        try {
          // Normalisé au cas où il serait à l'ancien format, puis validé comme un import.
          const template = normalizeTemplate(await firstValueFrom(this.http.get<unknown>(bundled.path)));
          validateTemplateStructure(template);
          await this.db.templates.put(template);
          dbTemplates = [...dbTemplates, template];
        } catch (err) {
          // Non mémorisé : nouvel essai au prochain démarrage.
          console.warn(`Impossible de charger ${bundled.path}.`, err);
          continue;
        }
      }
      seeded.add(bundled.id);
    }

    writeSeededIds(seeded);
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
    // La normalisation retire notamment le motif N/A obligatoire, option supprimée (ADR 0007).
    const toSave: ChecklistTemplate = { ...normalizeTemplate(template), updatedAt: new Date().toISOString() };
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

/** Modèles livrés avec l'application (fichiers de `src/assets/templates`). */
export const BUNDLED_TEMPLATES: readonly { id: string; path: string }[] = [
  { id: 'delivery-audit-standard', path: 'assets/templates/delivery-audit.json' },
  { id: 'release-flow-example', path: 'assets/templates/release-flow.json' }
];

/** Clé `localStorage` mémorisant les identifiants des modèles livrés déjà ajoutés. */
export const SEEDED_TEMPLATES_KEY = 'bundled_templates_seeded';

/** Modèles livrés ajoutés avant l'introduction de la clé, quand la bibliothèque n'était remplie qu'à vide. */
const SEEDED_BEFORE_KEY = ['delivery-audit-standard'];

/**
 * Identifiants des modèles livrés déjà ajoutés. Sans mémoire (premier démarrage de cette version,
 * stockage vidé ou indisponible), une bibliothèque existante est réputée contenir déjà l'audit de
 * livraison : sans cette précaution, un utilisateur qui l'avait supprimé le verrait réapparaître.
 */
function readSeededIds(libraryExists: boolean): Set<string> {
  try {
    const raw = localStorage.getItem(SEEDED_TEMPLATES_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((id): id is string => typeof id === 'string'));
      }
    }
  } catch {
    // Stockage indisponible ou valeur corrompue : on retombe sur la règle par défaut.
  }
  return new Set(libraryExists ? SEEDED_BEFORE_KEY : []);
}

function writeSeededIds(ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(SEEDED_TEMPLATES_KEY, JSON.stringify([...ids]));
  } catch {
    // Stockage indisponible : les modèles livrés seront réévalués au prochain démarrage.
  }
}

/** 6 caractères [a-z0-9] : suffixe lisible pour l'identifiant d'une copie. */
function randomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 6);
}
