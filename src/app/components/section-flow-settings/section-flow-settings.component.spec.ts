import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SectionFlowSettingsComponent } from './section-flow-settings.component';
import { DependencyChip } from '../../pages/template-builder/flow-editor.helpers';
import { GateKind, JoinMode } from '../../models/checklist.model';

const CHIPS: DependencyChip[] = [
  { id: 'prep', title: 'Préparation', selected: true, disabled: false },
  { id: 'tests', title: 'Tests', selected: false, disabled: true },
  { id: 'doc', title: 'Documentation', selected: false, disabled: false }
];

describe('SectionFlowSettingsComponent', () => {
  let fixture: ComponentFixture<SectionFlowSettingsComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const chip = (title: string) => [...el().querySelectorAll<HTMLButtonElement>('.dep-chip')].find(c => c.textContent!.trim() === title)!;
  const legends = () => [...el().querySelectorAll('legend')].map(l => l.textContent!.trim());

  const render = (inputs: Partial<{ chips: DependencyChip[]; dependencyCount: number; hasDependents: boolean; gate: GateKind; joinMode: JoinMode }> = {}) => {
    fixture.componentRef.setInput('sectionId', 'build');
    fixture.componentRef.setInput('chips', inputs.chips ?? CHIPS);
    fixture.componentRef.setInput('dependencyCount', inputs.dependencyCount ?? 1);
    fixture.componentRef.setInput('hasDependents', inputs.hasDependents ?? false);
    fixture.componentRef.setInput('gate', inputs.gate);
    fixture.componentRef.setInput('joinMode', inputs.joinMode);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SectionFlowSettingsComponent] }).compileComponents();
    fixture = TestBed.createComponent(SectionFlowSettingsComponent);
  });

  it('affiche les puces actives, désactivées et expliquées', () => {
    render();
    expect(chip('Préparation').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Documentation').getAttribute('aria-pressed')).toBe('false');
    const loop = chip('Tests');
    expect(loop.disabled).toBe(true);
    expect(loop.title).toBe('Créerait une boucle');
    expect(el().querySelector('#' + loop.getAttribute('aria-describedby'))!.textContent).toBe('Créerait une boucle');
    expect(el().querySelector('.start-hint')).toBeNull();
  });

  it('émet la dépendance basculée', () => {
    render();
    const toggled: string[] = [];
    fixture.componentInstance.toggleDependency.subscribe(id => toggled.push(id));
    chip('Documentation').click();
    chip('Préparation').click();
    chip('Tests').click();
    expect(toggled).toEqual(['doc', 'prep']);
  });

  it('signale une étape de départ et ne propose ni porte ni jonction sans objet', () => {
    render({ chips: CHIPS.map(c => ({ ...c, selected: false })), dependencyCount: 0 });
    expect(el().querySelector('.start-hint')!.textContent).toContain('étape de départ');
    expect(legends()).toEqual([]);
  });

  it('propose la porte quand d’autres sections dépendent de la section, avec la valeur par défaut', () => {
    render({ hasDependents: true });
    expect(legends()).toEqual(['Porte']);
    const checked = el().querySelector<HTMLInputElement>('input[value="hard"]')!;
    expect(checked.checked).toBe(true);

    const gates: GateKind[] = [];
    fixture.componentInstance.gateChange.subscribe(g => gates.push(g));
    el().querySelector<HTMLInputElement>('input[value="soft"]')!.click();
    expect(gates).toEqual(['soft']);
  });

  it('propose la jonction à partir de deux dépendances', () => {
    render({ dependencyCount: 2, joinMode: 'any' });
    expect(legends()).toEqual(['Jonction']);
    expect(el().querySelector<HTMLInputElement>('input[value="any"]')!.checked).toBe(true);

    const modes: JoinMode[] = [];
    fixture.componentInstance.joinModeChange.subscribe(m => modes.push(m));
    el().querySelector<HTMLInputElement>('input[value="all"]')!.click();
    expect(modes).toEqual(['all']);
  });
});
