/**
 * Transforme un titre en nom de fichier sûr en conservant les lettres accentuées.
 *
 * - `normalize('NFC')` : un « é » peut être stocké en deux caractères (« e » + accent
 *   combinant, forme NFD fréquente sur macOS) ; NFC le recompose en un seul caractère.
 * - `\p{L}` / `\p{N}` (drapeau `u`) : toute lettre ou chiffre Unicode (é, ç, ß, ...),
 *   là où `[a-z0-9]` ne connaît que l'ASCII et remplaçait chaque accent par « _ ».
 * - Tout le reste (espaces, ponctuation, caractères interdits par Windows `\ / : * ? " < > |`)
 *   devient « _ », les « _ » consécutifs sont fusionnés et ceux des extrémités retirés.
 */
export function toFileBaseName(title: string, fallback: string): string {
  const cleaned = title
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned || fallback;
}

/**
 * Déclenche le téléchargement d'un Blob via un lien temporaire.
 * L'URL blob est libérée juste après le clic : le navigateur a déjà pris en charge le téléchargement.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
