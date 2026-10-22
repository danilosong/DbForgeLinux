const MODE_FLAG = 'NO_BACKSLASH_ESCAPES'

export function withoutNoBackslashEscapes(mode: string): string {
  return mode.split(',').filter((item) => item.trim().toUpperCase() !== MODE_FLAG).join(',')
}

export async function withSplitterCompatibleSqlMode<T>(
  readMode: () => Promise<string>,
  setMode: (mode: string) => Promise<void>,
  operation: () => Promise<T>
): Promise<T> {
  const originalMode = await readMode()
  const compatibleMode = withoutNoBackslashEscapes(originalMode)
  await setMode(compatibleMode)
  try {
    const verifiedMode = await readMode()
    if (verifiedMode.split(',').some((item) => item.trim().toUpperCase() === MODE_FLAG)) {
      throw new Error('Could not disable NO_BACKSLASH_ESCAPES for safe SQL script parsing.')
    }
    return await operation()
  } finally {
    await setMode(originalMode)
  }
}
