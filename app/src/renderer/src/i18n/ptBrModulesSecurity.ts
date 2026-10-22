/** English texts for the security-review UI keys (the key is a stable id, not the text). */
export const enSecurityMessages: Record<string, string> = {
  'sessions.variable.globalEffect': 'SET GLOBAL changes the running server for every new connection (not kept after a restart).',
  'sessions.variable.persistEffect': 'SET PERSIST changes the running server and keeps the value after a restart.',
  'sessions.variable.persistUnsupported': 'SET PERSIST is unavailable on MariaDB. Use SET GLOBAL; update the server configuration to keep the value after restart.',
  'sessions.variable.typeName': 'Type the variable name to confirm:',
  'largeScript.scanning': 'Checking the script before running it…',
  'largeScript.summary': 'Pre-check: {0} statements. DROP: {1} · TRUNCATE: {2} · DELETE without WHERE: {3} · UPDATE without WHERE: {4} · privileges (GRANT/REVOKE/users): {5} · server settings (SET GLOBAL/PERSIST): {6}',
  'largeScript.noRisks': 'No DROP, TRUNCATE, DELETE/UPDATE without WHERE, privilege or server-setting statements were found.',
  'largeScript.confirmRisky': 'Run this script, including the statements listed above?',
  'largeScript.prodConfirm': 'This is a Production connection. Type {0} to run the script:'
}

/** Brazilian Portuguese for messages added by the security review (main-process errors and panel prompts). */
export const ptBrModulesSecurity: Record<string, string> = {
  'MariaDB does not support SET PERSIST; use SET GLOBAL. To keep a change after restart, update the server configuration.': 'O MariaDB não oferece SET PERSIST; use SET GLOBAL. Para manter uma alteração após reiniciar, atualize a configuração do servidor.',
  'sessions.variable.globalEffect': 'SET GLOBAL altera o servidor em execução para todas as novas conexões (não é mantido após reiniciar).',
  'sessions.variable.persistEffect': 'SET PERSIST altera o servidor em execução e mantém o valor após reiniciar.',
  'sessions.variable.persistUnsupported': 'SET PERSIST não está disponível no MariaDB. Use SET GLOBAL; atualize a configuração do servidor para manter o valor após reiniciar.',
  'sessions.variable.typeName': 'Digite o nome da variável para confirmar:',
  'largeScript.scanning': 'Verificando o script antes de executá-lo…',
  'largeScript.summary': 'Pré-verificação: {0} instruções. DROP: {1} · TRUNCATE: {2} · DELETE sem WHERE: {3} · UPDATE sem WHERE: {4} · privilégios (GRANT/REVOKE/usuários): {5} · configurações do servidor (SET GLOBAL/PERSIST): {6}',
  'largeScript.noRisks': 'Nenhuma instrução DROP, TRUNCATE, DELETE/UPDATE sem WHERE, de privilégios ou de configuração do servidor foi encontrada.',
  'largeScript.confirmRisky': 'Executar este script, incluindo as instruções listadas acima?',
  'largeScript.prodConfirm': 'Esta é uma conexão de Produção. Digite {0} para executar o script:',
  'Type {0} to run this script on a Production connection.': 'Digite {0} para executar este script em uma conexão de Produção.',
  'Type the variable name {0} to confirm this server-wide change.': 'Digite o nome da variável {0} para confirmar esta alteração em todo o servidor.',
  'Unsupported variable apply mode.': 'Modo de aplicação de variável não suportado.',
  'Data generation is blocked on Production connections. Allow it explicitly for this run and type the database name.': 'A geração de dados está bloqueada em conexões de Produção. Libere explicitamente para esta execução e digite o nome do banco de dados.',
  'Type the database name {0} to generate data on a Production connection.': 'Digite o nome do banco de dados {0} para gerar dados em uma conexão de Produção.',
  'The profile path is not a directory.': 'O caminho do perfil não é um diretório.'
}
