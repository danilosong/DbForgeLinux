import type { DiagramPoint } from './types.js'

export interface ERRouteBox { position: DiagramPoint; width: number; height: number }

/** Routes above every table so relation segments cannot cross table cards. */
export function routeERRelation(from: ERRouteBox, to: ERRouteBox, obstacles: ERRouteBox[], laneOffset = 0): string {
  const laneY = Math.min(...obstacles.map((box) => box.position.y), from.position.y, to.position.y) - 18 - laneOffset
  const startX = from.position.x + from.width / 2
  const endX = to.position.x + to.width / 2
  const startY = from.position.y
  const endY = to.position.y
  return `M ${startX} ${startY} L ${startX} ${laneY} L ${endX} ${laneY} L ${endX} ${endY}`
}
