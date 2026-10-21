export interface SqlSignature { name: string; parameters: string[]; description: string }
export interface ActiveSqlSignature { name: string; label: string; parameters: string[]; description: string; activeParameter: number; parameterRanges: Array<[number, number]> }

const signatures: SqlSignature[] = [
  { name: 'AVG', parameters: ['expression'], description: 'Returns the mean of the non-null values.' },
  { name: 'COALESCE', parameters: ['value', 'next_value'], description: 'Returns the first non-null value from the argument list.' },
  { name: 'CONCAT', parameters: ['first_value', 'next_value'], description: 'Joins text values in the order supplied.' },
  { name: 'COUNT', parameters: ['expression'], description: 'Counts matching rows or non-null values.' },
  { name: 'DATE_FORMAT', parameters: ['date_value', 'format_pattern'], description: 'Formats a date or time value using a format pattern.' },
  { name: 'IF', parameters: ['condition', 'value_if_true', 'value_if_false'], description: 'Chooses a value according to whether the condition is true.' },
  { name: 'IFNULL', parameters: ['value', 'replacement'], description: 'Uses a replacement when the first value is null.' },
  { name: 'JSON_EXTRACT', parameters: ['document', 'path'], description: 'Reads the value at a path inside a JSON document.' },
  { name: 'MAX', parameters: ['expression'], description: 'Returns the greatest non-null value in the group.' },
  { name: 'MIN', parameters: ['expression'], description: 'Returns the least non-null value in the group.' },
  { name: 'ROUND', parameters: ['number', 'decimal_places'], description: 'Rounds a number to the requested number of decimal places.' },
  { name: 'SUBSTRING', parameters: ['text', 'start_position', 'length'], description: 'Returns part of a string from the requested position.' },
  { name: 'SUM', parameters: ['expression'], description: 'Adds the non-null values in the group.' }
]
const byName = new Map(signatures.map((signature) => [signature.name, signature]))

function isEscaped(source: string, index: number): boolean {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor--) slashes++
  return slashes % 2 === 1
}

function activeCall(source: string): { name: string; start: number; parameter: number } | undefined {
  const stack: Array<{ index: number; commas: number }> = []
  let quote = ''
  let lineComment = false
  let blockComment = false
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    const next = source[index + 1] ?? ''
    if (lineComment) { if (char === '\n') lineComment = false; continue }
    if (blockComment) { if (char === '*' && next === '/') { blockComment = false; index++ }; continue }
    if (quote) { if (char === quote && !isEscaped(source, index)) { if (next === quote) index++; else quote = '' }; continue }
    if ((char === '-' && next === '-' && (index + 2 >= source.length || /\s/.test(source[index + 2]!))) || char === '#') { lineComment = true; if (char === '-') index++; continue }
    if (char === '/' && next === '*') { blockComment = true; index++; continue }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue }
    if (char === '(') { stack.push({ index, commas: 0 }); continue }
    if (char === ')') { stack.pop(); continue }
    if (char === ',' && stack.length) stack[stack.length - 1]!.commas++
  }
  const call = stack.at(-1)
  if (!call) return undefined
  const start = call.index
  const before = source.slice(0, start).trimEnd()
  const match = /([A-Za-z_][\w$]*)$/.exec(before)
  if (!match) return undefined
  return { name: match[1]!.toUpperCase(), start, parameter: call.commas }
}

export function getActiveSqlSignature(source: string, offset: number): ActiveSqlSignature | undefined {
  if (!Number.isInteger(offset) || offset < 0 || offset > source.length) return undefined
  const call = activeCall(source.slice(0, offset))
  const signature = call && byName.get(call.name)
  if (!signature) return undefined
  const parameters = signature.parameters
  const rendered = parameters.map((parameter, index) => index < parameters.length - 1 ? `${parameter}, ` : parameter)
  let position = signature.name.length + 1
  const parameterRanges = rendered.map((parameter, index) => {
    const end = position + parameter.length - (index < rendered.length - 1 ? 2 : 0)
    const range: [number, number] = [position, end]
    position += parameter.length
    return range
  })
  return {
    name: signature.name,
    label: `${signature.name}(${rendered.join('')})`,
    parameters,
    description: signature.description,
    activeParameter: Math.min(call.parameter, parameters.length - 1),
    parameterRanges
  }
}
