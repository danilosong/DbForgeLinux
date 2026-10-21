import { describe, expect, it } from 'vitest'
import { buildCreateDatabaseDdl, validateCreateDatabaseDdl } from '../../src/modules/object-editors/database.js'

describe('buildCreateDatabaseDdl', () => {
  it('quotes database identifiers and includes selected charset options', () => {
    expect(buildCreateDatabaseDdl('sales`archive', 'utf8mb4', 'utf8mb4_0900_ai_ci'))
      .toBe('CREATE DATABASE `sales``archive` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;')
  })

  it('rejects empty, oversized and malformed option values', () => {
    expect(() => buildCreateDatabaseDdl('')).toThrow(/1 to 64/)
    expect(() => buildCreateDatabaseDdl('x'.repeat(65))).toThrow(/1 to 64/)
    expect(() => buildCreateDatabaseDdl('db', 'utf8mb4; DROP DATABASE mysql')).toThrow(/character set/)
    expect(() => buildCreateDatabaseDdl('db', 'utf8mb4', 'utf8mb4;')).toThrow(/collation/)
  })

  it('accepts only a single CREATE DATABASE statement for the selected name', () => {
    expect(validateCreateDatabaseDdl('CREATE DATABASE `sales``archive`;', 'sales`archive'))
      .toBe('CREATE DATABASE `sales``archive`;')
    expect(() => validateCreateDatabaseDdl('CREATE DATABASE db; DROP DATABASE mysql;', 'db')).toThrow(/Only one/)
    expect(() => validateCreateDatabaseDdl('CREATE DATABASE other;', 'db')).toThrow(/match/)
  })
})
