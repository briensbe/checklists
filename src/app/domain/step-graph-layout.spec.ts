import { GRAPH_LAYOUT, GraphStructureNode, layoutStepGraph, truncateLabel } from './step-graph-layout';

const node = (id: string, column: number, parents: string[], order: number, label = id): GraphStructureNode => ({
  id,
  label,
  column,
  parents,
  order
});

/** Le modèle d'exemple « Mise en production » (maquette 03). */
const RELEASE: GraphStructureNode[] = [
  node('prep', 0, [], 0, 'Préparation'),
  node('build', 1, ['prep'], 1, 'Build'),
  node('doc', 1, ['prep'], 2, 'Documentation'),
  node('tests', 2, ['build'], 3, 'Tests'),
  node('go', 3, ['tests', 'doc'], 4, 'Go / no-go'),
  node('deploy', 4, ['go'], 5, 'Déploiement')
];

const allNumbers = (layout: ReturnType<typeof layoutStepGraph>) => [
  layout.width,
  layout.height,
  ...Object.values(layout.positions).flatMap(p => [p.x, p.y]),
  ...layout.edges.flatMap(e => e.path.match(/-?\d+(\.\d+)?/g)!.map(Number))
];

describe('layoutStepGraph', () => {
  it('chemin linéaire : une colonne par étape, tous les nœuds à la même hauteur', () => {
    const layout = layoutStepGraph([node('a', 0, [], 0), node('b', 1, ['a'], 1), node('c', 2, ['b'], 2)], 900);
    const { a, b, c } = layout.positions;
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
    expect(new Set([a.y, b.y, c.y]).size).toBe(1);
    expect(layout.width).toBe(900);
  });

  it('modèle d’exemple : cinq colonnes, branches à des hauteurs différentes, « Tests » au niveau de « Build »', () => {
    const { positions, columnWidth } = layoutStepGraph(RELEASE, 900);
    const xs = ['prep', 'build', 'tests', 'go', 'deploy'].map(id => positions[id].x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(positions['build'].x).toBe(positions['doc'].x);
    expect(positions['build'].y).not.toBe(positions['doc'].y);
    expect(Math.abs(positions['build'].y - positions['doc'].y)).toBeGreaterThanOrEqual(GRAPH_LAYOUT.rowGap);
    expect(positions['tests'].y).toBe(positions['build'].y);
    // « Go / no-go » entre les deux branches qu'il rejoint
    expect(positions['go'].y).toBeCloseTo((positions['tests'].y + positions['doc'].y) / 2, 1);
    expect(positions['prep'].y).toBe(positions['go'].y);
    expect(positions['deploy'].x - positions['go'].x).toBeCloseTo(columnWidth, 1);
  });

  it('conteneur trop étroit : largeur minimale par colonne, dessin plus large que le conteneur', () => {
    const layout = layoutStepGraph(RELEASE, 320);
    expect(layout.columnWidth).toBe(GRAPH_LAYOUT.minColumnWidth);
    expect(layout.width).toBe(5 * GRAPH_LAYOUT.minColumnWidth + 2 * GRAPH_LAYOUT.paddingX);
    const xs = Object.values(layout.positions).map(p => p.x);
    expect(Math.min(...xs) - GRAPH_LAYOUT.nodeRadius).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs) + GRAPH_LAYOUT.nodeRadius).toBeLessThanOrEqual(layout.width);
  });

  it('largeur inconnue (0) : retombe sur la largeur minimale', () => {
    const layout = layoutStepGraph(RELEASE, 0);
    expect(layout.width).toBe(5 * GRAPH_LAYOUT.minColumnWidth + 2 * GRAPH_LAYOUT.paddingX);
  });

  it('plusieurs départs : écartés dans la première colonne, le plus haut dans la marge', () => {
    const layout = layoutStepGraph([node('a', 0, [], 0), node('b', 0, [], 1), node('c', 1, ['a', 'b'], 2)], 600);
    const { a, b, c } = layout.positions;
    expect(b.y - a.y).toBe(GRAPH_LAYOUT.rowGap);
    expect(c.y).toBeCloseTo((a.y + b.y) / 2, 1);
    expect(a.y).toBe(GRAPH_LAYOUT.paddingTop + GRAPH_LAYOUT.nodeRadius);
    expect(layout.height).toBe(b.y + GRAPH_LAYOUT.nodeRadius + GRAPH_LAYOUT.labelSpace);
  });

  it('relie chaque dépendance par une courbe du bord droit du départ au bord gauche de l’arrivée', () => {
    const layout = layoutStepGraph(RELEASE, 900);
    expect(layout.edges.map(e => `${e.from}>${e.to}`).sort()).toEqual(
      ['prep>build', 'prep>doc', 'build>tests', 'tests>go', 'doc>go', 'go>deploy'].sort()
    );
    const edge = layout.edges.find(e => e.from === 'prep' && e.to === 'build')!;
    const { prep, build } = layout.positions;
    const r = GRAPH_LAYOUT.nodeRadius;
    const [ax, ay, , , , , bx, by] = edge.path.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(edge.path.startsWith('M ')).toBe(true);
    expect(ax).toBeCloseTo(prep.x + r, 1);
    expect(ay).toBeCloseTo(prep.y, 1);
    expect(bx).toBeCloseTo(build.x - r, 1);
    expect(by).toBeCloseTo(build.y, 1);
  });

  it('boucle dans les données : aucune exception, le lien qui revient en arrière est tracé', () => {
    const layout = layoutStepGraph([node('a', 0, ['b'], 0), node('b', 1, ['a'], 1)], 600);
    expect(layout.edges).toHaveLength(2);
    const back = layout.edges.find(e => e.from === 'b' && e.to === 'a')!;
    expect(back.path).toContain('M');
    expect(allNumbers(layout).every(Number.isFinite)).toBe(true);
  });

  it('aucune coordonnée invalide, même pour un graphe vide', () => {
    expect(allNumbers(layoutStepGraph(RELEASE, 900)).every(Number.isFinite)).toBe(true);
    expect(layoutStepGraph([], 500)).toMatchObject({ width: 500, height: 0, edges: [] });
  });

  it('ne dépend que de la structure : un état différent ne change pas les positions', () => {
    const withState = RELEASE.map((n, i) => ({ ...n, visual: i % 2 ? 'locked' : 'done', answered: i }));
    expect(layoutStepGraph(withState, 900)).toEqual(layoutStepGraph(RELEASE, 900));
  });

  it('raccourcit un libellé trop long pour sa colonne', () => {
    const long = 'Binaires, Livrables & Checksums de la livraison';
    const layout = layoutStepGraph([node('a', 0, [], 0, long)], 100);
    expect(layout.labels['a'].endsWith('…')).toBe(true);
    expect(layout.labels['a'].length).toBeLessThan(long.length);
  });
});

describe('truncateLabel', () => {
  it('garde un libellé court, raccourcit un long avec « … »', () => {
    expect(truncateLabel('Build', 10)).toBe('Build');
    expect(truncateLabel('Documentation utilisateur', 10)).toBe('Documenta…');
  });
});
