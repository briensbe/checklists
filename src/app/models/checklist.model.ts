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

export interface ChecklistItemTemplate {
  id: string;
  label: string;
  help?: string;
  mode?: 'all' | 'patch'; // Applicable context condition
  extraField?: ExtraFieldSchema;
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
  comment: string;
  extra?: Record<string, string>;
}

export interface ChecklistSession {
  id: string; // Session ID (ex: 'current' or uuid)
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
