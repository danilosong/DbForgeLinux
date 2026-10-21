import type { ColumnModel, TableModel } from '../schema/model.js'
import type { GeneratorSpec, Locale } from './types.js'

export type Random = () => number

export function seededRandom(seed: number | string = 1): Random {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(value: string): number {
  let hash = 2166136261
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619) }
  return hash >>> 0
}

const firstNames: Record<Locale, string[]> = {
  'pt-BR': ['Ana', 'Bruno', 'Camila', 'Diego', 'Elisa', 'Felipe', 'Giovana', 'Hugo', 'Isabela', 'João', 'Lia', 'Mateus'],
  'en-US': ['Ava', 'Benjamin', 'Charlotte', 'Daniel', 'Emma', 'Felix', 'Grace', 'Henry', 'Isla', 'Jackson', 'Luna', 'Mason']
}
const lastNames: Record<Locale, string[]> = {
  'pt-BR': ['Almeida', 'Barbosa', 'Costa', 'Dias', 'Ferreira', 'Gomes', 'Lima', 'Oliveira', 'Pereira', 'Silva'],
  'en-US': ['Adams', 'Brown', 'Clark', 'Davis', 'Evans', 'Garcia', 'Hill', 'Jones', 'Miller', 'Smith']
}
const streets: Record<Locale, string[]> = {
  'pt-BR': ['Rua das Flores', 'Avenida Brasil', 'Rua do Sol', 'Alameda Central', 'Rua Bela Vista'],
  'en-US': ['Oak Street', 'Maple Avenue', 'Cedar Road', 'Pine Lane', 'Lakeview Drive']
}
const lorem: Record<Locale, string[]> = {
  'pt-BR': ['texto de exemplo', 'dados para teste', 'uma frase simples', 'conteúdo gerado'],
  'en-US': ['sample text', 'test data', 'a simple sentence', 'generated content']
}
const countryCodes: Record<Locale, string[]> = {
  'pt-BR': ['BR', 'AR', 'CA', 'DE', 'ES', 'FR', 'GB', 'IT', 'JP', 'US'],
  'en-US': ['AU', 'BR', 'CA', 'DE', 'ES', 'FR', 'GB', 'IN', 'JP', 'US']
}

function pick<T>(values: readonly T[], random: Random): T { return values[Math.floor(random() * values.length)] }

export function sampleRegex(pattern: string, random: Random): string {
  const source = pattern.replace(/^\^|\$$/g, '')
  if (source.length > 256 || /\(\?[<!=]/.test(source)) throw new Error('Regex não suportado pelo gerador seguro.')
  let output = ''
  for (let i = 0; i < source.length; i++) {
    let token = source[i]
    let choices: string[] | undefined
    if (token === '\\') {
      token = source[++i] ?? ''
      if (token === 'd') choices = [...'0123456789']
      else if (token === 'w') choices = [...'abcdefghijklmnopqrstuvwxyz0123456789_']
      else if (token === 's') choices = [' ']
      else if (token === 'D') choices = [...'abcdefghijklmnopqrstuvwxyz']
      else output += token
    } else if (token === '[') {
      const end = source.indexOf(']', i + 1)
      if (end < 0) throw new Error('Classe de caracteres regex não terminada.')
      let spec = source.slice(i + 1, end)
      const negate = spec.startsWith('^')
      if (negate) spec = spec.slice(1)
      choices = []
      for (let k = 0; k < spec.length; k++) {
        if (spec[k + 1] === '-' && spec[k + 2]) {
          for (let code = spec.charCodeAt(k); code <= spec.charCodeAt(k + 2); code++) choices.push(String.fromCharCode(code))
          k += 2
        } else choices.push(spec[k])
      }
      if (negate) choices = [...'abcdefghijklmnopqrstuvwxyz0123456789'].filter((char) => !choices?.includes(char))
      i = end
    } else if (token === '(' || token === ')' || token === '|') throw new Error('Regex com grupos ou alternativas não é suportado.')
    if (choices) {
      let repeat = 1
      const quantifier = /^(?:\{(\d+)(?:,(\d+))?\}|([+?*]))/.exec(source.slice(i + 1))
      if (quantifier) {
        if (quantifier[1]) repeat = Number(quantifier[2] ?? quantifier[1]) === Number(quantifier[1]) ? Number(quantifier[1]) : Math.floor(Number(quantifier[1]) + random() * (Number(quantifier[2]) - Number(quantifier[1]) + 1))
        else repeat = quantifier[3] === '?' ? (random() < 0.5 ? 0 : 1) : quantifier[3] === '*' ? Math.floor(random() * 4) : 1 + Math.floor(random() * 4)
        i += quantifier[0].length
      }
      if (repeat > 128) throw new Error('Repetição regex acima do limite seguro.')
      for (let n = 0; n < repeat; n++) output += pick(choices, random)
    } else if (token !== '^' && token !== '$') output += token === '.' ? pick([...'abcdefghijklmnopqrstuvwxyz'], random) : token
  }
  return output
}

export interface GenerationContext {
  random: Random
  locale: Locale
  rowIndex: number
  table: TableModel
  column: ColumnModel
  spec?: GeneratorSpec
  sequence?: number
  foreignValues?: readonly unknown[]
}

export function inferKind(column: ColumnModel, spec?: GeneratorSpec): GeneratorSpec['kind'] {
  if (spec?.kind && spec.kind !== 'auto') return spec.kind
  const label = `${column.name} ${column.comment ?? ''}`.toLowerCase()
  if (/email|e-mail|correo/.test(label)) return 'email'
  if (/country|country_code|pais|país/.test(label)) return 'country'
  if (/status|state|active|enabled|state_code/.test(label) || /^enum\s*\(/i.test(column.type)) return 'status'
  if (/name|nome|first|last/.test(label)) return 'name'
  if (/address|endereco|street|logradouro/.test(label)) return 'address'
  if (/date|data|time|created|updated/.test(label)) return 'date'
  if (/lorem|description|descricao|comment|comentario/.test(label)) return 'lorem'
  if (/int|decimal|numeric|float|double|year/.test(column.type.toLowerCase())) return 'number'
  if (/char|text|enum|set|json/.test(column.type.toLowerCase())) return 'lorem'
  return 'auto'
}

export function generateValue(ctx: GenerationContext): unknown {
  const { random, locale, column, spec } = ctx
  const nullPercent = Math.max(0, Math.min(100, spec?.nullPercent ?? 0))
  if (nullPercent && random() * 100 < nullPercent && column.nullable) return null
  const kind = inferKind(column, spec)
  if (kind === 'sequence') return (spec?.start ?? 1) + ctx.rowIndex * (spec?.step ?? 1)
  if (kind === 'unique') {
    const value = (spec?.start ?? 1) + ctx.rowIndex * (spec?.step ?? 1)
    return /int|decimal|numeric|float|double|year/i.test(column.type) ? value : `${ctx.table.name}-${column.name}-${value}`
  }
  if (kind === 'list') {
    if (!spec?.values?.length) throw new Error(`Gerador list para ${column.name} exige values.`)
    return pick(spec.values, random)
  }
  if (kind === 'regex') {
    if (!spec?.pattern) throw new Error(`Gerador regex para ${column.name} exige pattern.`)
    return sampleRegex(spec.pattern, random)
  }
  if (kind === 'foreignKey' || kind === 'fromTable') {
    if (!ctx.foreignValues?.length) throw new Error(`Nenhum valor de origem disponível para ${column.name}.`)
    return pick(ctx.foreignValues, random)
  }
  if (kind === 'name') return `${pick(firstNames[locale], random)} ${pick(lastNames[locale], random)}`
  if (kind === 'email') return `${pick(firstNames[locale], random).toLowerCase()}.${pick(lastNames[locale], random).toLowerCase()}${ctx.rowIndex}@example.test`
  if (kind === 'country') return pick(countryCodes[locale], random)
  if (kind === 'status') {
    const values = /^enum\s*\((.*)\)$/i.exec(column.type)?.[1]?.match(/'((?:''|\\.|[^'])*)'/g)?.map((value) => value.slice(1, -1).replaceAll("''", "'"))
    return values?.length ? pick(values, random) : pick(['active', 'inactive', 'pending', 'archived'], random)
  }
  if (kind === 'address') return `${pick(streets[locale], random)}, ${1 + Math.floor(random() * 9999)}`
  if (kind === 'date') {
    const day = Math.floor(random() * 365 * 12)
    const date = new Date(Date.UTC(2020, 0, 1 + day))
    if (spec?.format === 'date' || /^date\b/i.test(column.type)) return date.toISOString().slice(0, 10)
    return date
  }
  if (kind === 'number') {
    const min = spec?.min ?? (/unsigned/i.test(column.type) ? 0 : -1000)
    const max = spec?.max ?? 1000
    if (/decimal|numeric|float|double/i.test(column.type)) return Math.round((min + random() * (max - min)) * 100) / 100
    return Math.floor(min + random() * (max - min + 1))
  }
  if (kind === 'lorem') return pick(lorem[locale], random)
  if (/bool|tinyint\(1\)/i.test(column.type)) return random() < 0.5 ? 0 : 1
  if (/date|time/i.test(column.type)) return /^date\b/i.test(column.type) ? new Date(Date.UTC(2020, 0, 1 + Math.floor(random() * 3650))).toISOString().slice(0, 10) : new Date(Date.UTC(2020, 0, 1 + Math.floor(random() * 3650)))
  if (/int|decimal|numeric|float|double|year/i.test(column.type)) return Math.floor(random() * 1000)
  if (/blob|binary/i.test(column.type)) return Buffer.from(`sample-${ctx.rowIndex}`)
  return pick(lorem[locale], random)
}

export function isUniqueColumn(table: TableModel, columnName: string): boolean {
  return table.indexes.some((index) => (index.kind === 'PRIMARY' || index.kind === 'UNIQUE') && index.columns.length === 1 && index.columns[0].name === columnName)
}

export function passesSimpleCheck(check: string, row: Record<string, unknown>): boolean {
  const expression = check.trim().replace(/^\(+|\)+$/g, '')
  let match = /^`?([\w$]+)`?\s+(IS\s+NOT\s+NULL|IS\s+NULL)$/i.exec(expression)
  if (match) return /NOT/i.test(match[2]) ? row[match[1]] != null : row[match[1]] == null
  match = /^`?([\w$]+)`?\s+(<=|>=|<>|!=|=|<|>)\s*(-?\d+(?:\.\d+)?)$/i.exec(expression)
  if (match) {
    const value = Number(row[match[1]]); const limit = Number(match[3])
    if (!Number.isFinite(value)) return true
    return ({ '<': value < limit, '<=': value <= limit, '>': value > limit, '>=': value >= limit, '=': value === limit, '!=': value !== limit, '<>': value !== limit } as Record<string, boolean>)[match[2]]
  }
  match = /^`?([\w$]+)`?\s+BETWEEN\s+(-?\d+(?:\.\d+)?)\s+AND\s+(-?\d+(?:\.\d+)?)$/i.exec(expression)
  if (match) { const value = Number(row[match[1]]); return !Number.isFinite(value) || value >= Number(match[2]) && value <= Number(match[3]) }
  if (/\s+AND\s+/i.test(expression)) return expression.split(/\s+AND\s+/i).every((part) => passesSimpleCheck(part, row))
  if (/\s+OR\s+/i.test(expression)) return expression.split(/\s+OR\s+/i).some((part) => passesSimpleCheck(part, row))
  match = /^`?([\w$]+)`?\s+IN\s*\(([^)]+)\)$/i.exec(expression)
  if (match) return match[2].split(',').some((value) => String(row[match[1]]) === value.trim().replace(/^['"]|['"]$/g, ''))
  return true
}

export function relevantChecks(table: TableModel): string[] { return table.checks.filter((check) => check.enforced !== false).map((check) => check.expression) }
