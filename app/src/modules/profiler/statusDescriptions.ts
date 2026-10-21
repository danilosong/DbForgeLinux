export type DescriptionLocale = 'en' | 'pt-BR'

const descriptions: Record<string, [string, string]> = {
  Bytes_received: ['Bytes sent by clients to this server since startup.', 'Bytes enviados pelos clientes a este servidor desde a inicialização.'],
  Bytes_sent: ['Bytes returned by this server to clients since startup.', 'Bytes devolvidos por este servidor aos clientes desde a inicialização.'],
  Com_select: ['Number of SELECT statements processed by the server.', 'Quantidade de instruções SELECT processadas pelo servidor.'],
  Created_tmp_disk_tables: ['Temporary tables created on disk while processing statements.', 'Tabelas temporárias criadas em disco durante o processamento de instruções.'],
  Created_tmp_tables: ['Temporary tables created while processing statements.', 'Tabelas temporárias criadas durante o processamento de instruções.'],
  Handler_read_first: ['Requests to read the first entry of an index.', 'Solicitações para ler a primeira entrada de um índice.'],
  Handler_read_key: ['Requests to read rows using an index key.', 'Solicitações para ler linhas usando uma chave de índice.'],
  Handler_read_next: ['Requests to advance to the next entry in an index.', 'Solicitações para avançar à próxima entrada de um índice.'],
  Handler_read_rnd: ['Requests to read rows by their physical position.', 'Solicitações para ler linhas por sua posição física.'],
  Handler_read_rnd_next: ['Requests to read the next row during a table scan.', 'Solicitações para ler a próxima linha durante uma varredura de tabela.'],
  Innodb_buffer_pool_read_requests: ['Logical page reads requested from the InnoDB buffer pool.', 'Leituras lógicas de páginas solicitadas ao buffer pool do InnoDB.'],
  Innodb_buffer_pool_reads: ['Pages that InnoDB had to fetch from storage because they were not cached.', 'Páginas buscadas pelo InnoDB no armazenamento por não estarem em cache.'],
  Innodb_rows_deleted: ['Rows deleted by InnoDB operations.', 'Linhas removidas por operações do InnoDB.'],
  Innodb_rows_inserted: ['Rows inserted by InnoDB operations.', 'Linhas inseridas por operações do InnoDB.'],
  Innodb_rows_read: ['Rows read by InnoDB operations.', 'Linhas lidas por operações do InnoDB.'],
  Innodb_rows_updated: ['Rows changed by InnoDB operations.', 'Linhas alteradas por operações do InnoDB.'],
  Questions: ['Statements sent by clients to the server, including commands served from cache.', 'Instruções enviadas pelos clientes ao servidor, inclusive comandos atendidos pelo cache.'],
  Queries: ['Statements executed by the server, including statements run within stored programs.', 'Instruções executadas pelo servidor, inclusive as chamadas dentro de programas armazenados.'],
  Rows_examined: ['Rows read while evaluating statements, whether or not they were returned.', 'Linhas lidas durante a avaliação das instruções, tenham sido retornadas ou não.'],
  Rows_sent: ['Rows returned to clients by statements.', 'Linhas retornadas aos clientes pelas instruções.'],
  Rows_affected: ['Rows changed by the most recent statement.', 'Linhas alteradas pela instrução mais recente.'],
  Select_full_join: ['Joins that had to read rows without a usable index on a joined table.', 'Junções que precisaram ler linhas sem índice utilizável em uma das tabelas.'],
  Select_full_range_join: ['Joins that used a range scan on a joined table.', 'Junções que usaram uma varredura por intervalo em uma tabela relacionada.'],
  Select_range: ['SELECT operations that used a range scan on the first table.', 'Operações SELECT que usaram varredura por intervalo na primeira tabela.'],
  Select_scan: ['SELECT operations that scanned the first table.', 'Operações SELECT que varreram a primeira tabela.'],
  Sort_merge_passes: ['Merge passes performed by the sort operation.', 'Passagens de intercalação executadas pela operação de ordenação.'],
  Sort_rows: ['Rows processed by sorting operations.', 'Linhas processadas por operações de ordenação.'],
  Sort_scan: ['Sort operations that read rows by scanning a table.', 'Operações de ordenação que leram linhas por varredura de tabela.'],
  Table_locks_immediate: ['Table lock requests granted without waiting.', 'Solicitações de bloqueio de tabela concedidas sem espera.'],
  Table_locks_waited: ['Table lock requests that had to wait.', 'Solicitações de bloqueio de tabela que precisaram aguardar.'],
  Threads_running: ['Client threads currently executing work rather than waiting.', 'Threads de clientes executando trabalho, em vez de aguardarem.'],
  Uptime: ['Seconds the server has been running.', 'Segundos desde que o servidor foi iniciado.']
}

export function describeStatusVariable(name: string, locale: DescriptionLocale): string {
  const description = descriptions[name]
  if (description) return description[locale === 'pt-BR' ? 1 : 0]
  return locale === 'pt-BR'
    ? 'Contador de status fornecido pelo servidor; sua unidade e seu escopo dependem da variável.'
    : 'Server-reported status counter; its unit and scope depend on this variable.'
}
