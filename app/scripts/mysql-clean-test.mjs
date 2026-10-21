/* global process, console */
import mysql from 'mysql2/promise'

const host = process.env.MYSQL_HOST ?? '127.0.0.1'
const port = Number(process.env.MYSQL_PORT ?? 33067)
const user = process.env.MYSQL_USER ?? 'root'
const password = process.env.MYSQL_PASSWORD ?? 'integration-only'

const databasePrefixes = ['tuxsql_modules_', 'tuxsql_test_', 'tuxsql_debug_test_', 'martelo_connection_', 'data_source_', 'data_target_', 'imex_test_', 'imex_ui_', 'schema_a_', 'schema_b_', 'cmp_a_', 'cmp_b_']
const userPrefixes = ['tuxsql_ui_', 'tuxsql_tu_', 'tuxsql_test_user_', 'martelo_ui_']
const tablePrefixes = ['martelo_ui_', 'tuxsql_ui_', 'tuxsql_test_', 'qa_tx_', 'qa_compare_src_', 'qa_compare_dst_', 'qa_designer_', 'qa_csv_', 'smoke_doc_']
const protectedDatabases = new Set(['mysql', 'information_schema', 'performance_schema', 'sys'])
const identifier = (value) => `\`${value.replaceAll('`', '``')}\``
const account = (value) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`

const connection = await mysql.createConnection({ host, port, user, password, multipleStatements: false })
const removed = { databases: [], users: [], objects: [] }
try {
  const [schemas] = await connection.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA')
  for (const { SCHEMA_NAME: schema } of schemas) {
    if (databasePrefixes.some((prefix) => schema.startsWith(prefix))) {
      await connection.query(`DROP DATABASE IF EXISTS ${identifier(schema)}`)
      removed.databases.push(schema)
    }
  }

  const [accounts] = await connection.query('SELECT User, Host FROM mysql.user')
  for (const row of accounts) {
    const name = String(row.User)
    if (userPrefixes.some((prefix) => name.startsWith(prefix)) || name === 'tuxsql_smoke') {
      await connection.query(`DROP USER IF EXISTS ${account(name)}@${account(String(row.Host))}`)
      removed.users.push(`${name}@${row.Host}`)
    }
  }

  const [tables] = await connection.query('SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_TYPE IN (\'BASE TABLE\', \'VIEW\')')
  for (const row of tables) {
    const schema = String(row.TABLE_SCHEMA)
    const name = String(row.TABLE_NAME)
    if (protectedDatabases.has(schema) || ((schema === 'sample' || schema === 'sample_b') && !name.startsWith('martelo_ui_')) || !tablePrefixes.some((prefix) => name.startsWith(prefix))) continue
    const dropKind = row.TABLE_TYPE === 'VIEW' ? 'VIEW' : 'TABLE'
    await connection.query(`DROP ${dropKind} IF EXISTS ${identifier(schema)}.${identifier(name)}`)
    removed.objects.push(`${schema}.${name}`)
  }

  const [routines] = await connection.query('SELECT ROUTINE_SCHEMA, ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES')
  for (const row of routines) {
    const schema = String(row.ROUTINE_SCHEMA)
    const name = String(row.ROUTINE_NAME)
    if (protectedDatabases.has(schema) || !tablePrefixes.some((prefix) => name.startsWith(prefix))) continue
    const kind = row.ROUTINE_TYPE === 'FUNCTION' ? 'FUNCTION' : 'PROCEDURE'
    await connection.query(`DROP ${kind} IF EXISTS ${identifier(schema)}.${identifier(name)}`)
    removed.objects.push(`${schema}.${name}`)
  }

  for (const [metadataTable, schemaColumn, nameColumn, dropKind] of [['TRIGGERS', 'TRIGGER_SCHEMA', 'TRIGGER_NAME', 'TRIGGER'], ['EVENTS', 'EVENT_SCHEMA', 'EVENT_NAME', 'EVENT']]) {
    const [objects] = await connection.query(`SELECT ${schemaColumn} AS OBJECT_SCHEMA, ${nameColumn} AS OBJECT_NAME FROM information_schema.${metadataTable}`)
    for (const row of objects) {
      const schema = String(row.OBJECT_SCHEMA)
      const name = String(row.OBJECT_NAME)
      if (protectedDatabases.has(schema) || !tablePrefixes.some((prefix) => name.startsWith(prefix))) continue
      await connection.query(`DROP ${dropKind} IF EXISTS ${identifier(schema)}.${identifier(name)}`)
      removed.objects.push(`${schema}.${name}`)
    }
  }
  console.log(JSON.stringify({ host, port, removed }, null, 2))
} finally {
  await connection.end()
}
