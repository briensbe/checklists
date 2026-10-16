import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router, provideRouter } from '@angular/router';
import { TemplatesListComponent } from './templates-list.component';
import { TemplateService } from '../../services/template.service';
import { DialogService } from '../../services/dialog.service';
import { ChecklistTemplate } from '../../models/checklist.model';

describe('TemplatesListComponent', () => {
  let component: TemplatesListComponent;
  let fixture: ComponentFixture<TemplatesListComponent>;
  let router: Router;
  let dialogService: DialogService;
  let templateService: TemplateService;

  const mockTemplate: ChecklistTemplate = {
    id: 'test-tpl',
    name: 'Template Test',
    version: '1.0',
    description: 'Description',
    updatedAt: '2026-10-16T12:00:00.000Z',
    contextSchema: [],
    sections: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplatesListComponent],
      providers: [
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TemplatesListComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
    dialogService = TestBed.inject(DialogService);
    templateService = TestBed.inject(TemplateService);
  });

  it('devrait naviguer vers /checklists?new=<templateId> lors de launchChecklist sans prompt', () => {
    component.launchChecklist(mockTemplate);

    expect(router.navigate).toHaveBeenCalledWith(['/checklists'], {
      queryParams: { new: 'test-tpl' }
    });
  });

  it('devrait demander confirmation via DialogService lors de la suppression de modèle', async () => {
    vi.spyOn(templateService, 'deleteTemplate').mockResolvedValue();
    const confirmSpy = vi.spyOn(dialogService, 'confirm').mockResolvedValue(true);

    await component.deleteTemplate('test-tpl');

    expect(confirmSpy).toHaveBeenCalled();
    expect(templateService.deleteTemplate).toHaveBeenCalledWith('test-tpl');
  });

  it('ne devrait pas supprimer le modèle si la confirmation est refusée', async () => {
    vi.spyOn(templateService, 'deleteTemplate').mockResolvedValue();
    vi.spyOn(dialogService, 'confirm').mockResolvedValue(false);

    await component.deleteTemplate('test-tpl');

    expect(templateService.deleteTemplate).not.toHaveBeenCalled();
  });
});
