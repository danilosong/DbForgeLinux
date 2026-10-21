import type { ExplainNode } from './index.js'

export interface PlanDiagramNode {
  id: string
  node: ExplainNode
  x: number
  y: number
  depth: number
}
export interface PlanDiagramEdge { from: string; to: string; rows?: number }
export interface PlanDiagramLayout { nodes: PlanDiagramNode[]; edges: PlanDiagramEdge[]; width: number; height: number; maxCost: number }

/** Places plan nodes in depth columns and centers each parent over its children. */
export function layoutPlanDiagram(roots: ExplainNode[]): PlanDiagramLayout {
  const nodes: PlanDiagramNode[] = []
  let leafIndex = 0
  let deepest = 0
  let maxCost = 0
  const walk = (node: ExplainNode, depth: number, parentId?: string): number => {
    const id = `${parentId ?? 'root'}-${depth}-${nodes.length}`
    deepest = Math.max(deepest, depth)
    maxCost = Math.max(maxCost, node.cost ?? 0)
    const childYs = node.children.map((child) => {
      return walk(child, depth + 1, id)
    })
    const y = childYs.length ? (Math.min(...childYs) + Math.max(...childYs)) / 2 : 50 + leafIndex++ * 118
    nodes.push({ id, node, x: 24 + depth * 252, y, depth })
    return y
  }
  roots.forEach((root) => { walk(root, 0) })
  // Rebuild edges from tree relationships after all stable node ids have been assigned.
  const idByNode = new Map(nodes.map((item) => [item.node, item.id]))
  const stableEdges: PlanDiagramEdge[] = []
  const link = (node: ExplainNode): void => {
    for (const child of node.children) {
      const from = idByNode.get(node); const to = idByNode.get(child)
      if (from && to) stableEdges.push({ from, to, rows: child.rows })
      link(child)
    }
  }
  roots.forEach(link)
  return { nodes, edges: stableEdges, width: Math.max(560, 24 + (deepest + 1) * 252), height: Math.max(180, 50 + leafIndex * 118), maxCost }
}

export function planCostHue(cost: number | undefined, maximum: number): number {
  if (!cost || maximum <= 0) return 120
  return Math.round(120 - 120 * Math.max(0, Math.min(1, cost / maximum)))
}
