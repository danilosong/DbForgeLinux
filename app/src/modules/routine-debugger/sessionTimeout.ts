export function scheduleDebugSessionTimeout(seconds: number, onTimeout: () => void): () => void {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600) throw new Error('Debugging timeout must be between 1 and 3600 seconds.')
  const timer = setTimeout(onTimeout, seconds * 1000)
  return () => clearTimeout(timer)
}
