import type { ObjectEditorTarget } from '../../shared/contracts/object-editors.js'
import { createTable, diffTables, quoteIdentifier } from '../schema/index.js'
import type { TableModel } from '../schema/model.js'

export function buildObjectTemplate(target: ObjectEditorTarget): string {
  const name = `${quoteIdentifier(target.database)}.${quoteIdentifier(target.name)}`
  if (target.kind === 'view') return `CREATE OR REPLACE VIEW ${name} AS\nSELECT 1 AS id;`
  if (target.kind === 'procedure') return `CREATE PROCEDURE ${name}()\nBEGIN\n  SELECT 1;\nEND`
  if (target.kind === 'function') return `CREATE FUNCTION ${name}() RETURNS INT\nDETERMINISTIC\nBEGIN\n  RETURN 1;\nEND`
  if (target.kind === 'trigger') return `CREATE TRIGGER ${name} BEFORE INSERT ON ${quoteIdentifier(target.database)}.${quoteIdentifier('table_name')}\nFOR EACH ROW\nBEGIN\n  SET NEW.id = NEW.id;\nEND`
  if (target.kind === 'event') return `CREATE EVENT ${name}\nON SCHEDULE EVERY 1 DAY\nDO\n  SELECT 1;`
  throw new Error(`Não há template para ${target.kind}.`)
}

export interface RoutineParameter { name: string; mode: 'IN' | 'OUT' | 'INOUT'; type: string }
export interface RoutineOptions { definer: string; sqlAccess: 'CONTAINS SQL' | 'NO SQL' | 'READS SQL DATA' | 'MODIFIES SQL DATA'; deterministic: boolean; parameters: RoutineParameter[] }

export function buildRoutineTemplate(target: ObjectEditorTarget, options: RoutineOptions): string {
  if (target.kind !== 'procedure' && target.kind !== 'function') throw new Error('Routine options are only available for procedures and functions.')
  const name = `${quoteIdentifier(target.database)}.${quoteIdentifier(target.name)}`
  const definer = options.definer.trim()
  if (definer && definer !== 'CURRENT_USER' && !/^[A-Za-z0-9_.%$-]+@[A-Za-z0-9_.%$-]+$/.test(definer)) throw new Error('Definer must be CURRENT_USER or user@host.')
  const params = options.parameters.map((parameter) => {
    const parameterName = parameter.name.trim()
    const type = parameter.type.trim().toUpperCase()
    if (!/^[A-Za-z_$][\w$]*$/.test(parameterName)) throw new Error('Routine parameter name is invalid.')
    if (target.kind === 'function' && parameter.mode !== 'IN') throw new Error('Function parameters must use IN mode.')
    if (!/^(?:TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|BIT|BOOL|BOOLEAN|CHAR|VARCHAR|BINARY|VARBINARY|TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|DATE|DATETIME|TIMESTAMP|TIME|YEAR|JSON)(?:\(\d{1,5}(?:,\s*\d{1,5})?\))?(?:\s+UNSIGNED)?$/.test(type)) throw new Error(`Invalid routine parameter type: ${parameter.type}`)
    return `${parameter.mode} ${quoteIdentifier(parameterName)} ${type}`
  }).join(', ')
  const prefix = `CREATE${definer ? ` DEFINER = ${definer === 'CURRENT_USER' ? definer : `'${definer.split('@')[0]}'@'${definer.split('@')[1]}'`}` : ''}`
  const signature = `${prefix} ${target.kind.toUpperCase()} ${name}(${params})`
  if (target.kind === 'procedure') return `${signature}\n${options.sqlAccess}\nBEGIN\n  SELECT 1;\nEND;`
  return `${signature} RETURNS INT\n${options.deterministic ? 'DETERMINISTIC' : 'NOT DETERMINISTIC'}\n${options.sqlAccess}\nBEGIN\n  RETURN 1;\nEND;`
}

export function validateTableDraft(table: TableModel): void {
  if (!table.name.trim() || table.name.length > 64) throw new Error('Nome de tabela vazio ou maior que 64 caracteres.')
  if (!table.columns.length) throw new Error('Adicione ao menos uma coluna.')
  const names = table.columns.map((column) => column.name.trim().toLowerCase())
  if (names.some((name) => !name)) throw new Error('A column name field cannot be empty.')
  if (new Set(names).size !== names.length) throw new Error('Os nomes das colunas devem ser únicos.')
  for (const column of table.columns) {
    const type = column.type.trim()
    const typeWithoutUnsigned = type.replace(/\s+UNSIGNED$/i, '')
    const [base, ...tail] = typeWithoutUnsigned.split('(')
    const knownBase = /^(?:TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|BIT|BOOL|BOOLEAN|CHAR|VARCHAR|BINARY|VARBINARY|TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|TINYBLOB|BLOB|MEDIUMBLOB|LONGBLOB|DATE|DATETIME|TIMESTAMP|TIME|YEAR|JSON|ENUM|SET)$/i.test(base?.trim() ?? '')
    const hasBalancedArguments = !tail.length || (typeWithoutUnsigned.endsWith(')') && !/[;]|--|\/\*|\*\//.test(typeWithoutUnsigned) && (typeWithoutUnsigned.match(/\(/g)?.length ?? 0) === 1 && (typeWithoutUnsigned.match(/\)/g)?.length ?? 0) === 1)
    if (!knownBase || !hasBalancedArguments || /\s+UNSIGNED$/i.test(type) && !/^(?:TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|BIT)\b/i.test(base ?? '')) throw new Error(`Tipo inválido para ${column.name}: ${column.type}`)
  }
  if (table.columns.filter((column) => column.autoIncrement).length > 1) throw new Error('A tabela pode ter apenas uma coluna Auto Increment.')
  if (table.indexes.filter((index) => index.kind === 'PRIMARY').length > 1) throw new Error('A tabela pode ter apenas uma chave primária.')
  if (table.indexes.some((index) => !index.name.trim() || !index.columns.length || index.columns.some((part) => part.name && !table.columns.some((column) => column.name === part.name)))) throw new Error('Cada índice precisa de um nome e colunas existentes.')
  if (table.foreignKeys.some((fk) => !fk.name.trim() || !fk.columns.length || fk.columns.length !== fk.referencedColumns.length || fk.columns.some((name) => !table.columns.some((column) => column.name === name)) || !fk.referencedTable.trim())) throw new Error('Revise as colunas e a tabela de referência da chave estrangeira.')
  const autoIncrement = table.columns.find((column) => column.autoIncrement)
  if (autoIncrement && !table.indexes.some((index) => index.kind === 'PRIMARY' && index.columns.some((part) => part.name === autoIncrement.name))) throw new Error('Auto Increment requer uma coluna de chave primária.')
  if (table.engine && !/^[A-Za-z][A-Za-z0-9_]*$/.test(table.engine)) throw new Error('Engine inválido.')
  if (table.charset && !/^[A-Za-z0-9_]+$/.test(table.charset)) throw new Error('Character set inválido.')
  if (table.collation && !/^[A-Za-z0-9_]+$/.test(table.collation)) throw new Error('Collation inválida.')
  for (const [key, value] of Object.entries(table.options ?? {})) if (!['AUTO_INCREMENT', 'ROW_FORMAT', 'STATS_PERSISTENT', 'STATS_AUTO_RECALC'].includes(key.toUpperCase()) || !/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`Opção de tabela inválida: ${key}.`)
  if (table.partitioning?.definitions?.some((item) => /;|--|\/\*/.test(item.value ?? ''))) throw new Error('Valor de partição inválido.')
}

export function normalizeObjectDefinition(sql: string, target: ObjectEditorTarget): string {
  const value = sql.replace(/^\s*DELIMITER\s+\S+\s*$/gim, '').trim().replace(/;?$/, ';')
  if (!/^CREATE\b/i.test(value)) throw new Error('A definição deve começar com CREATE.')
  const pattern = new RegExp(`\\b${target.kind}\\s+((?:\`(?:\`\`|[^\`])+\`\\.)?(?:\`(?:\`\`|[^\`])+\`|[A-Za-z_$][\\w$]*))`, 'i')
  const found = pattern.exec(value)?.[1]
  if (!found) throw new Error(`A definição CREATE não declara ${target.kind}.`)
  const parts = found.split('.').map((part) => part.startsWith('`') ? part.slice(1, -1).replaceAll('``', '`') : part)
  if (parts.at(-1) !== target.name || (parts.length > 1 && parts.at(-2) !== target.database)) throw new Error('O nome na definição deve coincidir com o objeto aberto no Explorer.')
  return value
}

export function buildTableDdlPreview(table: TableModel, original: TableModel | null, database: string): string {
  return original ? diffTables(original, table, database, true).join('\n\n') || '-- Sem alterações pendentes' : createTable(table, database)
}
