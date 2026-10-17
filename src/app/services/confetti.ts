import { Injectable } from '@angular/core';

/** Module `canvas-confetti` (`export =`) tel que le renvoie un import dynamique. */
type ConfettiModule = { default: typeof import('canvas-confetti') };

/**
 * Célébration de fin de chemin (ADR 0010, point 5) : `canvas-confetti` n'est chargé qu'au moment
 * de l'effet, par import dynamique (fichier séparé, absent du chargement initial), et jamais quand
 * l'utilisateur demande de réduire les animations. Tout échec est ignoré : l'annonce textuelle suffit.
 */
@Injectable({ providedIn: 'root' })
export class ConfettiService {
  /** Chargement de la bibliothèque ; remplaçable dans les tests. */
  loader: () => Promise<ConfettiModule> = () => import('canvas-confetti');

  /** Lance une salve ; renvoie vrai si elle a été lancée. */
  async launch(): Promise<boolean> {
    if (typeof window === 'undefined' || prefersReducedMotion()) return false;
    try {
      const confetti = (await this.loader()).default;
      void confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 }, disableForReducedMotion: true });
      return true;
    } catch {
      return false;
    }
  }
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
