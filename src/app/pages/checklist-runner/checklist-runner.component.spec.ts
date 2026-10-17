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
import { RunnerController, RUNNER_VIEW_STORAGE_KEY } from './runner-controller';
import { provideStepIcons } from '../../components/step-graph/step-icons';

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
        provideStepIcons(),
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

  afterEach(() => {
    // Des minuteurs simulés laissés actifs figeraient `fake-indexeddb` dans les fichiers de test suivants.
    vi.useRealTimers();
  });

  it('devrait permettre d’annuler le passage groupé à OK et restaurer les réponses initiales', async () => {
    const restoreSpy = vi.spyOn(sessionService, 'restoreAnswers').mockResolvedValue();
    vi.spyOn(sessionService, 'markRemainingAsOk').mockResolvedValue({ modified: 1, skippedForEvidence: 0, skippedLocked: 0 });

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
    vi.spyOn(sessionService, 'markRemainingAsOk').mockResolvedValue({ modified: 2, skippedForEvidence: 1, skippedLocked: 0 });
    await component.onMarkAllOk();
    expect(toastService.toasts()[0].message).toBe('2 contrôle(s) passé(s) à OK. 1 bloquant(s) laissé(s) sans réponse faute de preuve.');
  });

  it('signale dans le toast que les étapes verrouillées n’ont pas été modifiées', async () => {
    const mark = vi.spyOn(sessionService, 'markRemainingAsOk');
    mark.mockResolvedValue({ modified: 3, skippedForEvidence: 0, skippedLocked: 2 });
    await component.onMarkAllOk();
    expect(toastService.toasts()[0].message).toBe('3 contrôle(s) passé(s) à OK. Les étapes verrouillées n’ont pas été modifiées.');

    toastService.clear();
    mark.mockResolvedValue({ modified: 0, skippedForEvidence: 0, skippedLocked: 2 });
    await component.onMarkAllOk();
    expect(toastService.toasts()[0].message).toBe('Aucun contrôle passé à OK : Les étapes verrouillées n’ont pas été modifiées.');
  });

  describe('clôture avec une preuve manquante', () => {
    const withMissingProof: ChecklistSession = {
      ...mockSession,
      templateSnapshot: {
        ...mockSession.templateSnapshot,
        sections: [
          {
            id: 'sec-1',
            title: 'Tests',
            items: [{ id: 'auto', label: 'Tests automatisés au vert', controlType: 'checkbox', criticality: 'blocking', evidenceRequired: 'photo' }]
          }
        ]
      },
      // Cochée avec sa photo, qui a été supprimée depuis : « preuve manquante »
      answers: { auto: { status: null, checked: true, comment: '' } }
    };

    beforeEach(() => {
      sessionService.currentSession.set(withMissingProof);
      vi.spyOn(fixture.debugElement.injector.get(RunnerController), 'flushEvidenceDeletions').mockResolvedValue();
    });

    it('demande confirmation et laisse la session en cours si l’utilisateur annule', async () => {
      const confirm = vi.spyOn(dialogService, 'confirm').mockResolvedValue(false);
      const complete = vi.spyOn(sessionService, 'completeSession').mockResolvedValue([]);

      await component.onComplete();

      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({ message: '1 contrôle répondu a perdu sa preuve exigée, dont 1 bloquant. Terminer quand même la checklist ?' })
      );
      expect(complete).not.toHaveBeenCalled();
    });

    it('termine la session si l’utilisateur confirme', async () => {
      vi.spyOn(dialogService, 'confirm').mockResolvedValue(true);
      const complete = vi.spyOn(sessionService, 'completeSession').mockResolvedValue([]);
      await component.onComplete();
      expect(complete).toHaveBeenCalledTimes(1);
    });
  });

  describe('vue chemin', () => {
    const flowSession: ChecklistSession = {
      ...mockSession,
      id: 'runner-flow',
      templateSnapshot: {
        ...mockSession.templateSnapshot,
        sections: [
          { id: 'prep', title: 'Préparation', icon: 'clipboard-list', items: [{ id: 'p1', label: 'Ticket validé', controlType: 'checkbox', criticality: 'blocking' }] },
          { id: 'build', title: 'Build', icon: 'hammer', dependsOn: ['prep'], items: [{ id: 'b1', label: 'Build vert', controlType: 'checkbox', criticality: 'blocking' }] }
        ]
      },
      answers: {}
    };

    const render = () => {
      // `ngOnInit` charge la session depuis la base : on lui rend la session déjà en place.
      vi.spyOn(sessionService, 'loadSession').mockResolvedValue(sessionService.currentSession());
      fixture.detectChanges();
    };
    const el = (): HTMLElement => fixture.nativeElement;

    beforeEach(() => {
      localStorage.removeItem(RUNNER_VIEW_STORAGE_KEY);
    });

    afterEach(() => {
      localStorage.removeItem(RUNNER_VIEW_STORAGE_KEY);
    });

    it('sans dépendance : la vue liste actuelle, sans bascule ni graphe', () => {
      render();
      expect(el().querySelector('.view-toggle')).toBeNull();
      expect(el().querySelector('app-step-graph')).toBeNull();
      expect(el().querySelectorAll('app-checklist-section')).toHaveLength(1);
    });

    it('modèle à dépendances : graphe et panneau d’étape, puis bascule mémorisée vers la liste', () => {
      sessionService.currentSession.set(flowSession);
      render();
      expect(el().querySelector('app-step-graph svg.graph')).not.toBeNull();
      expect(el().querySelector('#step-panel')!.textContent).toContain('Préparation');
      expect(el().querySelector('app-checklist-section')).toBeNull();

      const liste = [...el().querySelectorAll<HTMLButtonElement>('.view-toggle-btn')].find(b => b.textContent!.includes('Liste'))!;
      liste.click();
      fixture.detectChanges();
      expect(localStorage.getItem(RUNNER_VIEW_STORAGE_KEY)).toBe('list');
      expect(el().querySelectorAll('app-checklist-section')).toHaveLength(2);
      // La section verrouillée montre ses prérequis au lieu de lignes de saisie
      expect(el().querySelector('app-step-locked')!.textContent).toContain('Cette étape attend');
    });
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

    it('Espace sur un élément au rôle de bouton (nœud du graphe) ne déclenche pas le geste principal', () => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      node.setAttribute('role', 'button');
      document.body.appendChild(node);
      press(' ', node);
      node.remove();
      expect(handle).not.toHaveBeenCalled();
    });

    it('laisse Échap tranquille quand aucun tiroir n’est ouvert', () => {
      const event = press('Escape');
      expect(handle).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });
  });
});
