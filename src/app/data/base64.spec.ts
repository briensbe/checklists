import { base64ToBlob, blobToBase64 } from './base64';

describe('base64', () => {
  it('fait un aller-retour exact sur un contenu binaire de plusieurs tranches', async () => {
    // Plusieurs tranches de 32 Kio, taille non multiple (atob/btoa de jsdom sont lents : on reste modeste).
    const size = 5 * 0x8000 + 17;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = (i * 31 + 7) % 256;
    const original = new Blob([bytes], { type: 'image/png' });

    const encoded = await blobToBase64(original);
    const decoded = base64ToBlob(encoded, 'image/png', size);

    expect(decoded.type).toBe('image/png');
    expect(decoded.size).toBe(size);
    const roundTrip = new Uint8Array(await decoded.arrayBuffer());
    expect(roundTrip.every((b, i) => b === bytes[i])).toBe(true);
  });

  it('encode un Blob vide en chaîne vide', async () => {
    expect(await blobToBase64(new Blob([]))).toBe('');
    expect(base64ToBlob('', 'text/plain', 0).size).toBe(0);
  });

  it('refuse une chaîne base64 invalide', () => {
    expect(() => base64ToBlob('@@pas du base64@@', 'text/plain')).toThrow('base64 invalide');
  });

  it('refuse une taille décodée incohérente', async () => {
    const encoded = await blobToBase64(new Blob(['abc']));
    expect(() => base64ToBlob(encoded, 'text/plain', 10)).toThrow('différente de la taille déclarée');
  });
});
