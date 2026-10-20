# UX 14 — Debugger de rotinas (Breakpoints, Watches, Call Stack)

Reusa `01-shell.md`, `05` (editores de rotina), `03` (CodeEditor, DataGrid). **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (T-SQL/MySQL Debugger) e https://www.devart.com/dbforge/mysql/studio/mysql-debugger.html. Citações por redirecionamento; páginas individuais não abertas.

> **Aviso de viabilidade [I]:** MySQL/MariaDB não têm depurador nativo; o dbForge original instrumenta/executa a rotina de forma própria. Esta spec descreve a UX; o mecanismo (instrumentação do corpo com pontos de verificação, execução passo a passo em sessão dedicada) é decisão de engenharia e pode limitar recursos (ver §8).

## 1. Entrada
Explorer > Procedure/Function/Trigger > **Debug** (Alt+F5 [I]); editor de rotina (05) > botão **Debug**; menu SQL > Debug (F5 inicia em modo debug quando "Debug" ativo). Scripts SQL gerais: P3 [I]. Iniciar abre diálogo de parâmetros (igual ao Execute de 05) e depois alterna para a **perspectiva de debug**.

## 2. Perspectiva de debug
```
+ Aba: [sp_calc_total (debug)] -----------------------------------+
| Toolbar: [Continue F5][Pause][Stop Shift+F5] |                    |
|  [Step Into F11][Step Over F10][Step Out Shift+F11][Run to Cursor]|
|  | [Restart Ctrl+Shift+F5] | [Rollback after debug ☑]             |
+------------------------------------------+------------------------+
| Editor (somente leitura durante debug)   | Painel lateral:        |
|  ● breakpoint (gutter), ▶ linha atual    | [Variables][Output]    |
|                                          |                        |
+------------------------------------------+------------------------+
| Abas inferiores: [Watches][Call Stack][Breakpoints][Messages][Result]
+-------------------------------------------------------------------+
```
Painéis dock próprios [C: Breakpoints, Call Stack, Watches existem em DefaultLayout].

## 3. Breakpoints [C]
- Alternar: clique no gutter / F9; marca ● vermelha; desabilitado ○ cinza; condicional ◆ (com tooltip da condição) [I: conditional comuns na indústria].
- **Painel Breakpoints:** lista (✓ ativo | Local (rotina:linha) | Condição | Hit count | Mensagem de log [I]); ações: Add, Edit (condição SQL booleana, hit count "quando = N / ≥ N"), Delete, Delete All, Disable All; clique duplo navega. Persistem por conexão/rotina entre sessões; mapeados por linha (aviso se o corpo mudou: "Breakpoint desalinhado").
- Linhas não executáveis (comentário/DECLARE) não aceitam breakpoint (cursor "proibido" + tooltip).

## 4. Execução e passos [C]
Continue, Step Into (entra em CALL de outra rotina e abre sua aba), Step Over, Step Out, Run to Cursor, Pause (best-effort [I]), Stop (encerra e faz ROLLBACK se opção marcada — padrão marcado em Prod), Restart. Linha atual: fundo accent 20% + seta; linhas executadas recentes realce sutil. Ao terminar: aba Result mostra resultados/OUT/retorno (05 §4/5).

## 5. Watches [C]
Grid: Expressão | Valor | Tipo. Adicionar: [+], duplo clique em linha vazia, botão direito na seleção do editor "Add Watch" (Ctrl+Alt+W [I]). Avalia variáveis locais, parâmetros, variáveis de sessão `@x`, expressões SQL simples. Alteração do valor desde o último passo em destaque âmbar; erro de avaliação: valor "‹erro›" em vermelho com tooltip; edição de valor em linha (set variable) [I]. Painel **Variables** lista automaticamente locais+parâmetros do frame.
Hover sobre variável no editor mostra tooltip com valor [I].

## 6. Call Stack [C]
Lista de frames (▶ atual no topo): Rotina | Linha | Tipo (Procedure/Function/Trigger). Clique/duplo clique seleciona o frame: editor mostra o código do frame; Variables/Watches avaliam nesse contexto; seta cinza indica frame ≠ atual. Menu: Copy Stack, Run to Frame [I].

## 7. Estados
| Estado | Aparência |
|---|---|
| Preparando | "Preparando depuração…" (instrumentação), spinner; [Cancel] |
| Em execução | toolbar: Pause/Stop ativos; status bar "Debugging… (running)" |
| Pausado | linha atual realçada; painéis ativos; status "Paused at sp_x:12" |
| Concluído | banner verde "Execução concluída" + resultados; breakpoints mantidos |
| Erro de rotina | pausa na linha do erro (se possível), banner vermelho com `Error` e opções [Continue(erro)] [Stop] |
| Não suportado (trigger sem contexto, função com efeitos, privilégios) | InlineErrorPanel explicando limitação |
| Conexão perdida | sessão encerrada, ROLLBACK implícito, banner âmbar [Reiniciar] |
Segurança: depurar executa a rotina de verdade (efeitos colaterais). Primeiro uso e Prod: diálogo "A depuração executa código real; marque 'Rollback após depurar' para reverter" ; DDL dentro de rotina não pode ser revertido (aviso).

## 8. Limitações a documentar na UI [I]
Sem breakpoints em SQL dinâmico (PREPARE/EXECUTE); sem step-in em funções nativas; Pause pode atrasar até a próxima linha instrumentada; transações DDL não revertem. Banner "Limitações do depurador" com link para ajuda.

## 9. Atalhos

| Ação | Atalho |
|---|---|
| Iniciar debug | Alt+F5 [I] |
| Continue | F5 |
| Step Into / Over / Out | F11 / F10 / Shift+F11 |
| Run to Cursor | Ctrl+F10 |
| Toggle Breakpoint | F9 |
| Stop | Shift+F5 |
| Add Watch | Ctrl+Alt+W |
(Em ambientes que capturam F10/F11, ofertar alternativas editáveis; ver 01 §10.)

## 10. Temas / acessibilidade
Tokens 01; breakpoint = ícone+forma (círculo/losango/oco), não só cor; linha atual com seta + realce; anúncios aria-live do estado (Paused at…).

## 11. Componentes
CodeEditor (gutter customizado: breakpoints, seta), ToolbarDebug, WatchesGrid, CallStackList, BreakpointsList, VariablesGrid, Banner, ConfirmDialog.

## 12. Critérios de aceite
- Definir breakpoints (incl. condicionais), iniciar depuração de procedure com parâmetros, pausar, avançar por Step Into/Over/Out, inspecionar Watches e Call Stack e parar com rollback.
- Estados e limitações visíveis; Prod protegido; claro/escuro; teclado completo.
