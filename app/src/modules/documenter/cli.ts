import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { QueryValues } from 'mysql2'
import mysql from 'mysql2/promise'
import { writeDocumentation } from './index.js'
import { inspectDatabase } from '../schema/index.js'
import { generateDocumentationBatch, type DocumentationBatchItem } from './automation.js'
import { printDocumentationPdfHeadless } from './headlessPdf.js'
import { inspectDocumenterAccounts } from './accounts.js'

const help = `TuxSQL Documenter CLI

Usage: npm run documenter:cli -- --manifest <file.json>

Required environment:
  TUXSQL_DB_HOST       MySQL/MariaDB host
  TUXSQL_DB_USER       Database user
  TUXSQL_DOCUMENTER_OUTPUT  Default output directory (optional when every task sets outputDirectory)
  TUXSQL_DB_PASSWORD   Password (optional; leave unset for passwordless accounts)
  TUXSQL_DB_PORT       Port (default: 3306)

The JSON manifest is an array of tasks. Each task needs database and may set
outputDirectory, title, author, copyright, logo, created, folderName,
  descriptions, includeDiagram, includeUsers, coverPage, breadcrumbs, palette,
  excludedColumns, excludedIndexes, and formats.
Formats: html, markdown, pdf. PDF renders in headless Chromium (set
TUXSQL_CHROME_PATH when the executable is outside common Linux locations).
Credentials are read only from environment variables.
`

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Set the ${name} environment variable.`)
  return value
}

function parseManifest(value: unknown, defaultOutputDirectory: string | undefined): DocumentationBatchItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error('The manifest must be a list with 1 to 100 tasks.')
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`Task ${index + 1} must be a valid object.`)
    const task = entry as Record<string, unknown>
    if (Object.keys(task).some((key) => !['database', 'outputDirectory', 'title', 'author', 'copyright', 'logo', 'created', 'folderName', 'descriptions', 'includeDiagram', 'includeUsers', 'coverPage', 'breadcrumbs', 'palette', 'excludedColumns', 'excludedIndexes', 'formats'].includes(key))) {
      throw new Error(`Task ${index + 1} contains an unknown option.`)
    }
    if (typeof task.database !== 'string' || !task.database.trim()) throw new Error(`Task ${index + 1} requires a database.`)
    const outputDirectory = typeof task.outputDirectory === 'string' ? task.outputDirectory : defaultOutputDirectory
    if (!outputDirectory?.trim()) throw new Error(`Task ${index + 1} requires outputDirectory or TUXSQL_DOCUMENTER_OUTPUT.`)
    if (task.formats !== undefined && (!Array.isArray(task.formats) || task.formats.some((format) => !['html', 'markdown', 'pdf'].includes(String(format))))) {
      throw new Error(`Task ${index + 1} contains formats unsupported by the CLI. Use html, markdown, and/or pdf.`)
    }
    if (task.palette !== undefined && !['default', 'metro-light', 'ocean', 'forest'].includes(String(task.palette))) throw new Error(`Task ${index + 1} has an invalid cover palette.`)
    if (task.includeUsers !== undefined && typeof task.includeUsers !== 'boolean') throw new Error(`Task ${index + 1}: includeUsers must be a boolean.`)
    return { ...task, database: task.database, outputDirectory: resolve(outputDirectory), formats: task.formats as DocumentationBatchItem['formats'] } as DocumentationBatchItem
  })
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) { process.stdout.write(help); return }
  const manifestIndex = args.indexOf('--manifest')
  if (manifestIndex < 0 || !args[manifestIndex + 1] || args.length !== 2) throw new Error(help)
  const manifestPath = resolve(args[manifestIndex + 1]!)
  const manifestInfo = await readFile(manifestPath)
  if (manifestInfo.byteLength > 1024 * 1024) throw new Error('The manifest exceeds the 1 MiB size limit.')
  const outputRoot = process.env.TUXSQL_DOCUMENTER_OUTPUT?.trim()
  const tasks = parseManifest(JSON.parse(manifestInfo.toString('utf8')) as unknown, outputRoot)
  const host = requiredEnvironment('TUXSQL_DB_HOST')
  const user = requiredEnvironment('TUXSQL_DB_USER')
  const port = Number(process.env.TUXSQL_DB_PORT ?? '3306')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('TUXSQL_DB_PORT must be a valid port number.')
  const password = process.env.TUXSQL_DB_PASSWORD
  const results = await generateDocumentationBatch(tasks, {
    inspect: async (database) => {
      const connection = await mysql.createConnection({ host, port, user, password, database, connectTimeout: 10_000, multipleStatements: false })
      try { return await inspectDatabase(async (sql, parameters = []) => {
        const [rows] = await connection.query(sql, [...parameters] as QueryValues)
        return Array.isArray(rows) ? rows as Array<Record<string, unknown>> : []
      }, database) } finally { await connection.end() }
    },
    inspectAccounts: async (database) => {
      const connection = await mysql.createConnection({ host, port, user, password, database, connectTimeout: 10_000, multipleStatements: false })
      try {
        return await inspectDocumenterAccounts(async (sql, parameters = []) => {
          const [rows] = await connection.query(sql, [...parameters] as QueryValues)
          return Array.isArray(rows) ? rows as Array<Record<string, unknown>> : []
        }, database)
      } finally { await connection.end() }
    },
    write: (model, options) => writeDocumentation(model, { ...options, pdfPrinter: { printToPDF: printDocumentationPdfHeadless } })
  })
  for (const result of results) {
    if (result.error) process.stderr.write(`${result.database}: ${result.error}\n`)
    else process.stdout.write(`${result.database}: ${Object.values(result.output ?? {}).join(', ')}\n`)
  }
  if (results.some((result) => result.error)) process.exitCode = 1
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Documenter CLI failed.'}\n`)
  process.exitCode = 1
})
