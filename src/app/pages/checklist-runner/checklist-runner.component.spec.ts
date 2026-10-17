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
import { RunnerController } from './runner-controller';

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
    vi.spyOn(sessionService, 'markRemainingAsOk').mockResolvedValue({ modified: 1, skippedForEvidence: 0 });

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

  it('signale dans le toast les bloquants laissés sans réponse faute de preuve', async () => {
    vi.spyOn(sessionService, 'markRemainingAsOk').mockResolvedValue({ modified: 2, skippedForEvidence: 1 });
    await component.onMarkAllOk();
    expect(toastService.toasts()[0].message).toBe('2 contrôle(s) passé(s) à OK. 1 bloquant(s) laissé(s) sans réponse faute de preuve.');
  });

  it('exécute les suppressions de preuves en attente avant une clôture acceptée, pas avant une clôture refusée', async () => {
    const controller = fixture.debugElement.injector.get(RunnerController);
    const flush = vi.spyOn(controller, 'flushEvidenceDeletions').mockResolvedValue();
    const complete = vi.spyOn(sessionService, 'completeSession').mockResolvedValue([]);

    await component.onComplete(); // KO sans justification et item sans réponse : clôture refusée
    expect(flush).not.toHaveBeenCalled();

    sessionService.currentSession.set({
      ...mockSession,
      answers: { 'item-1': { status: 'OK', comment: '' }, 'item-2': { status: 'NA', comment: '' } }
    });
    await component.onComplete();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  describe('raccourcis clavier', () => {
    let controller: RunnerController;
    let handle: ReturnType<typeof vi.spyOn>;

    const press = (key: string, target: EventTarget = document.body, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };

    beforeEach(() => {
      controller = fixture.debugElement.injector.get(RunnerController);
      handle = vi.spyOn(controller, 'handleShortcut').mockResolvedValue(true);
    });

    it('déclenche le geste principal par Espace, sans défilement de la page', () => {
      const event = press(' ');
      expect(handle).toHaveBeenCalledWith('primary');
      expect(event.defaultPrevented).toBe(true);
    });

    it('ignore les raccourcis pendant une saisie', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      press('k', input);
      press(' ', input);
      input.remove();
      expect(handle).not.toHaveBeenCalled();
    });

    it('ignore les raccourcis quand une fenêtre modale est ouverte', () => {
      component.isJsonDraftModalOpen.set(true);
      press('k');
      expect(handle).not.toHaveBeenCalled();
    });

    it('laisse passer les raccourcis du navigateur', () => {
      const event = press('a', document.body, { ctrlKey: true });
      expect(handle).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('Session terminée : ni Espace ni K, mais la navigation et le tiroir restent', () => {
      sessionService.currentSession.set({ ...mockSession, status: 'completed' });
      press(' ');
      press('k');
      press('ArrowDown');
      press('a');
      expect(handle.mock.calls.map((call: unknown[]) => call[0])).toEqual(['next', 'drawer']);
    });

    it('ouvre l’aide avec la touche ?', async () => {
      handle.mockRestore();
      press('?');
      await Promise.resolve();
      expect(controller.helpOpen()).toBe(true);
      expect(component.isModalOpen()).toBe(true);
    });

    it('laisse Échap tranquille quand aucun tiroir n’est ouvert', () => {
      const event = press('Escape');
      expect(handle).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });
  });
});
