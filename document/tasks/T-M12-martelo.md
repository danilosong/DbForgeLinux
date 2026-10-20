AGENT: Martelo (Codex)
NOTA: Arquiteto = "Chefinho". Se `maestri ask "Chefinho"` falhar, finalize com resumo no terminal. `git add` SÓ dos seus arquivos.
OBJECTIVE: Backend dos módulos Security Manager, Session Manager, Server Variables (M12) e Query Profiler (M13). Sem UI.
REFERENCE: document/ux/08-seguranca-sessoes.md, document/ux/07-schema-compare.md, app/src/modules/schema, app/src/main/db/DbDriver.ts
TASK:
1. app/src/modules/security/: listar usuários/hosts, privilégios globais/db/tabela/coluna/rotina, roles (MySQL 8/MariaDB), CREATE/ALTER/DROP USER, GRANT/REVOKE, ALTER USER ... PASSWORD/lock/expire, limites de recurso, SSL requirements; gerar script SQL preview antes de aplicar; senhas nunca logadas.
2. app/src/modules/sessions/: SHOW PROCESSLIST/performance_schema.threads, KILL QUERY/KILL, filtros, detalhes (query, tempo, estado, locks via sys/performance_schema quando disponível); Server Variables: SHOW GLOBAL/SESSION VARIABLES e STATUS, SET GLOBAL/SESSION com validação de tipo e indicação de dinâmica/estática, comparação e destaque de mudanças entre snapshots.
3. app/src/modules/profiler/: profiling de consulta (SET profiling / performance_schema statement events conforme versão), EXPLAIN (FORMAT=JSON/TREE/ANALYZE) com parse para estrutura de árvore tipada (custos, linhas, índices usados, avisos), SHOW STATUS diff antes/depois, histórico de execuções comparáveis.
CONSTRAINTS: só app/src/modules/ e app/test/modules/; não tocar renderer/main/index.ts; identificadores escapados; operações destrutivas (DROP USER, KILL, SET GLOBAL) só geram/executam via função explícita com parâmetro `confirm: true`.
ACCEPTANCE: unit + integração docker (MySQL 8.4; MariaDB se viável): criar user/grant → introspectar → revogar; kill de sessão de teste; EXPLAIN parseado; typecheck/lint/vitest passam; commits pequenos.
