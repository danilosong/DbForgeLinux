import { createReadStream } from 'node:fs'
import { destructiveStatementKind, maskSqlCommentsAndLiterals } from '../options/executionWarnings.js'

export type ScriptEncoding = 'utf8' | 'utf16le' | 'latin1' | 'windows1252'
export type ScriptErrorAction = 'stop' | 'continue' | 'ignore-all'
export interface ScriptProgress { statements: number; errors: number; skipped: number; bytesRead: number }
export interface ScriptError { statement: number; message: string; sql: string }

/** mysqldump --extended-insert caps each INSERT near net_buffer_length (~1 MB), so 64 MB covers real dumps with a predictable peak. */
export const DEFAULT_MAX_SCRIPT_STATEMENT_BYTES = 64 * 1024 * 1024
const MAX_CONFIGURED_STATEMENT_BYTES = 1024 * 1024 * 1024
const MAX_DELIMITER_LENGTH = 16
const DIRECTIVE_LINE_LIMIT = 256

/** Copies a short excerpt so it does not keep the whole (possibly huge) statement alive as a V8 sliced string. */
function detachedExcerpt(text: string, length: number): string { return Buffer.from(text.slice(0, length), 'utf8').toString('utf8') }

/**
 * Splits a SQL file incrementally. Only the current statement is retained, with a finite size cap.
 * Its pieces are joined once per read chunk and once per statement (never string by string), which
 * keeps the peak near twice the statement size instead of the ~7x of per-piece concatenation.
 */
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
  let statementParts: string[] = []; let chunkPieces: string[] = []; let statementBytes = 0; let quote = ''; let escaped = false; let lineComment = false; let blockComment = false
  let delimiter = ';'; let line = 1; let column = 1; let statementHasContent = false
  let count = 0; let skipped = 0; let bytesRead = 0; let ignoreAll = false; let stopped = Boolean(options.signal?.aborted)
  let scanBuffer = ''; let directiveCandidate = true; let directiveBuffer = ''
  const errors: ScriptError[] = []
  const progress = (): void => options.onProgress({ statements: count, errors: errors.length, skipped, bytesRead })
  const append = (text: string): void => {
    const size = Buffer.byteLength(text, 'utf8')
    if (statementBytes + size > maxStatementBytes) {
      throw new Error(`Statement exceeds the configured limit (${maxStatementBytes} bytes) in file "${options.path}", line ${line}, column ${column}.`)
    }
    chunkPieces.push(text)
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
  const flushChunk = (): void => {
    if (!chunkPieces.length) return
    statementParts.push(chunkPieces.length === 1 ? chunkPieces[0]! : chunkPieces.join(''))
    chunkPieces = []
  }
  const resetStatement = (): void => { statementParts = []; chunkPieces = []; statementBytes = 0; statementHasContent = false }
  const run = async (): Promise<void> => {
    flushChunk()
    const sql = (statementParts.length === 1 ? statementParts[0]! : statementParts.join('')).trim()
    // Release the pieces before executing, so only the joined statement stays alive.
    statementParts = []
    if (!sql) { resetStatement(); return }
    if (options.databaseSelected && /^\s*(?:USE\b|(?:CREATE|ALTER|DROP)\s+DATABASE\b)/i.test(sql)) { skipped++; resetStatement(); return }
    count++
    try { await options.execute(sql) }
    catch (error) {
      const item = { statement: count, message: error instanceof Error ? error.message.slice(0, 2000) : 'Statement failed.', sql: detachedExcerpt(sql, 2000) }
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
    flushChunk()
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
      try {
        for await (const chunk of stream) {
          if (options.signal?.aborted) { stopped = true; break }
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          bytesRead += buffer.byteLength
          await feedText(decoder.decode(buffer, { stream: true }))
          if (stopped) break
        }
      } catch (error) {
        if (!options.signal?.aborted) throw error
        stopped = true
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
    statementParts = []; chunkPieces = []; scanBuffer = ''; directiveBuffer = ''
  }
  progress()
  return { statements: count, errors, skipped, stopped }
}

export type ScriptRiskKind = 'drop' | 'truncate' | 'delete-without-where' | 'update-without-where' | 'privileges' | 'server-settings'
export interface ScriptRiskSample { statement: number; kind: ScriptRiskKind; sql: string }
export interface ScriptScan { statements: number; skipped: number; risks: Record<ScriptRiskKind, number>; samples: ScriptRiskSample[] }

/** Only the head of a huge statement (bulk INSERT) is classified, so the scan keeps bounded memory. */
const CLASSIFY_LIMIT_CHARS = 1024 * 1024
const MAX_RISK_SAMPLES = 20

/**
 * Classifies one statement for the pre-execution summary, ignoring comments and literals. A statement
 * longer than the limit is judged by its head; a DELETE/UPDATE whose WHERE lies beyond it is reported
 * as missing WHERE (the conservative side).
 */
export function classifyScriptStatement(sql: string): ScriptRiskKind | undefined {
  const head = sql.length > CLASSIFY_LIMIT_CHARS ? sql.slice(0, CLASSIFY_LIMIT_CHARS) : sql
  const code = maskSqlCommentsAndLiterals(head)
  if (/^\s*(?:GRANT|REVOKE)\b|\b(?:CREATE|DROP|ALTER|RENAME)\s+USER\b|\bSET\s+(?:PASSWORD|DEFAULT\s+ROLE)\b/i.test(code)) return 'privileges'
  if (/\bSET\s+(?:GLOBAL|PERSIST|PERSIST_ONLY)\b|@@(?:GLOBAL|PERSIST|PERSIST_ONLY)\s*\.\s*\w+\s*(?::=|=)/i.test(code)) return 'server-settings'
  const kind = destructiveStatementKind(head)
  return kind === 'delete' ? 'delete-without-where' : kind === 'update' ? 'update-without-where' : kind
}

/**
 * Dry run of Execute Large Script: the same streaming splitter, DELIMITER handling, statement cap
 * and USE/CREATE DATABASE skipping as a real run, but nothing reaches the server.
 */
export async function scanLargeScript(options: { path: string; encoding: ScriptEncoding; databaseSelected: boolean; signal?: AbortSignal; maxStatementBytes?: number }): Promise<ScriptScan> {
  const risks: Record<ScriptRiskKind, number> = { drop: 0, truncate: 0, 'delete-without-where': 0, 'update-without-where': 0, privileges: 0, 'server-settings': 0 }
  const samples: ScriptRiskSample[] = []
  let statement = 0
  const report = await executeLargeScript({
    ...options,
    execute: async (sql) => {
      statement++
      const kind = classifyScriptStatement(sql)
      if (!kind) return
      risks[kind]++
      if (samples.length < MAX_RISK_SAMPLES) samples.push({ statement, kind, sql: detachedExcerpt(sql, 200) })
    },
    onProgress: () => undefined,
    onError: async () => 'continue'
  })
  return { statements: report.statements, skipped: report.skipped, risks, samples }
}

/** What a run on a Production connection must have typed back: the target database, or PRODUCTION when none is selected. */
export function largeScriptProductionConfirmation(database: string): string { return database || 'PRODUCTION' }
