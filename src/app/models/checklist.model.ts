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

// --- Enchaînement des étapes (voir ADR 0007) ----------------------------------
// Tous ces champs sont optionnels : leur absence reproduit le comportement antérieur.

/** Seuls les contrôles bloquants verrouillent une porte. Absente = `optional`. */
export type Criticality = 'blocking' | 'important' | 'optional';
export const CRITICALITIES: readonly Criticality[] = ['blocking', 'important', 'optional'];

/** Type de preuve exigé par le modèle au moment de valider un contrôle. */
export type EvidenceKind = 'comment' | 'photo' | 'link' | 'file';
export const EVIDENCE_KINDS: readonly EvidenceKind[] = ['comment', 'photo', 'link', 'file'];

/** Jonction : toutes les dépendances franchies (`all`, défaut) ou au moins une (`any`). */
export type JoinMode = 'all' | 'any';
export const JOIN_MODES: readonly JoinMode[] = ['all', 'any'];

/** Porte stricte (`hard`, défaut) ou franchissable avec justification (`soft`). */
export type GateKind = 'hard' | 'soft';
export const GATE_KINDS: readonly GateKind[] = ['hard', 'soft'];

/** Clôture : une réponse partout (`all`, défaut) ou seuls les bloquants résolus (`blocking`). */
export type CompletionPolicy = 'all' | 'blocking';
export const COMPLETION_POLICIES: readonly CompletionPolicy[] = ['all', 'blocking'];

export interface ChecklistItemTemplate {
  id: string;
  label: string;
  help?: string;
  controlType?: ItemControlType; // Par défaut 'status' si non spécifié
  withTimestamp?: boolean; // Pour type 'checkbox': active l'horodatage automatique au clic
  customChoices?: CustomChoiceOption[]; // Pour type 'choice'
  visibleIf?: VisibilityCondition; // Absent = toujours applicable
  extraField?: ExtraFieldSchema;
  criticality?: Criticality; // Absente = 'optional'
  evidenceRequired?: EvidenceKind; // Absent = aucune preuve exigée (les preuves libres restent possibles)
  evidenceHint?: string; // Consigne affichée au moment de fournir la preuve
}

export interface ChecklistSectionTemplate {
  id: string;
  title: string;
  icon?: string;
  items: ChecklistItemTemplate[];
  dependsOn?: string[]; // Identifiants des sections à franchir avant celle-ci ; absent ou vide = départ
  joinMode?: JoinMode; // Absent = 'all'
  gate?: GateKind; // Absent = 'hard'
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  updatedAt: string; // ISO, mis à jour à chaque enregistrement
  contextSchema: ContextFieldSchema[];
  sections: ChecklistSectionTemplate[];
  completionPolicy?: CompletionPolicy; // Absente = 'all'
}

/** Changement d'état d'un contrôle. Les saisies de texte ne sont jamais historisées. */
export type ItemEvent =
  | { at: string; kind: 'status'; status: ControlStatus | null }
  | { at: string; kind: 'checked'; checked: boolean }
  | { at: string; kind: 'choice'; choiceId: string | null }
  | { at: string; kind: 'evidence-added'; evidenceId: string; name: string }
  | { at: string; kind: 'evidence-removed'; evidenceId: string; name: string }
  | { at: string; kind: 'evidence-pending'; pending: boolean }
  | { at: string; kind: 'evidence-link'; url: string | null };

export interface ItemAnswer {
  status: ControlStatus | null;
  checked?: boolean;
  checkedAt?: string; // ISO date-time
  selectedChoice?: string; // Option id or label
  comment: string;
  extra?: Record<string, string>;
  evidencePending?: boolean; // Fait, preuve à compléter (jamais sur un bloquant)
  evidenceLink?: string; // Preuve de type lien : une seule adresse http(s) validée (ADR 0009)
  history?: ItemEvent[]; // On ajoute, on n'écrase pas
}

/** Franchissement forcé d'une porte souple : c'est une décision de l'utilisateur, donc stockée. */
export interface ForcedGate {
  sectionId: string;
  reason: string;
  at: string;
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
  forcedGates?: ForcedGate[];
  createdAt: string;
  updatedAt: string;
}

/** Taille maximale d'une preuve (50 Mo). */
export const MAX_EVIDENCE_SIZE = 50 * 1024 * 1024;

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

// --- Fichier d'échange de session (voir ADR 0004) ----------------------------

/** Décision prise par l'utilisateur lors d'un import : pas de conflit, remplacer l'existant, ou importer comme copie. */
export type ImportConflictMode = 'new' | 'replace' | 'copy';

export const SESSION_EXCHANGE_FORMAT = 'checklist-session';
export const SESSION_EXCHANGE_FORMAT_VERSION = 1;

/** Preuve embarquée dans le fichier d'échange. L'identifiant n'est pas exporté : il est régénéré à l'import. */
export interface ExchangeEvidence {
  itemId: string;
  name: string;
  type: EvidenceRecord['type'];
  mimeType: string;
  size: number;
  createdAt: string;
  data: string; // base64 pur, sans préfixe data:
}

export interface SessionExchangeFile {
  format: typeof SESSION_EXCHANGE_FORMAT;
  formatVersion: number;
  exportedAt: string;
  session: ChecklistSession;
  /** Synthèse lisible, recalculable : jamais relue à l'import. */
  summary: {
    templateName: string;
    templateVersion: string;
    metrics: MetricsSummary;
  };
  /** Absent = pièces jointes non incluses ; tableau vide = incluses, aucune. */
  evidences?: ExchangeEvidence[];
}
