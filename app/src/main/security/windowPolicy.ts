export function isTrustedRendererNavigation(currentUrl: string, targetUrl: string): boolean {
  try {
    const current = new URL(currentUrl)
    const target = new URL(targetUrl)
    if (current.protocol === 'file:') return target.protocol === 'file:' && target.pathname === current.pathname
    return ['http:', 'https:'].includes(current.protocol) && target.origin === current.origin
  } catch { return false }
}

export function maySaveSqlToPath(openedPaths: ReadonlySet<string> | undefined, targetPath: string): boolean {
  return Boolean(openedPaths?.has(targetPath))
}
