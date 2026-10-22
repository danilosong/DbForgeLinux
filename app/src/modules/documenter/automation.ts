import type { DatabaseModel } from '../schema/model.js'
import { writeDocumentation, type DocumenterAccount, type DocumenterOptions, type DocumentFormat, type WrittenDocumentation } from './index.js'

export interface DocumentationBatchItem {
  database: string
  outputDirectory: string
  title?: string
  author?: string
  copyright?: string
  logo?: string
  created?: string
  folderName?: string
  descriptions?: Record<string, string>
  includeDiagram?: boolean
  includeUsers?: boolean
  coverPage?: boolean
  breadcrumbs?: boolean
  palette?: DocumenterOptions['palette']
  excludedColumns?: string[]
  excludedIndexes?: string[]
  formats?: DocumentFormat[]
}

export interface DocumentationBatchResult {
  database: string
  output?: WrittenDocumentation
  error?: string
}

export async function generateDocumentationBatch(
  items: DocumentationBatchItem[],
  dependencies: {
    inspect(database: string): Promise<DatabaseModel>
    inspectAccounts?(database: string): Promise<DocumenterAccount[]>
    write?: (model: DatabaseModel, options: DocumenterOptions & { outputDirectory: string }) => Promise<WrittenDocumentation>
  }
): Promise<DocumentationBatchResult[]> {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) throw new Error('The manifest must contain between 1 and 100 databases.')
  const write = dependencies.write ?? writeDocumentation
  const results: DocumentationBatchResult[] = []
  for (const item of items) {
    const database = typeof item?.database === 'string' ? item.database.trim() : ''
    const outputDirectory = typeof item?.outputDirectory === 'string' ? item.outputDirectory.trim() : ''
    if (!database || /[\0\r\n]/.test(database) || !outputDirectory || /[\0\r\n]/.test(outputDirectory)) {
      results.push({ database: database || '(unknown)', error: 'Each task requires a valid database and outputDirectory.' })
      continue
    }
    try {
      const model = await dependencies.inspect(database)
      const options: DocumenterOptions & { outputDirectory: string } = {
        ...item,
        outputDirectory,
        accounts: item.includeUsers ? await dependencies.inspectAccounts?.(database) : undefined,
        formats: item.formats ?? ['html', 'markdown']
      }
      if (item.includeUsers && !dependencies.inspectAccounts) throw new Error('No account source is configured for user documentation.')
      delete (options as Partial<DocumentationBatchItem>).database
      results.push({ database, output: await write(model, options) })
    } catch (error) {
      results.push({ database, error: error instanceof Error ? error.message : 'Documentation generation failed.' })
    }
  }
  return results
}
