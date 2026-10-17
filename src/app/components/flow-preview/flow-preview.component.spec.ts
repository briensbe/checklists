import { ComponentFixture, TestBed } from '@angular/core/testing';
import releaseFlowJson from '../../../assets/templates/release-flow.json';
import { FlowPreviewComponent } from './flow-preview.component';
import { provideStepIcons } from '../step-graph/step-icons';
import { ChecklistTemplate } from '../../models/checklist.model';

const releaseFlow = releaseFlowJson as ChecklistTemplate;

describe('FlowPreviewComponent', () => {
  let fixture: ComponentFixture<FlowPreviewComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const banner = () => el().querySelector('.flow-banner');
  const lines = (kind: string) => [...el().querySelectorAll(`.flow-banner-line.is-${kind}`)].map(l => l.textContent!.trim());

  const render = (template: ChecklistTemplate) => {
    fixture.componentRef.setInput('template', template);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FlowPreviewComponent], providers: [provideStepIcons()] }).compileComponents();
    fixture = TestBed.createComponent(FlowPreviewComponent);
  });

  it('dessine le graphe en variante « structure » et annonce un modèle valide', () => {
    render(releaseFlow);
    expect(el().querySelectorAll('app-step-graph g.node')).toHaveLength(6);
    expect(el().querySelectorAll('.ring-value')).toHaveLength(0);
    expect(banner()!.getAttribute('role')).toBe('status');
    expect(lines('ok')).toEqual(['1 départ(s), 1 fin(s), pas de boucle']);
    expect(lines('warning')).toEqual([]);
    expect(el().querySelector('g.node')!.getAttribute('aria-label')).toBe('Préparation : étape de départ, 3 items dont 2 bloquants');
  });

  it('signale une étape sans contrôle en avertissement', () => {
    render({ ...releaseFlow, sections: [...releaseFlow.sections, { id: 'com', title: 'Communication', items: [], dependsOn: ['rf-deploy'] }] });
    expect(lines('warning')).toEqual(['1 étape(s) sans contrôle : « Communication »']);
    expect(lines('ok')).toEqual(['1 départ(s), 1 fin(s), pas de boucle']);
  });

  it('signale une dépendance inconnue en erreur, sans « pas de boucle »', () => {
    const sections = releaseFlow.sections.map(s => (s.id === 'rf-build' ? { ...s, dependsOn: ['rf-prep', 'fantome'] } : s));
    render({ ...releaseFlow, sections });
    expect(lines('error')).toHaveLength(1);
    expect(lines('error')[0]).toContain('section inconnue');
    expect(lines('ok')).toEqual([]);
  });

  it('remplace le graphe par une phrase d’aide quand le modèle n’a aucune dépendance', () => {
    render({ ...releaseFlow, sections: releaseFlow.sections.map(({ dependsOn: _d, ...s }) => s) });
    expect(el().querySelector('app-step-graph')).toBeNull();
    expect(banner()).toBeNull();
    expect(el().querySelector('.flow-preview-empty')!.textContent).toContain('toutes les étapes sont ouvertes dès le début');
  });

  it('émet la section choisie dans l’aperçu', () => {
    render(releaseFlow);
    const chosen: string[] = [];
    fixture.componentInstance.selectSection.subscribe(id => chosen.push(id));
    const tests = [...el().querySelectorAll('g.node')].find(n => n.getAttribute('aria-label')!.startsWith('Tests :'))!;
    tests.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(chosen).toEqual(['rf-tests']);
  });
});
