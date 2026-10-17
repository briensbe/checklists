/** Couleur d'un anneau : en cours, complet, ou en anomalie (variables `--ring-*` des deux thèmes). */
export type RingTone = 'progress' | 'complete' | 'anomaly';

export interface RingGeometry {
  /** Valeur bornée entre 0 et 1. */
  value: number;
  center: number;
  radius: number;
  circumference: number;
  /** Décalage du trait (`stroke-dashoffset`) qui laisse visible la part `value` de la circonférence. */
  dashOffset: number;
}

/**
 * Géométrie d'un anneau de progression, en pixels : partagée par le composant `progress-ring`
 * et par les nœuds du graphe des étapes, qui dessinent leur anneau dans leur propre `<svg>`.
 */
export function ringGeometry(value: number, size: number, stroke: number): RingGeometry {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const radius = Math.max(0, (size - stroke) / 2);
  const circumference = 2 * Math.PI * radius;
  return { value: clamped, center: size / 2, radius, circumference, dashOffset: circumference * (1 - clamped) };
}

/** Règle de couleur commune aux anneaux : l'anomalie l'emporte, puis la complétude. */
export function ringToneOf(answered: number, total: number, hasAnomaly: boolean): RingTone {
  if (hasAnomaly) return 'anomaly';
  return total > 0 && answered === total ? 'complete' : 'progress';
}
