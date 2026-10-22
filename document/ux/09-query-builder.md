# UX 09 — Query Builder

> Fidelidade REA & Observação VM: rótulos conferidos contra REA ui-text e **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas completas em `re/original-observation/04-query-builder/` e `re/original-observation/10-tools-options/`).
- **[C] Estrutura e Vistas (`04-query-builder/01-new-query-1745.png`):** Documento `Query3.sql` com vistas inferiores `Query Builder | Text | (+)`, área de desenho com *"You can drag objects from Database Explorer here."*, ícone SELECT, abas inferiores `Selection | Joins | Where | Group By | Having | Order By`, botões Distinct, Move Up/Down, grade Column/Alias/Table/Aggregate/Order By/Where, zoom.
- **[C] Menus Globais Dinâmicos (`02-menu-layout-1745.png`, `03-menu-query-1745.png`):** Menus `Layout` (Align, Make Same Size, Spacing) e `Query` (Execute F5, Change Type, Create Subquery) inseridos entre Comparison e SQL.
- **[C] Cartões de Tabela e JOIN Automático (`06-two-tables-dropped-1746.png`):** Tabelas `orders` e `customers` arrastadas com linha ortogonal de join desenhada automaticamente via FK (`orders.customer_id → customers.id`), linha `*(All Columns)` e linha adicionada na Selection.
- **[C] Aba Joins e Aba Text (`07-joins-tab-1746.png`, `08-text-tab-1746.png`):** Árvore de joins com botões (+) e (x); aba Text com SQL formatado em degraus e palavras-chave maiúsculas.
- **[C] Subqueries Visuais (`09-create-subquery-1746.png`):** `Query > Create Subquery` cria abas internas `Root Query | SubQuery` com botão de fechar e sub-canvas dedicado.
- **[C] Configurações Padrão de Options (`10-tools-options/21-query-builder-1804.png`):** Workspace: `[x] Enable shadows`, `[x] Enable grid`, `Grid size: 8`, `[x] Snap to grid`.

Reusa `01-shell.md` (tokens/componentes), `03` (DataGrid, CodeEditor).

## 1. Entradas e Documento [I: sessão anterior]
- **Entradas:**
  - Botão **New Query** na toolbar principal (abre documento `Query1.sql` em vista visual Query Builder por padrão).
  - Database Explorer > clique com botão direito em tabela > **Send to > Query Builder**.
  - Menu SQL > **New Query Builder** ou atalho `Ctrl+Alt+Q`.
- **Estrutura MDI do Documento:**
  - Abre como documento com abas de visualização na borda inferior:
    `[Query Builder]  [Text]  [+]` (e aba `Data` quando a consulta for executada com sucesso).
  - Menus contextuais na barra de menus global: ao focar no documento, o sistema insere os menus **Query** e **Layout** entre Database e SQL.

## 2. Layout do Canvas e Painéis [I: sessão anterior]
```
+ Aba: [Query1.sql (Query Builder)] ----------------------------------------------+
| Toolbar: [Execute F5] [Stop] [Validate] [Format] | [Statement ▾] [Add Table]     |
|          [Auto Layout] [Zoom 100% ▾] [Fit] | [Open in SQL Editor]               |
+---------------------------------------------------------------------------------+
| CANVAS (Área de Desenho Visual):                                                |
|                                                                                 |
|  [SELECT]                                                                       |
|  +-------------------+              +-------------------+                       |
|  | orders         [-] |             | customers      [-] |                       |
|  +-------------------+              +-------------------+                       |
|  | [ ] *(All Columns)|              | [ ] *(All Columns)|                       |
|  | [x] id (PK)       |              | [x] id (PK)       |                       |
|  | [x] customer_id(FK)--------◇----->| [ ] name          |                       |
|  | [ ] order_date    |              | [x] email         |                       |
|  +-------------------+              +-------------------+                       |
|                                                                                 |
|  Dica: "You can drag objects from Database Explorer here."                      |
+---------------------------------------------------------------------------------+
| ABAS INFERIORES: [Selection] [Joins] [Where] [Group By] [Having] [Order By]     |
|                                                                                 |
| Grade Selection:                                                                |
| [✓] | Column      | Alias    | Table     | Aggregate | Order By | Where         |
| [x] | id          | order_id | orders    | None      | None     |               |
| [x] | email       |          | customers | None      | Asc (1)  |               |
|                                                                                 |
| Barra de controle: [Distinct ☐]  [Top/Limit: 1000]  [Move Up]  [Move Down]      |
+---------------------------------------------------------------------------------+
| VISTAS INFERIORES: [Query Builder] [Text] [Data]                                |
+---------------------------------------------------------------------------------+
```

## 3. Comportamento do Canvas e Cartões [C: observado na VM]
- **Adição de Objetos:** Arrastar tabelas ou views do Database Explorer e soltar no canvas.
- **Cartão de Tabela:**
  - Barra de título com ícone do objeto, nome da tabela, alias editável e botão de recolher/expandir (`[-]`).
  - Primeira linha fixa: `*(All Columns)` com checkbox.
  - Lista de colunas com checkbox para seleção rápida de projeção.
  - Ícones semânticos de integridade: chave primária (`PK`) e chave estrangeira (`FK`).
- **JOINs Automáticos baseados em Foreign Keys [C]:**
  - Ao arrastar duas tabelas que possuam relação de chave estrangeira (ex.: `orders` e `customers`), a linha ortogonal de JOIN é **desenhada automaticamente** ligando as duas colunas com marcador losango (`orders.customer_id → customers.id`).
  - Duplo-clique na linha de JOIN abre o diálogo de edição do relacionamento: tipo de junção (`INNER JOIN`, `LEFT OUTER JOIN`, `RIGHT OUTER JOIN`, `CROSS JOIN`) e condições de junção (`AND`/`OR`).
- **Navegação do Canvas:** Pan através de arraste com o botão do meio ou fundo, zoom via `Ctrl+Roda`, `Ctrl+0` para enquadramento completo (Fit).

## 4. Abas Inferiores de Configuração [C: observado na VM]
- **Selection:** Grade de projeção contendo `[✓]` | `Column` | `Alias` | `Table` | `Aggregate` (`SUM`, `COUNT`, `AVG`, `MIN`, `MAX`, `COUNT DISTINCT`) | `Order By` | `Where`. Marcar checkboxes no cartão da tabela sincroniza instantaneamente com as linhas desta grade.
- **Joins:** Tabela | Join Type | Condition | Referenced Table.
- **Where / Having:** Construtor de cláusulas de filtro com botão `[+] Add Condition`: Coluna | Operador (`=`, `<>`, `>`, `<`, `>=`, `<=`, `LIKE`, `IN`, `BETWEEN`, `IS NULL`) | Valor/Expressão | Conector lógico (`AND`/`OR`).
- **Group By / Order By:** Definição explícita de agrupamentos e ordem de classificação de resultados.

## 5. Sincronização Bidirecional e Texto SQL [C: observado na VM]
- A alternância para a aba inferior **Text** exibe o código SQL formatado gerado em tempo real com indentação estruturada em degraus:
  ```sql
  SELECT
    orders.id AS order_id,
    customers.email
  FROM orders
    INNER JOIN customers
      ON orders.customer_id = customers.id
  ORDER BY customers.email
  ```
- Edições manuais realizadas no editor SQL da aba **Text** são interpretadas e refletidas de volta no diagrama do Query Builder ao alternar de aba (caso o SQL seja suportado). Comandos não suportados (ex.: scripts com múltiplos statements) exibem banner explicativo.

## 6. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Subqueries Visuais Aninhadas com Breadcrumbs (Pendente):** No original, comandos "Create Subquery" e "Edit SubQuery" criam sub-canvas visuais aninhados com navegação por trilha (`Main > Subquery 1`). No TuxSQL subconsultas são manipuladas via texto SQL.
2. **Auto-Layout Físico em Grafo no Canvas (Pendente):** No original há botão de layout automático que distribui e afasta cartões sobrepostos usando algoritmo de grafo. O TuxSQL requer posicionamento manual dos cartões.
3. **Menus Dinâmicos de Barra de Topo ("Query" e "Layout") (Pendente):** No original a ativação do Query Builder adiciona menus de contexto dedicados no menu bar principal do estúdio. No TuxSQL todas as ações estão consolidadas na toolbar do próprio documento.
4. **Minimapa Vetorial no Canto do Canvas (Pendente):** O original inclui painel flutuante com visão geral em miniatura para navegação rápida em queries com mais de 10 tabelas. O TuxSQL possui zoom/pan direto no canvas.

## 7. Estados de Interface
| Estado | Comportamento |
|---|---|
| Canvas Vazio | Instrução central: "You can drag objects from Database Explorer here." |
| Carregando Colunas | Shimmer skeleton na lista de colunas do cartão recém-adicionado |
| Executando Consulta | Barra de progresso indeterminada no topo e botão Execute desabilitado |
| Sucesso na Execução | Criação/foco na aba inferior Data exibindo o grid de resultados preenchido |
| Erro de Sintaxe SQL | Banner vermelho no topo com detalhe do erro retornado pelo parser |

## 8. Atalhos de Teclado
- Executar Consulta: `F5`
- Formatar SQL: `Ctrl+K, Ctrl+D`
- Adicionar Tabela: `Ctrl+T`
- Enquadrar Diagrama (Fit): `Ctrl+0`
- Alternar Vistas (Builder / Text / Data): `Ctrl+1` / `Ctrl+2` / `Ctrl+3`
- Excluir Objeto/Join Selecionado: `Delete`

### 8.1 Opções de Configuração do Canvas (Tools > Options > Query Builder) [C]
Conforme capturado na VM (`re/original-observation/10-tools-options/21-query-builder-1804.png`), os valores padrão da página **Query Builder > General** são:
- **Workspace:**
  - `[x] Enable shadows`: ativado por padrão (sombras sob os cartões de tabela).
  - `[x] Enable grid`: ativado por padrão (grade de fundo do canvas).
  - `Grid size: 8`: tamanho da grade de alinhamento em pixels (padrão 8).
  - `[x] Snap to grid`: ativado por padrão (alinhamento magnético à grade).

## 9. Temas e Acessibilidade
- Conformidade total com os tokens de design de `01-shell.md`.
- Conectores de join com espessura e marcadores vetoriais nítidos em alto contraste em temas Claro e Escuro.
- Navegação completa por teclado entre cartões, colunas e campos de abas inferiores.

## 10. Componentes
`QueryBuilderCanvas`, `TableCardNode`, `JoinConnectorLine`, `SelectionTabGrid`, `ConditionBuilderGrid`, `GroupByGrid`, `SubqueryBreadcrumbView`, `SyncSqlEditor`.

## 11. Critérios de Aceite
- Permite arrastar tabelas do Database Explorer e criar joins manuais e automáticos baseados em FKs.
- Seleção de colunas e definições de agregação, ordenação e filtros geram SQL válido e executável.
- Sincronização em tempo real entre o diagrama visual e a aba Text.
- Execução do SELECT preenche adequadamente a aba de resultados Data.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Query Builder | Título da aba/janela | `qb.title` |
| Design Query | Comando de abertura do builder | `qb.designQuery` |
| Add Tables/Views / Add Table | Toolbar/Add Table | `qb.addTables / qb.addTable` |
| Add Output Column / Delete Output Column | Aba Selection | `qb.selection.add / qb.selection.delete` |
| Aggregate / Aggregate functions | Coluna da grid Selection | `qb.selection.aggregate` |
| Distinct | Controle Selection | `qb.selection.distinct` |
| Group By | Aba Group By | `qb.groupBy` |
| Add Condition | Botão +, Where/Having | `qb.cond.add` |
| Criteria: | Grid de condições | `qb.cond.criteria` |
| Add Join Condition / Drop Join Condition | Menu da linha de join | `qb.join.addCond / qb.join.dropCond` |
| Change Join Type / Drop Join | Menu da linha de join | `qb.join.changeType / qb.join.drop` |
| A join with these tables already exists | Erro ao criar join duplicado | `qb.err.joinExists` |
| Can not add condition to natural join | Erro de condição | `qb.err.naturalJoinCond` |
| Create Subquery / Edit SubQuery | Menu de subconsulta | `qb.sub.create / qb.sub.edit` |
| Click to open subquery | Tooltip no cartão derivado | `qb.sub.open` |
| Asterisk cannot be used in subqueries without a function. | Erro de validação | `qb.err.asteriskSubquery` |
| Alias cannot be empty | Erro de alias | `qb.err.aliasEmpty` |
| Only SELECT, INSERT, UPDATE or DELETE statement supported in Query Builder. | Banner ao abrir SQL não suportado | `qb.err.stmtUnsupported` |
| Query Builder doesn't support building more than one statement in a script. | Banner ao abrir script | `qb.err.multiStmt` |
| It is impossible to open Query Builder because the query text is invalid (or edition limited). | Banner de SQL inválido | `qb.err.cannotOpen` |
| Qualify column name using table alias | Opção de geração de SQL | `qb.opt.qualifyAlias` |
