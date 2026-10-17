import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
    service.clear();
  });

  afterEach(() => {
    // Des minuteurs simulés laissés actifs figeraient `fake-indexeddb` dans les fichiers de test suivants.
    vi.useRealTimers();
  });

  it('devrait afficher un toast et le retirer après sa durée', () => {
    service.show({ message: 'Bienvenue', durationMs: 2000 });
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('Bienvenue');

    vi.advanceTimersByTime(2000);
    expect(service.toasts().length).toBe(0);
  });

  it('devrait supporter les raccourcis info, success, warning, danger', () => {
    service.info('Info');
    service.success('Succès');
    service.warning('Attention');
    service.danger('Erreur');

    const toasts = service.toasts();
    expect(toasts.length).toBe(4);
    expect(toasts[0].tone).toBe('info');
    expect(toasts[1].tone).toBe('success');
    expect(toasts[2].tone).toBe('warning');
    expect(toasts[3].tone).toBe('danger');
  });

  it('devrait exécuter onCommit après expiration de showDeferred', async () => {
    let committed = false;
    service.showDeferred({
      message: 'Élément supprimé',
      durationMs: 6000,
      onCommit: () => {
        committed = true;
      }
    });

    expect(service.toasts().length).toBe(1);
    expect(committed).toBe(false);

    vi.advanceTimersByTime(6000);
    // Résolution des promesses asynchrones
    await Promise.resolve();

    expect(committed).toBe(true);
    expect(service.toasts().length).toBe(0);
  });

  it('devrait exécuter onUndo et ne pas exécuter onCommit si l’action est déclenchée', async () => {
    let committed = false;
    let undone = false;

    service.showDeferred({
      message: 'Suppression en cours',
      durationMs: 6000,
      onCommit: () => {
        committed = true;
      },
      onUndo: () => {
        undone = true;
      }
    });

    const toast = service.toasts()[0];
    expect(toast.action).toBeDefined();

    await toast.action?.run();

    expect(undone).toBe(true);
    expect(committed).toBe(false);
    expect(service.toasts().length).toBe(0);

    // Même après expiration, onCommit ne doit pas être appelé
    vi.advanceTimersByTime(6000);
    expect(committed).toBe(false);
  });

  it('devrait exécuter immédiatement onCommit lors de flushPending', () => {
    let committed = false;
    service.showDeferred({
      message: 'Suppression en attente',
      durationMs: 6000,
      onCommit: () => {
        committed = true;
      }
    });

    expect(committed).toBe(false);
    service.flushPending();
    expect(committed).toBe(true);
    expect(service.toasts().length).toBe(0);
  });

  it('commitNow exécute tout de suite la validation d’un toast, une seule fois, et le ferme', async () => {
    const onCommit = vi.fn();
    const id = service.showDeferred({ message: 'Preuve supprimée', durationMs: 6000, onCommit });

    await service.commitNow(id);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(service.toasts().length).toBe(0);

    vi.advanceTimersByTime(6000);
    await Promise.resolve();
    await service.commitNow(id);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
