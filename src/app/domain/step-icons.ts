/**
 * Icônes d'étape (champ `icon` d'une section), résolues à l'affichage (ADR 0008, point 3 ; ADR 0010, point 4).
 *
 * Une liste fermée unique sert au runner et, plus tard, à la palette du builder. Un nom hors liste
 * est converti s'il s'agit d'un ancien nom Heroicons connu, sinon remplacé par l'icône par défaut.
 * Les données ne sont jamais réécrites : le modèle et la copie figée gardent leur valeur d'origine.
 */

/** Noms Lucide (en minuscules, avec tirets) enregistrés pour l'affichage par nom. */
export const STEP_ICON_NAMES = [
  'list-checks',
  'clipboard-list',
  'clipboard-check',
  'flag',
  'goal',
  'git-merge',
  'git-branch',
  'hammer',
  'wrench',
  'book-open',
  'file-text',
  'flask-conical',
  'bug',
  'gavel',
  'rocket',
  'ticket',
  'box',
  'package',
  'archive',
  'code',
  'terminal',
  'database',
  'server',
  'cloud',
  'globe',
  'shield-check',
  'lock',
  'users',
  'message-square',
  'mail',
  'calendar',
  'settings',
  'search'
] as const;

export type StepIconName = (typeof STEP_ICON_NAMES)[number];

/** Icône d'une étape sans icône ou à l'icône inconnue (celle de l'en-tête de section historique). */
export const DEFAULT_STEP_ICON: StepIconName = 'list-checks';

/** Anciens noms Heroicons (modèle de livraison, anciens imports) et leur équivalent Lucide. */
export const LEGACY_STEP_ICONS: Readonly<Record<string, StepIconName>> = {
  'document-text': 'file-text',
  'circle-stack': 'database',
  'archive-box': 'archive',
  cube: 'box',
  beaker: 'flask-conical',
  'bug-ant': 'bug',
  cog: 'settings',
  'cog-6-tooth': 'settings',
  'command-line': 'terminal',
  'server-stack': 'server',
  'user-group': 'users',
  envelope: 'mail',
  'magnifying-glass': 'search',
  'lock-closed': 'lock',
  'globe-alt': 'globe',
  'calendar-days': 'calendar',
  'wrench-screwdriver': 'wrench',
  'clipboard-document-list': 'clipboard-list',
  'clipboard-document-check': 'clipboard-check',
  'chat-bubble-left': 'message-square',
  'rocket-launch': 'rocket'
};

const KNOWN = new Set<string>(STEP_ICON_NAMES);

/** Nom d'icône à afficher pour une étape : toujours un nom de `STEP_ICON_NAMES`. */
export function resolveStepIcon(name: string | null | undefined): StepIconName {
  const key = name?.trim().toLowerCase() ?? '';
  if (KNOWN.has(key)) return key as StepIconName;
  return LEGACY_STEP_ICONS[key] ?? DEFAULT_STEP_ICON;
}
