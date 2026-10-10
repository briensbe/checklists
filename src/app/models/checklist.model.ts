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

export interface CustomChoiceOption {
  id: string;
  label: string;
  color?: string; // CSS color or badge tone (ex: green, red, amber, blue, slate)
  isBlocking?: boolean;
}

export interface ChecklistItemTemplate {
  id: string;
  label: string;
  help?: string;
  controlType?: ItemControlType; // Par défaut 'status' si non spécifié
  withTimestamp?: boolean; // Pour type 'checkbox': active l'horodatage automatique au clic
  customChoices?: CustomChoiceOption[]; // Pour type 'choice'
  mode?: 'all' | 'patch'; // Applicable context condition
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

export interface ChecklistSession {
  id: string; // UUID
  title: string; // Nom explicite de la session/audit
  templateId: string;
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
