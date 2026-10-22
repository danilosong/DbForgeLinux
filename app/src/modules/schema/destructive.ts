import type { ColumnModel, DatabaseModel } from './model.js'

const integerBits: Record<string, number> = { tinyint: 8, smallint: 16, mediumint: 24, int: 32, integer: 32, bigint: 64 }
const textRank: Record<string, number> = { tinytext: 255, text: 65_535, mediumtext: 16_777_215, longtext: 4_294_967_295 }

export function isColumnNarrowing(before: ColumnModel, after: ColumnModel): boolean {
  const oldType = typeParts(before.type)
  const newType = typeParts(after.type)
  if (!oldType || !newType) return before.nullable && !after.nullable
  if (before.nullable && !after.nullable) return true
  if (oldType.name !== newType.name) {
    if ((integerBits[oldType.name] ?? 0) > (integerBits[newType.name] ?? 0) && integerBits[newType.name]) return true
    if ((textRank[oldType.name] ?? 0) > (textRank[newType.name] ?? 0) && textRank[newType.name]) return true
    return false
  }
  if (['varchar', 'char', 'varbinary', 'binary'].includes(oldType.name)) return (newType.args[0] ?? Number.POSITIVE_INFINITY) < (oldType.args[0] ?? Number.POSITIVE_INFINITY)
  if (oldType.name === 'decimal' || oldType.name === 'numeric') return (newType.args[0] ?? 10) < (oldType.args[0] ?? 10) || (newType.args[1] ?? 0) < (oldType.args[1] ?? 0)
  if (oldType.name === 'enum' || oldType.name === 'set') {
    const oldValues = enumValues(before.type)
    const newValues = enumValues(after.type)
    return oldValues !== undefined && newValues !== undefined && oldValues.some((value) => !newValues.includes(value))
  }
  return false
}

export function hasNarrowingChanges(before: DatabaseModel, after: DatabaseModel): boolean {
  const beforeTables = new Map(before.tables.map((table) => [table.name, table]))
  for (const table of after.tables) {
    const oldTable = beforeTables.get(table.name)
    if (!oldTable) continue
    const oldColumns = new Map(oldTable.columns.map((column) => [column.name, column]))
    if (table.columns.some((column) => { const old = oldColumns.get(column.name); return old !== undefined && isColumnNarrowing(old, column) })) return true
  }
  return false
}

export function isDestructiveSchemaScript(script: string, database: DatabaseModel): boolean {
  if (/\bDROP\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT|DATABASE)\b/i.test(script)) return true
  const tableMap = new Map(database.tables.map((table) => [table.name.toLowerCase(), table]))
  for (const statement of script.split(';')) {
    const identifier = '(?:`((?:``|[^`])+)`|([A-Za-z_$][\\w$]*))'
    const alter = new RegExp(`^\\s*ALTER\\s+TABLE\\s+(?:${identifier}\\s*\\.\\s*)?${identifier}\\s+([\\s\\S]*)$`, 'i').exec(statement)
    if (!alter) continue
    const schema = identifierValue(alter[1], alter[2])
    if (schema && schema !== database.name) continue
    const tableName = identifierValue(alter[3], alter[4])
    if (!tableName) continue
    const table = tableMap.get(tableName.toLowerCase())
    const clauses = splitClauses(alter[5]!)
    for (const clause of clauses) {
      if (/^DROP\s+(?:INDEX|KEY|PRIMARY|FOREIGN|CHECK|CONSTRAINT)\b/i.test(clause)) continue
      if (/^DROP\s+(?:COLUMN\s+)?/i.test(clause)) return true
      const modify = /^MODIFY\s+(?:COLUMN\s+)?(?:`((?:``|[^`])+)`|([A-Za-z_$][\w$]*))\s+([A-Za-z]+(?:\s*\([^)]*\))?)([\s\S]*)$/i.exec(clause)
      if (!modify || !table) continue
      const columnName = identifierValue(modify[1], modify[2])
      const old = table.columns.find((column) => column.name === columnName)
      if (!old) continue
      const proposed: ColumnModel = { ...old, type: modify[3]!.replaceAll(/\s+/g, ''), nullable: !/\bNOT\s+NULL\b/i.test(modify[4]!) }
      if (isColumnNarrowing(old, proposed)) return true
    }
  }
  return false
}

function identifierValue(quoted: string | undefined, bare: string | undefined): string | undefined { return quoted?.replaceAll('``', '`') ?? bare }

function typeParts(value: string): { name: string; args: number[] } | undefined {
  const match = /^\s*([a-z]+)\s*(?:\(([^)]*)\))?/i.exec(value)
  if (!match) return undefined
  const args = (match[2] ?? '').split(',').map((part) => Number(part.trim())).filter(Number.isFinite)
  return { name: match[1]!.toLowerCase(), args }
}

function enumValues(type: string): string[] | undefined {
  const body = /^\s*(?:enum|set)\s*\((.*)\)\s*$/i.exec(type)?.[1]
  if (body === undefined) return undefined
  return [...body.matchAll(/'((?:\\.|''|[^'])*)'/g)].map((match) => match[1]!.replaceAll("''", "'").replaceAll("\\'", "'"))
}

function splitClauses(value: string): string[] {
  const parts: string[] = []; let start = 0; let depth = 0; let quote = ''
  for (let i = 0; i < value.length; i++) {
    const char = value[i]!
    if (quote) { if (char === quote && value[i + 1] === quote) { i++; continue }; if (char === quote && value[i - 1] !== '\\') quote = ''; continue }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue }
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) { parts.push(value.slice(start, i).trim()); start = i + 1 }
  }
  parts.push(value.slice(start).trim()); return parts.filter(Boolean)
}
