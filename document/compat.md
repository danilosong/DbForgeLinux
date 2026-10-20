# Compatibilidade MySQL e MariaDB

Validação feita em 2026-10-20 com `MYSQL_INTEGRATION=1 pnpm test`, usando imagens Docker descartáveis vinculadas somente a `127.0.0.1`. Cada execução recebeu `MYSQL_HOST=127.0.0.1` e a porta indicada. As imagens sem patch fixo foram resolvidas para as versões mostradas na tabela.

## Matriz de integração

| Servidor | Porta | Driver e conexão | Schema e editor de objetos | Segurança, sessões e profiler | Debugger de rotinas | Geração, comparação e documentação | Importação e exportação | Resultado |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| MySQL 5.7.44 (`mysql:5.7`) | 33057 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 48 arquivos, 147 testes passaram |
| MySQL 8.0.46 (`mysql:8.0`) | 33080 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 48 arquivos, 147 testes passaram |
| MySQL 8.4.11 (`mysql:8.4`) | 33084 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | repetição completa: 48 arquivos, 148 testes passaram |
| MariaDB 10.11.19 (`mariadb:10.11`) | 33111 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | repetição completa: 48 arquivos, 148 testes passaram |
| MariaDB 11.8.9 (`mariadb:11`) | 33117 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 48 arquivos, 148 testes passaram |

Os módulos de geração, comparação e documentação compartilham o teste de integração M14/M9/M15. A comparação também tem um teste de integração independente. As colunas indicam os testes que executaram contra o servidor; o restante da suíte unitária rodou junto em cada execução.

## Compatibilidade e limites observados

- MySQL 5.7, MySQL 8.0/8.4 e MariaDB 10.11/11.x passaram pelas operações cobertas de introspecção e sincronização de schema, DDL de tabela, `SHOW CREATE`, grants de usuário, `SHOW GRANTS`, listagem/encerramento de sessões, `EXPLAIN FORMAT=JSON`, criação/execução de rotinas instrumentadas, comparação de dados e importação/exportação em fluxo.
- TLS `preferred` no mysql2 não negocia fallback por conta própria. O driver agora repete a conexão sem TLS somente quando o handshake informa `HANDSHAKE_NO_SSL_SUPPORT`; se a conexão for `required` ou estiver validando certificado, o erro continua sendo retornado. A suíte completa de MariaDB 10.11 valida esse fallback em `testConnection` e `connect`.
- O erro de streaming veio do caminho que desempacotava `PromisePoolConnection.connection` e presumidamente chamava `.stream()` em qualquer `query()` retornado. Essa propriedade é interna do wrapper `mysql2/promise`, não é o contrato core de streaming. `streamRows` agora recebe conexões diretamente de um `mysql2` core pool e chama `CorePoolConnection.query().stream()`; o pool promisificado e o core compartilham a mesma instância. Assim o resultado tem o tipo e a API de streaming exigidos, sem depender da forma interna do wrapper ou de reconexões.
- O evento original de MySQL 8.4 foi intermitente; não reapareceu em 50 streams sequenciais, numa reconexão seguida de novo stream, nem nos caminhos de spool, exportação e comparação. A suíte completa passou depois da mudança em MySQL 8.4 e MariaDB 10.11 (48 arquivos, 148 testes em cada). A versão de teste também executa `MYSQL_STREAM_STRESS=50`; MariaDB usa `MYSQL_EXPECT_TLS_FALLBACK=1` para afirmar conexão sem TLS quando `preferred` recua após o handshake.
- O debugger foi exercitado com procedures e sessões dedicadas nos cinco servidores. O teste não prova suporte a todos os dialetos ou permissões de contas sem privilégios administrativos.
- A matriz cobre os caminhos executados pela suíte atual, não certifica todos os recursos específicos de cada versão (por exemplo, todas as variantes de roles, colunas de `information_schema` ou formatos de `EXPLAIN`). Recursos que dependem de sintaxe exclusiva ou permissões indisponíveis devem ser verificados antes de serem declarados compatíveis.

## Execução reproduzível

Exemplo para MySQL 8.4:

```sh
MYSQL_INTEGRATION=1 MYSQL_HOST=127.0.0.1 MYSQL_PORT=33084 pnpm test
```

As cinco execuções usaram o mesmo comando, mudando apenas `MYSQL_PORT`. Os contêineres e suas portas foram removidos após a validação.
