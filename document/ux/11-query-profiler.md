# UX 11 — Query Profiler, Query History e Plano de Execução (EXPLAIN)

Reusa `01-shell.md`, `03` (editor/grid/resultados). **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Query Profiler; SQL Query History), catálogo interno `re/ui-strings/ui-text.txt`, **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas em `re/original-observation/12-profiler/` e varredura completa em `re/original-observation/p2-05-query-profiler/`).
- **[C] Ponto de entrada e Menu:** Menu principal `SQL > Query Profiling Mode` (`re/original-observation/p2-05-query-profiler/13-menu-sql-1939.png`). O menu `Tools` NÃO possui opção de profiler (`00-menu-tools-1934.png`). Ícone fica emoldurado/destacado quando ativo (`14-profiling-mode-1939.png`, `18-sql-menu-estado-1939.png`, `30-menu-sql-toggle-off-1941.png`).
- **[C] Aviso Real de Paginal Mode (`19-execute-profiling-on-1940.png`, `29-aviso-completo-1941.png`):** Ao executar consulta com profiling ativo e modo paginado habilitado, a barra de status exibe *"Query completed with warnings."* e a Error List emite aviso com o texto exato: *"Query profiling has been completed with the paginal mode turned on. Turn the paginal mode off to get the correct results."*.
- **[C] Estrutura da Árvore e Sub-nós (`19` a `23`):** Raiz `Query Profiler` -> nó de execução `HH:MM:SS DD/MM/YYYY (duracao)` -> filhos `Profile`, `Plan`, `Plan Diagram`, `Session statistics`.
- **[C] Detalhes dos Sub-nós:**
  - `Profile` (`20-profiler-profile-1940.png`): Colunas `State | Summed Duration, sec. | Percentage, %`, etapas e linha consolidada `Sum: total / 100%`.
  - `Plan` (`21-profiler-plan-1940.png`): Colunas do EXPLAIN clássico e painel descritivo do acesso.
  - `Plan Diagram` (`23-profiler-plan-diagram-1940.png`): Grafo visual com cabeçalho `"Total Cost: {custo}"`, caixas de operação com ícones (`SELECT` -> `Table Scan`), rótulo de aresta e percentual em vermelho (ex.: `"100,00%"`) acima do nó de maior custo.
  - `Session statistics` (`22-profiler-session-stats-1940.png`): Colunas `Name | Value | Description`.
- **[C] Dropdown de Comparação na Toolbar (`26-profiler-dropdown-1940.png`):** Opções reais: `Not compare` (marcado por padrão), `Compare last two results`, `Compare last three results`, `Compare last four results`, `Compare last five results`.
- **[C] Menu Dinâmico Data (`24-segunda-execucao-1940.png`):** Focar no painel do Profiler insere `Data` no menu principal com ações de cópia formatada (CSV, XML, HTML, JSON, EXCEL) e exportação.

## 1. Query Profiler [C: observado na VM]

### 1.1 Entrada e Ativação [C]
- No documento do Editor SQL: botão toggle **Query Profiling Mode** na barra de ferramentas SQL (`prof.mode`).
- Menu SQL > **Query Profiling Mode**.
- Atalho do toggle: `Ctrl+Alt+P`.
- Ao executar uma query com o modo ativado, abre-se automaticamente a aba de visualização **Profiler** (docada no editor ao lado de `Text | Results | Data | Profiler`).
- Estado inicial/vazio: "Turn on Query Profiling Mode and execute the current query" ou botão `[Get New Results]`.

### 1.2 Layout do Painel Profiler [C: observado na VM]
```
+ Aba: [Profiler: Consulta1.sql] ---------------------------------------------------+
| Toolbar: [Get New Results] [Clear History] [Compare...] [Save Result] [Export]    |
+-----------------------------------------------------------------------------------+
| PAINEL ESQUERDO (Árvore de Execuções)     | PAINEL DIREITO (Detalhe da Execução)  |
|                                           |                                       |
| ▾ Query Profiler                          | results - 16:22:15 (1.001 s)          |
|   ▾ 16:22:15 20/10/2026 (1.001s)          | SQL Query: [SELECT * FROM orders...]  |
|     • Profile                             +---------------------------------------+
|     • Plan                                | Visualização do nó selecionado:       |
|     • Plan Diagram                        | (Profile / Plan / Plan Diagram /      |
|     • Session statistics                  |  Session statistics)                  |
|   ▸ 16:20:02 20/10/2026 (0.042s)          |                                       |
+-----------------------------------------------------------------------------------+
```

### 1.3 Sub-nós de Detalhe por Execução [C: observado na VM]

#### 1.3.1 Nó "Profile"
- Título do cabeçalho: "Change of STATUS VARIABLES due to the query execution".
- Grade tabular dos estágios da execução:
  - `State`: nome do estágio (ex.: `User sleep`, `starting`, `checking permissions`, `Opening tables`, `init`, `System lock`, `optimizing`, `executing`, `end`, `freeing items`, `cleaning up`).
  - `Summed Duration, sec.`: tempo gasto na etapa em segundos com precisão de microsegundos (ex.: `1,000079`).
  - `Percentage, %`: fração relativa do tempo total (ex.: `99,98%`).
  - Barra de proporção gráfica inline colorida.
- Linha de rodapé consolidada: `Sum` com a duração total somada (ex.: `1,000274 s`) e `100%`.
- Em MySQL 8.0+ onde `SHOW PROFILE` é obsoleto, o TuxSQL extrai os eventos de estágios transparentemente a partir de `performance_schema.events_stages_history`.

#### 1.3.2 Nó "Plan" (EXPLAIN Tabular e Hierárquico)
- Grade com as colunas clássicas do EXPLAIN:
  - `id` | `select_type` | `table` | `partitions` | `type` (ALL, index, range, ref, eq_ref, const) | `possible_keys` | `key` | `key_len` | `ref` | `rows` | `filtered` | `Extra`.
- Painel inferior sincronizado com a linha selecionada: texto explicativo formatado descrevendo em linguagem acessível o que aquela operação significa (ex.: "Full table scan: the optimizer reads all rows from the table because no usable index was found").

#### 1.3.3 Nó "Plan Diagram" (Visualização Gráfica do Plano)
- Cabeçalho: "Total Cost: {custo}" calculado a partir do EXPLAIN FORMAT=JSON.
- Nós visuais organizados em fluxo (cards retangulares conectados por setas direcionais):
  - Card da operação (ex.: `SELECT`, `Table Value Constructor`, `Nested Loop`, `Filter`).
  - Arestas com indicação numérica da contagem de linhas transferidas entre nós.
  - Destaque em cores para nós com custo proporcional elevado (gradiente verde → amarelo → vermelho).

#### 1.3.4 Nó "Session statistics"
- Título do cabeçalho: "Change of the session statistics due to the query execution".
- Grade com as variáveis de sessão impactadas pela execução (`SHOW SESSION STATUS` delta):
  - `Name`: nome da variável de status do MySQL (ex.: `Bytes_received`, `Bytes_sent`, `Com_select`, `Created_tmp_disk_tables`, `Handler_read_key`, `Innodb_buffer_pool_pages_data`, `Last_query_cost`, `Open_files`, `Questions`, `Sort_rows`).
  - `Value`: variação numérica (delta) sofrida pelo contador durante a consulta.
  - `Description`: texto explicativo oficial e detalhado sobre o papel de cada métrica no MySQL.
- Filtro rápido para exibir apenas variáveis que sofreram alteração (`Δ != 0`) ou todas as variáveis.

### 1.4 Ferramenta de Comparação (Compare Runs) [C]
- Botão `[Compare...]` na toolbar do Profiler:
  - Permite selecionar duas execuções da árvore (Execução A e Execução B).
  - Exibição lado a lado em duas colunas:
    - Resumo: Duração Total A vs B com cálculo de delta percentual (verde para ganho de performance, vermelho para degradação).
    - Comparativo de Estágios: correspondência de estados entre as duas execuções.
    - Comparativo de Contadores: deltas de `Bytes_sent`, leituras de disco e buffers.
    - Comparativo do Plano: indicação visual de nós adicionados, alterados ou removidos.

## 2. SQL Query History [C]
- Entrada: Botão **Query History** na toolbar SQL ou menu View > Other Windows > SQL Query History (`Ctrl+Alt+H`).
- Painel docável contendo:
  - Grade: `Executed At` | `Connection` | `Database` | `Duration` | `Rows` | `Status (✓/✕)` | `Query Preview`.
  - Painel de detalhe inferior com o código SQL formatado somente leitura e mensagens de erro do servidor quando houver.
  - Retenção local com política de expiração (padrão 60 dias, configurável) armazenada em `$XDG_DATA_HOME/tuxsql/history`.
  - Ações: duplo clique para reabrir em novo editor SQL, "Profile this query", "Copy", "Delete" e "Clear History".

## 3. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Canvas Gráfico 2D Interativo no "Plan Diagram" (Pendente):** No original, o nó "Plan Diagram" apresenta uma superfície 2D com nós gráficos e setas contendo contadores de linhas e custo relativo. O TuxSQL atualmente renderiza o plano de execução em formato de árvore hierárquica e grade tabular, sem o canvas de nós vetoriais.
2. **Dicionário Enciclopédico de Variáveis de Sessão (Pendente):** Na aba "Session statistics", o original inclui na coluna `Description` descrições em texto de cada uma das centenas de variáveis de status do MySQL. O TuxSQL exibe os nomes e valores delta calculados com precisão, mas não possui a base textual de definições descritivas embutida.
3. **Docagem como Sub-aba Interna ao Documento SQL (Pendente):** No original, a aba "Profiler" fica docada dentro da mesma janela MDI do script SQL (ao lado de Text e Data). No TuxSQL ela opera como aba no dock de resultados ou painel especializado.

## 4. Estados de Interface
| Estado | Comportamento |
|---|---|
| Consulta em Execução com Profiling | Spinner animado no nó da execução com contador de tempo decorrido `hh:mm:ss.mmm` |
| Coleta Concluída com Sucesso | Árvore atualizada com o novo nó expandido e aba Profile selecionada por padrão |
| Falha / Erro na Consulta | Mensagem de erro do servidor exibida na aba Messages; o nó no histórico registra status de erro |
| DML Potencialmente Destrutivo | Diálogo de alerta exigindo confirmação explícita antes de perfilar comandos `UPDATE`/`DELETE` |
| Profiling Desabilitado no Servidor | Banner informativo orientando como habilitar `performance_schema` no servidor MySQL |

## 5. Atalhos de Teclado
- Alternar Query Profiling Mode: `Ctrl+Alt+P`
- Exibir Plano Estimado (Explain): `Ctrl+E`
- Reexecutar Consulta (Get New Results): `F5`
- Abrir SQL Query History: `Ctrl+Alt+H`
- Comparar Execuções Selecionadas: `Ctrl+Shift+C`

## 6. Temas e Acessibilidade
- Total conformidade com o tema Claro e Escuro de `01-shell.md`.
- Gráficos de barra e indicadores de estágio utilizam rótulos numéricos textuais explícitos (nunca apenas cor).
- Grades de dados navegáveis por teclado com atalhos de cópia rápida de valores selecionados.

## 7. Componentes
`ProfilerPanel`, `ExecutionHistoryTree`, `ProfileStageGrid`, `PlanTabularView`, `PlanDiagramCanvas`, `SessionStatsGrid`, `RunComparisonDialog`, `QueryHistoryDock`.

## 8. Critérios de Aceite
- Toggle de profiling ativa a captura de tempos por estágio e deltas de status da sessão MySQL.
- EXPLAIN FORMAT=JSON e FORMAT=TREE são interpretados com destaque para nós de alto custo.
- Comparação lado a lado entre duas execuções evidencia melhorias ou regressões de desempenho.
- Histórico de consultas persiste comandos executados e permite reabertura direta no editor.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Query Profiling Mode | Toggle na toolbar SQL | `prof.mode` |
| Turn on "Query Profiling Mode" and execute the current query | Estado vazio do Profiler | `prof.empty` |
| Get New Results | Botão de reexecutar/atualizar | `prof.getResults` |
| Get new results for current element | Tooltip | `prof.getResultsHint` |
| Profile a query without caching (use SQL_NO_CACHE option) | Opção de perfilamento | `prof.noCache` |
| Duration of statement execution, sec. | Cabeçalho/tooltip de coluna | `prof.col.duration` |
| Date of receiving profiling results | Cabeçalho de coluna de histórico | `prof.col.date` |
| Compare changes of STATUS VARIABLES | Opção/aba de comparação | `prof.statusVars` |
| Several queries cannot be profiled at the same time. | Erro de múltiplas consultas | `prof.err.multi` |
| Are you sure you want to clear profiling history? | Confirmação | `prof.clearConfirm` |
| Do you want to remove selected profiling results? | Confirmação | `prof.removeConfirm` |
| General Query profiler options. | Descrição das opções | `prof.options.desc` |
| Cannot generate Execution Plan | Título de erro do plano | `prof.err.planTitle` |
| Cannot generate execution plan for current statement. | Erro do plano | `prof.err.plan` |
| Display Estimated Execution Plan | Comando Explain | `prof.cmd.explain` |
| Query History / Show Query History | Janela/comando de histórico | `hist.title` |
| Clear Query History | Comando | `hist.clear` |
| You are about to delete all records in your query history. Are you sure you want to continue? | Confirmação | `hist.clearConfirm` |
| Store query history | Opção de retenção | `hist.store` |
| Query history storage file was corrupted... a new one was created. | Aviso de recuperação | `hist.warn.corrupt` |
