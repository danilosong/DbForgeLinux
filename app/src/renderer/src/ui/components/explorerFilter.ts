export function matchesExplorerFilter(value: string, query: string, useRegex: boolean, caseSensitive = false): boolean {
  if (!query) return true
  if (!useRegex) return (caseSensitive ? value : value.toLocaleLowerCase()).includes(caseSensitive ? query : query.toLocaleLowerCase())
  try { return new RegExp(query, caseSensitive ? '' : 'i').test(value) }
  catch { return false }
}

export function isValidExplorerRegex(query: string): boolean {
  if (!query) return true
  try { new RegExp(query); return true } catch { return false }
}
