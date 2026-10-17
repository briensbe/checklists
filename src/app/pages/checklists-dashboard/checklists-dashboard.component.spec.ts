import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivatedRoute, Router } from '@angular/router';
import { ChecklistsDashboardComponent } from './checklists-dashboard.component';
import { ChecklistSessionService } from '../../services/checklist-session.service';
import { TemplateService } from '../../services/template.service';
import { ToastService } from '../../services/toast.service';
import { ChecklistSession, ChecklistTemplate } from '../../models/checklist.model';

describe('ChecklistsDashboardComponent', () => {
  let component: ChecklistsDashboardComponent;
  let fixture: ComponentFixture<ChecklistsDashboardComponent>;
  let sessionService: ChecklistSessionService;
  let templateService: TemplateService;
  let toastService: ToastService;

  const mockTemplate: ChecklistTemplate = {
    id: 'tpl-1',
    name: 'Template 1',
    version: '1.0',
    description: 'Description 1',
    updatedAt: '2026-10-16T12:00:00.000Z',
    contextSchema: [],
    sections: []
  };

  const mockSession: ChecklistSession = {
    id: 'sess-123',
    title: 'Session Alpha',
    templateId: 'tpl-1',
    templateSnapshot: mockTemplate,
    status: 'in_progress',
    closures: [],
    contextValues: {},
    answers: {},
    createdAt: '2026-10-16T12:00:00Z',
    updatedAt: '2026-10-16T12:00:00Z'
  };

  afterEach(() => {
    // Des minuteurs simulés laissés actifs figeraient `fake-indexeddb` dans les fichiers de test suivants.
    vi.useRealTimers();
  });

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [ChecklistsDashboardComponent],
      providers: [
        {
          provide: Router,
          useValue: { navigate: vi.fn() }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: vi.fn().mockReturnValue(null)
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChecklistsDashboardComponent);
    component = fixture.componentInstance;
    sessionService = TestBed.inject(ChecklistSessionService);
    templateService = TestBed.inject(TemplateService);
    toastService = TestBed.inject(ToastService);
    toastService.clear();

    sessionService.allSessions.set([mockSession]);
    vi.spyOn(templateService, 'availableTemplates').mockReturnValue([mockTemplate]);
    vi.spyOn(templateService, 'initTemplates').mockResolvedValue();
    vi.spyOn(sessionService, 'loadAllSessions').mockResolvedValue([mockSession]);
  });

  it('affiche dans la liste le modèle présélectionné par ?new=<id>, même s’il n’est pas le premier', async () => {
    const second: ChecklistTemplate = { ...mockTemplate, id: 'tpl-2', name: 'Mise en production' };
    vi.spyOn(templateService, 'availableTemplates').mockReturnValue([mockTemplate, second]);
    const route = TestBed.inject(ActivatedRoute);
    vi.mocked(route.snapshot.queryParamMap.get).mockImplementation(key => (key === 'new' ? 'tpl-2' : null));

    await component.ngOnInit();
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('.modal-card select')!;
    expect(component.selectedTemplateId()).toBe('tpl-2');
    expect(select.value).toBe('tpl-2');
    expect(select.selectedOptions[0].textContent).toContain('Mise en production');
  });

  it('devrait supprimer une session avec possibilité d’annulation (optimiste)', () => {
    const deleteSpy = vi.spyOn(sessionService, 'deleteSession').mockResolvedValue();
    const event = new MouseEvent('click');

    component.deleteSession(event, 'sess-123');

    // La session est retirée immédiatement du signal
    expect(sessionService.allSessions().length).toBe(0);
    // Un toast d'annulation est visible
    expect(toastService.toasts().length).toBe(1);
    expect(toastService.toasts()[0].action?.label).toBe('Annuler');
    // deleteSession en base n'a pas encore été appelé
    expect(deleteSpy).not.toHaveBeenCalled();

    // Avancement de 6 secondes : la suppression définitive est exécutée
    vi.advanceTimersByTime(6000);
    expect(deleteSpy).toHaveBeenCalledWith('sess-123');
  });

  it('devrait restaurer la session dans la liste si l’utilisateur clique sur Annuler', async () => {
    const deleteSpy = vi.spyOn(sessionService, 'deleteSession').mockResolvedValue();
    const event = new MouseEvent('click');

    component.deleteSession(event, 'sess-123');
    expect(sessionService.allSessions().length).toBe(0);

    const toast = toastService.toasts()[0];
    await toast.action?.run();

    // La session est réintégrée
    expect(sessionService.allSessions().length).toBe(1);
    expect(sessionService.allSessions()[0].id).toBe('sess-123');

    // Expiration du délai : aucun delete n'est exécuté
    vi.advanceTimersByTime(6000);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('devrait exécuter flushPending lors de ngOnDestroy', () => {
    const deleteSpy = vi.spyOn(sessionService, 'deleteSession').mockResolvedValue();
    const event = new MouseEvent('click');

    component.deleteSession(event, 'sess-123');
    expect(deleteSpy).not.toHaveBeenCalled();

    // Déchargement du composant
    component.ngOnDestroy();
    expect(deleteSpy).toHaveBeenCalledWith('sess-123');
  });
});
