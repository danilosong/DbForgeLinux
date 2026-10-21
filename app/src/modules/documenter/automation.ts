import type { DatabaseModel } from '../schema/model.js'
import { writeDocumentation, type DocumenterOptions, type DocumentFormat, type WrittenDocumentation } from './index.js'

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
    write?: (model: DatabaseModel, options: DocumenterOptions & { outputDirectory: string }) => Promise<WrittenDocumentation>
  }
): Promise<DocumentationBatchResult[]> {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) throw new Error('O manifesto deve conter de 1 a 100 bancos de dados.')
  const write = dependencies.write ?? writeDocumentation
  const results: DocumentationBatchResult[] = []
  for (const item of items) {
    const database = typeof item?.database === 'string' ? item.database.trim() : ''
    const outputDirectory = typeof item?.outputDirectory === 'string' ? item.outputDirectory.trim() : ''
    if (!database || /[\0\r\n]/.test(database) || !outputDirectory || /[\0\r\n]/.test(outputDirectory)) {
      results.push({ database: database || '(unknown)', error: 'Cada tarefa exige database e outputDirectory válidos.' })
      continue
    }
    try {
      const model = await dependencies.inspect(database)
      const options: DocumenterOptions & { outputDirectory: string } = {
        ...item,
        outputDirectory,
        formats: item.formats ?? ['html', 'markdown']
      }
      delete (options as Partial<DocumentationBatchItem>).database
      results.push({ database, output: await write(model, options) })
    } catch (error) {
      results.push({ database, error: error instanceof Error ? error.message : 'Falha ao gerar documentação.' })
    }
  }
  return results
}
