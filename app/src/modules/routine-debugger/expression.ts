import type { DebugWatch } from './types.js'

const functions: Record<string, (...args: unknown[]) => unknown> = {
  ABS: (value) => Math.abs(number(value)),
  CEIL: (value) => Math.ceil(number(value)),
  FLOOR: (value) => Math.floor(number(value)),
  ROUND: (value, digits = 0) => { const factor = 10 ** number(digits); return Math.round(number(value) * factor) / factor },
  LENGTH: (value) => String(value ?? '').length,
  LOWER: (value) => String(value ?? '').toLowerCase(),
  UPPER: (value) => String(value ?? '').toUpperCase(),
  COALESCE: (...values) => values.find((value) => value !== null && value !== undefined) ?? null
}

/** Evaluates a restricted expression grammar; it never invokes SQL, eval, or user-named functions. */
export function evaluateWatchExpression(expression: string, variables: Record<string, unknown>): DebugWatch {
  const tokens = expression.match(/\s*(?:\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|>=|<=|<>|!=|==|&&|\|\||[()+*/%<>=,!\-&|])\s*/g)
  if (!tokens || tokens.join('').trim() !== expression.trim()) return { name: expression, error: 'Unsupported expression syntax.' }
  const input = tokens.map((token) => token.trim()).filter(Boolean)
  let index = 0
  const peek = (): string => input[index] ?? ''
  const take = (): string => input[index++] ?? ''
  const primary = (): unknown => {
    const token = take()
    if (token === '(') { const value = or(); if (take() !== ')') throw new Error('Missing closing parenthesis.'); return value }
    if (token === '+' || token === '-' || token.toUpperCase() === 'NOT' || token === '!') {
      const value = primary()
      if (token === '+') return number(value)
      if (token === '-') return -number(value)
      return !truthy(value)
    }
    if (/^\d/.test(token)) return Number(token)
    if (/^(TRUE|FALSE|NULL)$/i.test(token)) return token.toUpperCase() === 'NULL' ? null : token.toUpperCase() === 'TRUE'
    if (/^[A-Za-z_$]/.test(token)) {
      const name = token.toUpperCase()
      if (peek() === '(') {
        const fn = functions[name]
        if (!fn) throw new Error(`Function ${token} is not allowed.`)
        take()
        const args: unknown[] = []
        while (peek() !== ')' && peek() !== '') { args.push(or()); if (peek() !== ',') break; take() }
        if (take() !== ')') throw new Error('Missing closing parenthesis in function call.')
        if (name === 'ROUND' && (args.length < 1 || args.length > 2) || name === 'COALESCE' && args.length < 1 || !['ROUND', 'COALESCE'].includes(name) && args.length !== 1) throw new Error(`Invalid argument count for ${token}.`)
        const value = fn(...args)
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Expression does not produce a finite number.')
        return value
      }
      if (!Object.hasOwn(variables, token)) throw new Error(`Variable ${token} is not in scope.`)
      return variables[token]
    }
    throw new Error('Expression is incomplete.')
  }
  const product = (): unknown => { let value = primary(); while (['*', '/', '%'].includes(peek())) { const operator = take(); const right = number(primary()); const left = number(value); value = operator === '*' ? left * right : operator === '/' ? left / right : left % right } return value }
  const sum = (): unknown => { let value = product(); while (peek() === '+' || peek() === '-') { const operator = take(); const right = primaryArithmetic(); value = operator === '+' ? (typeof value === 'string' || typeof right === 'string' ? String(value ?? '') + String(right ?? '') : number(value) + number(right)) : number(value) - number(right) } return value }
  const primaryArithmetic = (): unknown => { const value = product(); return value }
  const comparison = (): unknown => { let value = sum(); while (['=', '==', '!=', '<>', '<', '>', '<=', '>='].includes(peek())) { const operator = take(); const right = sum(); value = operator === '=' || operator === '==' ? value === right || String(value) === String(right) : operator === '!=' || operator === '<>' ? !(value === right || String(value) === String(right)) : operator === '<' ? comparable(value, right) < 0 : operator === '>' ? comparable(value, right) > 0 : operator === '<=' ? comparable(value, right) <= 0 : comparable(value, right) >= 0 } return value }
  const and = (): unknown => { let value = comparison(); while (peek().toUpperCase() === 'AND' || peek() === '&&') { take(); const right = comparison(); value = truthy(value) && truthy(right) } return value }
  const or = (): unknown => { let value = and(); while (peek().toUpperCase() === 'OR' || peek() === '||') { take(); const right = and(); value = truthy(value) || truthy(right) } return value }
  try {
    const value = or()
    if (index !== input.length) throw new Error(`Unexpected token ${peek()}.`)
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Expression does not produce a finite number.')
    return { name: expression, value, type: value === null ? 'NULL' : typeof value }
  } catch (error) { return { name: expression, error: error instanceof Error ? error.message : 'Expression could not be evaluated.' } }
}
function number(value: unknown): number { const result = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN; if (!Number.isFinite(result)) throw new Error('A numeric value is required.'); return result }
function truthy(value: unknown): boolean { return typeof value === 'boolean' ? value : Boolean(value) }
function comparable(left: unknown, right: unknown): number { if ((typeof left === 'number' || typeof left === 'string') && (typeof right === 'number' || typeof right === 'string')) return left < right ? -1 : left > right ? 1 : 0; throw new Error('Values cannot be compared.') }
