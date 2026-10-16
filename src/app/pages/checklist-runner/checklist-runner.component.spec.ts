import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ChecklistRunnerComponent } from './checklist-runner.component';
import { ChecklistSessionService } from '../../services/checklist-session.service';
import { TemplateService } from '../../services/template.service';
import { ExportService } from '../../services/export.service';
import { EvidenceService } from '../../services/evidence.service';
import { DialogService } from '../../services/dialog.service';
import { ToastService } from '../../services/toast.service';
import { ChecklistSession } from '../../models/checklist.model';

describe('ChecklistRunnerComponent', () => {
  let component: ChecklistRunnerComponent;
  let fixture: ComponentFixture<ChecklistRunnerComponent>;
  let sessionService: ChecklistSessionService;
  let dialogService: DialogService;
  let toastService: ToastService;
  let exportService: ExportService;

  const mockSession: ChecklistSession = {
    id: 'runner-sess-1',
    title: 'Runner Session',
    templateId: 'tpl-1',
    templateSnapshot: {
      id: 'tpl-1',
      name: 'Template 1',
      version: '1.0',
      description: 'Desc',
      updatedAt: '2026-10-16T12:00:00.000Z',
      contextSchema: [],
      sections: [
        {
          id: 'sec-1',
          title: 'Section 1',
          items: [
            { id: 'item-1', label: 'Item 1' },
            { id: 'item-2', label: 'Item 2' }
          ]
        }
      ]
    },
    status: 'in_progress',
    closures: [],
    contextValues: {},
    answers: {
      'item-1': { status: 'KO', comment: 'Anomalie', extra: {} }
    },
    createdAt: '2026-10-16T12:00:00Z',
    updatedAt: '2026-10-16T12:00:00Z'
  };

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [ChecklistRunnerComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: vi.fn().mockReturnValue('runner-sess-1')
              },
              queryParamMap: {
                get: vi.fn().mockReturnValue(null)
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChecklistRunnerComponent);
    component = fixture.componentInstance;
    sessionService = TestBed.inject(ChecklistSessionService);
    dialogService = TestBed.inject(DialogService);
    toastService = TestBed.inject(ToastService);
    exportService = TestBed.inject(ExportService);
    toastService.clear();

    sessionService.currentSession.set(mockSession);
    vi.spyOn(TestBed.inject(TemplateService), 'initTemplates').mockResolvedValue();
    vi.spyOn(TestBed.inject(EvidenceService), 'loadEvidenceCounts').mockResolvedValue();
  });

  it('devrait permettre d’annuler le passage groupé à OK et restaurer les réponses initiales', async () => {
    const restoreSpy = vi.spyOn(sessionService, 'restoreAnswers').mockResolvedValue();
    vi.spyOn(sessionService, 'markRemainingAsOk').mockResolvedValue(1);

    await component.onMarkAllOk();

    expect(toastService.toasts().length).toBe(1);
    expect(toastService.toasts()[0].message).toContain('1 contrôle(s) passé(s) à OK');

    const undoAction = toastService.toasts()[0].action;
    expect(undoAction).toBeDefined();

    // Clic sur Annuler
    await undoAction?.run();

    expect(restoreSpy).toHaveBeenCalledWith({
      'item-1': { status: 'KO', comment: 'Anomalie', extra: {} }
    });
  });

  it('devrait demander confirmation via DialogService pour la réinitialisation de session', async () => {
    const resetSpy = vi.spyOn(sessionService, 'resetSession').mockResolvedValue();
    const confirmSpy = vi.spyOn(dialogService, 'confirm').mockResolvedValue(true);

    await component.onResetSession();

    expect(confirmSpy).toHaveBeenCalled();
    expect(resetSpy).toHaveBeenCalled();
  });

  it('devrait demander confirmation via DialogService pour la réouverture d’une session', async () => {
    const reopenSpy = vi.spyOn(sessionService, 'reopenSession').mockResolvedValue();
    const confirmSpy = vi.spyOn(dialogService, 'confirm').mockResolvedValue(true);

    await component.onReopen();

    expect(confirmSpy).toHaveBeenCalled();
    expect(reopenSpy).toHaveBeenCalled();
  });

  it('devrait afficher un toast danger en cas d’échec d’export PDF sans faire alert()', async () => {
    vi.spyOn(exportService, 'exportPdf').mockRejectedValue(new Error('Erreur PDF'));
    const dangerSpy = vi.spyOn(toastService, 'danger');

    await component.onExportPdf();

    expect(dangerSpy).toHaveBeenCalledWith(expect.stringContaining('Erreur PDF'));
  });
});
