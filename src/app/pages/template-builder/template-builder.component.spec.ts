import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { TemplateBuilderComponent } from './template-builder.component';
import { TemplateService } from '../../services/template.service';
import { ToastService } from '../../services/toast.service';

describe('TemplateBuilderComponent', () => {
  let component: TemplateBuilderComponent;
  let fixture: ComponentFixture<TemplateBuilderComponent>;
  let templateService: TemplateService;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateBuilderComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateBuilderComponent);
    component = fixture.componentInstance;
    templateService = TestBed.inject(TemplateService);
    toastService = TestBed.inject(ToastService);
    toastService.clear();

    vi.spyOn(templateService, 'initTemplates').mockResolvedValue();
    fixture.detectChanges();
  });

  it('devrait supprimer une section avec toast d’annulation et pouvoir la restaurer', async () => {
    expect(component.template().sections.length).toBe(1);

    component.removeSection(0);
    expect(component.template().sections.length).toBe(0);
    expect(toastService.toasts().length).toBe(1);

    const toast = toastService.toasts()[0];
    await toast.action?.run();

    expect(component.template().sections.length).toBe(1);
  });

  it('devrait afficher un toast d’avertissement si le nom du modèle est vide lors de la sauvegarde', async () => {
    const warningSpy = vi.spyOn(toastService, 'warning');
    const saveSpy = vi.spyOn(templateService, 'saveTemplate');

    component.template.update(t => ({ ...t, name: '   ' }));
    await component.save();

    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('nom pour le modèle'));
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
