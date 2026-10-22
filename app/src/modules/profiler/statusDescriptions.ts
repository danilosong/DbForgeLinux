import { mysql84StatusVariables } from './mysql84StatusVariables.js'

export const statusDescriptions: Record<string, string> = {
  Bytes_received: 'Bytes sent by clients to this server since startup.',
  Bytes_sent: 'Bytes returned by this server to clients since startup.',
  Com_select: 'Number of SELECT statements processed by the server.',
  Created_tmp_disk_tables: 'Temporary tables created on disk while processing statements.',
  Created_tmp_tables: 'Temporary tables created while processing statements.',
  Handler_read_first: 'Requests to read the first entry of an index.',
  Handler_read_key: 'Requests to read rows using an index key.',
  Handler_read_next: 'Requests to advance to the next entry of an index.',
  Handler_read_rnd: 'Requests to read rows by their physical position.',
  Handler_read_rnd_next: 'Requests to read the next row during a table scan.',
  Innodb_buffer_pool_read_requests: 'Logical page reads requested from the InnoDB buffer pool.',
  Innodb_buffer_pool_reads: 'Pages that InnoDB had to fetch from storage because they were not cached.',
  Innodb_rows_deleted: 'Rows deleted by InnoDB operations.',
  Innodb_rows_inserted: 'Rows inserted by InnoDB operations.',
  Innodb_rows_read: 'Rows read by InnoDB operations.',
  Innodb_rows_updated: 'Rows changed by InnoDB operations.',
  Questions: 'Statements sent by clients to the server, including commands served from cache.',
  Queries: 'Statements executed by the server, including statements run within stored programs.',
  Rows_examined: 'Rows read while evaluating statements, whether or not they were returned.',
  Rows_sent: 'Rows returned to clients by statements.',
  Rows_affected: 'Rows changed by the most recent statement.',
  Select_full_join: 'Joins that had to read rows without a usable index on a joined table.',
  Select_full_range_join: 'Joins that used a range scan on a joined table.',
  Select_range: 'SELECT operations that used a range scan on the first table.',
  Select_scan: 'SELECT operations that scanned the first table.',
  Sort_merge_passes: 'Merge passes performed by the sort operation.',
  Sort_rows: 'Rows processed by sorting operations.',
  Sort_scan: 'Sort operations that read rows by scanning a table.',
  Table_locks_immediate: 'Table lock requests granted without waiting.',
  Table_locks_waited: 'Table lock requests that had to wait.',
  Threads_running: 'Client threads currently executing work rather than waiting.',
  Uptime: 'Seconds the server has been running.'
}

const knownDescriptions = new Set(Object.keys(statusDescriptions))
for (const name of mysql84StatusVariables) {
  if (knownDescriptions.has(name)) continue
  const words = name.replace(/^Innodb_/, 'InnoDB ').replace(/^Mysqlx_/, 'MySQL X Protocol ').replace(/^Com_/, 'SQL command ').replace(/^Ssl_/, 'TLS ').replace(/^Current_tls_/, 'Active TLS ').replace(/^Performance_schema_/, 'Performance Schema ').replaceAll('_', ' ').toLowerCase()
  let description: string
  if (name.startsWith('Com_')) description = `Number of ${name.slice(4).replaceAll('_', ' ').toUpperCase()} statement requests processed by the server.`
  else if (name.startsWith('Handler_')) description = `Number of storage-engine handler ${name.slice(8).replaceAll('_', ' ').toLowerCase()} requests.`
  else if (name.startsWith('Performance_schema_') && name.endsWith('_lost')) description = `Number of ${words.replace(/ lost$/, '')} records that could not be retained by Performance Schema.`
  else if (name.startsWith('Innodb_')) description = `InnoDB ${name.slice(7).replaceAll('_', ' ').toLowerCase()} status value.`
  else if (name.startsWith('Mysqlx_')) description = `MySQL X Protocol ${name.slice(7).replaceAll('_', ' ').toLowerCase()} status value.`
  else if (name.startsWith('Current_tls_')) description = `Active TLS context ${name.slice(12).replaceAll('_', ' ').toLowerCase()} used for new connections.`
  else if (name.startsWith('Ssl_') || name.startsWith('Tls_')) description = `TLS ${name.replace(/^(Ssl|Tls)_/, '').replaceAll('_', ' ').toLowerCase()} status value for server connections.`
  else if (name.endsWith('_bytes')) description = `Current or cumulative byte total for ${words.replace(/ bytes$/, '')}, as reported by the server.`
  else if (name.endsWith('_pages')) description = `Number of storage pages associated with ${words.replace(/ pages$/, '')}.`
  else if (name.endsWith('_reads') || name.endsWith('_writes') || name.endsWith('_requests')) description = `Number of ${words} operations reported since server startup.`
  else if (name.endsWith('_count')) description = `Current count of ${words.replace(/ count$/, '')} reported by the server.`
  else if (name.endsWith('_status')) description = `Current status of ${words.replace(/ status$/, '')} in the server.`
  else if (name.startsWith('Mysqlx_') || name.startsWith('Telemetry_')) description = `Server capability or counter for ${words}.`
  else description = `Server status value for ${words}; the name identifies the reported count, setting, or metadata.`
  statusDescriptions[name] = description
}

export function describeStatusVariable(name: string): string {
  return statusDescriptions[name] ?? 'Server-reported status counter; its unit and scope depend on this variable.'
}
