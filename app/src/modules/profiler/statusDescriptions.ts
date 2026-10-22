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

export function describeStatusVariable(name: string): string {
  return statusDescriptions[name] ?? 'Server-reported status counter; its unit and scope depend on this variable.'
}
