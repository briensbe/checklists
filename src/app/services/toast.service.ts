import { Injectable, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
  action?: ToastAction;
  timerId?: ReturnType<typeof setTimeout>;
}

export interface ShowToastOptions {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: ToastAction;
}

export interface DeferredActionOptions {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
  undoLabel?: string;
  onCommit: () => void | Promise<void>;
  onUndo?: () => void | Promise<void>;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly _toasts = signal<ToastItem[]>([]);
  readonly toasts = this._toasts.asReadonly();

  // Registre des actions différées à exécuter lors d'un flush
  private readonly pendingCommits = new Map<string, () => void | Promise<void>>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushPending();
        }
      });

      window.addEventListener('beforeunload', () => {
        this.flushPending();
      });
    }
  }

  show(options: ShowToastOptions): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const duration = options.durationMs ?? 4000;

    let timerId: ReturnType<typeof setTimeout> | undefined;
    if (duration > 0) {
      timerId = setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    const item: ToastItem = {
      id,
      message: options.message,
      tone: options.tone ?? 'info',
      durationMs: duration,
      action: options.action,
      timerId
    };

    this._toasts.update(list => [...list, item]);
    return id;
  }

  info(message: string, durationMs = 4000): string {
    return this.show({ message, tone: 'info', durationMs });
  }

  success(message: string, durationMs = 4000): string {
    return this.show({ message, tone: 'success', durationMs });
  }

  warning(message: string, durationMs = 5000): string {
    return this.show({ message, tone: 'warning', durationMs });
  }

  danger(message: string, durationMs = 6000): string {
    return this.show({ message, tone: 'danger', durationMs });
  }

  /**
   * Enregistre et affiche une action avec possibilité d'annulation pendant `durationMs` (défaut 6s).
   * Si l'utilisateur clique sur « Annuler », `onUndo` est exécuté.
   * Si le délai expire ou si la page se décharge (flush), `onCommit` est exécuté.
   */
  showDeferred(options: DeferredActionOptions): string {
    const duration = options.durationMs ?? 6000;
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    this.pendingCommits.set(id, options.onCommit);

    const timerId = setTimeout(async () => {
      this.pendingCommits.delete(id);
      try {
        await options.onCommit();
      } catch (err) {
        console.error('Erreur lors du commit différé :', err);
      }
      this.dismiss(id, false);
    }, duration);

    const item: ToastItem = {
      id,
      message: options.message,
      tone: options.tone ?? 'info',
      durationMs: duration,
      timerId,
      action: {
        label: options.undoLabel ?? 'Annuler',
        run: async () => {
          clearTimeout(timerId);
          this.pendingCommits.delete(id);
          this.dismiss(id, false);
          if (options.onUndo) {
            await options.onUndo();
          }
        }
      }
    };

    this._toasts.update(list => [...list, item]);
    return id;
  }

  /**
   * Exécute tout de suite la validation différée d'un toast (sans attendre son délai) et le ferme.
   * Sans effet si le toast a déjà été validé ou annulé. Les erreurs remontent à l'appelant.
   */
  async commitNow(id: string): Promise<void> {
    const commit = this.pendingCommits.get(id);
    if (!commit) return;
    this.pendingCommits.delete(id);
    this.dismiss(id);
    await commit();
  }

  /**
   * Exécute immédiatement tous les commits différés en attente et purge la file.
   */
  flushPending(): void {
    if (this.pendingCommits.size === 0) return;

    for (const [id, commit] of Array.from(this.pendingCommits.entries())) {
      this.pendingCommits.delete(id);
      try {
        commit();
      } catch (err) {
        console.error('Erreur lors du flush différé :', err);
      }
      this.dismiss(id, false);
    }
  }

  dismiss(id: string, cancelTimer = true): void {
    const current = this._toasts().find(t => t.id === id);
    if (current && cancelTimer && current.timerId) {
      clearTimeout(current.timerId);
    }
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  clear(): void {
    for (const toast of this._toasts()) {
      if (toast.timerId) {
        clearTimeout(toast.timerId);
      }
    }
    this._toasts.set([]);
    this.pendingCommits.clear();
  }
}
