# UX 14 — Debugger de rotinas (Breakpoints, Watches, Call Stack)

Reusa `01-shell.md`, `05` (editores de rotina), `03` (CodeEditor, DataGrid). Legenda: **[I]** INFERIDO (baseado em sessão anterior em `NOTES.md` #13 e inventário REA `document/05-rea-debugger.md`; pendente de confirmação por novas capturas da Lupa).

## 1. Mecanismo (resumo para a UX) [I]
O MySQL não possui protocolo de depuração embutido. O produto original **instrumenta** as rotinas e instala no servidor uma **infraestrutura de depuração** ("debug engine") — um schema auxiliar (`cr_debug` no original; **no clone: `tuxsql_linux_debug`**, nome próprio) com tabelas de breakpoints, call stack, sessões e watches e procedures de controle. Há duas sessões: **debug session** (controla/observa) e **target session** (executa a rotina instrumentada), sincronizadas por locks nomeados (`GET_LOCK`/`RELEASE_LOCK`). Consequências de UX:
1. A infraestrutura precisa ser **instalada/atualizada/removida com confirmação explícita** (requer CREATE DATABASE/privilégios no servidor) — §3.
2. Rotinas são **compiladas para depuração** (código instrumentado com pontos de verificação) antes de rodar — §4.
3. Não se pode instalar/atualizar/remover a infraestrutura com **sessões de debug ativas** — §3.
4. Resolução de incompatibilidade do MySQL 8.4: em sessão anterior observou-se que o original falha na instalação em modo estrito por tentar alocar colunas `VARCHAR(21845)` em charset UTF-8; o TuxSQL supera o original utilizando `MEDIUMTEXT` seguro no schema `tuxsql_linux_debug`.

## 2. Entradas e Fluxo de Inicialização [I: sessão anterior]
- **Entradas:**
  - Menu **Debug** no menu bar de topo.
  - Database Explorer > clique com botão direito na Stored Procedure ou Function > **Step Into** (`F11`) ou **Compile for Debugging...**
- **Etapas de Inicialização:**
  1. *Checagem do Engine:* Se o schema auxiliar de debug não existir no servidor, exibe o diálogo modal:
     `"Debug engine is not found on the server. To continue, you have to deploy the debug engine."` com botões `[Deploy]` e `[Cancel]`.
  2. *Compilação da Rotina:* Se a rotina não estiver instrumentada, exibe:
     `"<db>.<rotina> does not contain debug information. You should compile it before debug. Do you want to continue?"` com botões `[Yes]` e `[No]`.
  3. *Diálogo "Edit Parameters":*
     - Grade: `Name` | `Type` | `Direction` (Input/Output com ícone) | `Null value (☑)` | `Value`.
     - Parâmetros de saída (`OUT`/`INOUT`) possuem campos de valor desabilitados para digitação prévia.
     - Checkbox: `☑ Show after execute` (exibe valores de saída após a conclusão da rotina).
     - Botões `[OK]` e `[Cancel]`.
  4. *Abertura da Perspectiva de Depuração:* A rotina abre em aba dedicada com páginas `General`, `Data` e `SQL`.

## 3. Gerenciar a infraestrutura de depuração (debug engine) [I]
Menu Debug (ou Explorer > conexão > Debug): **Deploy Debug Engine**, **Remove Debug Engine**, e "Update" quando desatualizada.
| Situação | Comportamento / mensagens |
|---|---|
| Não instalada ao iniciar debug | Diálogo: "A infraestrutura de depuração não foi encontrada no database `{0}`. Para continuar, é preciso instalá-la." [Deploy] [Cancel] com explicação técnica do schema auxiliar |
| Desatualizada | "A infraestrutura no servidor não está atualizada. Para continuar é preciso atualizá-la" [Update] [Cancel] |
| Instalando | Progresso com spinner "Deploying debug engine to database `{0}`…" ; sucesso "Debug engine has been successfully deployed." ; falha "Deployment failed" |
| Remover | Confirmação; opção "Remove debug code from routines" e "Removing the debug engine from the server…"; sucesso "The debug engine was removed." |
| Sessões ativas | Bloqueio atômico: "Deployment failed. There are active debug sessions in database `{0}`." Não permite sobrescrita destrutiva |
| Privilégios insuficientes | "Your user account has insufficient privileges to use the debugging engine database." |

## 4. Compilar para depuração [I]
- Comandos: **Compile for Debugging**, **Compile Dependants for Debugging**, **Compile References for Debugging** (Explorer/menu Debug).
- Atalhos observados: `Ctrl+Alt+F7` / `Ctrl+Alt+F9`; compilação normal (sem debug) `Ctrl+F7` / `Ctrl+F9`.
- Autocommit: "To start debugging, the autocommit mode will be enabled. Would you like to continue?" — aviso exibido caso a sessão esteja em modo manual.

## 5. Perspectiva de Depuração [C: confirmado na VM]
A rotina abre como documento no editor (ex.: `sample.sp_customer_orders`). Confirmado via `re/original-observation/03-debugger/07-debug-session-1742.png`.
- **Gutter do Editor:**
  - Círculo vermelho para Breakpoints normais (`17-breakpoint-f9-line4-1744.png`).
  - Seta amarela apontando para a linha atual de execução pausada com realce amarelo na linha ativa (`07-debug-session-1742.png`, `09-after-step-over-1743.png`, `11-second-step-over-1743.png`).
  - Gutter de linhas não-executáveis (como `END` ou declarações de bloco) rejeita breakpoints (`16-breakpoint-gutter-1744.png`).
- **Painéis Docados de Apoio:**
  - **Watches:** Grade com `Name` | `Value` | `Type`, contendo linha vazia ao final para adicionar nova variável ou expressão observada (`12-watch-added-1743.png`). [C: colunas confirmadas na VM; edição de variável em execução é INFERIDA].
  - **Breakpoints:** Toolbar (`Disable All`, `Delete All`) + grade `Check` | `Name` | `Line` | `Character` (`17-breakpoint-f9-line4-1744.png`). [C: colunas básicas confirmadas na VM; condições e hit count são INFERIDAS].
  - **Call Stack:** Grade com `Name` | `Line`; exibe o quadro atual com seta indicadora de execução (`10-call-stack-tab-1743.png`).
  - Abas inferiores docáveis: `Output` | `Error List` | `Watches` | `Breakpoints` | `Call Stack` (`07-debug-session-1742.png`).

### 5.1 Watch Expressions (Expressões de Inspeção) [C: confirmado na VM]
- **Evidência VM:** Confirmado via `re/original-observation/03-debugger/12-watch-added-1743.png` (colunas Name, Value, Type; p_count = 4, INT).
- **Comportamento Confirmado:**
  - A última linha da grade Watches é um campo editável com placeholder *"Add watch..."*.
  - O desenvolvedor pode digitar qualquer nome de variável (ex.: `p_count`, `total`) ou expressão (ex.: `p_customer + 1`, `p_count > 0`).
  - Ao pressionar `Enter`, a expressão é avaliada no escopo da execução pausada.
  - Coluna `Value`: exibe o valor calculado (ex.: `4`). A cada avanço de passo (`F10`/`F11`), os valores são recalculados automaticamente e os que mudaram recebem destaque visual temporário.
  - Coluna `Type`: exibe o tipo de dado do resultado (`INT`, `VARCHAR`, `DECIMAL`, `BOOLEAN`).
  - Botão de exclusão `[x]` por linha ou tecla `Delete` remove a expressão do monitoramento.
- **Comportamento Inferido [I: proposta do clone, não comprovada na VM]:**
  - Edição direta de valores de variáveis no grid de Watches durante a pausa (Lupa catalogou em `NOTAS.md` como DESCONHECIDA na referência; no TuxSQL, Watches são inicialmente de leitura das variáveis e expressões computadas).

### 5.2 Breakpoints Condicionais e Hit Count [I: inferido / proposta do clone]
- **Evidência VM:** O PNG `re/original-observation/03-debugger/17-breakpoint-f9-line4-1744.png` confirma **apenas** o painel Breakpoints básico com colunas `Check | Name | Line | Character` e o ponto vermelho no gutter na linha 4 (`sample.sp_customer_orders, 4, 3`). As funcionalidades de **Condição** e **Hit Count** NÃO possuem tela capturada na VM (`re/original-observation/03-debugger/NOTAS.md` classifica explicitamente como `DESCONHECIDO` na referência) e constituem proposta do clone para paridade estendida. Atalhos de teclado gerais confirmados em `re/original-observation/10-tools-options/04-env-keyboard-1802.png`.
- **Comportamento Proposto:**
  - Pressionar `F9` ou clicar no gutter insere/remove breakpoint incondicional.
  - Clique com botão direito no marcador ou na lista de breakpoints abre menu com **Breakpoint Properties...** (ou atalho de contexto).
  - **Diálogo Breakpoint Properties:**
    - **Condition:**
      - Checkbox `[x] Condition`.
      - Campo de texto para expressão condicional SQL (ex.: `p_count > 10`, `status = 'ACTIVE'`).
      - Modo: `(•) Is true` (pausa quando a condição avaliar para verdadeiro) ou `( ) Has changed` (pausa quando o valor da expressão mudar).
    - **Hit Count:**
      - Modo: `(•) Always break` (padrão) | `( ) Break when hit count is equal to N` | `( ) Break when hit count is a multiple of N` | `( ) Break when hit count is greater than or equal to N`.
      - Contador `Current hit count: N` com botão `[Reset Hit Count]`.
  - **Indicador Visual:** Marcador de breakpoint condicional no gutter exibe glifo distintivo com `+` ou `=` no interior do círculo vermelho.
  - Na execução instrumentada, a rotina avalia a condição do breakpoint; se for falsa ou o hit count não for satisfeito, a execução prossegue sem interrupção.

### 5.3 Diálogo View Output Parameters [C: confirmado na VM]
- **Evidência VM:** Confirmado via `re/original-observation/03-debugger/06-edit-parameters-filled-1742.png` (`[x] Show after execute`), `re/original-observation/03-debugger/18-after-continue-1744.png` (modal "View Output Parameters" ao término do `Continue Ctrl+F5`) e `re/original-observation/03-debugger/19-after-output-params-1744.png` (foco na aba Data com o resultset retornado).
- **Comportamento:**
  - No diálogo inicial "Edit Parameters", o checkbox `[x] Show after execute` vem marcado por padrão (`06-edit-parameters-filled-1742.png`).
  - Ao término da execução da rotina (via `Continue Ctrl+F5` ou último passo no `END`), abre automaticamente o diálogo modal **"View Output Parameters"** (`18-after-continue-1744.png`).
  - **Grade de Parâmetros:**
    - `Name`: Nome do parâmetro (ex.: `p_customer`, `p_count`).
    - `Type`: Tipo do dado (ex.: `BIGINT`, `INT`).
    - `Direction`: Direção (`Input`, `Output`, `Input/Output`) com ícones direcionais.
    - `Null value`: Checkbox indicando se o resultado é nulo.
    - `Value`: Campo de valor formatado. Parâmetros de entrada aparecem desabilitados com o valor fornecido; parâmetros de saída exibem os valores computados pela rotina (ex.: `p_count = 4`).
  - **Ação:** Botão `[Close]` (acionável via `Enter` ou `Esc`).
  - **Pós-Encerramento:** Ao fechar o diálogo, o ambiente foca na aba **`Data`** do editor (`19-after-output-params-1744.png`), exibindo os resultsets produzidos pelas consultas da rotina (ex.: `Record 1 of 4` com as colunas retornadas).

## 6. Comandos e Atalhos de Depuração [C: confirmado na VM]
Confirmado via menu Debug em `re/original-observation/03-debugger/08-debug-menu-1742.png`:
- **Step Into:** `F11` (entra na instrução ou rotina chamada).
- **Step Over:** `F10` (executa a linha atual sem entrar em sub-rotinas; move destaque para próxima linha executável).
- **Step Out:** `Shift+F11` (executa até sair da rotina atual).
- **Toggle Breakpoint:** `F9` (adiciona/remove breakpoint na linha do cursor).
- **Delete All Breakpoints:** `Ctrl+Shift+F9` (com confirmação "Do you want to delete all breakpoints?").
- **Continue / Run:** `Ctrl+F5` (ou `Alt+F9`; executa até o próximo breakpoint ou término).
- **Break All:** `Ctrl+Alt+Pause` (interrompe execução imediata).
- **Stop Debugging:** `Shift+F5` (encerra a sessão e restaura variáveis).
- **Restart:** `Ctrl+Shift+F5` (reinicia do início com os mesmos parâmetros).
- **Run To Cursor:** `Ctrl+F10` (ou `F4`).

## 7. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Edição Direta de Valores de Variáveis no Grid Watches em Execução [I: inferida / desconhecida na VM]:** No original o comportamento não pôde ser comprovado nas capturas da VM (listado como DESCONHECIDO em `03-debugger/NOTAS.md`). No TuxSQL o painel Watches reflete os valores computados de forma somente leitura.
2. **Diálogo Interativo de Tratamento de Exceções [I: inferida]:** Comportamento em exceções não foi capturado na VM (DESCONHECIDO). Proposta inferida do clone: quando ocorre uma exceção não tratada, abortar com mensagem nos painéis Output e Error List, em vez de modal bloqueante.
3. **Depuração de Event Schedulers e UDFs em C (Divergência Intencional):** TuxSQL foca exclusivamente em Stored Procedures e Triggers SQL.

## 8. Estados de Interface
| Estado | Comportamento |
|---|---|
| Checando Sessões / Compilando | Spinner modal "Checking for active debug sessions..." e "Compiling routine..." |
| Em Execução Contínua | Status bar animada "Debugging in progress..." e botão Pause/Stop habilitado |
| Pausado em Breakpoint | Foco automático no editor na linha ativa com seta vermelha e linha amarela destacada |
| Concluído com Sucesso | Toast informativo "Debugging finished", resultado exibido no Output |
| Erro de Sintaxe na Instrumentação | Banner vermelho detalhando erro de compilação sem alterar o código original no banco |

## 9. Temas e Acessibilidade
- Conformidade estrita com os temas Claro e Escuro de `01-shell.md`.
- Breakpoints possuem formatos e marcadores distintivos (círculo sólido, círculo vazado para desabilitado, triângulo de aviso para erro).
- Indicador da linha atual combina realce de fundo com seta visual no gutter e leitor de tela anuncia "Paused at routine, line X".

## 10. Componentes
`DebuggerToolbar`, `DebugEditorGutter`, `WatchesGrid`, `BreakpointsList`, `CallStackTree`, `EditParametersModal`, `DeployEngineConfirmDialog`, `EngineProgressView`.

## 11. Critérios de Aceite
- Detecta ausência do engine de depuração e oferece diálogo de deploy com schema `tuxsql_linux_debug`.
- Exibe diálogo Edit Parameters para configuração de valores de entrada e saída.
- Execução respeita breakpoints, Step Into (`F11`), Step Over (`F10`) e Step Out (`Shift+F11`).
- Painéis Watches e Call Stack sincronizam valores e profundidade de chamadas a cada passo.

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
