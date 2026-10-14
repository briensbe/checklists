export type ControlStatus = 'OK' | 'KO' | 'NA';

export type ContextFieldType = 'text' | 'date' | 'select';

export interface ContextFieldSchema {
  id: string;
  label: string;
  type: ContextFieldType;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

export interface ExtraFieldSchema {
  id: string;
  label: string;
  placeholder?: string;
}

export type ItemControlType = 'status' | 'checkbox' | 'choice';

/** Palette fixe de tons, liée aux variables CSS --tone-* (thèmes clair et sombre). */
export type ChoiceTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export const CHOICE_TONES: readonly ChoiceTone[] = ['success', 'danger', 'warning', 'info', 'neutral'];

export interface CustomChoiceOption {
  id: string;
  label: string;
  tone: ChoiceTone;
  isBlocking?: boolean;
}

/** L'item est applicable si la valeur du champ de contexte `fieldId` figure dans `equals`. */
export interface VisibilityCondition {
  fieldId: string;
  equals: string[];
}

export interface ChecklistItemTemplate {
  id: string;
  label: string;
  help?: string;
  controlType?: ItemControlType; // Par défaut 'status' si non spécifié
  withTimestamp?: boolean; // Pour type 'checkbox': active l'horodatage automatique au clic
  customChoices?: CustomChoiceOption[]; // Pour type 'choice'
  visibleIf?: VisibilityCondition; // Absent = toujours applicable
  extraField?: ExtraFieldSchema;
  requireNaReason?: boolean; // Option de template : exige un motif obligatoire si N/A
}

export interface ChecklistSectionTemplate {
  id: string;
  title: string;
  icon?: string;
  items: ChecklistItemTemplate[];
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  updatedAt: string; // ISO, mis à jour à chaque enregistrement
  contextSchema: ContextFieldSchema[];
  sections: ChecklistSectionTemplate[];
}

export interface ItemAnswer {
  status: ControlStatus | null;
  checked?: boolean;
  checkedAt?: string; // ISO date-time
  selectedChoice?: string; // Option id or label
  comment: string;
  extra?: Record<string, string>;
}

export type SessionStatus = 'in_progress' | 'completed';

export interface SessionClosure {
  closedAt: string;
  reopenedAt?: string;
}

export interface ChecklistSession {
  id: string; // UUID
  title: string; // Nom explicite de la session/audit
  templateId: string; // Référence d'origine, sert uniquement à détecter une nouvelle version
  templateSnapshot: ChecklistTemplate; // Copie figée : seule source de structure pour la session
  structureUnavailable?: boolean; // Template d'origine absent lors de la migration v3
  status: SessionStatus;
  closures: SessionClosure[];
  contextValues: Record<string, string>;
  answers: Record<string, ItemAnswer>;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceRecord {
  id: string;
  sessionId: string;
  itemId: string;
  name: string;
  type: 'image' | 'file' | 'log';
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

export interface MetricsSummary {
  total: number;
  answered: number;
  okCount: number;
  koCount: number;
  naCount: number;
  pending: number;
  percent: number;
}
