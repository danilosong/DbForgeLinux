import type { Writable } from 'node:stream'
import type { DbDriver } from '../../main/db/DbDriver.js'

export type ExportFormat = 'csv' | 'text' | 'json' | 'xml' | 'sql' | 'html' | 'xlsx' | 'pdf'
export type ImportFormat = 'csv' | 'text' | 'json' | 'xml' | 'xlsx' | 'sql'
export type ImportMode = 'append' | 'update' | 'delete' | 'upsert' | 'repopulate'
export type Row = Record<string, unknown>

export interface JobProgress {
  phase: 'reading' | 'writing' | 'preview' | 'complete'
  rows: number
  bytes?: number
}

export interface ExportJob {
  driver: DbDriver
  connectionId: string
  query: string
  destination: Writable
  format: ExportFormat
  signal?: AbortSignal
  onProgress?: (progress: JobProgress) => void
  options?: {
    delimiter?: string
    quote?: string
    encoding?: 'utf8' | 'utf16le' | 'latin1'
    header?: boolean
    forceQuotes?: boolean
    rowStart?: number
    rowCount?: number
    columnTypes?: Record<string, 'String' | 'Integer' | 'Float' | 'DateTime' | 'HexString'>
    batchSize?: number
    createTable?: boolean
    dropIfExists?: boolean
    table?: string
  }
}

export interface ImportJob {
  driver: DbDriver
  connectionId: string
  source: AsyncIterable<Buffer | string>
  format: ImportFormat
  table: string
  signal?: AbortSignal
  onProgress?: (progress: JobProgress) => void
  options?: {
    delimiter?: string
    quote?: string
    encoding?: 'utf8' | 'utf16le' | 'latin1'
    header?: boolean
    skipLines?: number
    headerPosition?: number
    nullString?: string
    booleanTrueValue?: string
    booleanFalseValue?: string
    columns?: string[]
    columnMapping?: Record<string, string>
    mode?: ImportMode
    keyColumns?: string[]
    batchSize?: number
    onRowError?: 'continue' | 'abort' | 'prompt'
    onRowErrorPrompt?: (row: number, message: string) => Promise<'continue' | 'abort'>
    transactional?: boolean
    previewRows?: number
    rowElement?: string
    createTable?: { database: string; name: string; columns: Array<{ name: string; type: string; primaryKey: boolean }> }
  }
}

export interface ExportReport { rows: number; bytes: number }
export interface ImportReport { read: number; inserted: number; updated: number; deleted: number; errors: number; rowErrors: Array<{ row: number; message: string }> }

export interface ImportPreview { columns: string[]; rows: Row[] }
