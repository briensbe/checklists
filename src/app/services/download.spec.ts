import { toFileBaseName } from './download';

describe('toFileBaseName', () => {
  it('conserve les lettres accentuées', () => {
    expect(toFileBaseName('Vérif échange', 'x')).toBe('Vérif_échange');
    expect(toFileBaseName('Contrôle qualité – Noël', 'x')).toBe('Contrôle_qualité_Noël');
  });

  it('recompose les accents stockés en forme décomposée (NFD)', () => {
    const decomposed = 'Vérif'; // « e » + accent aigu combinant
    expect(toFileBaseName(decomposed, 'x')).toBe('Vérif');
  });

  it('remplace les caractères interdits et fusionne les séparateurs', () => {
    expect(toFileBaseName('Audit 1.3 : livraison / patch?', 'x')).toBe('Audit_1_3_livraison_patch');
    expect(toFileBaseName('  (remplacée)  ', 'x')).toBe('remplacée');
  });

  it('garde chiffres, tirets et soulignés', () => {
    expect(toFileBaseName('audit-2026_v2', 'x')).toBe('audit-2026_v2');
  });

  it('utilise le nom de repli pour un titre vide ou sans caractère utilisable', () => {
    expect(toFileBaseName('', 'Checklist')).toBe('Checklist');
    expect(toFileBaseName('???', 'Checklist')).toBe('Checklist');
  });
});
