import deliveryAudit from '../../assets/templates/delivery-audit.json';
import releaseFlow from '../../assets/templates/release-flow.json';
import { DEFAULT_STEP_ICON, LEGACY_STEP_ICONS, resolveStepIcon, STEP_ICON_NAMES } from './step-icons';

describe('resolveStepIcon', () => {
  it('garde un nom de la liste fermée', () => {
    expect(resolveStepIcon('hammer')).toBe('hammer');
    expect(resolveStepIcon('git-merge')).toBe('git-merge');
  });

  it('convertit un ancien nom Heroicons', () => {
    expect(resolveStepIcon('document-text')).toBe('file-text');
    expect(resolveStepIcon('circle-stack')).toBe('database');
    expect(resolveStepIcon('archive-box')).toBe('archive');
    expect(resolveStepIcon('cube')).toBe('box');
  });

  it('remplace un nom inconnu, absent ou vide par l’icône par défaut', () => {
    expect(resolveStepIcon('licorne')).toBe(DEFAULT_STEP_ICON);
    expect(resolveStepIcon(undefined)).toBe(DEFAULT_STEP_ICON);
    expect(resolveStepIcon(null)).toBe(DEFAULT_STEP_ICON);
    expect(resolveStepIcon('  ')).toBe(DEFAULT_STEP_ICON);
  });

  it('tolère la casse et les espaces', () => {
    expect(resolveStepIcon(' Hammer ')).toBe('hammer');
  });

  it('la table de conversion ne renvoie que des noms de la liste fermée', () => {
    const known = new Set<string>(STEP_ICON_NAMES);
    expect(Object.values(LEGACY_STEP_ICONS).every(name => known.has(name))).toBe(true);
    expect(known.has(DEFAULT_STEP_ICON)).toBe(true);
  });

  it('résout chaque icône des modèles livrés sans retomber sur l’icône par défaut', () => {
    const icons = [...deliveryAudit.sections, ...releaseFlow.sections].map(s => s.icon);
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(resolveStepIcon(icon), icon).not.toBe(DEFAULT_STEP_ICON);
    }
  });
});
