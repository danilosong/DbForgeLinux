import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { generateDocumentation, writeDocumentation } from '../../src/modules/documenter/index.js'
import type { DatabaseModel } from '../../src/modules/schema/model.js'

const model: DatabaseModel = {
  kind: 'database', name: 'sample<db>', charset: 'utf8mb4', collation: 'utf8mb4_0900_ai_ci',
  tables: [{
    kind: 'table', name: 'users', columns: [
      { name: 'id', type: 'int', nullable: false }, { name: 'display|name', type: 'varchar(80)', nullable: true, comment: '<script>alert(1)</script>' }
    ], indexes: [{ name: 'PRIMARY', kind: 'PRIMARY', columns: [{ name: 'id' }] }],
    foreignKeys: [{ name: 'fk_user', columns: ['id'], referencedTable: 'users', referencedColumns: ['id'] }], checks: []
  }],
  views: [{ kind: 'view', name: 'safe_view', definition: 'SELECT * FROM users' }],
  procedures: [{ kind: 'procedure', name: 'find_user', definition: 'SELECT * FROM users', parameters: ['IN p_id INT'] }],
  functions: [], triggers: [{ kind: 'trigger', name: 'users_audit', table: 'users', timing: 'AFTER', event: 'INSERT', definition: 'SET @x = 1' }],
  events: [{ kind: 'event', name: 'cleanup', definition: 'DELETE FROM users', status: 'ENABLED', schedule: 'EVERY 1 DAY' }]
}

describe('documenter', () => {
  it('generates escaped HTML, Markdown and optional relationship SVG', () => {
    const output = generateDocumentation(model, { includeDiagram: true, descriptions: { 'table.users': 'User reference table' } })
    expect(output.html).toContain('<!doctype html>')
    expect(output.html).toContain('User reference table')
    expect(output.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(output.html).not.toContain('<script>alert')
    expect(output.markdown).toContain('display\\|name')
    expect(output.markdown).toContain('Foreign keys:')
    expect(output.html).toContain('Dependencies: users')
    expect(output.diagramSvg).toContain('<svg')
    expect(output.diagramSvg).toContain('marker-end')
  })

  it('adds a customizable cover to HTML and Markdown and can omit it', () => {
    const output = generateDocumentation(model, { title: 'Internal catalog', author: 'Data team', copyright: '2026 Example', logo: 'ACME', created: '2026-10-20', descriptions: { cover: 'Schema reference' } })
    expect(output.html).toContain('class="cover"')
    expect(output.html).toContain('Data team')
    expect(output.html).toContain('Schema reference')
    expect(output.markdown).toContain('author: Data team')
    expect(output.markdown).toContain('logo: ACME')
    expect(generateDocumentation(model, { coverPage: false }).html).not.toContain('class="cover"')
  })
  it('excludes individual columns and indexes from generated documentation', () => {
    const output = generateDocumentation(model, { excludedColumns: ['users.display|name'], excludedIndexes: ['users.PRIMARY'] })
    expect(output.html).not.toContain('display|name')
    expect(output.html).not.toContain('<strong>PRIMARY</strong>')
    expect(output.markdown).not.toContain('display\\|name')
    expect(output.markdown).not.toContain('PRIMARY (PRIMARY)')
  })

  it('writes HTML, Markdown, SVG and PDF bytes through the isolated printer interface', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tuxsql-doc-'))
    const printToPDF = vi.fn(async (html: string) => Buffer.from(`PDF:${html.length}`))
    try {
      const output = await writeDocumentation(model, { outputDirectory: directory, includeDiagram: true, formats: ['html', 'markdown', 'pdf'], pdfPrinter: { printToPDF } })
      expect(output.html).toBeDefined(); expect(output.markdown).toBeDefined(); expect(output.pdf).toBeDefined(); expect(output.diagram).toBeDefined()
      expect((await readFile(output.html!, 'utf8')).startsWith('<!doctype html>')).toBe(true)
      expect((await readFile(output.markdown!, 'utf8')).startsWith('---\ntitle: Database documentation:')).toBe(true)
      expect((await readFile(output.pdf!)).subarray(0, 4).toString()).toBe('PDF:')
      expect((await readFile(output.diagram!, 'utf8')).startsWith('<svg')).toBe(true)
      expect(printToPDF).toHaveBeenCalledOnce()
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('requires a PDF printer only when PDF output is requested', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tuxsql-doc-'))
    try { await expect(writeDocumentation(model, { outputDirectory: directory, formats: ['pdf'] })).rejects.toThrow('PdfPrintToPdf') }
    finally { await rm(directory, { recursive: true, force: true }) }
  })
})
