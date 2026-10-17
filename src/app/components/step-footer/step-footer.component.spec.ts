import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepFooterComponent } from './step-footer.component';
import { StepFooter } from '../../domain/path-view';
import { RunnerController } from '../../pages/checklist-runner/runner-controller';

const footer = (overrides: Partial<StepFooter> = {}): StepFooter => ({
  passed: false,
  unresolvedBlocking: 0,
  next: [],
  isFinal: false,
  allPassed: false,
  naBlocking: [],
  pending: [],
  missing: [],
  forced: null,
  canForce: false,
  ...overrides
});

describe('StepFooterComponent', () => {
  let fixture: ComponentFixture<StepFooterComponent>;
  const controller = {
    selectStep: vi.fn(),
    focusItem: vi.fn(),
    forceGate: vi.fn(async () => true)
  };
  const el = (): HTMLElement => fixture.nativeElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const button = (label: string) => [...el().querySelectorAll('button')].find(b => b.textContent!.includes(label))!;

  const render = (value: StepFooter, readonly = false) => {
    fixture.componentRef.setInput('sectionId', 'doc');
    fixture.componentRef.setInput('footer', value);
    fixture.componentRef.setInput('readonly', readonly);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [StepFooterComponent],
      providers: [{ provide: RunnerController, useValue: controller }]
    }).compileComponents();
    fixture = TestBed.createComponent(StepFooterComponent);
  });

  it('bloquants restants avant d’ouvrir la suite', () => {
    render(footer({ unresolvedBlocking: 2 }));
    expect(text()).toContain('2 bloquants avant d’ouvrir la suite');
    render(footer({ unresolvedBlocking: 1 }));
    expect(text()).toContain('1 bloquant avant d’ouvrir la suite');
  });

  it('porte ouverte (sélectionne l’étape) et branche en attente', () => {
    render(
      footer({
        passed: true,
        next: [
          { sectionId: 'build', title: 'Build', unlocked: true },
          { sectionId: 'go', title: 'Go / no-go', unlocked: false }
        ]
      })
    );
    expect(text()).toContain('« Go / no-go » attend encore une autre branche');
    button('Porte ouverte vers « Build »').click();
    expect(controller.selectStep).toHaveBeenCalledWith('build', true);
  });

  it('étape finale, puis toutes les étapes franchies', () => {
    render(footer({ passed: true, isFinal: true }));
    expect(text()).toContain('Étape finale franchie');
    render(footer({ passed: true, isFinal: true, allPassed: true }));
    expect(text()).toContain('Toutes les étapes sont franchies');
  });

  it('bloquants en N/A, preuves à compléter et manquantes, chacun menant à son contrôle', () => {
    render(
      footer({
        passed: true,
        naBlocking: [{ id: 'p1', label: 'Créneau réservé' }],
        pending: [{ id: 'p2', label: 'Tests de charge' }],
        missing: [
          { id: 'p3', label: 'Tests automatisés' },
          { id: 'p4', label: 'Rapport de sécurité' }
        ]
      })
    );
    expect(text()).toContain('1 bloquant passé en N/A');
    expect(text()).toContain('1 preuve à compléter');
    expect(text()).toContain('2 preuves manquantes');
    button('Rapport de sécurité').click();
    expect(controller.focusItem).toHaveBeenCalledWith('p4', { block: 'center', smooth: true });
  });

  it('affiche la date et la justification d’un forçage', () => {
    render(footer({ passed: true, forced: { sectionId: 'doc', reason: 'Validé par le PO', at: '2026-10-17T14:02:00' } }));
    expect(text()).toContain('Porte forcée le 17/10/2026 à 14:02 : « Validé par le PO »');
  });

  it('forçage : justification obligatoire, puis enregistrement', async () => {
    render(footer({ unresolvedBlocking: 1, canForce: true }));
    button('Forcer le passage').click();
    fixture.detectChanges();

    const submit = button('Forcer') as HTMLButtonElement;
    expect(submit.textContent!.trim()).toBe('Forcer');
    expect(submit.disabled).toBe(true);

    const textarea = el().querySelector('textarea')!;
    textarea.value = '  Runbook livré la semaine prochaine ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(submit.disabled).toBe(false);

    el().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(controller.forceGate).toHaveBeenCalledWith('doc', 'Runbook livré la semaine prochaine');
  });

  it('Échap ferme le formulaire sans rien enregistrer, et n’est pas relayé au runner', () => {
    render(footer({ unresolvedBlocking: 1, canForce: true }));
    button('Forcer le passage').click();
    fixture.detectChanges();
    const textarea = el().querySelector('textarea')!;
    textarea.value = 'Dérogation';
    textarea.dispatchEvent(new Event('input'));

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    textarea.dispatchEvent(escape);
    fixture.detectChanges();

    expect(escape.defaultPrevented).toBe(true);
    expect(el().querySelector('form')).toBeNull();
    expect(controller.forceGate).not.toHaveBeenCalled();
  });

  it('aucune commande de forçage sur une porte stricte ni en lecture seule', () => {
    render(footer({ unresolvedBlocking: 1, canForce: false }));
    expect(button('Forcer le passage')).toBeUndefined();
    render(footer({ unresolvedBlocking: 1, canForce: true }), true);
    expect(button('Forcer le passage')).toBeUndefined();
  });
});
