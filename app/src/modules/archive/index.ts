import { TextWriter, Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from '@zip.js/zip.js'

export interface ZipArchiveOptions { compressionLevel: number; comment?: string; password?: string }

/** Write a standards-compliant ZIP archive. Password encryption uses WinZip AES-256. */
export async function encodeZipArchive(data: Buffer, entryName: string, options: ZipArchiveOptions): Promise<Buffer> {
  const safeName = entryName.replace(/[\\/\0]/g, '_').slice(0, 180) || 'archive.dat'
  const writer = new ZipWriter(new Uint8ArrayWriter(), { level: Math.min(9, Math.max(0, options.compressionLevel)), useWebWorkers: false, useCompressionStream: false })
  await writer.add(safeName, new Uint8ArrayReader(data), options.password ? { password: options.password, encryptionStrength: 3 } : undefined)
  return Buffer.from(await writer.close(new TextEncoder().encode(options.comment ?? '')))
}

export async function decodeZipEntry(contents: Buffer, expectedName: string, password?: string, maxBytes = 50 * 1024 * 1024): Promise<string> {
  const reader = new ZipReader(new Uint8ArrayReader(contents), { password, useWebWorkers: false })
  try {
    const entries = await reader.getEntries()
    const entry = entries[0]
    if (entries.length !== 1 || entry?.filename !== expectedName || entry.directory || (entry.uncompressedSize ?? 0) > maxBytes) throw new Error('ZIP entry is invalid or too large.')
    return await entry.getData(new TextWriter(), { password })
  } finally { await reader.close() }
}
