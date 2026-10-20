import type { Writable } from 'node:stream'
import type { DbDriver } from '../../main/db/DbDriver.js'

export type ExportFormat = 'csv' | 'json' | 'xml' | 'sql' | 'html' | 'xlsx'
export type ImportFormat = 'csv' | 'json' | 'xml' | 'xlsx' | 'sql'
export type ImportMode = 'append' | 'update' | 'delete' | 'upsert'
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
    columns?: string[]
    columnMapping?: Record<string, string>
    mode?: ImportMode
    keyColumns?: string[]
    batchSize?: number
    onRowError?: 'continue' | 'abort'
    transactional?: boolean
    previewRows?: number
    rowElement?: string
  }
}

export interface ExportReport { rows: number; bytes: number }
export interface ImportReport { read: number; inserted: number; updated: number; deleted: number; errors: number; rowErrors: Array<{ row: number; message: string }> }

export interface ImportPreview { columns: string[]; rows: Row[] }
