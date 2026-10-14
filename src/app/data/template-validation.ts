import { ChecklistTemplate } from '../models/checklist.model';

/**
 * Validation structurelle minimale d'un template (déjà normalisé).
 * Pure : partagée par l'import de templates et par l'import de sessions (copie figée).
 */
export function validateTemplateStructure(template: ChecklistTemplate): void {
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
