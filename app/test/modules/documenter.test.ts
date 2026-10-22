import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { generateDocumentation, writeDocumentation } from '../../src/modules/documenter/index.js'
import { inspectDocumenterAccounts } from '../../src/modules/documenter/accounts.js'
import { generateDocumentationBatch } from '../../src/modules/documenter/automation.js'
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
  it('generates a batch for each database, reports per-database failures, and continues', async () => {
    const inspected: string[] = []
    const written: string[] = []
    const results = await generateDocumentationBatch([
      { database: 'sales', outputDirectory: '/tmp/docs' },
      { database: 'missing', outputDirectory: '/tmp/docs' },
      { database: 'warehouse', outputDirectory: '/tmp/docs', formats: ['html'] }
    ], {
      inspect: async (database) => {
        inspected.push(database)
        if (database === 'missing') throw new Error('database unavailable')
        return model
      },
      write: async (_schema, options) => {
        written.push(`${options.title ?? 'default'}:${options.outputDirectory}:${options.formats?.join(',')}`)
        return { html: `${options.outputDirectory}/index.html` }
      }
    })

    expect(inspected).toEqual(['sales', 'missing', 'warehouse'])
    expect(written).toEqual(['default:/tmp/docs:html,markdown', 'default:/tmp/docs:html'])
    expect(results).toMatchObject([
      { database: 'sales', output: { html: '/tmp/docs/index.html' } },
      { database: 'missing', error: 'database unavailable' },
      { database: 'warehouse', output: { html: '/tmp/docs/index.html' } }
    ])
  })

  it('rejects empty and oversized documentation batches', async () => {
    const dependencies = { inspect: async () => model }
    await expect(generateDocumentationBatch([], dependencies)).rejects.toThrow('between 1 and 100 databases')
    await expect(generateDocumentationBatch(Array.from({ length: 101 }, (_, index) => ({ database: `db-${index}`, outputDirectory: '/tmp/docs' })), dependencies)).rejects.toThrow('between 1 and 100 databases')
  })
  it('threads cover settings and account grants through the batch generator', async () => {
    const inspectAccounts = vi.fn(async () => [{ grantee: "'reporter'@'%'", globalPrivileges: ['SELECT'], scopedPrivileges: [] }])
    const write = vi.fn(async (_model: DatabaseModel, options: { palette?: string; accounts?: unknown[]; includeUsers?: boolean }) => {
      expect(options).toMatchObject({ palette: 'forest', includeUsers: true, accounts: [{ grantee: "'reporter'@'%'" }] })
      return { markdown: '/tmp/docs/catalog.md' }
    })
    const result = await generateDocumentationBatch([{ database: 'catalog', outputDirectory: '/tmp/docs', includeUsers: true, palette: 'forest', formats: ['pdf'] }], {
      inspect: async () => model, inspectAccounts, write
    })
    expect(inspectAccounts).toHaveBeenCalledWith('catalog')
    expect(result[0]?.output?.markdown).toBe('/tmp/docs/catalog.md')
  })

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
  it('renders selected cover palette, breadcrumbs, and account privilege sections safely', () => {
    const output = generateDocumentation(model, {
      title: 'Sales catalog', palette: 'ocean', breadcrumbs: false, includeUsers: true,
      accounts: [{ grantee: "'reader'@'%'", globalPrivileges: ['SELECT'], scopedPrivileges: ['sample<db>.users: SELECT'] }]
    })
    expect(output.html).toContain('--cover-accent:#0f766e')
    expect(output.html).not.toContain('class="crumb"')
    expect(output.html).toContain('<h2>Users and privileges</h2>')
    expect(output.html).toContain('&lt;db&gt;.users: SELECT')
    expect(output.markdown).toContain('palette: ocean')
    expect(output.markdown).toContain("'reader'@'%'")
    expect(generateDocumentation(model, { includeUsers: false, accounts: [{ grantee: 'reader', globalPrivileges: ['SELECT'], scopedPrivileges: [] }] }).html).not.toContain('Users and privileges')
  })
  it('applies valid editable cover colors to HTML and ignores invalid colors', () => {
    const output = generateDocumentation(model, { coverAccent: '#123abc', coverSurface: '#abcdef' })
    expect(output.html).toContain('--cover-accent:#123abc')
    expect(output.html).toContain('--cover-surface:#abcdef')
    expect(generateDocumentation(model, { coverAccent: 'red' }).html).toContain('--cover-accent:#2563eb')
  })
  it('groups information-schema grants without requesting authentication data', async () => {
    const query = vi.fn(async (sql: string, parameters?: unknown[]) => {
      expect(sql).not.toMatch(/authentication_string|password/i)
      expect(parameters).toEqual(['catalog', 'catalog'])
      return [
        { grantee: "'reader'@'%'", scope: 'GLOBAL', privilege: 'SELECT', object_name: null },
        { grantee: "'reader'@'%'", scope: 'OBJECT', privilege: 'UPDATE', object_name: 'catalog.users' }
      ]
    })
    await expect(inspectDocumenterAccounts(query, 'catalog')).resolves.toEqual([{ grantee: "'reader'@'%'", globalPrivileges: ['SELECT'], scopedPrivileges: ['catalog.users: UPDATE'] }])
  })
  it('excludes individual columns and indexes from generated documentation', () => {
    const output = generateDocumentation(model, { excludedColumns: ['users.display|name'], excludedIndexes: ['users.PRIMARY'] })
    expect(output.html).not.toContain('display|name')
    expect(output.html).not.toContain('<strong>PRIMARY</strong>')
    expect(output.markdown).not.toContain('display\\|name')
    expect(output.markdown).not.toContain('PRIMARY (PRIMARY)')
  })

  it('offers the nine documented HTML themes and excludes unchecked tables in HTML and Markdown', () => {
    for (const palette of ['default', 'bootstrap', 'cerulean', 'cyborg', 'default-dark', 'flatly', 'journal', 'paper', 'yeti'] as const) {
      expect(generateDocumentation(model, { palette }).html).toContain('Database: <strong>sample&lt;db&gt;</strong>')
    }
    const output = generateDocumentation(model, { excludedTables: ['users'] })
    expect(output.html).not.toContain('id="table-users"')
    expect(output.markdown).not.toContain('Table: users')
  })

  it('writes HTML, Markdown, SVG and PDF bytes through the isolated printer interface', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tuxsql-doc-'))
    const printToPDF = vi.fn(async (html: string) => Buffer.from(`PDF:${html.length}`))
    try {
      const output = await writeDocumentation(model, { outputDirectory: directory, includeDiagram: true, formats: ['html', 'markdown', 'pdf'], pdfOrientation: 'landscape', pdfFontScale: 125, pdfPageNumbers: true, pdfPrinter: { printToPDF } })
      expect(output.html).toBeDefined(); expect(output.markdown).toBeDefined(); expect(output.pdf).toBeDefined(); expect(output.diagram).toBeDefined()
      expect((await readFile(output.html!, 'utf8')).startsWith('<!doctype html>')).toBe(true)
      expect((await readFile(output.markdown!, 'utf8')).startsWith('---\ntitle: Database documentation:')).toBe(true)
      expect((await readFile(output.pdf!)).subarray(0, 4).toString()).toBe('PDF:')
      expect((await readFile(output.diagram!, 'utf8')).startsWith('<svg')).toBe(true)
      expect(printToPDF).toHaveBeenCalledOnce()
      expect(printToPDF).toHaveBeenCalledWith(expect.stringContaining('font-size:125%'), expect.objectContaining({ pageSize: 'A4', landscape: true, displayHeaderFooter: true, footerTemplate: expect.stringContaining('pageNumber') }))
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('requires a PDF printer only when PDF output is requested', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tuxsql-doc-'))
    try { await expect(writeDocumentation(model, { outputDirectory: directory, formats: ['pdf'] })).rejects.toThrow('PdfPrintToPdf') }
    finally { await rm(directory, { recursive: true, force: true }) }
  })
})
