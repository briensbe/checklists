import { ringGeometry, ringToneOf } from './ring-geometry';

describe('ringGeometry', () => {
  it('calcule rayon, circonférence et décalage du trait en pixels', () => {
    const g = ringGeometry(0.5, 32, 4);
    expect(g.center).toBe(16);
    expect(g.radius).toBe(14);
    expect(g.circumference).toBeCloseTo(2 * Math.PI * 14);
    expect(g.dashOffset).toBeCloseTo(g.circumference / 2);
  });

  it('borne la valeur entre 0 et 1, et traite une valeur invalide comme 0', () => {
    expect(ringGeometry(1.7, 32, 4).value).toBe(1);
    expect(ringGeometry(1.7, 32, 4).dashOffset).toBe(0);
    expect(ringGeometry(-0.2, 32, 4).value).toBe(0);
    expect(ringGeometry(Number.NaN, 32, 4).value).toBe(0);
  });
});

describe('ringToneOf', () => {
  it('anomalie, puis complet, puis en cours', () => {
    expect(ringToneOf(3, 3, true)).toBe('anomaly');
    expect(ringToneOf(3, 3, false)).toBe('complete');
    expect(ringToneOf(1, 3, false)).toBe('progress');
    expect(ringToneOf(0, 0, false)).toBe('progress');
  });
});
