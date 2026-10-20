import type { DatabaseObject } from '../../shared/contracts/sql.js'

export interface ObjectSearchHit { object: DatabaseObject; field: 'name' | 'definition'; line: number; excerpt: string }
export interface InvalidObject { object: DatabaseObject; reason: string; definition?: string }
export type ObjectDefinitionReader = (object: DatabaseObject) => Promise<string>
export type ObjectValidator = (object: DatabaseObject) => Promise<void>

export function searchObjectText(objects: DatabaseObject[], definitions: Map<string, string>, query: string, options: { names: boolean; definitions: boolean; caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean } = { names: true, definitions: true }): ObjectSearchHit[] {
  const needle = query.trim()
  if (!needle) throw new Error('Enter a search mask.')
  if (needle.length > 256) throw new Error('Search mask is too long (maximum 256 characters).')
  let expression: RegExp | undefined
  if (options.regex) {
    try { expression = new RegExp(needle, `${options.caseSensitive ? '' : 'i'}g`) }
    catch { throw new Error(`Entered search mask "${needle}" is invalid.`) }
  }
  const hits: ObjectSearchHit[] = []
  const match = (text: string): number => {
    if (expression) { expression.lastIndex = 0; return expression.exec(text)?.index ?? -1 }
    const source = options.caseSensitive ? text : text.toLocaleLowerCase()
    const search = options.caseSensitive ? needle : needle.toLocaleLowerCase()
    const index = source.indexOf(search)
    if (index < 0 || !options.wholeWord) return index
    const before = text[index - 1] ?? ''; const after = text[index + needle.length] ?? ''
    return /[\p{L}\p{N}_]/u.test(before) || /[\p{L}\p{N}_]/u.test(after) ? -1 : index
  }
  for (const object of objects) {
    if (options.names) { const index = match(object.name); if (index >= 0) hits.push({ object, field: 'name', line: 1, excerpt: object.name }) }
    if (options.definitions) {
      const definition = definitions.get(`${object.kind}:${object.name}`) ?? ''
      const lines = definition.split(/\r?\n/)
      lines.forEach((line, index) => { const at = match(line); if (at >= 0) hits.push({ object, field: 'definition', line: index + 1, excerpt: line.slice(Math.max(0, at - 60), at + needle.length + 80).trim() }) })
    }
  }
  return hits
}

export async function findInvalidObjects(objects: DatabaseObject[], getDefinition: ObjectDefinitionReader, validate: ObjectValidator): Promise<{ checked: number; invalid: InvalidObject[]; errors: InvalidObject[] }> {
  const result = { checked: 0, invalid: [] as InvalidObject[], errors: [] as InvalidObject[] }
  for (const object of objects) {
    let definition: string | undefined
    try {
      definition = await getDefinition(object)
      await validate(object)
      result.checked += 1
    } catch (error) {
      const item = { object, reason: error instanceof Error ? error.message : String(error), definition }
      if (/permission|access denied|not supported|does not exist|not found/i.test(item.reason)) result.errors.push(item)
      else result.invalid.push(item)
    }
  }
  return result
}
