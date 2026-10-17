import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepIconPickerComponent } from './step-icon-picker.component';
import { provideStepIcons } from '../step-graph/step-icons';
import { STEP_ICON_NAMES, StepIconName } from '../../domain/step-icons';

describe('StepIconPickerComponent', () => {
  let fixture: ComponentFixture<StepIconPickerComponent>;
  let picked: StepIconName[];
  const el = (): HTMLElement => fixture.nativeElement;
  const trigger = () => el().querySelector<HTMLButtonElement>('.icon-trigger')!;
  const options = () => [...el().querySelectorAll<HTMLButtonElement>('.icon-option')];

  const render = async (icon: string | undefined) => {
    fixture.componentRef.setInput('icon', icon);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StepIconPickerComponent], providers: [provideStepIcons()] }).compileComponents();
    fixture = TestBed.createComponent(StepIconPickerComponent);
    picked = [];
    fixture.componentInstance.pick.subscribe(name => picked.push(name));
    document.body.appendChild(fixture.nativeElement);
  });

  afterEach(() => fixture.nativeElement.remove());

  it('montre l’icône résolue d’un ancien nom Heroicons, avec son libellé français', async () => {
    await render('circle-stack');
    expect(trigger().querySelector('svg.lucide-database')).not.toBeNull();
    expect(trigger().getAttribute('aria-label')).toBe("Icône de l'étape : Base de données");
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('montre l’icône par défaut pour un nom inconnu ou absent', async () => {
    await render('licorne');
    expect(trigger().querySelector('svg.lucide-list-checks')).not.toBeNull();
    await render(undefined);
    expect(trigger().querySelector('svg.lucide-list-checks')).not.toBeNull();
  });

  it('déplie toute la liste fermée, l’icône courante signalée et focalisée', async () => {
    await render('hammer');
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(options()).toHaveLength(STEP_ICON_NAMES.length);
    const current = options().filter(o => o.getAttribute('aria-pressed') === 'true');
    expect(current.map(o => o.getAttribute('aria-label'))).toEqual(['Marteau']);
    expect(document.activeElement).toBe(current[0]);
  });

  it('émet l’icône choisie, referme la palette et rend le focus au bouton', async () => {
    await render('hammer');
    trigger().click();
    fixture.detectChanges();
    options().find(o => o.getAttribute('aria-label') === 'Fiole')!.click();
    fixture.detectChanges();

    expect(picked).toEqual(['flask-conical']);
    expect(options()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger());
  });

  it('Échap referme sans rien émettre et rend le focus au bouton', async () => {
    await render('hammer');
    trigger().click();
    fixture.detectChanges();
    options()[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(picked).toEqual([]);
    expect(options()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger());
  });
});
