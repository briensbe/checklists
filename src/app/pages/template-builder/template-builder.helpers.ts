import {
  ChecklistItemTemplate,
  ChecklistSectionTemplate,
  ChecklistTemplate,
  ContextFieldSchema,
  Criticality,
  EvidenceKind
} from '../../models/checklist.model';
import { validateFlow } from '../../domain/flow-rules';

const CRITICALITY_CYCLE: Record<Criticality, Criticality> = {
  blocking: 'important',
  important: 'optional',
  optional: 'blocking'
};

/** Criticité suivante au clic sur la pastille : bloquant → important → optionnel → bloquant. */
export function nextCriticality(current: Criticality): Criticality {
  return CRITICALITY_CYCLE[current];
}

// --- Mises à jour immuables (ADR 0006, design D1 de builder-flow-editor) -----------------
// Chaque helper recrée uniquement le chemin modifié (modèle → section → item) : les autres
// références sont conservées, et tout `computed` qui lit le modèle (modifications non
// enregistrées, aperçu du graphe) se recalcule.

/** Copie du modèle avec les propriétés de premier niveau remplacées (nom, version, description…). */
export function updateTemplate(template: ChecklistTemplate, patch: Partial<ChecklistTemplate>): ChecklistTemplate {
  return { ...template, ...patch };
}

/** Copie immuable du modèle où seule la section `sectionId` est recréée. */
export function updateSection(
  template: ChecklistTemplate,
  sectionId: string,
  change: (section: ChecklistSectionTemplate) => ChecklistSectionTemplate
): ChecklistTemplate {
  return {
    ...template,
    sections: template.sections.map(section => (section.id === sectionId ? change(section) : section))
  };
}

/** Copie immuable du modèle où seul le champ de contexte d'index `index` est recréé. */
export function updateContextField(
  template: ChecklistTemplate,
  index: number,
  change: (field: ContextFieldSchema) => ContextFieldSchema
): ChecklistTemplate {
  const schema = template.contextSchema ?? [];
  if (index < 0 || index >= schema.length) return template;
  return { ...template, contextSchema: schema.map((field, i) => (i === index ? change(field) : field)) };
}

/** Ajoute un item à la fin de la section. */
export function addItem(template: ChecklistTemplate, sectionId: string, item: ChecklistItemTemplate): ChecklistTemplate {
  return updateSection(template, sectionId, section => ({ ...section, items: [...section.items, item] }));
}

/** Insère un item à la position `index` de la section (bornée à la longueur de la liste). */
export function insertItemAt(
  template: ChecklistTemplate,
  sectionId: string,
  index: number,
  item: ChecklistItemTemplate
): ChecklistTemplate {
  return updateSection(template, sectionId, section => {
    const items = [...section.items];
    items.splice(Math.max(0, Math.min(index, items.length)), 0, item);
    return { ...section, items };
  });
}

/** Retire l'item de position `index` de la section (index hors bornes : modèle inchangé). */
export function removeItemAt(template: ChecklistTemplate, sectionId: string, index: number): ChecklistTemplate {
  const section = template.sections.find(s => s.id === sectionId);
  if (!section || index < 0 || index >= section.items.length) return template;
  return updateSection(template, sectionId, s => ({ ...s, items: s.items.filter((_, i) => i !== index) }));
}

/** Déplace un item à l'intérieur de sa section. */
export function moveItemWithin(template: ChecklistTemplate, sectionId: string, fromIndex: number, toIndex: number): ChecklistTemplate {
  return updateSection(template, sectionId, section => ({ ...section, items: reorderArray(section.items, fromIndex, toIndex) }));
}

/** Déplace un item d'une section à une autre (même section : déplacement interne). */
export function moveItemBetween(
  template: ChecklistTemplate,
  fromSectionId: string,
  toSectionId: string,
  fromIndex: number,
  toIndex: number
): ChecklistTemplate {
  if (fromSectionId === toSectionId) return moveItemWithin(template, fromSectionId, fromIndex, toIndex);
  const source = template.sections.find(s => s.id === fromSectionId);
  const target = template.sections.find(s => s.id === toSectionId);
  if (!source || !target) return template;
  const moved = transferItemBetweenLists(source.items, target.items, fromIndex, toIndex);
  return {
    ...template,
    sections: template.sections.map(s =>
      s.id === fromSectionId ? { ...s, items: moved.source } : s.id === toSectionId ? { ...s, items: moved.target } : s
    )
  };
}

/** Copie immuable du modèle où seul l'item `itemId` (et sa section) est recréé. */
export function updateItem(
  template: ChecklistTemplate,
  itemId: string,
  change: (item: ChecklistItemTemplate) => ChecklistItemTemplate
): ChecklistTemplate {
  return {
    ...template,
    sections: template.sections.map(section =>
      section.items.some(i => i.id === itemId)
        ? { ...section, items: section.items.map(i => (i.id === itemId ? change(i) : i)) }
        : section
    )
  };
}

/** Change la criticité d'un item ; la valeur est toujours écrite explicitement, `optional` compris. */
export function setItemCriticality(template: ChecklistTemplate, itemId: string, criticality: Criticality): ChecklistTemplate {
  return updateItem(template, itemId, item => ({ ...item, criticality }));
}

/**
 * Fixe la preuve exigée d'un item et sa consigne. `null` (« aucune ») retire `evidenceRequired`
 * et `evidenceHint` du modèle ; une consigne vide est retirée.
 */
export function setItemEvidence(
  template: ChecklistTemplate,
  itemId: string,
  kind: EvidenceKind | null,
  hint?: string
): ChecklistTemplate {
  return updateItem(template, itemId, item => {
    const { evidenceRequired: _kind, evidenceHint: _hint, ...rest } = item;
    if (!kind) return rest;
    const trimmed = hint?.trim();
    return trimmed ? { ...rest, evidenceRequired: kind, evidenceHint: hint } : { ...rest, evidenceRequired: kind };
  });
}

/**
 * Duplique un item de checklist en lui attribuant un nouvel identifiant unique.
 */
export function duplicateItem(item: ChecklistItemTemplate): ChecklistItemTemplate {
  const clone = structuredClone(item);
  clone.id = `item-${crypto.randomUUID()}`;
  if (clone.customChoices && clone.customChoices.length > 0) {
    clone.customChoices = clone.customChoices.map(c => ({
      ...c,
      id: `opt-${crypto.randomUUID()}`
    }));
  }
  return clone;
}

/**
 * Duplique une section complète et tous ses items en attribuant de nouveaux identifiants uniques.
 * La copie garde les dépendances (`dependsOn`) de l'originale ; aucune section ne dépend de la copie.
 */
export function duplicateSection(section: ChecklistSectionTemplate): ChecklistSectionTemplate {
  const clone = structuredClone(section);
  clone.id = `sec-${crypto.randomUUID()}`;
  clone.title = `${clone.title} (copie)`;
  clone.items = (clone.items || []).map(item => duplicateItem(item));
  return clone;
}

/**
 * Retire une section supprimée des dépendances des autres sections (copie immuable :
 * seules les sections concernées sont recréées).
 */
export function removeSectionFromDependencies(
  sections: readonly ChecklistSectionTemplate[],
  removedId: string
): ChecklistSectionTemplate[] {
  return sections.map(s =>
    s.dependsOn?.includes(removedId) ? { ...s, dependsOn: s.dependsOn.filter(d => d !== removedId) } : s
  );
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valide l'intégrité globale du modèle avant enregistrement :
 * - Nom obligatoire
 * - Au moins une section
 * - Sections avec titre et au moins un item
 * - Unicité globale des identifiants d'items
 * - Enchaînement valide (`validateFlow`)
 */
export function validateTemplateIntegrity(template: ChecklistTemplate): TemplateValidationResult {
  const errors: string[] = [];

  if (!template.name || !template.name.trim()) {
    errors.push('Veuillez renseigner un nom pour le modèle.');
  }

  if (!template.sections || template.sections.length === 0) {
    errors.push('Le modèle doit comporter au moins une section.');
    return { valid: false, errors };
  }

  const seenItemIds = new Set<string>();
  const duplicateItemIds = new Set<string>();

  template.sections.forEach((sec, sIdx) => {
    if (!sec.title || !sec.title.trim()) {
      errors.push(`La section n°${sIdx + 1} doit comporter un titre.`);
    }

    if (!sec.items || sec.items.length === 0) {
      errors.push(`La section « ${sec.title || sIdx + 1} » doit comporter au moins un contrôle.`);
    } else {
      sec.items.forEach((item, iIdx) => {
        if (!item.label || !item.label.trim()) {
          errors.push(`Le contrôle n°${iIdx + 1} de la section « ${sec.title || sIdx + 1} » doit comporter un libellé.`);
        }

        if (item.id) {
          if (seenItemIds.has(item.id)) {
            duplicateItemIds.add(item.id);
          } else {
            seenItemIds.add(item.id);
          }
        }
      });
    }
  });

  if (duplicateItemIds.size > 0) {
    errors.push(`Identifiants de contrôles en doublon détectés : ${Array.from(duplicateItemIds).join(', ')}.`);
  }

  // Même règle d'enchaînement qu'à l'import : dépendances connues, pas de boucle, valeurs autorisées.
  errors.push(...validateFlow(template).map(issue => issue.message));

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface VisibleIfOrphan {
  itemId: string;
  itemLabel: string;
  fieldId: string;
}

/**
 * Détecte les items dont la condition `visibleIf` fait référence à un champ de contexte inexistant.
 */
export function findVisibleIfOrphans(
  template: ChecklistTemplate,
  contextSchema: ContextFieldSchema[]
): VisibleIfOrphan[] {
  const validFieldIds = new Set((contextSchema || []).map(f => f.id));
  const orphans: VisibleIfOrphan[] = [];

  for (const sec of template.sections || []) {
    for (const item of sec.items || []) {
      if (item.visibleIf && item.visibleIf.fieldId) {
        if (!validFieldIds.has(item.visibleIf.fieldId)) {
          orphans.push({
            itemId: item.id,
            itemLabel: item.label,
            fieldId: item.visibleIf.fieldId
          });
        }
      }
    }
  }

  return orphans;
}

/**
 * Déplace un élément d'un index à un autre de manière immuable.
 */
export function reorderArray<T>(list: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
    return [...list];
  }
  const result = [...list];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Transfère un item d'une liste source vers une liste cible de manière immuable.
 */
export function transferItemBetweenLists<T>(
  source: readonly T[],
  target: readonly T[],
  fromIndex: number,
  toIndex: number
): { source: T[]; target: T[] } {
  const newSource = [...source];
  const newTarget = [...target];

  if (fromIndex < 0 || fromIndex >= newSource.length) {
    return { source: newSource, target: newTarget };
  }

  const [item] = newSource.splice(fromIndex, 1);
  const insertIndex = Math.max(0, Math.min(toIndex, newTarget.length));
  newTarget.splice(insertIndex, 0, item);

  return { source: newSource, target: newTarget };
}
