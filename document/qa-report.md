# QA exploratório — fluxos de risco

Executado em 2026-10-20 com Electron empacotado pelo Playwright sob `xvfb-run`, MySQL 8.4 descartável em `127.0.0.1:33067`. O smoke completo está em `app/scripts/qa-risk-e2e.mjs` e é iniciado com `pnpm qa:risk:e2e`.

| Fluxo | Resultado e evidência |
|---|---|
| Edição inline no grid | **Implementada após esta rodada de QA.** Coberta por `grid-editing.test.ts`, `grid-editing.integration.test.ts` e no fluxo MySQL/UI do script; ver seção Rodada 2 e `document/paridade/F-GRID.md`. |
| Transação manual / auto-commit desligado | **Passou via IPC e MySQL real.** `BEGIN`, INSERT, leitura em streaming com a transação aberta, `ROLLBACK` e `COMMIT`; a leitura viu a escrita pendente, rollback removeu-a e commit persistiu-a. |
| Cancelar `SELECT SLEEP(30)` | **Bug corrigido.** O abort anterior fechava o stream do cliente sem parar a consulta no servidor. Streams agora rastreiam a conexão/thread; abort e timeout enviam `KILL QUERY`, e liberam a conexão ao terminar. Regressões: `app/test/MysqlDriver.test.ts` verifica `KILL QUERY`; `app/test/MysqlDriver.risk.integration.test.ts` verifica o desaparecimento no `PROCESSLIST` e um `SELECT 1` posterior; o smoke confirma o cancelamento real pelo app. |
| Perda de conexão durante consulta | **Passou.** O smoke executa `SELECT SLEEP(30)`, mata a conexão com `KILL CONNECTION`, observa a falha e confirma nova conexão funcional. |
| Abrir/salvar `.sql` | **Passou pela UI.** Abrir arquivo via diálogo, executar, salvar pelo menu Arquivo e confirmar conteúdo; o IPC também verifica permissão `0600`. |
| Múltiplas abas e resultados | **Passou pela UI.** Abriu um novo documento SQL e confirmou abas `Result 1` e `Result 2` para statements múltiplos. |
| Security Manager criar/remover usuário | **Passou pela UI e IPC.** Criação e remoção de conta descartável; o fluxo de confirmação foi aceito pelo Playwright. |
| Table Designer aplicar | **Passou pela UI e IPC.** Explorer → menu de contexto `Design`, adicionar coluna e aplicar; chamadas IPC também criaram e alteraram uma tabela real. |
| Compare → sync → compare | **Passou via IPC/MySQL.** A comparação inicial tinha alterações e registros exclusivos; a sincronização foi transacional e a comparação seguinte não teve diferenças. Também coberto por `app/test/modules/data-compare.integration.test.ts`. |
| Importar CSV de 100 mil linhas | **Passou via IPC do Import/Export e MySQL real.** Dialog de origem, preview, import transacional e contagem final de 100 mil registros; o teste de integração dedicado também cobre import/export em streaming. |

O commit/rollback e os fluxos de Import/Compare foram exercitados pelas APIs IPC chamadas dentro do renderer Playwright; os diálogos de arquivo e o Table Designer/Security Manager também passaram pela interface. A edição inline permanece uma lacuna de produto, pois não há affordance nem contrato de gravação no grid para testar com segurança.

## Validação

- `pnpm qa:risk:e2e` — passou após a correção.
- `MYSQL_INTEGRATION=1 pnpm exec vitest run test/MysqlDriver.risk.integration.test.ts test/modules/data-compare.integration.test.ts test/modules/schema.integration.test.ts test/modules/security-sessions-profiler.integration.test.ts test/modules/data-export-import.integration.test.ts` — 5 testes passaram; inclui import de 100 mil linhas.
- `pnpm test` — 140 testes passaram; 9 testes de integração opt-in foram ignorados sem `MYSQL_INTEGRATION=1`.
- `pnpm lint` e `pnpm build` — passaram.
- `pnpm typecheck` — passou no estado final.

## Rodada 2 (2026-10-20)

Executada com MySQL 8.4 descartável em `127.0.0.1:33067`, MariaDB 11.4 descartável em `127.0.0.1:33069`, repositórios Git temporários e servidor HTTP fake em loopback. O smoke Electron roda por `xvfb-run`; o processo Electron encerra com SIGTERM antes do Xvfb.

| Módulo / cenário | Resultado | Evidência / limite |
|---|---|---|
| F-GRID — UPDATE/INSERT/DELETE, preview e sync/recompare | **Passou.** | `app/test/grid-editing.test.ts`, `app/test/grid-editing.integration.test.ts`, `app/scripts/qa-risk-e2e.mjs`; snapshots claros/escuros em `document/evidence/ui/table-data-grid-edit-{light,dark}.png`. Ver `document/paridade/F-GRID.md`. |
| Profiler — EXPLAIN ANALYZE nos dois servidores | **Passou.** | `security-sessions-profiler.integration.test.ts`: MySQL `EXPLAIN ANALYZE` e MariaDB `ANALYZE FORMAT=JSON` executados em servidor real. Profiler JSON e sessão aparecem na mesma integração MySQL; MariaDB focou ANALYZE. |
| Documenter — database real em HTML/Markdown/PDF | **Passou.** | `app/scripts/smoke-e2e.mjs` exporta database MySQL real via Electron `printToPDF`; confere começo do HTML/Markdown e assinatura `%PDF-`. `m14-m9-m15.integration.test.ts` verifica também conteúdo HTML/Markdown e diagrama SVG. |
| Source Control — Git real, commit/diff/branch, symlink e hook | **Passou.** | `app/test/modules/source-control.test.ts`: repo temporário, commit/histórico/diff/branch, rejeição de symlink e confirmação de hook malicioso não executado. |
| AI Assistant — streaming, cancelamento, erros HTTP e contexto opt-in | **Passou.** | `app/test/modules/ai-assistant.test.ts` cobre chunks SSE OpenAI-compatível/Anthropic, NDJSON Ollama, resposta truncada, timeout, cancelamento de conexão e 401/429 sem vazar corpo/chave. `app/test/modules/ai-assistant-ipc.test.ts` confirma eventos `chunk/done/error` por requestId enviados ao webContents solicitante e cancelamento via IPC. |
| Data Generator — 100 mil linhas, FK e unique | **Passou.** | `m14-m9-m15.integration.test.ts` gera 100.000 filhos + 100 pais no MySQL real; verifica ausência de órfãos e `COUNT(DISTINCT email)=100000`. |
| Debugger — breakpoint/step com loop, cursor e handler | **Passou.** | `routine-debugger.integration.test.ts` instrumenta e executa procedure real; pausa em breakpoint, executa step, percorre cursor/handler e valida soma e restauração do DDL original. |
| Session Manager — kill | **Passou.** | `security-sessions-profiler.integration.test.ts` mata uma sessão com `SELECT SLEEP(20)` em curso e aguarda seu encerramento. O teste não verifica uma longa execução além deste caso simples. |
| Options — import de JSON corrompido | **Passou, preserva preferências.** | `options.test.ts` importa arquivo malformado pelo mesmo helper usado no IPC e verifica que a configuração ativa continua intacta. |

### Validação da Rodada 2

- `pnpm smoke:e2e` — passou sob `xvfb-run`, incluindo conexão real e export real HTML/Markdown/PDF pelo Electron.
- `MYSQL_INTEGRATION=1 pnpm exec vitest run test/modules/security-sessions-profiler.integration.test.ts test/modules/m14-m9-m15.integration.test.ts test/modules/routine-debugger.integration.test.ts` — passou; inclui 100k e debugger complexo.
- `MARIADB_INTEGRATION=1 pnpm exec vitest run test/modules/security-sessions-profiler.integration.test.ts` — passou; `ANALYZE FORMAT=JSON` real.
- `pnpm test` — 153 passaram, 11 opt-in ignorados.
- Unit tests Source Control, AI, Options, Documenter e instrumentador do Debugger — passaram.
- `pnpm build`, `pnpm typecheck` e ESLint focado nos arquivos alterados — passaram.
- A lacuna de AI streaming registrada nesta rodada foi fechada: contrato/preload expõe eventos incrementais, o IPC os encaminha por requestId e o painel atualiza a resposta por frame de animação.
