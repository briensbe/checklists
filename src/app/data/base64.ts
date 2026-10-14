/**
 * Conversion Blob ↔ base64 sans dépendance, utilisée par le fichier d'échange de session.
 *
 * Fonctionne à l'identique dans le navigateur et sous Vitest (Node) : on passe par
 * `ArrayBuffer` + `btoa`/`atob` plutôt que par `FileReader` (absent ou partiel hors navigateur).
 */

/**
 * Taille des tranches converties en une fois. `String.fromCharCode(...octets)` transforme
 * chaque octet en argument de fonction : sur plusieurs Mo, cela dépasse la taille maximale
 * de la pile d'appels. Découper en tranches de 32 Kio évite l'erreur sans coût notable.
 */
const CHUNK_SIZE = 0x8000;

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

/**
 * Décode une chaîne base64 (sans préfixe `data:`) en Blob du type MIME donné.
 * Lève une erreur si la chaîne est invalide ou si la taille décodée diffère de `expectedSize`.
 */
export function base64ToBlob(data: string, mimeType: string, expectedSize?: number): Blob {
  let binary: string;
  try {
    binary = atob(data);
  } catch {
    throw new Error('contenu base64 invalide');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  if (expectedSize !== undefined && bytes.length !== expectedSize) {
    throw new Error(`taille décodée (${bytes.length} octets) différente de la taille déclarée (${expectedSize} octets)`);
  }
  return new Blob([bytes], { type: mimeType });
}
