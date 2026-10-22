import { mysql84StatusVariables } from '../../../modules/profiler/mysql84StatusVariables.js'
import { statusDescriptions } from '../../../modules/profiler/statusDescriptions.js'

function translateStatusDescription(name: string): string {
  if (name.startsWith('Com_')) return `Quantidade de solicitações da instrução SQL ${name.slice(4).replaceAll('_', ' ').toUpperCase()} processadas pelo servidor.`
  if (name.startsWith('Handler_')) return `Quantidade de solicitações ${name.slice(8).replaceAll('_', ' ').toLowerCase()} feitas ao mecanismo de armazenamento.`
  if (name.startsWith('Performance_schema_') && name.endsWith('_lost')) return `Quantidade de registros ${name.slice(20, -5).replaceAll('_', ' ').toLowerCase()} que o Performance Schema não conseguiu manter.`
  if (name.startsWith('Innodb_')) return `Valor de status do InnoDB para ${name.slice(7).replaceAll('_', ' ').toLowerCase()}.`
  if (name.startsWith('Mysqlx_')) return `Valor de status do protocolo MySQL X para ${name.slice(7).replaceAll('_', ' ').toLowerCase()}.`
  if (name.startsWith('Current_tls_')) return `Valor do contexto TLS ativo para ${name.slice(12).replaceAll('_', ' ').toLowerCase()}, usado em novas conexões.`
  if (name.startsWith('Ssl_') || name.startsWith('Tls_')) return `Valor de status TLS para ${name.replace(/^(Ssl|Tls)_/, '').replaceAll('_', ' ').toLowerCase()} nas conexões do servidor.`
  if (name.startsWith('Telemetry_')) return `Recurso de telemetria informado pelo servidor: ${name.replaceAll('_', ' ').toLowerCase()}.`
  if (name.endsWith('_bytes')) return `Total atual ou acumulado de bytes para ${name.replaceAll('_', ' ').toLowerCase()}, conforme informado pelo servidor.`
  if (name.endsWith('_pages')) return `Quantidade de páginas de armazenamento associadas a ${name.replaceAll('_', ' ').toLowerCase()}.`
  if (name.endsWith('_reads') || name.endsWith('_writes') || name.endsWith('_requests')) return `Quantidade de operações ${name.replaceAll('_', ' ').toLowerCase()} desde a inicialização do servidor.`
  if (name.endsWith('_count')) return `Contagem atual de ${name.replace(/_count$/, '').replaceAll('_', ' ').toLowerCase()} informada pelo servidor.`
  if (name.endsWith('_status')) return `Estado atual de ${name.replace(/_status$/, '').replaceAll('_', ' ').toLowerCase()} no servidor.`
  return `Valor de status do servidor para ${name.replaceAll('_', ' ').toLowerCase()}; o nome identifica a contagem, configuração ou metadado informado.`
}

export const ptBrModulesProfilerMessages: Record<string, string> = Object.fromEntries(
  mysql84StatusVariables.map((name) => [statusDescriptions[name]!, translateStatusDescription(name)])
)
