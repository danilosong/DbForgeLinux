import type { TuxSqlApi } from './api.js'
export {}
declare global {
  interface Window { tuxsql: TuxSqlApi }
}
