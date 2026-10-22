export const ptBrModulesImportExportMessages: Record<string, string> = {
  'imex.format.dbf': 'Arquivo dBase III com campos de texto Latin-1.',
  'imex.format.access': 'Tabelas somente para leitura via mdbtools.',
  'imex.reason.accessExport': 'A gravação em bancos Access não é compatível.',
  'imex.reason.accessImport': 'A leitura de Access exige mdbtools. Instale o pacote mdbtools pelo gerenciador Debian.',
  'imex.reason.odbc': 'ODBC exige um gerenciador de drivers nativo e o driver do banco correspondente; está fora do escopo Linux.',
  'imex.repopulateTransactional': 'A opção Repopular sempre executa em uma transação. A configuração de transação é ignorada para restaurar as linhas existentes se a importação falhar.',
  'imex.prodConfirmPrompt': 'Proteção de produção: digite o nome do banco de dados "{0}" para continuar esta importação destrutiva.',
  'imex.prodConfirmMismatch': 'O nome do banco de dados não corresponde. A importação não foi iniciada.'
}
