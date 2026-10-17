import { Provider } from '@angular/core';
import {
  LucideArchive,
  LucideBookOpen,
  LucideBox,
  LucideBug,
  LucideCalendar,
  LucideClipboardCheck,
  LucideClipboardList,
  LucideCloud,
  LucideCode,
  LucideDatabase,
  LucideFileText,
  LucideFlag,
  LucideFlaskConical,
  LucideGavel,
  LucideGitBranch,
  LucideGitMerge,
  LucideGlobe,
  LucideGoal,
  LucideHammer,
  LucideListChecks,
  LucideLock,
  LucideMail,
  LucideMessageSquare,
  LucidePackage,
  LucideRocket,
  LucideSearch,
  LucideServer,
  LucideSettings,
  LucideShieldCheck,
  LucideTerminal,
  LucideTicket,
  LucideUsers,
  LucideWrench,
  provideLucideIcons
} from '@lucide/angular';

/**
 * Composants Lucide de la liste fermée `STEP_ICON_NAMES` (`domain/step-icons.ts`) : seules ces icônes
 * peuvent être affichées par nom (`<svg [lucideIcon]>`), ce qui évite d'embarquer toute la bibliothèque.
 * Un test vérifie que chaque nom de la liste est bien enregistré ici.
 */
export const STEP_ICON_COMPONENTS = [
  LucideListChecks,
  LucideClipboardList,
  LucideClipboardCheck,
  LucideFlag,
  LucideGoal,
  LucideGitMerge,
  LucideGitBranch,
  LucideHammer,
  LucideWrench,
  LucideBookOpen,
  LucideFileText,
  LucideFlaskConical,
  LucideBug,
  LucideGavel,
  LucideRocket,
  LucideTicket,
  LucideBox,
  LucidePackage,
  LucideArchive,
  LucideCode,
  LucideTerminal,
  LucideDatabase,
  LucideServer,
  LucideCloud,
  LucideGlobe,
  LucideShieldCheck,
  LucideLock,
  LucideUsers,
  LucideMessageSquare,
  LucideMail,
  LucideCalendar,
  LucideSettings,
  LucideSearch
];

/** Enregistre les icônes d'étape, une fois pour toute l'application (`app.config.ts`). */
export function provideStepIcons(): Provider {
  return provideLucideIcons(...STEP_ICON_COMPONENTS);
}
