import { createHash } from 'node:crypto'

export function verifySha512(content: Uint8Array, expected: string): boolean {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(expected)) return false
  const actual = createHash('sha512').update(content).digest()
  const supplied = Buffer.from(expected, 'base64')
  return supplied.length === actual.length && actual.equals(supplied)
}

export async function downloadVerifiedArtifact(url: string, expectedSha512: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<Uint8Array> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') throw new Error('Update downloads require HTTPS.')
  const response = await fetcher(parsed, { redirect: 'error', signal })
  if (!response.ok) throw new Error(`Update server returned HTTP ${response.status}.`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > 2_000_000_000) throw new Error('Update artifact exceeds the 2 GB safety limit.')
  if (!verifySha512(bytes, expectedSha512)) throw new Error('Update artifact integrity check failed (SHA-512).')
  return bytes
}
