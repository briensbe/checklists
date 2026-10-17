import {
  CHOICE_TONES,
  ChecklistItemTemplate,
  ChecklistSectionTemplate,
  ChecklistSession,
  ChecklistTemplate,
  ChoiceTone,
  CustomChoiceOption
} from '../models/checklist.model';

/**
 * Normalisation des anciens formats de données vers le format courant.
 *
 * Ces fonctions sont pures (aucune dépendance Angular ni Dexie) : elles sont
 * utilisées à la fois par la migration de base v3 et par l'import de fichiers
 * JSON, ce qui garantit une seule définition de « ancien format → format courant ».
 */

const COLOR_TO_TONE: Record<string, ChoiceTone> = {
  green: 'success',
  emerald: 'success',
  red: 'danger',
  rose: 'danger',
  amber: 'warning',
  yellow: 'warning',
  orange: 'warning',
  blue: 'info',
  sky: 'info',
  indigo: 'info'
};

export function colorToTone(color: string | undefined): ChoiceTone {
  if (!color) return 'neutral';
  return COLOR_TO_TONE[color.trim().toLowerCase()] ?? 'neutral';
}

function isTone(value: unknown): value is ChoiceTone {
  return typeof value === 'string' && (CHOICE_TONES as readonly string[]).includes(value);
}

/** Formes héritées acceptées en entrée (avant la migration v3). */
type LegacyChoice = Omit<CustomChoiceOption, 'tone'> & { tone?: string; color?: string };
type LegacyItem = Omit<ChecklistItemTemplate, 'customChoices'> & {
  mode?: string;
  customChoices?: LegacyChoice[];
  /** Motif N/A obligatoire : option retirée (ADR 0007), le champ est supprimé à la normalisation. */
  requireNaReason?: boolean;
};
type LegacySection = Omit<ChecklistSectionTemplate, 'items'> & { items?: LegacyItem[] };
type LegacyTemplate = Omit<ChecklistTemplate, 'sections' | 'updatedAt' | 'contextSchema'> & {
  updatedAt?: string;
  contextSchema?: ChecklistTemplate['contextSchema'];
  sections?: LegacySection[];
};

function normalizeChoice(choice: LegacyChoice): CustomChoiceOption {
  const { color, tone, ...rest } = choice;
  return { ...rest, tone: isTone(tone) ? tone : colorToTone(color) };
}

function normalizeItem(item: LegacyItem): ChecklistItemTemplate {
  // Les champs inconnus (criticité, preuve exigée…) passent tels quels via `rest`.
  const { mode, customChoices, requireNaReason: _requireNaReason, ...rest } = item;
  const normalized: ChecklistItemTemplate = { ...rest };

  if (!normalized.visibleIf && mode === 'patch') {
    normalized.visibleIf = { fieldId: 'mode', equals: ['patch'] };
  }
  if (customChoices) {
    normalized.customChoices = customChoices.map(normalizeChoice);
  }
  return normalized;
}

/**
 * Convertit un template (éventuellement à l'ancien format) au format courant :
 * `mode: 'patch'` → `visibleIf`, `color` → `tone`, `requireNaReason` retiré, `updatedAt` renseigné.
 * Idempotente : un template déjà au format courant ressort identique.
 * La validation structurelle (id, nom, sections...) reste du ressort de l'appelant.
 */
export function normalizeTemplate(raw: unknown, now: string = new Date().toISOString()): ChecklistTemplate {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Format de template invalide : objet JSON attendu.');
  }
  const legacy = raw as LegacyTemplate;
  const { sections, contextSchema, updatedAt, ...rest } = legacy;

  return {
    ...rest,
    updatedAt: updatedAt || now,
    contextSchema: contextSchema ?? [],
    sections: (sections ?? []).map(section => {
      const { items, ...sectionRest } = section;
      return { ...sectionRest, items: (items ?? []).map(normalizeItem) };
    })
  };
}

/** Forme héritée d'une session (v2) : ni copie figée, ni statut. */
type LegacySession = Omit<ChecklistSession, 'templateSnapshot' | 'status' | 'closures'> & {
  templateSnapshot?: unknown;
  status?: ChecklistSession['status'];
  closures?: ChecklistSession['closures'];
};

export const UNAVAILABLE_TEMPLATE_NAME = 'Modèle indisponible';

/**
 * Migre une session vers le format v3 :
 * - copie figée du template d'origine (déjà normalisé) ou, à défaut, structure vide
 *   marquée `structureUnavailable` ;
 * - statut `in_progress` et historique de clôtures vide si absents.
 * Les réponses et valeurs de contexte sont conservées telles quelles.
 */
export function migrateSessionV3(
  raw: unknown,
  templatesById: ReadonlyMap<string, ChecklistTemplate>,
  now: string = new Date().toISOString()
): ChecklistSession {
  const legacy = raw as LegacySession;
  const { templateSnapshot, status, closures, ...rest } = legacy;

  let snapshot: ChecklistTemplate;
  let structureUnavailable = legacy.structureUnavailable;

  if (templateSnapshot) {
    snapshot = normalizeTemplate(templateSnapshot, now);
  } else {
    const source = templatesById.get(legacy.templateId);
    if (source) {
      snapshot = structuredClone(source);
    } else {
      snapshot = {
        id: legacy.templateId,
        name: UNAVAILABLE_TEMPLATE_NAME,
        description: '',
        version: '',
        updatedAt: now,
        contextSchema: [],
        sections: []
      };
      structureUnavailable = true;
    }
  }

  const session: ChecklistSession = {
    ...rest,
    templateSnapshot: snapshot,
    status: status ?? 'in_progress',
    closures: closures ?? []
  };
  if (structureUnavailable) {
    session.structureUnavailable = true;
  }
  return session;
}
