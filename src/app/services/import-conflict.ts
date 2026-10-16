import { ImportConflictMode } from '../models/checklist.model';
import { DialogService } from './dialog.service';

/**
 * Demande à l'utilisateur comment résoudre un conflit d'identifiant à l'import
 * via une boîte de dialogue modale accessible à 3 choix :
 * Remplacer / Importer comme copie / Annuler.
 */
export async function askImportConflict(
  dialogService: DialogService,
  existingDescription: string,
  copyHint: string
): Promise<Exclude<ImportConflictMode, 'new'> | null> {
  const result = await dialogService.choice<Exclude<ImportConflictMode, 'new'>>({
    title: 'Conflit d’identifiant',
    message: `${existingDescription} existe déjà avec cet identifiant.\n\nQue souhaitez-vous faire ?`,
    choices: [
      {
        id: 'replace',
        label: 'Remplacer l’existant',
        tone: 'danger'
      },
      {
        id: 'copy',
        label: `Importer comme copie (${copyHint})`,
        tone: 'primary',
        isDefault: true
      }
    ],
    cancelLabel: 'Annuler'
  });

  return result;
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
