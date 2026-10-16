import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { canDeactivateTemplateBuilder } from './template-builder.guard';
import { TemplateBuilderComponent } from '../pages/template-builder/template-builder.component';
import { DialogService } from '../services/dialog.service';

describe('canDeactivateTemplateBuilder guard', () => {
  it('devrait autoriser la navigation sans confirmation si le formulaire n\'est pas sale (isDirty === false)', async () => {
    const mockComponent = {
      isDirty: vi.fn().mockReturnValue(false)
    } as unknown as TemplateBuilderComponent;

    const mockDialogService = {
      confirm: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: DialogService, useValue: mockDialogService }
      ]
    });

    const result = await TestBed.runInInjectionContext(() =>
      canDeactivateTemplateBuilder(mockComponent, null as any, null as any, null as any)
    );

    expect(result).toBe(true);
    expect(mockDialogService.confirm).not.toHaveBeenCalled();
  });

  it('devrait afficher la boîte de dialogue si isDirty est vrai et respecter la réponse utilisateur', async () => {
    const mockComponent = {
      isDirty: vi.fn().mockReturnValue(true)
    } as unknown as TemplateBuilderComponent;

    const mockDialogService = {
      confirm: vi.fn().mockResolvedValue(true)
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: DialogService, useValue: mockDialogService }
      ]
    });

    const allowed = await TestBed.runInInjectionContext(() =>
      canDeactivateTemplateBuilder(mockComponent, null as any, null as any, null as any)
    );

    expect(allowed).toBe(true);
    expect(mockDialogService.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Modifications non enregistrées',
        confirmTone: 'danger'
      })
    );

    mockDialogService.confirm.mockResolvedValueOnce(false);
    const blocked = await TestBed.runInInjectionContext(() =>
      canDeactivateTemplateBuilder(mockComponent, null as any, null as any, null as any)
    );
    expect(blocked).toBe(false);
  });
});
