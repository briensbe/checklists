import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepLockedComponent } from './step-locked.component';
import { LockedStepItem, StepPrerequisites } from '../../domain/path-view';

describe('StepLockedComponent', () => {
  let fixture: ComponentFixture<StepLockedComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');

  const render = (prerequisites: StepPrerequisites, items: LockedStepItem[]) => {
    fixture.componentRef.setInput('prerequisites', prerequisites);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StepLockedComponent] }).compileComponents();
    fixture = TestBed.createComponent(StepLockedComponent);
  });

  it('montre d’abord les prérequis et leur état, puis les contrôles en texte simple', () => {
    render(
      {
        joinMode: 'all',
        items: [
          { sectionId: 'tests', title: 'Tests', state: 'ready' },
          { sectionId: 'doc', title: 'Documentation', state: 'in-progress' }
        ]
      },
      [
        { id: 'po', label: 'Validation du PO', answerText: null },
        { id: 'rb', label: 'Plan de rollback rédigé', answerText: null }
      ]
    );
    expect(text()).toContain('Cette étape attend :');
    const prereq = [...el().querySelectorAll('.prerequisite')].map(li => li.textContent!.replace(/\s+/g, ' ').trim());
    expect(prereq).toEqual(['Tests, prête', 'Documentation, bloquants en cours']);
    expect([...el().querySelectorAll('.locked-item')].map(li => li.textContent!.trim())).toEqual([
      'Validation du PO',
      'Plan de rollback rédigé'
    ]);
    // Aucune interface de saisie sur une étape verrouillée
    expect(el().querySelectorAll('input, button, textarea, .criticality-badge')).toHaveLength(0);
  });

  it('jonction en mode « any » et étape pas encore ouverte', () => {
    render({ joinMode: 'any', items: [{ sectionId: 'build', title: 'Build', state: 'not-open' }] }, []);
    expect(text()).toContain('Cette étape attend l’une de ces étapes :');
    expect(text()).toContain('pas encore ouverte');
  });

  it('étape reverrouillée : rappelle les réponses conservées', () => {
    render({ joinMode: 'all', items: [{ sectionId: 'build', title: 'Build', state: 'in-progress' }] }, [
      { id: 'rec', label: 'Recette métier validée', answerText: 'fait' },
      { id: 'perf', label: 'Tests de performance', answerText: null }
    ]);
    expect(text()).toContain('Réponses conservées : elles redeviendront modifiables à l’ouverture de la porte.');
    expect(el().querySelector('.locked-answer')!.textContent).toContain('fait');
  });
});
