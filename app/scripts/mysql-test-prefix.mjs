/* global process */
import { randomUUID } from 'node:crypto'

function segment(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'case'
}

export function mysqlTestPrefix(scope) {
  return `dbforge_test_${segment(scope)}_${process.pid}_${randomUUID().slice(0, 8)}`
}

export function mysqlTestUser(scope) {
  return `dbforge_tu_${segment(scope).slice(0, 4)}_${process.pid}_${randomUUID().slice(0, 8)}`
}
