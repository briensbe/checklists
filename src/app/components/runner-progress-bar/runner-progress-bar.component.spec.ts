import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RunnerProgressBarComponent } from './runner-progress-bar.component';
import { MetricsSummary } from '../../models/checklist.model';
import { NextItemState, SectionProgress } from '../../domain/quick-check';

const METRICS: MetricsSummary = { total: 10, answered: 4, okCount: 3, koCount: 1, naCount: 0, pending: 6, percent: 40 };

describe('RunnerProgressBarComponent', () => {
  let fixture: ComponentFixture<RunnerProgressBarComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  const render = (inputs: { sections?: SectionProgress[]; unresolvedBlocking?: number | null; nextState?: NextItemState }) => {
    fixture.componentRef.setInput('metrics', METRICS);
    fixture.componentRef.setInput('sections', inputs.sections ?? []);
    fixture.componentRef.setInput('unresolvedBlocking', inputs.unresolvedBlocking ?? null);
    fixture.componentRef.setInput('nextState', inputs.nextState ?? 'available');
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RunnerProgressBarComponent] }).compileComponents();
    fixture = TestBed.createComponent(RunnerProgressBarComponent);
  });

  it('dessine un anneau par section, de la couleur de son état, avec un nom accessible', () => {
    render({
      sections: [
        { sectionId: 'prep', title: 'Préparation', answered: 3, total: 5, hasAnomaly: false },
        { sectionId: 'build', title: 'Build', answered: 2, total: 2, hasAnomaly: false },
        { sectionId: 'tests', title: 'Tests', answered: 1, total: 3, hasAnomaly: true }
      ]
    });
    const buttons = [...el().querySelectorAll('.ring-btn')];
    expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual(['Préparation : 3 sur 5', 'Build : 2 sur 2', 'Tests : 1 sur 3']);
    const values = [...el().querySelectorAll('.ring-btn .ring-value')];
    expect(values[0].classList.contains('is-complete') || values[0].classList.contains('is-anomaly')).toBe(false);
    expect(values[1].classList.contains('is-complete')).toBe(true);
    expect(values[2].classList.contains('is-anomaly')).toBe(true);
  });

  it('remplit l’anneau en proportion des réponses', () => {
    render({ sections: [{ sectionId: 'prep', title: 'Préparation', answered: 3, total: 5, hasAnomaly: false }] });
    const ring = el().querySelector('.ring-btn .ring-value')!;
    const circumference = Number(ring.getAttribute('stroke-dasharray'));
    const offset = Number(ring.getAttribute('stroke-dashoffset'));
    expect(offset).toBeCloseTo(circumference * 0.4, 5);
  });

  it('émet la section cliquée', () => {
    render({ sections: [{ sectionId: 'prep', title: 'Préparation', answered: 0, total: 1, hasAnomaly: false }] });
    const clicked = vi.fn();
    fixture.componentInstance.sectionClick.subscribe(clicked);
    (el().querySelector('.ring-btn') as HTMLElement).click();
    expect(clicked).toHaveBeenCalledWith('prep');
  });

  it('affiche les bloquants restants seulement si le modèle en déclare', () => {
    render({ unresolvedBlocking: 2 });
    expect(el().querySelector('.blocking-count')?.textContent).toContain('2 bloquants restants');
    render({ unresolvedBlocking: 0 });
    expect(el().querySelector('.blocking-count')?.textContent).toContain('Aucun bloquant restant');
    render({ unresolvedBlocking: null });
    expect(el().querySelector('.blocking-count')).toBeNull();
  });

  it('désactive « Prochain item à traiter » quand tout est renseigné', () => {
    render({ nextState: 'all-done' });
    const next = el().querySelector<HTMLButtonElement>('.btn-next')!;
    expect(next.disabled).toBe(true);
    expect(next.textContent).toContain('Tout est renseigné');
  });

  it('désactive « Prochain item à traiter » quand les contrôles restants attendent l’ouverture de leur étape', () => {
    render({ nextState: 'locked-only' });
    const next = el().querySelector<HTMLButtonElement>('.btn-next')!;
    expect(next.disabled).toBe(true);
    expect(next.textContent).toContain('Contrôles restants dans des étapes verrouillées');

    render({ nextState: 'available' });
    expect(next.disabled).toBe(false);
    expect(next.getAttribute('aria-label')).toBe('Prochain item à traiter');
  });
});
