import {
  ChecklistItemTemplate,
  ChecklistSession,
  ContextFieldSchema,
  ItemAnswer,
  MetricsSummary
} from '../models/checklist.model';

/**
 * Préparation des rapports Excel et PDF, sous forme de fonctions pures.
 *
 * Toute information de structure vient de la copie figée de la session : aucune clé
 * de contexte n'est codée en dur, le rapport s'adapte à n'importe quel template.
 */

export interface ReportField {
  label: string;
  value: string;
}

export const NOT_FILLED = 'Non renseigné';

/**
 * `aaaa-mm-jj` → `jj/mm/aaaa` par simple découpage de la chaîne.
 * On évite volontairement `new Date('2026-10-14')` : cette forme est interprétée en
 * UTC minuit, et donc affichée la veille dans un fuseau à l'ouest de Greenwich.
 */
export function formatIsoDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** Horodatage complet (ISO avec heure) en date et heure locales françaises. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Date de la dernière clôture d'une session terminée ; `undefined` si elle est en cours. */
export function lastClosedAt(session: ChecklistSession): string | undefined {
  if (session.status !== 'completed') return undefined;
  return session.closures.at(-1)?.closedAt;
}

export function contextFieldValue(field: ContextFieldSchema, raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return NOT_FILLED;
  if (field.type === 'select') {
    return field.options?.find(o => o.value === value)?.label ?? value;
  }
  if (field.type === 'date') {
    return formatIsoDate(value);
  }
  return value;
}

/** Cartouche : modèle, version, statut, clôture éventuelle, puis le schéma de contexte dans son ordre. */
export function reportHeaderFields(session: ChecklistSession): ReportField[] {
  const snapshot = session.templateSnapshot;
  const fields: ReportField[] = [
    { label: 'Modèle', value: snapshot.name || NOT_FILLED },
    { label: 'Version du modèle', value: snapshot.version || '—' },
    { label: 'Statut', value: session.status === 'completed' ? 'Terminée' : 'En cours' }
  ];
  const closedAt = lastClosedAt(session);
  if (closedAt) {
    fields.push({ label: 'Clôturée le', value: formatDateTime(closedAt) });
  }
  for (const field of snapshot.contextSchema) {
    fields.push({ label: field.label, value: contextFieldValue(field, session.contextValues[field.id]) });
  }
  return fields;
}

export function reportSummaryFields(metrics: MetricsSummary): ReportField[] {
  return [
    { label: 'Progression', value: `${metrics.percent}% (${metrics.answered} / ${metrics.total})` },
    { label: 'OK / KO / N/A', value: `${metrics.okCount} / ${metrics.koCount} / ${metrics.naCount}` },
    { label: 'En attente', value: String(metrics.pending) }
  ];
}

/**
 * Texte de la colonne « État » d'un item, quel que soit son type de contrôle.
 * Un N/A s'affiche `N/A` pour tous les types (ADR 0009) ; une preuve en attente est signalée.
 */
export function itemStateText(item: ChecklistItemTemplate, answer: ItemAnswer | undefined): string {
  const state = baseStateText(item, answer);
  return answer?.evidencePending && answer.status !== 'NA' ? `${state} · preuve à compléter` : state;
}

function baseStateText(item: ChecklistItemTemplate, answer: ItemAnswer | undefined): string {
  if (answer?.status === 'NA') return 'N/A';
  const type = item.controlType ?? 'status';
  if (type === 'checkbox') {
    if (!answer?.checked) return 'NON FAIT';
    return answer.checkedAt ? `FAIT (${formatDateTime(answer.checkedAt)})` : 'FAIT';
  }
  if (type === 'choice') {
    const selected = answer?.selectedChoice;
    if (!selected) return 'NON SÉLECTIONNÉ';
    // Les réponses récentes stockent l'identifiant du choix, d'anciennes stockaient le libellé.
    return item.customChoices?.find(c => c.id === selected)?.label ?? selected;
  }
  return answer?.status ?? 'À TRAITER';
}

/** Commentaire, champ additionnel préfixé de son libellé (et non de sa clé technique), puis lien de preuve. */
export function itemObservations(item: ChecklistItemTemplate, answer: ItemAnswer | undefined, separator: string): string {
  const parts: string[] = [];
  if (answer?.comment?.trim()) parts.push(answer.comment.trim());
  for (const [key, value] of Object.entries(answer?.extra ?? {})) {
    if (!value?.trim()) continue;
    const label = item.extraField?.id === key ? item.extraField.label : key;
    parts.push(`${label} : ${value.trim()}`);
  }
  if (answer?.evidenceLink?.trim()) parts.push(`Lien de preuve : ${answer.evidenceLink.trim()}`);
  return parts.join(separator);
}
