import type { DbForgeApi } from './api.js'
export {}
declare global {
  interface Window { dbforge: DbForgeApi }
}
