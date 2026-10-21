import { quoteIdentifier } from '../schema/index.js'

export function buildCreateDatabaseDdl(name: string, characterSet = 'utf8mb4', collation = ''): string {
  const database = name.trim()
  // eslint-disable-next-line no-control-regex
  if (!database || database.length > 64 || /[\u0000-\u001f]/.test(database)) throw new Error('Database name must contain 1 to 64 printable characters.')
  if (!/^[A-Za-z0-9_]+$/.test(characterSet)) throw new Error('Invalid character set name.')
  if (collation && !/^[A-Za-z0-9_]+$/.test(collation)) throw new Error('Invalid collation name.')
  return `CREATE DATABASE ${quoteIdentifier(database)}${characterSet ? ` CHARACTER SET ${characterSet}` : ''}${collation ? ` COLLATE ${collation}` : ''};`
}

export function validateCreateDatabaseDdl(sql: string, expectedName: string): string {
  const statement = sql.trim().replace(/;\s*$/, '')
  const match = /^CREATE\s+DATABASE\s+(?:IF\s+NOT\s+EXISTS\s+)?(`(?:``|[^`])+`|[A-Za-z0-9_$]+)(?:\s+CHARACTER\s+SET\s+[A-Za-z0-9_]+)?(?:\s+COLLATE\s+[A-Za-z0-9_]+)?$/i.exec(statement)
  if (!match) throw new Error('Only one CREATE DATABASE statement is allowed.')
  const actualName = match[1]!.startsWith('`') ? match[1]!.slice(1, -1).replaceAll('``', '`') : match[1]
  if (actualName !== expectedName.trim()) throw new Error('The SQL database name must match the General page name.')
  return `${statement};`
}
