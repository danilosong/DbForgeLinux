import { constants } from 'node:fs'
import { open } from 'node:fs/promises'

/** Reads a regular, non-symlink file while enforcing a byte cap before and during allocation. */
export async function readBoundedRegularFile(path: string, maximumBytes: number): Promise<Buffer> {
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
  const handle = await open(path, flags)
  try {
    const info = await handle.stat()
    if (!info.isFile() || info.size > maximumBytes) throw new Error(`File exceeds the ${maximumBytes} byte limit or is not a regular file.`)
    const chunks: Buffer[] = []; let total = 0
    while (true) {
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, maximumBytes - total + 1))
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null)
      if (!bytesRead) break
      total += bytesRead
      if (total > maximumBytes) throw new Error(`File exceeds the ${maximumBytes} byte limit.`)
      chunks.push(chunk.subarray(0, bytesRead))
    }
    return Buffer.concat(chunks, total)
  } finally { await handle.close() }
}
