export function toggleBookmark(lines: ReadonlySet<number>, line: number): Set<number> {
  const next = new Set(lines)
  if (next.has(line)) next.delete(line)
  else if (Number.isInteger(line) && line > 0) next.add(line)
  return next
}

export function findBookmark(lines: Iterable<number>, currentLine: number, direction: 'next' | 'previous'): number | undefined {
  const sorted = [...new Set(lines)].filter((line) => Number.isInteger(line) && line > 0).sort((a, b) => a - b)
  if (!sorted.length) return undefined
  return direction === 'next'
    ? sorted.find((line) => line > currentLine) ?? sorted[0]
    : [...sorted].reverse().find((line) => line < currentLine) ?? sorted.at(-1)
}

export function toggleOutlining(collapsed: boolean): boolean {
  return !collapsed
}
