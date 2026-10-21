import type { DiagramPoint } from './types.js'

export interface ERRouteBox { position: DiagramPoint; width: number; height: number }

/** Finds the first nearby free slot so dropped cards do not cover another table. */
export function avoidTableOverlap(position: DiagramPoint, width: number, height: number, obstacles: ERRouteBox[], gap = 18): DiagramPoint {
  const overlaps = (x: number, y: number): boolean => obstacles.some((box) => x < box.position.x + box.width + gap && x + width + gap > box.position.x && y < box.position.y + box.height + gap && y + height + gap > box.position.y)
  if (!overlaps(position.x, position.y)) return position
  for (let row = 0; row < 100; row++) for (let column = 0; column < 100; column++) {
    const candidate = { x: position.x + column * (width + gap), y: position.y + row * Math.max(24, gap * 2) }
    if (!overlaps(candidate.x, candidate.y)) return candidate
  }
  return position
}

/** Routes above every table so relation segments cannot cross table cards. */
export function routeERRelation(from: ERRouteBox, to: ERRouteBox, obstacles: ERRouteBox[], laneOffset = 0): string {
  const laneY = Math.min(...obstacles.map((box) => box.position.y), from.position.y, to.position.y) - 18 - laneOffset
  const startX = from.position.x + from.width / 2
  const endX = to.position.x + to.width / 2
  const startY = from.position.y
  const endY = to.position.y
  return `M ${startX} ${startY} L ${startX} ${laneY} L ${endX} ${laneY} L ${endX} ${endY}`
}
