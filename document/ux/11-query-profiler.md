# UX 11 — Query Profiler, Query History e Plano de Execução (EXPLAIN)

Reusa `01-shell.md`, `03` (editor/grid/resultados). **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Query Profiler; SQL Query History) e https://www.devart.com/dbforge/mysql/studio/query-profiler.html. Citações da busca vieram por redirecionamento; páginas individuais não abertas. Fidelidade REA: rótulos conferidos contra REA ui-text.

## 1. Query Profiler

### 1.1 Entrada [C]
No documento SQL: botão **Query Profiling Mode** (toggle na toolbar SQL) → **Execute** → abre o documento/aba **Query Profiler** [C]. Atalho sugerido do toggle: Ctrl+Alt+P [I]. Também menu SQL > Query Profiling Mode. Estado vazio original: "Turn on Query Profiling Mode and execute the current query" ou botão **Get New Results** [C: REA ui-text].

### 1.2 Layout
```
+ Aba: [Profiler: SQL 1] -----------------------------------------+
| Toolbar: [Re-run] [Compare…] [Save Result] [Export] [Open Query]  |
+-------------------------------------------------------------------+
| Cabeçalho: SQL (resumo 1 linha, expandível) | tempo total | linhas |
+-------------------------------------------------------------------+
| Abas: [Profile][Plan][Session Statistics][Query Info*]            |
+-------------------------------------------------------------------+
```
**[C]** abas Profile, Plan e Session Statistics.
- **Profile:** tabela de estágios (SHOW PROFILE — Status | Duration (s) | % | Barra proporcional) ordenada por ocorrência; total no rodapé; maior estágio realçado (âmbar) [I]. Gráfico de barras horizontal opcional [I]. Nota de depreciação: SHOW PROFILE é deprecated no MySQL; em servidores 8.0+ usa Performance Schema (`events_stages_*`) quando disponível [I]; se nenhum disponível, mostra InlineErrorPanel explicando como habilitar (`performance_schema=ON`, `profiling=1`).
- **Plan:** ver §3.
- **Session Statistics:** grade chave/valor com **diferenças** de `SHOW SESSION STATUS` antes/depois da execução (Handler_read_*, Created_tmp_tables, Select_scan, Sort_rows…), só contadores que mudaram por padrão; toggle "Show all"; busca; destaque de valores altos (ex.: Select_full_join >0 âmbar).
- Histórico de execuções do mesmo SQL: lista lateral (timestamp, duração) para comparar [I].

### 1.3 Compare [C: comparação lado a lado]
Selecionar 2 resultados (do histórico lateral ou arquivos salvos `.prof`) → visão dividida com: totais, diferença por estágio (Δ s e Δ %, verde melhora/vermelho piora com ícone ▲▼), diferenças no plano (nós mudados marcados), estatísticas divergentes. Cabeçalhos A/B com SQL e horário.

### 1.4 Estados
| Estado | Comportamento |
|---|---|
| Executando | spinner em cada aba + [Stop]; Plan e Profile aparecem quando prontos |
| Sucesso | abas preenchidas; selo "Tempo total 0.042 s" |
| Erro SQL | aba Messages do documento SQL com o erro; Profiler não abre (toast "Consulta falhou; sem perfil") |
| Sem permissão/recurso | InlineErrorPanel com instruções |
| Statement não perfilável (DDL, múltiplos) | aviso: perfila apenas o primeiro SELECT/DML; pergunta |
Perfilar executa a consulta de verdade (DML altera dados!): diálogo de aviso na 1ª vez e sempre em Prod, com opção "Executar dentro de transação e dar ROLLBACK" [I].

## 2. SQL Query History [C]

### 2.1 Entrada
Toolbar SQL: botão **Query History** [C]; View > Other Windows > SQL Query History [C]. Painel dock (inferior ou direito).

### 2.2 Conteúdo
Lista (grid): Horário | Conexão | Database | Duração | Linhas/Afetadas | Status ✓/✕ | SQL (1ª linha). Painel de detalhe com SQL completo (Monaco read-only) + mensagem de erro se houve.
- **Retenção:** padrão 60 dias, configurável até 365 [C]; limpeza automática na abertura. Armazenamento local (Linux: `$XDG_DATA_HOME/dbforgelinux/history`, SQLite/JSONL) [adaptado de pasta ExecutedQueries; C para o conceito].
- **Busca/Filtro/Ordem/Agrupamento** [C]: texto, período (Hoje/7 dias/Personalizado), conexão, database, só erros, só lentas (> N s); agrupar por dia/conexão/database.
- **Reuso** [C]: duplo clique ou "To New SQL Window" abre em novo documento com conexão original; "Copy", "Profile this query" (abre Profiler), "Delete", "Delete all (com confirmação)", "Pin" [I].
- Segredos: texto das consultas é armazenado como digitado; opção "Não registrar consultas de conexões Prod" e "Mascarar literais de CREATE USER/IDENTIFIED BY" [I] (padrão ligado).
Estados: vazio "Nenhuma consulta registrada"; loading skeleton; erro de leitura do arquivo → banner [Reparar histórico].

## 3. Plano de execução EXPLAIN visual [C: Plan tree/diagram]

Disponível na aba **Plan** do Profiler e no botão **Explain** (Ctrl+E) do editor (abre aba "Plan" nos resultados).
- **Tree view:** árvore hierárquica (EXPLAIN FORMAT=TREE/JSON no 8+, tabular tradicional em versões antigas) com colunas: Operação/Tabela | Tipo de acesso (ALL, index, range, ref, eq_ref, const…) | Key usada | Linhas estimadas | Custo [I] | Filtered % | Extra. Nós problemáticos marcados: full scan (ALL) âmbar; "Using filesort"/"Using temporary" vermelho com tooltip de explicação e sugestão ("Considere índice em (col)").
- **Diagram view [C]:** nós conectados em fluxo (esquerda→direita ou cima→baixo), largura da aresta proporcional às linhas, cor do nó por custo relativo (verde→vermelho, com ícone/valor também). Zoom/pan, clique no nó seleciona e sincroniza com o painel de propriedades à direita (todas as colunas do EXPLAIN daquela etapa).
- Alternância Tree / Diagram / Raw (texto/JSON copiável).
- `EXPLAIN ANALYZE` (8.0.18+): checkbox "Analyze (executa a consulta)" com aviso; mostra tempos reais por nó.
- Estados: loading "Obtendo plano…"; erro (sintaxe, permissão, DML em versão que não suporta EXPLAIN) via InlineErrorPanel; vazio para statements sem plano.

## 4. Atalhos
Explain Ctrl+E; Profiling Mode Ctrl+Alt+P [I]; Re-run F5; Abrir histórico Ctrl+Shift+H [I]; Buscar no histórico Ctrl+F; Alternar Tree/Diagram Ctrl+Alt+T [I]; Comparar Ctrl+Shift+C [I].

## 5. Temas / acessibilidade
Tokens 01; barras com status.* + texto numérico; gravidade por ícone+rótulo; diagrama do plano com alternativa em árvore completa; grids por teclado.

## 6. Componentes
ResultTabs, DataGrid, BarCell (barra proporcional), CompareView, PlanTree, PlanDiagram (reuso do Canvas 09), PropertiesPanel, FilterBar, HistoryList, InlineErrorPanel.

## 7. Critérios de aceite
- Perfilar uma consulta mostra Profile/Plan/Session Statistics; comparar dois perfis mostra deltas; falta de suporte do servidor é explicada.
- Histórico registra, filtra e reabre consultas; retenção configurável.
- Plano visual em árvore e diagrama destaca gargalos; DML perfilado exige confirmação.
- Estados, temas e teclado cobertos.

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
