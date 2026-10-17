import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LucideDynamicIcon } from '@lucide/angular';
import { STEP_ICON_NAMES } from '../../domain/step-icons';
import { provideStepIcons, STEP_ICON_COMPONENTS } from './step-icons';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Icône par nom imbriquée dans un `<svg>`, comme dans le graphe des étapes. */
@Component({
  standalone: true,
  imports: [LucideDynamicIcon],
  template: `
    <svg width="100" height="100">
      <g transform="translate(10 10)">
        <svg [lucideIcon]="name()" [size]="20"></svg>
      </g>
    </svg>
  `
})
class NestedIconHost {
  readonly name = input.required<string>();
}

describe('Icônes d’étape enregistrées', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NestedIconHost], providers: [provideStepIcons()] });
  });

  it('enregistre exactement les noms de la liste fermée', () => {
    expect(STEP_ICON_COMPONENTS.map(c => c.icon.name).sort()).toEqual([...STEP_ICON_NAMES].sort());
  });

  it.each([...STEP_ICON_NAMES])('« %s » produit une icône non vide, imbriquée dans un <svg>', name => {
    const fixture = TestBed.createComponent(NestedIconHost);
    fixture.componentRef.setInput('name', name);
    fixture.detectChanges();
    const icon = (fixture.nativeElement as HTMLElement).querySelector('g > svg')!;
    expect(icon.namespaceURI).toBe(SVG_NS);
    expect(icon.children.length).toBeGreaterThan(0);
    expect(icon.firstElementChild!.namespaceURI).toBe(SVG_NS);
    expect(icon.getAttribute('width')).toBe('20');
  });
});
