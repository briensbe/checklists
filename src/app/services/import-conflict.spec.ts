import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DialogService } from './dialog.service';
import { askImportConflict } from './import-conflict';

describe('import-conflict', () => {
  let dialogService: DialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    dialogService = TestBed.inject(DialogService);
  });

  it('devrait retourner replace lorsque l’utilisateur choisit Remplacer', async () => {
    const promise = askImportConflict(dialogService, 'Une session', 'titre suffixé');

    const active = dialogService.activeDialog();
    expect(active?.type).toBe('choice');
    expect(active?.choices?.length).toBe(2);

    active?.resolve('replace');
    const result = await promise;
    expect(result).toBe('replace');
  });

  it('devrait retourner copy lorsque l’utilisateur choisit Copie', async () => {
    const promise = askImportConflict(dialogService, 'Une session', 'titre suffixé');

    const active = dialogService.activeDialog();
    active?.resolve('copy');
    const result = await promise;
    expect(result).toBe('copy');
  });

  it('devrait retourner null lors de l’annulation', async () => {
    const promise = askImportConflict(dialogService, 'Une session', 'titre suffixé');

    dialogService.close();
    const result = await promise;
    expect(result).toBeNull();
  });
});
