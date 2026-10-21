import { randomUUID } from 'node:crypto'

export function mysqlTestPrefix(scope: string): string {
  const normalized = scope.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'case'
  return `dbf_test_${normalized.slice(0, 24)}_${process.pid}_${randomUUID().slice(0, 8)}`
}

export function mysqlTestUser(scope: string): string {
  const normalized = scope.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'case'
  return `dbforge_tu_${normalized.slice(0, 4)}_${process.pid}_${randomUUID().slice(0, 8)}`
}
