import { describe, expect, it } from 'vitest'
import { mkdtemp, symlink, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { countCsvRecords, parseAccessSchema, parseAccessTables, validateAccessFile } from '../../src/modules/data-export-import/access.js'
import { buildCreateTableSql } from '../../src/modules/data-export-import/inference.js'

describe('Access import output adapter', () => {
  it('parses mocked mdb-tables and mdb-schema output into safe MySQL column types', () => {
    const tables = parseAccessTables('Customers\r\nOrders\r\n')
    const schema = parseAccessSchema(`CREATE TABLE [Customers]\n (\n  [CustomerID] Long Integer,\n  [DisplayName] Text (80),\n  [CreditLimit] Currency,\n  [CreatedAt] DateTime,\n  [IsActive] Boolean NOT NULL,\n  [Notes] Memo/Hyperlink (255)\n);`, `CREATE TABLE \`Customers\` (\`CustomerID\` int);\nALTER TABLE \`Customers\` ADD PRIMARY KEY (\`CustomerID\`);`, tables[0]!)
    expect(schema.columns).toEqual([
      { name: 'CustomerID', type: 'INT', primaryKey: true },
      { name: 'DisplayName', type: 'VARCHAR(80)', primaryKey: false },
      { name: 'CreditLimit', type: 'DECIMAL(19,4)', primaryKey: false },
      { name: 'CreatedAt', type: 'DATETIME', primaryKey: false },
      { name: 'IsActive', type: 'TINYINT(1)', primaryKey: false },
      { name: 'Notes', type: 'TEXT', primaryKey: false }
    ])
    const sql = buildCreateTableSql('access_test', 'Customers', schema.columns)
    expect(sql).toContain('`CreditLimit` DECIMAL(19,4) NULL')
    expect(sql).toContain('`CreatedAt` DATETIME NULL')
    expect(sql).toContain('PRIMARY KEY (`CustomerID`)')
  })

  it('keeps quoted multiline CSV fields as one record when enforcing the row cap', () => {
    expect(countCsvRecords('id,note\r\n1,"memo, with\nline break"\r\n2,ok\r\n', 2)).toBe(3)
    expect(countCsvRecords(`id,name\n1,"O'Brien"\n`, 10)).toBe(2)
  })

  it('rejects unrecognized Access types and empty table lists from mocked tool output', () => {
    expect(() => parseAccessSchema('CREATE TABLE [T]\n (\n [x] Unknown Jet Type\n);', '', 'T')).toThrow(/Unsupported Access column type/)
    expect(() => parseAccessTables('\n')).toThrow(/no valid tables/)
  })

  it('accepts only bounded regular .mdb/.accdb files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tuxsql-access-validation-'))
    try {
      const file = join(root, 'fixture.MDB')
      await writeFile(file, 'synthetic')
      await expect(validateAccessFile(file, 16)).resolves.toMatchObject({ size: 9 })
      await expect(validateAccessFile(file, 8)).rejects.toThrow(/configured 8 byte limit/)
      await expect(validateAccessFile(join(root, 'wrong.csv'), 16)).rejects.toThrow(/\.mdb or \.accdb/)
      await mkdir(join(root, 'directory.mdb'))
      await expect(validateAccessFile(join(root, 'directory.mdb'), 16)).rejects.toThrow(/regular file/)
      await symlink(file, join(root, 'linked.mdb'))
      await expect(validateAccessFile(join(root, 'linked.mdb'), 16)).rejects.toThrow(/regular file/)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
