import { createReadStream } from 'node:fs'

export type ScriptEncoding = 'utf8' | 'utf16le' | 'latin1' | 'windows1252'
export type ScriptErrorAction = 'stop' | 'continue' | 'ignore-all'
export interface ScriptProgress { statements: number; errors: number; skipped: number; bytesRead: number }
export interface ScriptError { statement: number; message: string; sql: string }

export const DEFAULT_MAX_SCRIPT_STATEMENT_BYTES = 256 * 1024 * 1024
const MAX_CONFIGURED_STATEMENT_BYTES = 1024 * 1024 * 1024
const MAX_DELIMITER_LENGTH = 16
const DIRECTIVE_LINE_LIMIT = 256

/** Splits a SQL file incrementally. Only the current statement is retained, with a finite size cap. */
export async function executeLargeScript(options: {
  path: string; encoding: ScriptEncoding; databaseSelected: boolean; signal?: AbortSignal; maxStatementBytes?: number;
  execute(sql: string): Promise<void>; onProgress(progress: ScriptProgress): void;
  onError(error: ScriptError): Promise<ScriptErrorAction>
}): Promise<{ statements: number; errors: ScriptError[]; skipped: number; stopped: boolean }> {
  const maxStatementBytes = options.maxStatementBytes ?? DEFAULT_MAX_SCRIPT_STATEMENT_BYTES
  if (!Number.isSafeInteger(maxStatementBytes) || maxStatementBytes < 1 || maxStatementBytes > MAX_CONFIGURED_STATEMENT_BYTES) {
    throw new Error(`Statement size limit must be between 1 and ${MAX_CONFIGURED_STATEMENT_BYTES} bytes.`)
  }
  const stream = createReadStream(options.path, { highWaterMark: 64 * 1024 })
  const decoder = new TextDecoder(options.encoding === 'windows1252' ? 'windows-1252' : options.encoding === 'latin1' ? 'iso-8859-1' : options.encoding, { fatal: false })
  let statement = ''; let statementBytes = 0; let quote = ''; let escaped = false; let lineComment = false; let blockComment = false
  let delimiter = ';'; let line = 1; let column = 1; let statementHasContent = false
  let count = 0; let skipped = 0; let bytesRead = 0; let ignoreAll = false; let stopped = Boolean(options.signal?.aborted)
  let scanBuffer = ''; let directiveCandidate = true; let directiveBuffer = ''
  const errors: ScriptError[] = []
  const progress = (): void => options.onProgress({ statements: count, errors: errors.length, skipped, bytesRead })
  const append = (text: string): void => {
    const size = Buffer.byteLength(text, 'utf8')
    if (statementBytes + size > maxStatementBytes) {
      throw new Error(`Statement maior que o limite configurado (${maxStatementBytes} bytes) no arquivo "${options.path}", linha ${line}, coluna ${column}.`)
    }
    statement += text
    statementBytes += size
    if (/\S/.test(text)) statementHasContent = true
    advancePosition(text)
  }
  function advancePosition(text: string): void {
    for (const char of text) {
      if (char === '\n') { line++; column = 1 }
      else column++
    }
  }
  const resetStatement = (): void => { statement = ''; statementBytes = 0; statementHasContent = false }
  const run = async (): Promise<void> => {
    const sql = statement.trim()
    if (!sql) { resetStatement(); return }
    if (options.databaseSelected && /^\s*(?:USE\b|(?:CREATE|ALTER|DROP)\s+DATABASE\b)/i.test(sql)) { skipped++; resetStatement(); return }
    count++
    try { await options.execute(sql) }
    catch (error) {
      const item = { statement: count, message: error instanceof Error ? error.message.slice(0, 2000) : 'Statement failed.', sql: sql.slice(0, 2000) }
      errors.push(item)
      const action = ignoreAll ? 'continue' : await options.onError(item)
      if (action === 'stop') stopped = true
      if (action === 'ignore-all') ignoreAll = true
    }
    resetStatement()
    if (count % 10 === 0) progress()
  }

  const parseReadyText = async (text: string, processLength: number): Promise<void> => {
    let i = 0; let segmentStart = 0
    while (i < processLength && !stopped) {
      const char = text[i]!; const next = text[i + 1] ?? ''
      if (lineComment) {
        if (char === '\n') { i++; append(text.slice(segmentStart, i)); segmentStart = i; lineComment = false }
        else i++
        continue
      }
      if (blockComment) {
        if (char === '*' && next === '/') { i += 2; append(text.slice(segmentStart, i)); segmentStart = i; blockComment = false }
        else i++
        continue
      }
      if (quote) {
        i++
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === quote) {
          if (next === quote) i++
          else { append(text.slice(segmentStart, i)); segmentStart = i; quote = '' }
        }
        continue
      }
      if (delimiter !== ';' && text.startsWith(delimiter, i)) {
        append(text.slice(segmentStart, i)); await run(); advancePosition(delimiter); i += delimiter.length; segmentStart = i; continue
      }
      if (char === '-' && next === '-' || char === '#') {
        append(text.slice(segmentStart, i))
        if (char === '-') { append('--'); i += 2 } else { append(char); i++ }
        segmentStart = i
        lineComment = true
        continue
      }
      if (char === '/' && next === '*') { append(text.slice(segmentStart, i)); append('/*'); i += 2; segmentStart = i; blockComment = true; continue }
      if (char === "'" || char === '"' || char === '`') { append(text.slice(segmentStart, i)); quote = char; append(char); i++; segmentStart = i; continue }
      if (delimiter === ';' && char === ';') { append(text.slice(segmentStart, i)); await run(); advancePosition(char); i++; segmentStart = i; continue }
      i++
    }
    if (i > segmentStart) append(text.slice(segmentStart, i))
    scanBuffer = text.slice(i)
  }
  const feedParser = async (text: string, final = false): Promise<void> => {
    if (stopped) return
    const combined = scanBuffer + text
    const processLength = final ? combined.length : Math.max(0, combined.length - MAX_DELIMITER_LENGTH)
    await parseReadyText(combined, processLength)
  }
  const feedText = async (text: string): Promise<void> => {
    let start = 0
    while (start < text.length && !stopped) {
      if (!directiveCandidate && !statementHasContent && !quote && !lineComment && !blockComment) directiveCandidate = true
      if (!directiveCandidate) {
        const newline = text.indexOf('\n', start)
        const end = newline < 0 ? text.length : newline + 1
        await feedParser(text.slice(start, end), newline >= 0)
        start = end
        continue
      }
      const newline = text.indexOf('\n', start)
      const end = newline < 0 ? text.length : newline + 1
      directiveBuffer += text.slice(start, end)
      start = end
      if (directiveBuffer.length > DIRECTIVE_LINE_LIMIT) {
        const buffered = directiveBuffer
        directiveBuffer = ''
        directiveCandidate = false
        await feedParser(buffered)
        continue
      }
      if (newline < 0) return
      const directive = /^\s*DELIMITER\s+(\S+)\s*\r?\n?$/i.exec(directiveBuffer)
      if (directive && !statementHasContent && !quote && !lineComment && !blockComment) {
        const nextDelimiter = directive[1]!
        if (nextDelimiter.length > MAX_DELIMITER_LENGTH || /[\s'"`\\]/.test(nextDelimiter)) throw new Error(`Invalid DELIMITER directive in ${options.path} at line ${line}.`)
        await feedParser('', true)
        advancePosition(directiveBuffer)
        delimiter = nextDelimiter
        directiveBuffer = ''
        directiveCandidate = true
        continue
      }
      const buffered = directiveBuffer
      directiveBuffer = ''
      directiveCandidate = false
      await feedParser(buffered, true)
    }
  }
  const onAbort = (): void => { stopped = true; stream.destroy() }
  options.signal?.addEventListener('abort', onAbort, { once: true })
  try {
    if (stopped) stream.destroy()
    if (!stopped) {
      for await (const chunk of stream) {
        if (options.signal?.aborted) { stopped = true; break }
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        bytesRead += buffer.byteLength
        await feedText(decoder.decode(buffer, { stream: true }))
        if (stopped) break
      }
    }
    if (options.signal?.aborted) stopped = true
    if (!stopped) {
      await feedText(decoder.decode())
      if (directiveBuffer) { const buffered = directiveBuffer; directiveBuffer = ''; directiveCandidate = false; await feedParser(buffered) }
      await feedParser('', true)
      if (!stopped) await run()
    }
  } finally {
    options.signal?.removeEventListener('abort', onAbort)
    stream.destroy()
    statement = ''; scanBuffer = ''; directiveBuffer = ''
  }
  progress()
  return { statements: count, errors, skipped, stopped }
}
