# 05 — REA: mecanismo do Debugger de rotinas (M16)
Fonte: strings embutidas em `Devart.DbForge.Debugger.MySql.dll` (script `DebuggingSchema.sql` embutido; "dbForge debugging infrastructure library for MySQL"). Descrição abaixo é nossa; nenhum código foi copiado.

| Achado | Status |
|---|---|
| MySQL não tem debugger nativo; o dbForge **instrumenta** as rotinas armazenadas e cria um schema auxiliar no servidor, chamado `cr_debug` (UTF8) | CONFIRMADA |
| Tabelas do schema: `breakpoints`, `callstack`, `debuggings`, `info`, `watches` (todas ligadas por `debug_id`) | CONFIRMADA |
| API em procedures/functions: `debug_on/debug_off`, `attach/detach`, `set_breakpoint/remove_breakpoint`, `trace`, `synchronize`, `continue(step_kind)`, `enter_module*/leave_module`, `enter_handler/exit_handler`, `update_watch*`, `check_breakpoint`, `get_version/check_version_compatibility`, `get_row_count/get_found_rows/get_last_insert_id` | CONFIRMADA |
| Duas sessões: **debug session** (controla) e **target session** (executa a rotina instrumentada); sincronizam por locks nomeados (`GET_LOCK` com o `debug_id` e variante "second"), trocando via `switch_locks` | CONFIRMADA (estrutura) / INFERIDA (protocolo exato) |
| Rotina instrumentada chama `trace(linhaIni, linhaFim, posIni, posFim, ...)` antes de cada statement e `enter_module/leave_module` na entrada/saída; `DECLARE CONTINUE HANDLER` captura exceções e sqlstate 02000 | CONFIRMADA (chamadas) / INFERIDA (reescrita exata) |
| Passos: step into/over/out/continue via `step_kind`; watches gravados como varbinary + tipo; call stack por `stack_depth` | INFERIDA (nomes), CONFIRMADA (campos) |
| Erro `ActiveDebugSessionsException`: não permite instalar/remover infraestrutura com sessões ativas | CONFIRMADA |

## Implicações para o clone (design próprio)
1. Requer permissão de CREATE DATABASE no servidor alvo → pedir confirmação explícita ao usuário antes de instalar `cr_debug`-equivalente (usar nome próprio, ex. `dbforge_linux_debug`) e oferecer remoção.
2. Parser SQL próprio das rotinas (procedure/function/trigger/event) para localizar statements (linha/posição) e injetar chamadas de trace; manter a rotina original intacta (criar cópia instrumentada num schema temporário ou substituir e restaurar em falha — decisão no PRD).
3. Duas conexões (controle e alvo) sincronizadas por GET_LOCK; timeouts e limpeza em desconexão.
4. Limitações a documentar: locks/tx, rotinas com SQL dinâmico, recursão, triggers em tabelas em uso.
Tarefa de implementação: M16 (após UX 14 e módulo `sql-parser`). Risco: ALTO.

## Limitações da implementação dbForgeLinux

- A primeira versão depura **procedures** com checkpoints em statements de nível superior e blocos `IF` inteiros. Funções não são instrumentadas: o checkpoint atual é uma procedure com escrita e espera, operações que MySQL proíbe em stored functions. Triggers e events também ficam fora do escopo inicial porque executam como parte de outro statement/ator e não permitem controlar seu ciclo de pausa com segurança equivalente.
- Os watches aceitam nomes simples de variáveis locais declaradas no bloco principal; expressões, parâmetros e variáveis declaradas em blocos internos ainda não são avaliados. A call stack contém o frame da procedure selecionada. Chamadas a outras rotinas não instrumentadas não geram frames adicionais.
- `Step Into`, `Step Over` e `Step Out` atualmente avançam entre checkpoints da procedure selecionada. O primeiro instrumentador mantém blocos de controle como uma unidade; não pausa em cada branch de `IF`, `CASE`, loops ou handlers. SQL dinâmico (`PREPARE`/`EXECUTE`) é rejeitado na compilação para depuração.
- A infraestrutura própria usa o schema `dbforge_linux_debug`, guarda o DDL original no servidor antes da troca e serializa checkpoints/comandos com lock nomeado e uma sessão de controle separada da sessão alvo. Atualizar/remover verifica sessões em `preparing`, `running` ou `paused`; após encerramento inesperado do aplicativo, uma linha ativa exige intervenção administrativa antes da remoção.
- Com autocommit desativado, a sessão alvo executa `ROLLBACK` ao terminar; `COMMIT` e DDL executados pelo corpo da rotina podem ter efeitos que o MySQL não reverte. Depuração executa o código real no servidor.
