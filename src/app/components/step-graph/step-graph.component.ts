import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { LucideCheck, LucideDynamicIcon, LucideLock } from '@lucide/angular';
import { StepVisual } from '../../domain/flow-rules';
import { GRAPH_LAYOUT, GraphLayoutOptions, GraphStructureNode, layoutStepGraph, StepGraphNode, truncateLabel } from '../../domain/step-graph-layout';
import { ringGeometry, ringToneOf, RingTone } from '../progress-ring/ring-geometry';

const STATE_LABELS: Record<StepVisual, string> = {
  locked: 'verrouillée',
  open: 'ouverte',
  passed: 'franchie',
  done: 'terminée'
};

/** Épaisseur de l'anneau d'un nœud, en pixels. */
const RING_STROKE = 4;
/** Taille des icônes au centre d'un nœud, en pixels. */
const ICON_SIZE = 22;

/**
 * Placement quand des nœuds portent une légende : une ligne de plus sous le libellé, et des nœuds
 * un peu plus écartés pour que la légende ne touche pas le nœud placé en dessous.
 */
const CAPTION_LAYOUT: GraphLayoutOptions = { ...GRAPH_LAYOUT, labelSpace: GRAPH_LAYOUT.labelSpace + 16, rowGap: GRAPH_LAYOUT.rowGap + 12 };

/**
 * `progress` : état d'une session (runner). `structure` : forme du chemin seule (aperçu du builder) :
 * ni anneau, ni cadenas, ni coche, ni badge de jonction, liens pleins et neutres.
 */
export type StepGraphVariant = 'progress' | 'structure';

/** Deux structures identiques ne relancent pas le placement (seul l'état des étapes a changé). */
function sameStructure(a: readonly GraphStructureNode[], b: readonly GraphStructureNode[]): boolean {
  return (
    a.length === b.length &&
    a.every((n, i) => {
      const o = b[i];
      return (
        n.id === o.id &&
        n.label === o.label &&
        n.column === o.column &&
        n.order === o.order &&
        n.parents.length === o.parents.length &&
        n.parents.every((p, j) => p === o.parents[j])
      );
    })
  );
}

/**
 * Graphe des étapes (ADR 0010, point 1) : un seul `<svg>`, positions en pixels calculées par
 * `layoutStepGraph` à partir de la largeur mesurée du composant. Composant présentationnel :
 * il n'injecte aucun service, reçoit ses nœuds et émet l'étape choisie. Le runner l'alimente
 * depuis les états d'étape (variante `progress`) ; l'aperçu du builder l'alimente depuis le seul
 * modèle (variante `structure`), avec une légende et un nom accessible par nœud.
 */
@Component({
  selector: 'app-step-graph',
  standalone: true,
  imports: [LucideDynamicIcon, LucideCheck, LucideLock],
  templateUrl: './step-graph.component.html',
  styleUrl: './step-graph.component.css'
})
export class StepGraphComponent {
  /** Nœuds dans l'ordre topologique, qui est aussi l'ordre de tabulation. */
  readonly nodes = input.required<StepGraphNode[]>();
  readonly selectedId = input<string | null>(null);
  /** Étapes qui viennent de se débloquer : leur nœud joue une courte animation d'ouverture. */
  readonly pulseIds = input<readonly string[]>([]);
  readonly variant = input<StepGraphVariant>('progress');

  protected readonly isStructure = computed(() => this.variant() === 'structure');

  readonly select = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Largeur disponible, mesurée sur l'élément hôte (0 tant qu'elle est inconnue). */
  protected readonly width = signal(0);

  protected readonly radius = GRAPH_LAYOUT.nodeRadius;
  protected readonly iconSize = ICON_SIZE;
  protected readonly iconOffset = -ICON_SIZE / 2;
  private readonly ring = ringGeometry(1, 2 * GRAPH_LAYOUT.nodeRadius, RING_STROKE);
  protected readonly ringRadius = this.ring.radius;
  protected readonly ringStroke = RING_STROKE;
  protected readonly ringCircumference = this.ring.circumference;

  private readonly structure = computed<GraphStructureNode[]>(
    () => this.nodes().map(({ id, label, column, parents, order }) => ({ id, label, column, parents, order })),
    { equal: sameStructure }
  );
  private readonly hasCaptions = computed(() => this.nodes().some(n => !!n.caption));
  private readonly layoutOptions = computed(() => (this.hasCaptions() ? CAPTION_LAYOUT : GRAPH_LAYOUT));
  protected readonly layout = computed(() => layoutStepGraph(this.structure(), this.width(), this.layoutOptions()));

  protected readonly view = computed(() => {
    const layout = this.layout();
    const selected = this.selectedId();
    const pulse = new Set(this.pulseIds());
    const captionChars = (layout.columnWidth - 8) / this.layoutOptions().charWidth;
    return this.nodes()
      .filter(node => layout.positions[node.id])
      .map(node => {
        const { x, y } = layout.positions[node.id];
        const value = node.total > 0 ? node.answered / node.total : node.visual === 'done' ? 1 : 0;
        const geometry = ringGeometry(value, 2 * GRAPH_LAYOUT.nodeRadius, RING_STROKE);
        const tone: RingTone = node.anomaly ? 'anomaly' : node.visual === 'done' ? 'complete' : ringToneOf(node.answered, node.total, false);
        return {
          node,
          transform: `translate(${x} ${y})`,
          label: layout.labels[node.id] ?? node.label,
          caption: node.caption ? truncateLabel(node.caption, captionChars) : null,
          dashOffset: geometry.dashOffset,
          tone,
          selected: node.id === selected,
          pulse: pulse.has(node.id),
          joinReady: !!node.join && node.join.ready === node.join.total,
          ariaLabel: node.ariaLabel ?? this.ariaLabel(node)
        };
      });
  });

  protected readonly edges = computed(() => {
    const passed = new Map(this.nodes().map(n => [n.id, n.passed]));
    const structure = this.isStructure();
    return this.layout().edges.map(edge => ({ ...edge, open: !structure && !!passed.get(edge.from) }));
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const element = this.host.nativeElement;
      this.width.set(element.clientWidth);
      // `ResizeObserver` est absent de certains environnements de test (jsdom) : la largeur minimale s'applique.
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(entries => {
        const width = Math.floor(entries[0]?.contentRect.width ?? element.clientWidth);
        if (width !== this.width()) this.width.set(width);
      });
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** Entrée ou Espace sur un nœud : sélection, sans défilement de la page ni geste principal. */
  protected onNodeKey(event: Event, id: string): void {
    event.preventDefault();
    this.select.emit(id);
  }

  private ariaLabel(node: StepGraphNode): string {
    let label = `${node.label} : ${STATE_LABELS[node.visual]}, ${node.answered} sur ${node.total} contrôles`;
    if (node.join) {
      label += `, ${node.join.ready} ${node.join.ready > 1 ? 'branches prêtes' : 'branche prête'} sur ${node.join.total}`;
    }
    return label;
  }
}
