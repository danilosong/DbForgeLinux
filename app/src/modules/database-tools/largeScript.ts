import { createReadStream } from 'node:fs'

export type ScriptEncoding = 'utf8' | 'utf16le' | 'latin1' | 'windows1252'
export type ScriptErrorAction = 'stop' | 'continue' | 'ignore-all'
export interface ScriptProgress { statements: number; errors: number; skipped: number; bytesRead: number }
export interface ScriptError { statement: number; message: string; sql: string }

/** Splits a MySQL script incrementally by line; quoted semicolons and comments are preserved. */
export async function executeLargeScript(options: {
  path: string; encoding: ScriptEncoding; databaseSelected: boolean; signal?: AbortSignal;
  execute(sql: string): Promise<void>; onProgress(progress: ScriptProgress): void;
  onError(error: ScriptError): Promise<ScriptErrorAction>;
}): Promise<{ statements: number; errors: ScriptError[]; skipped: number; stopped: boolean }> {
  const stream = createReadStream(options.path, { highWaterMark: 64 * 1024 })
  const decoder = new TextDecoder(options.encoding === 'windows1252' ? 'windows-1252' : options.encoding === 'latin1' ? 'iso-8859-1' : options.encoding, { fatal: false })
  let statement = ''; let quote = ''; let escaped = false; let lineComment = false; let blockComment = false
  let count = 0; let skipped = 0; let bytesRead = 0; let ignoreAll = false; let stopped = false
  const errors: ScriptError[] = []
  const progress = (): void => options.onProgress({ statements: count, errors: errors.length, skipped, bytesRead })
  const run = async (candidate: string): Promise<void> => {
    const sql = candidate.trim()
    if (!sql) return
    if (options.databaseSelected && /^\s*(?:USE\b|(?:CREATE|ALTER|DROP)\s+DATABASE\b)/i.test(sql)) { skipped++; return }
    count++
    try { await options.execute(sql) }
    catch (error) {
      const item = { statement: count, message: error instanceof Error ? error.message.slice(0, 2000) : 'Statement failed.', sql: sql.slice(0, 2000) }
      errors.push(item)
      const action = ignoreAll ? 'continue' : await options.onError(item)
      if (action === 'stop') stopped = true
      if (action === 'ignore-all') ignoreAll = true
    }
    if (count % 10 === 0) progress()
  }
  try {
    let pending = ''
    const consumeLine = async (line: string): Promise<void> => {
      for (let i = 0; i < line.length; i++) {
        const char = line[i]!; const next = line[i + 1] ?? ''
        if (lineComment) { statement += char; if (char === '\n') lineComment = false; continue }
        if (blockComment) { statement += char; if (char === '*' && next === '/') { statement += next; i++; blockComment = false }; continue }
        if (quote) { statement += char; if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) { if (next === quote) { statement += next; i++ } else quote = '' }; continue }
        if (char === '-' && next === '-' || char === '#') { statement += char; if (char === '-') { statement += next; i++ }; lineComment = true; continue }
        if (char === '/' && next === '*') { statement += '/*'; i++; blockComment = true; continue }
        if (char === "'" || char === '"' || char === '`') { quote = char; statement += char; continue }
        if (char === ';') { await run(statement); statement = ''; if (stopped) break; continue }
        statement += char
      }
    }
    for await (const chunk of stream) {
      if (options.signal?.aborted) { stopped = true; break }
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytesRead += buffer.byteLength
      pending += decoder.decode(buffer, { stream: true })
      let newline: number
      while ((newline = pending.indexOf('\n')) >= 0) {
        await consumeLine(pending.slice(0, newline).replace(/\r$/, '') + '\n')
        pending = pending.slice(newline + 1)
        if (stopped) break
      }
      if (stopped) break
    }
    pending += decoder.decode()
    if (!stopped && pending) await consumeLine(pending)
    if (!stopped) await run(statement)
  } finally { stream.destroy() }
  progress()
  return { statements: count, errors, skipped, stopped }
}
