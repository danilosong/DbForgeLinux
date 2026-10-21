/* global process, console */
import mysql from 'mysql2/promise'
import { randomUUID } from 'node:crypto'

const host = process.env.MYSQL_HOST ?? '127.0.0.1'
const port = Number(process.env.MYSQL_PORT ?? 33067)
const user = process.env.MYSQL_USER ?? 'root'
const password = process.env.MYSQL_PASSWORD ?? 'integration-only'
const schema = `dbforge_test_scale_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 12)}`
const admin = await mysql.createConnection({ host, port, user, password })
const pool = mysql.createPool({ host, port, user, password, connectionLimit: 16 })
let created = false
let interrupted = false
process.on('SIGINT', () => { interrupted = true })
process.on('SIGTERM', () => { interrupted = true })
const now = () => Number(process.hrtime.bigint()) / 1e6
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const rssStartMiB = Math.round(process.memoryUsage().rss / 1024 / 1024)

try {
  await admin.query(`CREATE DATABASE \`${schema}\``)
  created = true
  let next = 0
  const workers = Array.from({ length: 16 }, async () => {
    while (!interrupted) {
      const index = next++
      if (index >= 3000) return
      const table = `scale_${String(index).padStart(4, '0')}`
      await pool.query(`CREATE TABLE \`${schema}\`.\`${table}\` (id INT NOT NULL PRIMARY KEY, label VARCHAR(64), state TINYINT)`)
    }
  })
  await Promise.all(workers)
  if (interrupted) throw new Error('Benchmark interrupted; test schema will be removed.')

  const explorerSql = 'SELECT table_name AS name, table_type AS kind FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name'
  const schemaSql = 'SELECT schema_name AS name FROM information_schema.schemata ORDER BY schema_name'
  const tableSql = 'SELECT TABLE_NAME AS name, TABLE_TYPE AS tableType, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME'
  const columnSql = 'SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION'
  const routineSql = 'SELECT ROUTINE_NAME AS name, ROUTINE_TYPE AS routineType FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? ORDER BY ROUTINE_NAME'
  const explorerMs = []
  let explorerCount = 0
  for (let sample = 0; sample < 5; sample++) {
    const start = now()
    const [rows] = await admin.query(explorerSql, [schema])
    explorerMs.push(Math.round(now() - start))
    explorerCount = rows.length
  }
  const autocompleteMs = []
  let objectCount = 0
  let columnCount = 0
  let catalog = null
  for (let sample = 0; sample < 5; sample++) {
    const start = now()
    const [[databases], [tables], [columns], [routines]] = await Promise.all([
      admin.query(schemaSql), admin.query(tableSql, [schema]), admin.query(columnSql, [schema]), admin.query(routineSql, [schema])
    ])
    const byTable = new Map()
    for (const column of columns) {
      const list = byTable.get(column.tableName) ?? []
      list.push({ name: column.name, type: column.type, nullable: column.nullable === 'YES' })
      byTable.set(column.tableName, list)
    }
    catalog = {
      database: schema,
      databases: databases.map((row) => String(row.name)),
      objects: tables.map((row) => ({ name: String(row.name), kind: String(row.tableType).toUpperCase() === 'VIEW' ? 'view' : 'table', columns: byTable.get(String(row.name)) ?? [], engine: String(row.engine ?? '') })),
      routines: routines.map((row) => ({ name: String(row.name), kind: String(row.routineType).toUpperCase() === 'FUNCTION' ? 'function' : 'procedure' }))
    }
    autocompleteMs.push(Math.round(now() - start))
    objectCount = catalog.objects.length
    columnCount = columns.length
  }
  const detailMs = []
  for (let sample = 0; sample < 5; sample++) {
    const start = now()
    await admin.query('SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [schema, 'scale_0000'])
    detailMs.push(Math.round(now() - start))
  }
  console.log(JSON.stringify({
    fixture: schema, pid: process.pid, tables: explorerCount, columnsPerTable: 3,
    explorerListQueryMs: explorerMs, explorerMedianMs: median(explorerMs),
    autocompleteColdQueryAndMapMs: autocompleteMs, autocompleteMedianMs: median(autocompleteMs),
    autocompleteObjects: objectCount, autocompleteColumns: columnCount,
    oneTableDetailQueryMs: detailMs, oneTableDetailMedianMs: median(detailMs),
    benchmarkProcessRssStartMiB: rssStartMiB, benchmarkProcessRssAfterAutocompleteMiB: Math.round(process.memoryUsage().rss / 1024 / 1024)
  }, null, 2))
} finally {
  await pool.end()
  if (created) await admin.query(`DROP DATABASE IF EXISTS \`${schema}\``)
  await admin.end()
}
