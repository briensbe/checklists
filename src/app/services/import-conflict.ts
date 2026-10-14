import { ImportConflictMode } from '../models/checklist.model';

/**
 * Demande à l'utilisateur comment résoudre un conflit d'identifiant à l'import.
 * `confirm()` n'offrant que OK / Annuler, on enchaîne deux questions :
 * remplacer ? sinon importer comme copie ? sinon abandon (`null`).
 * Provisoire : remplacé par une modale à trois choix au change `ui-dialogs-and-undo`.
 */
export function askImportConflict(existingDescription: string, copyHint: string): Exclude<ImportConflictMode, 'new'> | null {
  if (confirm(`${existingDescription} porte déjà cet identifiant.\n\nOK : la remplacer.\nAnnuler : voir les autres options.`)) {
    return 'replace';
  }
  if (confirm(`Importer le fichier comme une copie (${copyHint}) ?\n\nAnnuler : abandonner l'import.`)) {
    return 'copy';
  }
  return null;
}

/** Lit un fichier choisi par l'utilisateur et le passe à `JSON.parse`, avec un message clair en cas d'échec. */
export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Le fichier n’est pas un JSON valide.');
  }
}
