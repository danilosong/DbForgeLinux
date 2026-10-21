import { quoteDebugIdentifier } from './engine.js'

export interface DebugCallParameter { name: string; type: string; direction: 'IN' | 'OUT' | 'INOUT'; value: string | null }
export interface DebugCallPlan { setup: Array<{ sql: string; values: Array<string | null> }>; sql: string; values: Array<string | null>; outputParameters: Array<{ name: string; type: string; variable: string }>; outputSelect: string }

/** Builds a parameterized CALL; argument values never become SQL text. */
export function buildDebugCallPlan(database: string, routine: string, parameters: DebugCallParameter[]): DebugCallPlan {
  const setup: DebugCallPlan['setup'] = []
  const values: Array<string | null> = []
  const outputs: DebugCallPlan['outputParameters'] = []
  const args = parameters.map((parameter, index) => {
    if (!/^[A-Za-z_$][\w$]{0,63}$/.test(parameter.name)) throw new Error('Invalid routine parameter name.')
    if (parameter.direction === 'IN') { values.push(parameter.value); return '?' }
    const variable = `@tuxsql_debug_out_${index}`
    if (parameter.direction === 'INOUT') setup.push({ sql: `SET ${variable}=?`, values: [parameter.value] })
    else setup.push({ sql: `SET ${variable}=NULL`, values: [] })
    outputs.push({ name: parameter.name, type: parameter.type, variable })
    return variable
  })
  const qualified = `${quoteDebugIdentifier(database)}.${quoteDebugIdentifier(routine)}`
  return { setup, sql: `CALL ${qualified}(${args.join(',')})`, values, outputParameters: outputs, outputSelect: outputs.map((item) => `${item.variable} AS ${quoteDebugIdentifier(item.name)}`).join(',') }
}
