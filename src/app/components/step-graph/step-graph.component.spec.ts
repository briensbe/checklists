import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepGraphComponent } from './step-graph.component';
import { provideStepIcons } from './step-icons';
import { StepGraphNode } from '../../domain/step-graph-layout';

const node = (id: string, overrides: Partial<StepGraphNode> = {}): StepGraphNode => ({
  id,
  label: id,
  column: 0,
  parents: [],
  order: 0,
  icon: 'list-checks',
  visual: 'open',
  passed: false,
  answered: 0,
  total: 2,
  anomaly: false,
  join: null,
  ...overrides
});

/** « Mise en production » : Préparation franchie, Build et Documentation ouvertes, la suite verrouillée. */
const RELEASE: StepGraphNode[] = [
  node('prep', { label: 'Préparation', icon: 'clipboard-list', visual: 'done', passed: true, answered: 2, total: 2 }),
  node('build', { label: 'Build', icon: 'hammer', column: 1, parents: ['prep'], order: 1, answered: 1 }),
  node('doc', { label: 'Documentation', icon: 'book-open', column: 1, parents: ['prep'], order: 2, answered: 1, total: 3, anomaly: true }),
  node('tests', { label: 'Tests', column: 2, parents: ['build'], order: 3, visual: 'locked' }),
  node('go', { label: 'Go / no-go', column: 3, parents: ['tests', 'doc'], order: 4, visual: 'locked', join: { ready: 1, total: 2 } }),
  node('deploy', { label: 'Déploiement', column: 4, parents: ['go'], order: 5, visual: 'locked' })
];

describe('StepGraphComponent', () => {
  let fixture: ComponentFixture<StepGraphComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const nodeEl = (label: string) =>
    [...el().querySelectorAll<SVGGElement>('g.node')].find(n => n.getAttribute('aria-label')!.startsWith(label + ' :'))!;

  const render = (nodes = RELEASE, selectedId: string | null = 'build', pulseIds: string[] = []) => {
    fixture.componentRef.setInput('nodes', nodes);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.componentRef.setInput('pulseIds', pulseIds);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StepGraphComponent], providers: [provideStepIcons()] }).compileComponents();
    fixture = TestBed.createComponent(StepGraphComponent);
  });

  it('dessine un nœud par étape et un lien par dépendance, dans un seul <svg> nommé', () => {
    render();
    const svg = el().querySelector('svg.graph')!;
    expect(svg.getAttribute('role')).toBe('group');
    expect(svg.getAttribute('aria-label')).toBe('Chemin des étapes');
    expect(el().querySelectorAll('g.node')).toHaveLength(6);
    expect(el().querySelectorAll('path.edge')).toHaveLength(6);
    expect(el().querySelector('g.edges')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('liens pleins depuis une étape franchie, en pointillés sinon', () => {
    render();
    const edges = [...el().querySelectorAll('path.edge')];
    expect(edges.filter(e => e.classList.contains('is-open'))).toHaveLength(2); // depuis « Préparation »
  });

  it('étape verrouillée : cadenas, sans anneau ; étape terminée : coche et anneau complet', () => {
    render();
    const tests = nodeEl('Tests');
    expect(tests.classList.contains('is-locked')).toBe(true);
    expect(tests.querySelector('.ring-value')).toBeNull();
    expect(tests.querySelector('svg[lucidelock], svg.lucide-lock')).not.toBeNull();

    const prep = nodeEl('Préparation');
    expect(prep.querySelector('svg.lucide-check')).not.toBeNull();
    expect(prep.querySelector('.ring-value')!.classList.contains('is-complete')).toBe(true);
    expect(Number(prep.querySelector('.ring-value')!.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
  });

  it('étape ouverte : icône de l’étape et anneau proportionnel ; anomalie en couleur dédiée', () => {
    render();
    const build = nodeEl('Build');
    expect(build.querySelector('svg.lucide-hammer')).not.toBeNull();
    const ring = build.querySelector('.ring-value')!;
    const circumference = Number(ring.getAttribute('stroke-dasharray'));
    expect(Number(ring.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference / 2, 5);
    expect(nodeEl('Documentation').querySelector('.ring-value')!.classList.contains('is-anomaly')).toBe(true);
  });

  it('badge de jonction n/m, distingué quand toutes les branches sont prêtes', () => {
    render();
    const badge = nodeEl('Go / no-go').querySelector('.join-badge')!;
    expect(badge.textContent!.trim()).toBe('1/2');
    expect(badge.classList.contains('is-ready')).toBe(false);

    render(RELEASE.map(n => (n.id === 'go' ? { ...n, join: { ready: 2, total: 2 } } : n)));
    expect(nodeEl('Go / no-go').querySelector('.join-badge')!.classList.contains('is-ready')).toBe(true);
  });

  it('nœuds au rôle de bouton, nom accessible complet et étape courante', () => {
    render();
    const go = nodeEl('Go / no-go');
    expect(go.getAttribute('role')).toBe('button');
    expect(go.getAttribute('tabindex')).toBe('0');
    expect(go.getAttribute('aria-label')).toBe('Go / no-go : verrouillée, 0 sur 2 contrôles, 1 branche prête sur 2');
    expect(nodeEl('Build').getAttribute('aria-current')).toBe('step');
    expect(go.getAttribute('aria-current')).toBeNull();
    // Ordre de tabulation : ordre topologique reçu
    expect([...el().querySelectorAll('g.node')].map(n => n.getAttribute('aria-label')!.split(' :')[0])).toEqual([
      'Préparation',
      'Build',
      'Documentation',
      'Tests',
      'Go / no-go',
      'Déploiement'
    ]);
  });

  it('sélectionne une étape au clic, à Entrée et à Espace (sans action par défaut)', () => {
    render();
    const selected: string[] = [];
    fixture.componentInstance.select.subscribe(id => selected.push(id));

    nodeEl('Documentation').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    nodeEl('Tests').dispatchEvent(enter);
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    nodeEl('Build').dispatchEvent(space);

    expect(selected).toEqual(['doc', 'tests', 'build']);
    expect(enter.defaultPrevented).toBe(true);
    expect(space.defaultPrevented).toBe(true);
  });

  it('anime les nœuds qui viennent de s’ouvrir', () => {
    render(RELEASE, 'build', ['build', 'doc']);
    expect(nodeEl('Build').querySelector('.node-body')!.classList.contains('is-pulse')).toBe(true);
    expect(nodeEl('Tests').querySelector('.node-body')!.classList.contains('is-pulse')).toBe(false);
  });

  it('positionne tout en pixels, sans aucun pourcentage', () => {
    render();
    const svg = el().querySelector('svg.graph')!;
    const attributes = [...el().querySelectorAll('*')].flatMap(e => [...e.attributes].map(a => a.value));
    expect(attributes.some(v => v.includes('%'))).toBe(false);
    expect(Number(svg.getAttribute('width'))).toBeGreaterThan(0);
    expect(nodeEl('Build').getAttribute('transform')).toMatch(/^translate\(\d+(\.\d+)? \d+(\.\d+)?\)$/);
  });

  describe('variante « structure » (aperçu du builder)', () => {
    const renderStructure = (nodes = RELEASE) => {
      fixture.componentRef.setInput('variant', 'structure');
      render(nodes, null);
    };

    it('la variante par défaut reste celle du runner', () => {
      render();
      expect(nodeEl('Tests').classList.contains('is-locked')).toBe(true);
      expect(el().querySelectorAll('.node-caption')).toHaveLength(0);
    });

    it('ni anneau, ni cadenas, ni coche, ni badge de jonction ; icône fournie et liens pleins neutres', () => {
      renderStructure();
      expect(el().querySelectorAll('.ring-value, .ring-track, .join-badge')).toHaveLength(0);
      expect(el().querySelectorAll('svg.lucide-lock, svg.lucide-check')).toHaveLength(0);
      expect(nodeEl('Préparation').querySelector('svg.lucide-clipboard-list')).not.toBeNull();
      expect(nodeEl('Tests').querySelector('svg.lucide-list-checks')).not.toBeNull();
      const edges = [...el().querySelectorAll('path.edge')];
      expect(edges.every(e => e.classList.contains('is-structure') && !e.classList.contains('is-open'))).toBe(true);
    });

    it('affiche la légende sous le libellé, sans chevaucher le nœud placé en dessous', () => {
      const captioned = RELEASE.map(n => ({ ...n, caption: '3 items · 2 bloq.' }));
      renderStructure(captioned);
      const build = nodeEl('Build');
      expect(build.querySelector('.node-caption')!.textContent!.trim()).toBe('3 items · 2 bloq.');

      // « Build » et « Documentation » partagent une colonne : la légende du premier finit avant le nœud du second.
      const y = (n: SVGGElement) => Number(n.getAttribute('transform')!.match(/ (\d+(\.\d+)?)\)$/)![1]);
      const [top, bottom] = [nodeEl('Build'), nodeEl('Documentation')].sort((a, b) => y(a) - y(b));
      const captionBottom = y(top) + Number(top.querySelector('.node-caption')!.getAttribute('y')) + 4;
      expect(captionBottom).toBeLessThan(y(bottom) - 28);
    });

    it('annonce le nom accessible fourni à la place du nom calculé', () => {
      renderStructure(RELEASE.map(n => (n.id === 'prep' ? { ...n, ariaLabel: 'Préparation : étape de départ, 3 items dont 2 bloquants' } : n)));
      expect(nodeEl('Préparation').getAttribute('aria-label')).toBe('Préparation : étape de départ, 3 items dont 2 bloquants');
    });

    it('sélectionne une étape au clavier', () => {
      renderStructure();
      const selected: string[] = [];
      fixture.componentInstance.select.subscribe(id => selected.push(id));
      nodeEl('Tests').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      nodeEl('Build').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      expect(selected).toEqual(['tests', 'build']);
    });
  });

  it('libellé raccourci sous le nœud, complet dans le titre', () => {
    const long = 'Binaires, Livrables & Checksums de la livraison';
    render([node('bin', { label: long })], null);
    const n = el().querySelector('g.node')!;
    expect(n.querySelector('.node-label')!.textContent!.trim().endsWith('…')).toBe(true);
    expect(n.querySelector('title')!.textContent).toBe(long);
  });
});
