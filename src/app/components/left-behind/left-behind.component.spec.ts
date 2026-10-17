import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeftBehindComponent, LeftBehindEntry } from './left-behind.component';

describe('LeftBehindComponent', () => {
  let fixture: ComponentFixture<LeftBehindComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  const render = (entries: LeftBehindEntry[]) => {
    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeftBehindComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeftBehindComponent);
  });

  it('ne s’affiche pas quand la liste est vide', () => {
    render([]);
    expect(el().querySelector('.left-behind')).toBeNull();
  });

  it('liste les contrôles avec leur étape et leur raison, et mène au contrôle choisi', () => {
    render([
      { itemId: 'changelog', label: 'Changelog rédigé', sectionTitle: 'Préparation', reason: 'sans réponse' },
      { itemId: 'perf', label: 'Tests de performance', sectionTitle: 'Tests', reason: 'preuve à compléter' }
    ]);
    expect(el().querySelector('.left-behind-title')!.textContent).toContain('Laissés en route (2)');
    const items = [...el().querySelectorAll<HTMLButtonElement>('.left-behind-item')];
    expect(items[0].textContent!.replace(/\s+/g, ' ')).toContain('Changelog rédigé, étape Préparation, sans réponse');

    const selected: string[] = [];
    fixture.componentInstance.select.subscribe(id => selected.push(id));
    items[1].click();
    expect(selected).toEqual(['perf']);
  });
});
