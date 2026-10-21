# UX 04 — Table Editor e Grid de Edição de Dados

**Fidelidade REA & Observação VM:** rótulos conferidos contra REA ui-text e **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas em `re/original-observation/04-sql-editor/resultado.png` e varredura completa em `re/original-observation/p2-02-table-designer/`).
- **[C] Sub-abas reais do Table Designer (`p2-02-table-designer/06-37`):** General, Constraints, Indexes, Options, Triggers, Partitioning, Data, SQL (+ ícone verde de compilar/validar).
- **[C] Rodapé de Ações:** `[Refresh Object]`, `[Apply Changes]`, `[Script Changes ▾]` com opções "To New SQL Window (Shift+Alt+C)" e "To Clipboard" (`re/original-observation/p2-02-table-designer/18-script-changes-dropdown-1818.png`).
- **[C] Validações de Coluna em Tempo Real:** Marcar PK força e desabilita Not Null (`16-pk-clicked-1818.png`). Marcar Auto Increment desabilita a opção nas demais colunas (`25-cnt-autoinc-1820.png`, `26-cnt-autoinc-second-click-1820.png`). Nome duplicado exibe ícone de erro vermelho na célula e tooltip "Column '{name}' already exists." (`27-duplicate-column-name-1820.png`), bloqueando Apply (`28-apply-with-duplicate-1820.png`).
- **[C] Menu de Contexto da Coluna (`30-column-context-menu-1821.png`):** New column Insert, Insert column, Find column, Move column up Ctrl+Up, Move column down Ctrl+Down, Remove column Ctrl+Delete.
- **[C] Diálogo de Refactoring (`35-script-changes-output-1822.png`):** "Some objects were renamed. Do you wish to start refactoring to make appropriate modifications in the dependent objects?" (Yes / No / Cancel).

Reusa tokens/componentes de `01-shell.md`; abre como documento em aba (ícone tabela). Entrada: Explorer > Tabela > "Edit Table" (Enter/F4 com foco na tabela) ou Create > Table (modo novo).

## 1. Layout

```
+ Aba: [customers] ----------------------------------------------------+
| Toolbar: [Apply Changes Ctrl+S] [Discard] [Refresh F5] | [Add Column] |
|  [Delete] [Up] [Down] | Banner de estado (pendente/erro)              |
+---------+-------------------------------------------+----------------+
| Nav     |  Página selecionada                       | Preview DDL    |
| vertical|                                           | (painel dir.,  |
| Columns |                                           |  colapsável)   |
| Indexes |                                           |  somente leit. |
| FKs     |                                           |                |
| Check   |                                           |                |
| Triggers|                                           |                |
| Options |                                           |                |
| Partit. |                                           |                |
| DDL     |                                           |                |
| Data    |                                           |                |
+---------+-------------------------------------------+----------------+
```
Campos de topo (acima das páginas): Name (obrigatório, ≤64 chars), Database (somente leitura), Engine, Comment. Nav 130px; preview DDL 340px (min 240), alternável com Ctrl+Alt+D; em larguras <1100px vira a página "DDL".

Modelo de edição: alterações ficam **pendentes** (não vão ao servidor) até Apply. Aba mostra "•"; células/linhas alteradas ganham destaque (novo=verde 15%, alterado=âmbar 15%, removido=vermelho 15% riscado — tokens status.*).

## 2. Páginas do Editor de Tabela

### 2.1 Columns
Grid editável (mesmo DataGrid de 03): colunas da grade:
| Coluna | Controle | Notas |
|---|---|---|
| # / ícones | PK (chave), FK, AI | clique alterna PK |
| Name | texto | obrigatório, único na tabela |
| Data Type | combo editável | lista MySQL (INT, VARCHAR, DECIMAL, DATETIME, JSON, ENUM…), autocompleta |
| Length/Precision/Scale | texto `(10,2)` | validado por tipo; ENUM/SET abre editor de valores |
| Unsigned / Zerofill | checkbox | só numéricos |
| Not Null | checkbox | PK força marcado |
| Auto Increment | checkbox | só um por tabela e deve ser chave |
| Default | combo (NULL, CURRENT_TIMESTAMP, expressão, literal) | aspas automáticas |
| Charset / Collation | combos | só texto |
| Generated | None / VIRTUAL / STORED + expressão | |
| Comment | texto | |
Painel de detalhe abaixo da grade espelha a coluna selecionada em formulário (útil para ENUM, generated, comentários longos). Ações: Add (Ctrl+Insert), Delete (Delete; confirma se tem FK/índice dependente e lista dependências), Move Up/Down (Alt+↑/↓; gera `AFTER`), Duplicate. Drag para reordenar. Renomear coluna preserva identidade (gera `CHANGE`).
Validações inline (borda vermelha + tooltip + Error List): nome duplicado/vazio/palavra reservada sem crases (aviso), tipo inválido, default incompatível, AI sem chave, PK nula.

### 2.2 Indexes
Lista à esquerda (Name, Type, Columns resumo), detalhe à direita. Tipo: PRIMARY, UNIQUE, INDEX, FULLTEXT, SPATIAL. Detalhe: Name, Type, Method (BTREE/HASH), Comment, Visible (checkbox), grid de colunas do índice (Column | Order ASC/DESC | Length prefix) com Add/Remove/Up/Down e seletor de coluna da tabela. Validação: índice sem colunas, nome duplicado, FULLTEXT em tipo inválido, PRIMARY duplicado.

### 2.3 Foreign Keys
Lista (Name, Columns, Ref. table, ON DELETE, ON UPDATE). Detalhe: Name; Referenced database/table (combo, carrega lazy do Explorer — estado loading); mapeamento coluna local → coluna referenciada (grid, par por linha, tipos devem ser compatíveis: aviso âmbar se não); ON DELETE/ON UPDATE: RESTRICT, CASCADE, SET NULL, NO ACTION (SET DEFAULT oculto: InnoDB não suporta). Erros típicos mostrados antes do Apply: tipos incompatíveis, referenciada sem índice, SET NULL em coluna NOT NULL.

### 2.4 Check Constraints
Lista (Name, Expression, Enforced). Detalhe: Name, Expression (mini editor Monaco de 1 linha com autocomplete de colunas), Enforced (checkbox). Desabilitada com banner "Requer MySQL 8.0.16+/MariaDB 10.2+" quando versão inferior.

### 2.5 Triggers
Lista dos triggers da tabela (Name, Timing BEFORE/AFTER, Event INSERT/UPDATE/DELETE). [New] [Edit] [Drop]; Edit/New abrem o Editor de Trigger (05) em nova aba (não editados inline). Estado vazio: "Nenhum trigger".

### 2.6 Options
Engine, Row format, Auto-increment inicial, Default charset/collation, Comment, Min/Max rows, Avg row length, Checksum, Delay key write, Stats (persistent/sample pages), Tablespace, Union (MyISAM merge). Campos não aplicáveis ao engine ficam desabilitados com tooltip.

### 2.7 Partitions
Seletor "Partition by": None | RANGE | LIST | HASH | KEY | LINEAR HASH/KEY + expressão/colunas + nº de partições (HASH/KEY). Para RANGE/LIST: grid (Name | Values less than / IN | Engine | Comment) com Add/Remove/Move, subpartições (P2). Aviso quando a PK não inclui as colunas de particionamento ("Todas as chaves únicas devem incluir a coluna de particionamento"). Dados existentes: aviso "Reparticionar reorganiza a tabela e pode ser demorado".

### 2.8 DDL
Editor Monaco somente leitura. Alterna: **CREATE TABLE** (estado atual completo) e **ALTER TABLE (alterações pendentes)** (modo padrão em tabelas existentes). Botões: Copy, Open in SQL Editor, Save to file. Atualiza com debounce de 300ms; indicador "Calculando…" curto; erro de validação → painel substitui por lista de problemas ("Corrija 2 erros para ver o DDL").

### 2.9 Data (Grid de Edição Inline) [C: observado na VM]
Embute o grid Table Data de 03 §4.4 com suporte a:
- **Modos de Visualização:**
  - Grade clássica horizontal tabular (linhas e colunas com redimensionamento e reordenação).
  - Modo Cartão Vertical (**Card View**): exibe registro individual verticalmente, facilitando análise de tabelas largas com 50+ colunas.
- **Edição Inline de Células:**
  - `F2` ou duplo-clique entra no modo edição.
  - Inserção de nova linha via `Ctrl+Insert`.
  - Exclusão via `Delete`.
  - Atribuição de valor nulo com `Set NULL` ou atalho `Ctrl+0`.
  - Destaque cromático por estado: verde (novos registros), âmbar (células modificadas), vermelho riscado (linhas marcadas para exclusão).
- **Apply Changes (`Ctrl+S`) e Discard:**
  - Operação atômica em transação contra o servidor.
  - Rollback e restauração de valores originais em caso de erro (ex.: chave duplicada).
- **Segurança e Bloqueio de Edição (Read-only):**
  - Tabelas sem chave primária ou consultas derivadas (`JOIN`) recebem banner explícito: "Table has no primary key: direct editing is disabled".

## 3. O que o TuxSQL ainda NÃO faz no Grid (Diferenças Objetivas em relação ao Original)
1. **Visualizador Espacial GIS Vetorial (Pendente):** No original, a aba "Spatial" do Cell Viewer renderiza mapas vetoriais interativos para colunas geométricas (`GEOMETRY`, `POINT`, `POLYGON`). No TuxSQL os dados são apresentados em formato textual WKT ou binário Hex.
2. **Tabela Dinâmica Integrada (Pivot Table interativa no grid) (Pendente):** No original há um modo dinâmico onde colunas e linhas podem ser arrastadas para cruzar dados diretamente sobre o resultado da consulta. No TuxSQL o cálculo de agrupamentos analíticos ocorre via utilitário `quickPivot`, mas sem o canvas visual drag-and-drop.
3. **Navegação Síncrona Master-Detail no Grid (Pendente):** O original permite conectar duas tabelas por chave estrangeira em painéis superior e inferior síncronos (clicar em um cliente carrega automaticamente seus pedidos). O TuxSQL renderiza grids independentes.
4. **Construtor Visual de Filtros Complexos (Pendente):** O original possui uma janela de diálogo com construtor em árvore para operadores lógicos (AND, OR, NOT, BETWEEN, IN) aplicados ao grid. O TuxSQL aplica filtros rápidos por texto e operadores básicos de coluna.

## 4. Apply Changes (fluxo)
1. Ctrl+S / Apply: valida; erros bloqueiam e focam o primeiro.
2. Diálogo "Apply Changes" com o ALTER gerado (somente leitura), checkbox "Executar em uma transação quando possível" (nota: DDL do MySQL faz commit implícito), avisos destrutivos (DROP COLUMN, redução de tamanho/tipo → "Pode causar perda de dados", MODIFY em tabela grande → "pode bloquear a tabela"), botões [Apply] [Copy SQL] [Cancel]. Conexão Prod: exige digitar o nome da tabela.
3. Loading: botão "Applying…" + progresso indeterminado; cancelamento não disponível após envio (nota).
4. Sucesso: toast verde "Tabela `customers` alterada", pendências limpas, Explorer atualizado, Output registra o SQL.
5. Erro: banner vermelho na aba com `Error 1215 …`, nada é perdido (alterações continuam pendentes), [Ver SQL] [Copiar erro]. Em falha parcial (statement N de M) mostra quais foram aplicados e recarrega a estrutura do servidor com opção [Recarregar].
Fechar com pendências: diálogo Save/Discard/Cancel. Tabela alterada externamente (detectado no Refresh/Apply): banner âmbar "A tabela mudou no servidor. [Recarregar] [Manter minhas alterações]".
Modo "Create": botão rotulado "Create Table"; DDL = CREATE TABLE.

## 5. Estados
| Estado | Comportamento |
|---|---|
| Loading estrutura | Skeleton nas páginas + spinner na aba |
| Erro de carga | InlineErrorPanel com [Tentar de novo] |
| Sem permissão ALTER | Aba em modo leitura, banner "Sem privilégio ALTER" |
| Conexão read-only | Idem, Apply desabilitado |
| Pendente | "•" na aba, Apply/Discard habilitados |
| Sucesso | toast + limpar destaques |

## 6. Atalhos
| Ação | Atalho |
|---|---|
| Apply | Ctrl+S |
| Descartar | Ctrl+Z (nível de página) / botão Discard |
| Adicionar linha à lista atual | Ctrl+Insert |
| Remover | Delete |
| Mover | Alt+↑ / Alt+↓ |
| Próxima/anterior página | Ctrl+PgDn / Ctrl+PgUp |
| Preview DDL | Ctrl+Alt+D |
| Refresh | F5 |

## 7. Temas e acessibilidade
Tokens de 01 §9; destaques por mistura status.* a 15%; legendas não dependem só de cor (ícones +, ✎, ✕ na primeira coluna). Grades navegáveis por teclado (role grid), erros ligados por aria-describedby.

## 8. Componentes
SideNavTabs, EditableGrid (com validação por célula), MasterDetailList (lista + detalhe), TypeCombo, ColumnPicker, SplitPreview (DDL), ApplyChangesDialog, DependencyWarningDialog, Banner, InlineErrorPanel, Skeleton.

## 9. Critérios de aceite
- Todas as páginas editam o modelo pendente e o DDL ALTER/CREATE reflete cada mudança em até 300ms.
- Validações listadas bloqueiam o Apply com mensagem inline.
- Apply mostra SQL, avisos destrutivos e tem estados loading/sucesso/erro; falha não perde pendências.
- Funciona em claro/escuro e 100% por teclado.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Edit Table | Menu/título da aba | `tbl.edit` |
| Add Column | Toolbar/menu | `tbl.col.add` |
| Columns | Página | `tbl.page.columns` |
| Foreign Keys | Página | `tbl.page.fks` |
| Check Constraints | Página | `tbl.page.checks` |
| Triggers | Página | `tbl.page.triggers` |
| Engine: | Campo/Options | `tbl.field.engine` |
| Character set: / Collation: | Campos de coluna/tabela | `tbl.field.charset` |
| Allow Nulls | Coluna da grade | `tbl.col.allowNull` |
| Auto Increment | Coluna da grade | `tbl.col.autoInc` |
| Add Primary Key | Ação | `tbl.pk.add` |
| Add Foreign Key | Ação | `tbl.fk.add` |
| Add Check Constraint | Ação | `tbl.check.add` |
| Add Unique Key | Ação | `tbl.unique.add` |
| Referenced Table: / Referenced Columns: | Detalhe de FK | `tbl.fk.refTable` |
| Apply Changes | Botão da toolbar | `tbl.apply` |
| Discard Changes | Botão da toolbar | `tbl.discard` |
| A column name field cannot be empty. | Validação de coluna | `tbl.error.colNameEmpty` |
| Do you want to drop column '{0}'? | Confirmação de exclusão | `tbl.confirm.dropColumn` |
| Do you want to drop index '{0}'? | Confirmação de exclusão | `tbl.confirm.dropIndex` |
| Do you want to drop constraint '{0}'? | Confirmação de exclusão | `tbl.confirm.dropConstraint` |
| {1} table engine does not support foreign keys. | Aviso de engine | `tbl.warn.fkEngine` |
| A reference table is not found for the [{0}] foreign key. | Erro de FK | `tbl.error.fkRefMissing` |
| Document '{0}' was modified. Do you want to save changes? | Fechar com pendências | `tbl.confirm.closeDirty` |
| Cannot currently modify this text in the editor. It is read-only. | Estado somente leitura | `common.readOnly` |
