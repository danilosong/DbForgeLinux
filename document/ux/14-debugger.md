# UX 14 — Debugger de rotinas (Breakpoints, Watches, Call Stack)

Reusa `01-shell.md`, `05` (editores de rotina), `03` (CodeEditor, DataGrid). Legenda: **[C]** CONFIRMADO (REA: `ui-text`, `shortcuts`, `document/05-rea-debugger.md`) / **[I]** INFERIDO.

**Fontes:** `re/ui-strings/ui-text.txt` (uso interno), `document/05-rea-debugger.md` (strings/script embutido do `Devart.DbForge.Debugger.MySql.dll`; descrição própria, nenhum código copiado). O aviso anterior de inviabilidade foi **removido**: o mecanismo é conhecido (ver §1).

## 1. Mecanismo confirmado (resumo para a UX) [C]
MySQL não tem depurador nativo; o produto original **instrumenta** as rotinas e instala no servidor uma **infraestrutura de depuração** ("debug engine") — um schema auxiliar (`cr_debug` no original; **no clone: `tuxsql_linux_debug`**, nome próprio) com tabelas de breakpoints, call stack, sessões e watches e procedures de controle. Há duas sessões: **debug session** (controla/observa) e **target session** (executa a rotina instrumentada), sincronizadas por locks nomeados. Consequências de UX:
1. A infraestrutura precisa ser **instalada/atualizada/removida com confirmação explícita** (requer CREATE DATABASE/privilégios no servidor) — §3.
2. Rotinas são **compiladas para depuração** (código instrumentado) antes de rodar — §4.
3. Não se pode instalar/atualizar/remover a infraestrutura com **sessões de debug ativas** — §3.
4. Funções e triggers têm suporte condicionado à versão do MySQL ("supported only on MySQL …", versão exata não extraída — **[I] pendente**).
5. Edições do produto: recurso pode ser bloqueado por edição ("not available in the {0} edition"; ação "Unlock SQL code debugger"); no clone não há edições, ignorar esse fluxo.

## 2. Entradas [C]
Menu **Debug** (menu de topo existe [C]); Explorer > Procedure/Function > **Debug Stored Procedure…** / **Compile for Debugging…** / **Compile Dependants for Debugging…** / **Compile References for Debugging…**; comando **Start Debugging**; **Debug Wizard** (diálogo de seleção: "Select a stored procedure or function to debug", parâmetros); "Start debug session for a stored procedure/function". Iniciar abre diálogo de parâmetros (igual ao Execute de 05) e depois alterna para a **perspectiva de debug**. Sem seleção válida: mensagem "Please select a procedure or function to debug."

## 3. Gerenciar a infraestrutura de depuração (debug engine) [C]
Menu Debug (ou Explorer > servidor/database > Debug): **Deploy Debug Engine**, **Remove Debug Engine**, e "Update" quando desatualizada.
| Situação | Comportamento / mensagens (parafraseadas) |
|---|---|
| Não instalada ao iniciar debug | Diálogo: "A infraestrutura de depuração não foi encontrada no database `{0}`. Para continuar, é preciso instalá-la." [Deploy] [Cancel] — **sempre com explicação do que será criado** (schema auxiliar, privilégios necessários) |
| Desatualizada | "A infraestrutura no servidor não está atualizada. Para continuar é preciso atualizá-la" [Update] [Cancel]; versão mais nova disponível: "Deseja atualizar?" |
| Instalando | Progresso "Deploying debug engine to database `{0}`…" ; sucesso "Debug engine has been successfully deployed." ; falha "Deployment failed" |
| Remover | Confirma; "Removing debug code from routines…" (opção "Remove debug code from routines") e "Removing the debug engine from the server…"; sucesso "The debug engine was removed."; inexistente: "…was not found… nothing to remove."; cancelado: "Debug engine removal was canceled." |
| Sessões ativas | Bloqueio: "Deployment failed. There are active debug sessions…" (exceção `ActiveDebugSessionsException` no original); passo prévio "Checking for active debug sessions…"; sugere limpar a tabela de sessões e reinstalar apenas se as sessões forem descartáveis |
| Privilégios insuficientes | "Your user account has insufficient privileges to use the debugging engine database." + dica: verificar privilégios no schema auxiliar pelo **Security Manager** (08) |
| Sem privilégio de metadados | "Can't start debug. Probably, you do not have enough privileges to get object metadata." |
Implementação própria do clone: schema `tuxsql_linux_debug`, parser SQL próprio, instrumentação (ver `document/05-rea-debugger.md`).

## 4. Compilar para depuração [C]
- Comandos: **Compile for Debugging**, **Compile Dependants for Debugging**, **Compile References for Debugging** (Explorer/menu Debug), com atalho Ctrl+Alt+F7 / Ctrl+Alt+F9 [C: `CompileObjectDebug`/`CompileDebug`]; **Compile** normal (sem debug) Ctrl+F7 / Ctrl+F9 [C]; "Remove debug code from routines" reverte.
- Mensagens: sucesso "`{0}` `{1}` has been successfully compiled with debug info." / "Selected objects have been successfully compiled with debug info."; falha "Can't start debug. Error occurred during compilation object `{0}`."; objeto não compilado: "Object `{0}` is not compiled for debug!" → "You should compile it before debug. Do you want to continue?" [Yes: compila e continua] [No]; "`{0}` does not contain debug information."; "Debugging is impossible for the `{0}` object." ; "There is no code to debug."
- Fonte modificada: "The source has been modified. Do you want to save before debugging?" (vários: "Some schema objects have been modified. Save them before debugging?").
- Autocommit: "To start debugging, the autocommit mode will be enabled. Would you like to continue?" [C] — exibir antes de iniciar.
- Compilação instrumentada preserva a rotina original (cópia/restauração no PRD; erro → restaurar e avisar).

## 5. Perspectiva de debug
```
+ Aba: [sp_calc_total (debug)] -----------------------------------+
| Toolbar: [Start/Run][Step Into][Step Over][Step Out]              |
|  [Run To Cursor][Stop Debugging][Restart] | [Compile for Debugging]|
+------------------------------------------+------------------------+
| Editor (somente leitura durante debug)   | Painel lateral         |
|  ● breakpoint (gutter), ▶ linha atual    | Watches / Variables    |
+------------------------------------------+------------------------+
| Abas inferiores: [Watches][Call Stack][Breakpoints][Output]       |
+-------------------------------------------------------------------+
```
Painéis dock **Watches**, **Call Stack**, **Breakpoints** [C: menu Debug > Watches / Call Stack / Breakpoints].

### 5.1 Breakpoints [C]
- Comandos: **Toggle Breakpoint**, **Insert Breakpoint**, **Delete Breakpoint**, **Delete All Breakpoints** (confirma: "Do you want to delete all breakpoints?"), **Disable All Breakpoints**; ícones de estado: normal, **Disabled**, **Error** (colocado em posição inválida), marca também na barra de rolagem ("Breakpoint (Scroll Bar)") [C].
- Posição inválida: "A breakpoint cannot be inserted at this location." / "Cannot set breakpoint at this position." (cursor proibido + tooltip).
- Painel Breakpoints: lista (ativo, local rotina:linha, condição/hit count **[I]**); duplo clique navega. Persistência por rotina **[I]**.
### 5.2 Execução e passos [C]
**Start Debugging**, **Run** (continuar), **Step Into**, **Step Over**, **Step Out**, **Run To Cursor**, **Stop Debugging**, **Restart** (mensagem "Debug is restarting…"). Pausa (Pause) **[I]**. Mensagens de ciclo: "Debugging started at {0}", "Debugging finished at {0}". Stop: "Do you want to stop debugging?".
Mudanças de código durante a sessão: "The code changes you have made will not be applied until you restart. If you continue debugging, your source will not match the executed code" com ação "Always ignore changes and continue debugging" [C]. Objeto modificado/renomeado durante debug: sessão encerrada ("Debug session for `{0}` was terminated. Probably object was modified." / "…was renamed to `{1}` during debug. Debug session will be terminated.") [C]. Objeto em debug não pode ser removido: "Object `{0}` is being debugged and can't be removed" [C]. Sessão já existente: "Application already has the debug session." [C].
**Exceções** [C]: "Exception occurred at line {0}. If you want to continue debugging press '{1}' otherwise press '{2}'" → diálogo com [Continue] (segue após handler) / [Stop].
### 5.3 Watches [C]
Painel **Watches**; comandos **Add Watch**, **Delete Watch**; grid Nome | Valor | Tipo [I: colunas]; limite: "Watch name is too long. Watch cannot be created". Valores gravados como binário + tipo no servidor [C: `watches`]; no grid exibir formatados. Mudança de valor entre passos em destaque [I]. Erro de avaliação em vermelho [I].
### 5.4 Call Stack [C]
Painel **Call Stack**: frames por profundidade (`stack_depth` [C]); frame atual no topo; selecionar frame navega ao código e avalia Watches nesse contexto [I]. Step Into em CALL de outra rotina compilada abre sua aba [I].

## 6. Estados
| Estado | Aparência |
|---|---|
| Preparando | "Checking for active debug sessions…" / "Compiling…" com spinner e [Cancel] |
| Em execução | status bar "Debugging…"; Stop/Pause habilitados |
| Pausado | linha atual realçada (accent 20% + seta); painéis ativos; "Paused at rotina:linha" |
| Concluído | "Debugging finished at {0}" no Output + banner verde; resultados na aba Result (05) |
| Erro | mensagens da §3/§4/§5 em Banner vermelho/âmbar + Output; "Could not attach debugger" quando falha o attach |
| Conexão perdida | sessão encerrada, banner âmbar [Reiniciar] |
Segurança: depurar executa código real; Prod exige confirmação extra; autocommit será ativado (aviso §4); DDL dentro de rotinas não pode ser revertido.

## 7. Limitações a mostrar na UI (INFERIDAS, do PRD em `05-rea-debugger.md`) [I]
SQL dinâmico (PREPARE/EXECUTE), recursão, locks/transações e triggers em tabelas em uso. Banner "Limitações do depurador" com link de ajuda.

## 8. Atalhos
| Ação | Atalho | Fonte |
|---|---|---|
| Run / Continue | Alt+F9 ou Ctrl+F5 | [C] REA shortcuts (`Run`) |
| Run To Cursor | Ctrl+F10 ou F4 | [C] (`RunToCursor`) |
| Restart | Shift+F9 | [C] (`Restart`) |
| Compile for Debugging | Ctrl+Alt+F7 / Ctrl+Alt+F9 | [C] |
| Compile (normal) | Ctrl+F7 / Ctrl+F9 | [C] |
| Step Into / Over / Out, Toggle Breakpoint, Stop | F11 / F10 / Shift+F11, F9, Shift+F5 | [I] (comandos [C]; teclas não localizadas no mapa extraído) |
Observação: o mapa de atalhos é a união de vários esquemas de teclado do original; no clone definir um esquema padrão e permitir reatribuir (19 §Keyboard). F10/F11 podem ser capturados por DEs (01 §10).

## 9. Temas / acessibilidade
Tokens 01; breakpoint por forma (círculo/oco/⚠) e não só cor; linha atual com seta + realce; aria-live para estado (Paused at…).

## 10. Componentes
CodeEditor (gutter: breakpoints, seta), ToolbarDebug, WatchesGrid, CallStackList, BreakpointsList, DeployEngineDialog (explica o que será instalado), ProgressList, Banner, ConfirmDialog.

## 11. Critérios de aceite
- Primeira depuração: detecta ausência da infraestrutura, explica e pede confirmação para instalar; atualização/remoção com bloqueio por sessões ativas.
- Compilar para debug (+ dependentes/referências), avisar autocommit, iniciar com parâmetros, breakpoints, Step Into/Over/Out, Run To Cursor, Watches, Call Stack, tratar exceção (continuar/parar), parar e restaurar.
- Mensagens de erro/sucesso conforme as listadas; Prod protegido; claro/escuro; teclado.

## Textos de interface (referência)
| Rótulo / mensagem (real, parafraseada se longa) | Onde usa | Chave i18n sugerida |
|---|---|---|
| Debug (menu) | menu de topo | `debug.menu` |
| Start Debugging / Stop Debugging | toolbar/menu | `debug.start` / `debug.stop` |
| Step Into / Step Over / Step Out | toolbar | `debug.stepInto` / `debug.stepOver` / `debug.stepOut` |
| Run To Cursor | toolbar | `debug.runToCursor` |
| Restart; "Debug is restarting..." | toolbar/status | `debug.restart` / `debug.restarting` |
| Toggle Breakpoint / Insert Breakpoint / Delete Breakpoint | gutter/menu | `debug.bp.toggle` / `.insert` / `.delete` |
| Delete All Breakpoints / Disable All Breakpoints | menu Breakpoints | `debug.bp.deleteAll` / `.disableAll` |
| Do you want to delete all breakpoints? | confirmação | `debug.bp.deleteAll.confirm` |
| A breakpoint cannot be inserted at this location. | erro | `debug.bp.invalid` |
| Breakpoints / Watches / Call Stack | painéis | `debug.panel.breakpoints` / `.watches` / `.callStack` |
| Add Watch / Delete Watch | painel Watches | `debug.watch.add` / `.delete` |
| Watch name is too long. Watch cannot be created | erro | `debug.watch.nameTooLong` |
| Compile for Debugging / Compile Dependants for Debugging / Compile References for Debugging | menu/Explorer | `debug.compile` / `.compileDependants` / `.compileReferences` |
| {0} '{1}' has been successfully compiled with debug info. | sucesso | `debug.compile.ok` |
| Can't start debug. Error occurred during compilation object '{0}'. | erro | `debug.compile.fail` |
| Object '{0}' is not compiled for debug! / You should compile it before debug. Do you want to continue? | confirmação | `debug.notCompiled` |
| The source has been modified. Do you want to save before debugging? | confirmação | `debug.saveBefore` |
| To start debugging, the autocommit mode will be enabled. Would you like to continue? | confirmação | `debug.autocommit` |
| Deploy Debug Engine / Remove Debug Engine | menu | `debug.engine.deploy` / `.remove` |
| Debug engine is not found in database '{0}'. To continue, you have to deploy the debug engine. | diálogo | `debug.engine.missing` |
| Debug engine ... is not up to date. To continue, you have to update the debug engine. | diálogo | `debug.engine.outdated` |
| Deploying debug engine to database '{0}'... / Debug engine has been successfully deployed. | progresso/sucesso | `debug.engine.deploying` / `.deployed` |
| Removing the debug engine from the server... / The debug engine was removed. | progresso/sucesso | `debug.engine.removing` / `.removed` |
| Deployment failed. There are active debug sessions in database '{0}'. | erro | `debug.engine.activeSessions` |
| Checking for active debug sessions... | progresso | `debug.engine.checkingSessions` |
| Your user account has insufficient privileges to use the debugging engine database. | erro | `debug.engine.privileges` |
| Can't start debug. Probably, you do not have enough privileges to get object metadata. | erro | `debug.metadata.privileges` |
| Application already has the debug session. | erro | `debug.session.exists` |
| Could not attach debugger | erro | `debug.attach.fail` |
| Debugging started at {0} / Debugging finished at {0} | Output | `debug.started` / `debug.finished` |
| Do you want to stop debugging? | confirmação | `debug.stop.confirm` |
| Exception occurred at line {0}. Press continue to proceed or stop | diálogo | `debug.exception` |
| The code changes you made will not be applied until you restart... / Always ignore changes and continue debugging | banner | `debug.sourceChanged` / `.ignoreChanges` |
| Debug session for '{0}' was terminated. Probably object was modified. | erro | `debug.session.terminated` |
| Object '{0}' is being debugged and can't be removed | erro | `debug.object.busy` |
| Please select a procedure or function to debug. | validação | `debug.select` |
| There is no code to debug. | aviso | `debug.noCode` |

## Pendências [I]
- Teclas de Step Into/Over/Out, Toggle Breakpoint e Stop não localizadas no mapa extraído (apenas Run, RunToCursor, Restart, Compile*).
- Versão mínima do MySQL para depurar funções e triggers (mensagem truncada na extração).
- Condição/hit count em breakpoints, Pause, colunas exatas dos grids, persistência de breakpoints.
- Protocolo exato entre debug/target session e reescrita da rotina instrumentada (design próprio).
