/**
 * Placement du graphe des étapes (ADR 0010, point 1), sous forme de fonction pure.
 *
 * Tout est exprimé en pixels, dans un seul repère partagé par les nœuds, les libellés et les liens :
 * jamais de pourcentage (les maquettes mélangeaient pourcentages CSS et `viewBox`, d'où des liens
 * décalés des nœuds). Le placement ne dépend que de la structure (colonnes, dépendances, libellés)
 * et de la largeur disponible : une nouvelle réponse ne le recalcule pas.
 */

import type { StepVisual } from './flow-rules';
import type { StepIconName } from './step-icons';

/** Ce dont le placement a besoin pour une étape. */
export interface GraphStructureNode {
  id: string;
  label: string;
  /** Longueur du plus long chemin depuis un départ (`computeColumns`, ADR 0007). */
  column: number;
  /** Identifiants des étapes dont celle-ci dépend. */
  parents: readonly string[];
  /** Rang dans le modèle, pour départager deux étapes de même hauteur idéale. */
  order: number;
}

/**
 * Nœud du graphe tel que le composant le dessine : structure (placement) et état (rendu).
 * Le runner le construit à partir des états d'étape ; le builder pourra le construire à partir du seul modèle.
 */
export interface StepGraphNode extends GraphStructureNode {
  /** Nom d'icône déjà résolu (`resolveStepIcon`). */
  icon: StepIconName;
  visual: StepVisual;
  /** Porte ouverte vers les étapes suivantes : les liens qui en partent sont pleins. */
  passed: boolean;
  /** Contrôles applicables qui ont une réponse, sur leur nombre. */
  answered: number;
  total: number;
  /** Au moins un contrôle applicable en anomalie (KO ou choix en anomalie). */
  anomaly: boolean;
  /** Progression d'une jonction (au moins deux dépendances), sinon `null`. */
  join: { ready: number; total: number } | null;
  /** Seconde ligne affichée sous le libellé (aperçu du builder : « 3 items · 2 bloq. »). */
  caption?: string;
  /** Nom accessible fourni par l'appelant ; remplace le nom calculé à partir de l'état de l'étape. */
  ariaLabel?: string;
}

export interface GraphLayoutOptions {
  nodeRadius: number;
  minColumnWidth: number;
  /** Écart vertical minimal entre deux nœuds d'une même colonne (centre à centre). */
  rowGap: number;
  paddingX: number;
  /** Marge au-dessus du plus haut nœud (place du badge de jonction). */
  paddingTop: number;
  /** Place réservée sous un nœud pour son libellé, marge basse comprise. */
  labelSpace: number;
  /** Largeur moyenne d'un caractère du libellé, pour le raccourcir. */
  charWidth: number;
}

export const GRAPH_LAYOUT: GraphLayoutOptions = {
  nodeRadius: 28,
  minColumnWidth: 128,
  rowGap: 104,
  paddingX: 16,
  paddingTop: 16,
  labelSpace: 40,
  charWidth: 7
};

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphEdgeLayout {
  from: string;
  to: string;
  /** Tracé SVG (`d`) : courbe de Bézier cubique du bord droit du départ au bord gauche de l'arrivée. */
  path: string;
}

export interface StepGraphLayout {
  /** Largeur du dessin : au moins la largeur disponible, plus si les colonnes ne tiennent pas. */
  width: number;
  height: number;
  columnWidth: number;
  /** Centre de chaque nœud. */
  positions: Record<string, GraphPoint>;
  edges: GraphEdgeLayout[];
  /** Libellé affiché sous le nœud, raccourci par « … » s'il dépasse la largeur d'une colonne. */
  labels: Record<string, string>;
}

const round = (value: number) => Math.round(value * 10) / 10;
const mean = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/** Raccourcit un libellé à `maxChars` caractères, points de suspension compris. */
export function truncateLabel(label: string, maxChars: number): string {
  const limit = Math.max(4, Math.floor(maxChars));
  return label.length <= limit ? label : `${label.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * Calcule les positions des nœuds, le tracé des liens et les libellés affichés.
 *
 * - Abscisse : centre de la colonne ; les colonnes se partagent la largeur disponible sans descendre
 *   sous `minColumnWidth` (au-delà, le dessin est plus large et son conteneur défile).
 * - Ordonnée, colonne par colonne : hauteur moyenne des dépendances déjà placées (0 pour un départ),
 *   écart minimal entre voisins, puis groupe recentré sur la moyenne des hauteurs idéales.
 * - Le dessin est enfin décalé pour que le plus haut nœud tienne dans la marge.
 */
export function layoutStepGraph(
  nodes: readonly GraphStructureNode[],
  availableWidth: number,
  options: GraphLayoutOptions = GRAPH_LAYOUT
): StepGraphLayout {
  const available = Number.isFinite(availableWidth) && availableWidth > 0 ? availableWidth : 0;
  if (nodes.length === 0) {
    return { width: available, height: 0, columnWidth: options.minColumnWidth, positions: {}, edges: [], labels: {} };
  }

  const columnCount = Math.max(...nodes.map(n => Math.max(0, n.column))) + 1;
  const columnWidth = Math.max(options.minColumnWidth, (available - 2 * options.paddingX) / columnCount);
  const width = Math.max(available, columnCount * options.minColumnWidth + 2 * options.paddingX);

  const raw = new Map<string, GraphPoint>();
  for (let column = 0; column < columnCount; column++) {
    const inColumn = nodes.filter(n => Math.max(0, n.column) === column);
    if (inColumn.length === 0) continue;

    // Hauteur idéale : barycentre des dépendances déjà placées (une boucle peut pointer plus loin).
    const ideal = new Map(
      inColumn.map(n => {
        const placed = n.parents.map(p => raw.get(p)?.y).filter((y): y is number => y !== undefined);
        return [n.id, placed.length > 0 ? mean(placed) : 0];
      })
    );
    const sorted = [...inColumn].sort((a, b) => ideal.get(a.id)! - ideal.get(b.id)! || a.order - b.order);

    const ys: number[] = [];
    for (const [index, node] of sorted.entries()) {
      const wanted = ideal.get(node.id)!;
      ys.push(index === 0 ? wanted : Math.max(wanted, ys[index - 1] + options.rowGap));
    }
    const shift = mean(sorted.map(n => ideal.get(n.id)!)) - mean(ys);
    const x = options.paddingX + (column + 0.5) * columnWidth;
    sorted.forEach((node, index) => raw.set(node.id, { x, y: ys[index] + shift }));
  }

  const top = Math.min(...[...raw.values()].map(p => p.y));
  const offset = options.paddingTop + options.nodeRadius - top;
  const positions: Record<string, GraphPoint> = {};
  for (const [id, point] of raw) {
    positions[id] = { x: round(point.x), y: round(point.y + offset) };
  }
  const bottom = Math.max(...Object.values(positions).map(p => p.y));
  const height = round(bottom + options.nodeRadius + options.labelSpace);

  const r = options.nodeRadius;
  const edges: GraphEdgeLayout[] = [];
  for (const node of nodes) {
    const to = positions[node.id];
    for (const parent of new Set(node.parents)) {
      const from = positions[parent];
      if (!from || parent === node.id) continue;
      const ax = round(from.x + r);
      const bx = round(to.x - r);
      const mx = round((ax + bx) / 2);
      edges.push({ from: parent, to: node.id, path: `M ${ax} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${bx} ${to.y}` });
    }
  }

  const maxChars = (columnWidth - 8) / options.charWidth;
  const labels = Object.fromEntries(nodes.map(n => [n.id, truncateLabel(n.label, maxChars)]));

  return { width: round(width), height, columnWidth: round(columnWidth), positions, edges, labels };
}
