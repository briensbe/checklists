import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DialogService } from './dialog.service';

describe('DialogService', () => {
  let service: DialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DialogService);
  });

  it('devrait être initialisé sans dialogue actif', () => {
    expect(service.activeDialog()).toBeNull();
  });

  it('devrait ouvrir une boîte de confirmation et résoudre à true lors de la confirmation', async () => {
    const promise = service.confirm({
      title: 'Supprimer ?',
      message: 'Confirmez la suppression.'
    });

    const active = service.activeDialog();
    expect(active).not.toBeNull();
    expect(active?.type).toBe('confirm');
    expect(active?.title).toBe('Supprimer ?');

    active?.resolve(true);
    const result = await promise;
    expect(result).toBe(true);
    expect(service.activeDialog()).toBeNull();
  });

  it('devrait résoudre à false lors de l’annulation de la confirmation', async () => {
    const promise = service.confirm({
      title: 'Supprimer ?',
      message: 'Confirmez.'
    });

    service.close();
    const result = await promise;
    expect(result).toBe(false);
    expect(service.activeDialog()).toBeNull();
  });

  it('devrait gérer un dialogue à choix multiples et résoudre avec l’identifiant sélectionné', async () => {
    const promise = service.choice({
      title: 'Conflit d’import',
      message: 'La session existe déjà.',
      choices: [
        { id: 'replace', label: 'Remplacer' },
        { id: 'copy', label: 'Copie' }
      ]
    });

    const active = service.activeDialog();
    expect(active?.type).toBe('choice');
    expect(active?.choices?.length).toBe(2);

    active?.resolve('copy');
    const result = await promise;
    expect(result).toBe('copy');
    expect(service.activeDialog()).toBeNull();
  });

  it('devrait résoudre à null quand un dialogue à choix multiples est fermé', async () => {
    const promise = service.choice({
      title: 'Choix',
      message: 'Veuillez choisir.',
      choices: [{ id: 'opt1', label: 'Option 1' }]
    });

    service.close();
    const result = await promise;
    expect(result).toBeNull();
  });
});
