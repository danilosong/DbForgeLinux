export type DockDirection = 'left' | 'right' | 'top' | 'bottom'

export function normalizeDockDirection(value: string | null): DockDirection {
  return value === 'left' || value === 'top' || value === 'bottom' ? value : 'right'
}

export function dockDirectionClass(direction: DockDirection): string {
  return `dock-${direction}`
}
