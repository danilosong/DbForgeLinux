# UX 09 — Query Builder

Reusa `01-shell.md` (tokens/componentes), `03` (DataGrid, CodeEditor). Legenda: **[C]** CONFIRMADO em doc pública; **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (seção SQL Development > Query Builder) e https://www.devart.com/dbforge/mysql/studio/query-builder.html. Nota: a busca web retornou resumos com citações via redirecionamento; as páginas exatas não foram abertas uma a uma. Itens marcados [C] constam dos resumos; o restante é [I] e deve ser conferido contra o produto.

## 1. Entradas
- Start Page > SQL Development > Query Builder [C]; toolbar principal [C]; Explorer > tabela(s) > **Send to > Query Builder** [C]; menu SQL > New Query Builder [I]. Atalho sugerido: Ctrl+Alt+Q [I].
- Abre documento em aba (ícone de diagrama). Suporta SELECT, INSERT, UPDATE, DELETE [C].

## 2. Layout
```
+ Aba: [Query1 (Builder)] ----------------------------------------+
| Toolbar: [Execute F5] [Stop] [Validate] [Format] | [Statement ▾]  |
|  [Add Table…] [Auto Layout] [Zoom -/+/Fit] | [Open in SQL Editor] |
+---------------------------------------------+--------------------+
| Canvas (diagrama): tabelas/views como       | Toolbox (dock):    |
|  cartões; linhas de join                    |  tabelas arrastáveis|
|                                             |  (opcional)        |
+---------------------------------------------+--------------------+
| Abas inferiores: [Selection][Where][Group By][Having][Order By]   |
|                  [Subqueries/CTE*]                                |
+-------------------------------------------------------------------+
| Visões do documento (abas na base): [Diagram][Text][Data]         |
+-------------------------------------------------------------------+
```
Três visões: **Diagram**, **Text** (SQL gerado, editável — edição manual reflete no diagrama quando parseável, senão banner "SQL não pôde ser representado visualmente") e **Data** (resultado) [C]. Divisor entre canvas e abas inferiores arrastável.

## 3. Canvas
- Adicionar objeto: arrastar do Database Explorer [C], botão Add Table (diálogo com busca multi-seleção), duplo clique no canvas. Cartão da tabela: título (nome + alias editável), lista de colunas com checkbox [C] (marcar = entra no SELECT), `*` no topo (todas), ícones PK/FK, rolagem se >12 colunas. Menu do cartão: Remove, Alias, Select All/None, Open in Table Editor, Add Related Tables (usa FKs e relações virtuais do 10).
- Relações FK já existentes viram **joins automáticos** [C] (linha entre colunas, rótulo do tipo). Criar join manual: arrastar coluna → coluna. Duplo clique na linha ou menu: tipo **INNER/LEFT/RIGHT/FULL(simulado)/CROSS** [C parcial; FULL OUTER via UNION é [I] para MySQL], condição (grid col/operador/col, AND/OR), "Usar relações virtuais" [I].
- Navegação: pan (arrastar fundo ou botão do meio), zoom Ctrl+roda, Fit (Ctrl+0), seleção múltipla com retângulo, Delete remove, setas movem (1px; Shift 10px), **Auto Layout** [I]. Minimapa opcional [I].

## 4. Abas inferiores
- **Selection:** grid (✓ | Expression/Column | Alias | Aggregate (None/SUM/COUNT/AVG/MIN/MAX/COUNT DISTINCT) | Sort | Sort order | Group) [C agregados]. Reordenar por arrastar; "Distinct" e "Top/Limit N" como controles acima.
- **Where / Having:** lista de condições com botão **+** verde [C]: Coluna | Operador (=, <>, >, <, >=, <=, LIKE, IN, BETWEEN, IS NULL, NOT…) | Valor (literal, parâmetro `?`/`@var`, outra coluna) | conector AND/OR; grupos com parênteses (recuo por arrastar) [I]. Árvore de condições alternativa em modo avançado [I].
- **Group By / Order By:** grids simples [I].
- **Subqueries:** subconsulta como tabela derivada ou em condição [C]: botão "Add Subquery" abre sub-canvas em aba aninhada com breadcrumb `Main > Sub1`; CTE (MySQL 8+) [I].
- **INSERT/UPDATE/DELETE:** modo selecionado em [Statement ▾]; UPDATE: grid de SET (coluna = valor); INSERT: valores/ SELECT; DELETE: só WHERE. Execução destrutiva sem WHERE exige confirmação (regra 02/03).

## 5. Estados
| Estado | Comportamento |
|---|---|
| Vazio | EmptyState "Arraste tabelas do Database Explorer" + [Add Table] |
| Loading metadados | Cartão com skeleton das colunas |
| Execução | Mesma regra de 03 §2.3; resultado na visão Data [C] |
| Erro SQL | Banner vermelho + foco em Messages; colunas/condições problemáticas com borda vermelha |
| Sucesso | `120 rows · 0.042 s` no rodapé da visão Data |
| Sem conexão | Banner "Selecione uma conexão" + seletor na toolbar |

## 6. Atalhos
Execute F5; Format Ctrl+K Ctrl+D; Add Table Ctrl+T; alternar visões Ctrl+1/2/3 [I]; Fit Ctrl+0; Remover Delete; Desfazer Ctrl+Z (modelo do builder, ilimitado na sessão).

## 7. Temas / acessibilidade
Tokens 01 §9. Linhas de join usam text.secondary e destaque accent ao hover/seleção; tipo de join identificado por texto/ícone, não só cor. Canvas navegável por teclado (Tab percorre cartões, setas movem foco entre colunas, Enter edita join). Modo "lista" alternativo ao canvas (árvore de tabelas e joins) para leitores de tela [I].

## 8. Componentes
Canvas (pan/zoom/seleção), TableCard, JoinLine/JoinDialog, ConditionRow/ConditionGroup, SelectionGrid, ViewTabs, SubqueryBreadcrumb, CodeEditor, DataGrid.

## 9. Critérios de aceite
- Montar um SELECT com 3 tabelas, joins, WHERE, GROUP BY/HAVING e ORDER BY só com mouse, vendo o SQL ao vivo.
- Edição no texto sincroniza com o diagrama (ou avisa).
- Execução mostra dados na visão Data; INSERT/UPDATE/DELETE gerados e protegidos.
- Claro/escuro, teclado, estados loading/erro/sucesso.
