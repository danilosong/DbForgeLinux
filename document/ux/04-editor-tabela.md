# UX 04 — Table Editor

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

## 2. Páginas

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

### 2.9 Data
Embute o grid Table Data de 03 §4.4 (mesmas regras de edição e Apply separado). Aviso se há alterações de estrutura pendentes: "Aplique a estrutura antes de editar dados" (grid em read-only até lá).

## 3. Apply Changes (fluxo)

1. Ctrl+S / Apply: valida; erros bloqueiam e focam o primeiro.
2. Diálogo "Apply Changes" com o ALTER gerado (somente leitura), checkbox "Executar em uma transação quando possível" (nota: DDL do MySQL faz commit implícito), avisos destrutivos (DROP COLUMN, redução de tamanho/tipo → "Pode causar perda de dados", MODIFY em tabela grande → "pode bloquear a tabela"), botões [Apply] [Copy SQL] [Cancel]. Conexão Prod: exige digitar o nome da tabela.
3. Loading: botão "Applying…" + progresso indeterminado; cancelamento não disponível após envio (nota).
4. Sucesso: toast verde "Tabela `customers` alterada", pendências limpas, Explorer atualizado, Output registra o SQL.
5. Erro: banner vermelho na aba com `Error 1215 …`, nada é perdido (alterações continuam pendentes), [Ver SQL] [Copiar erro]. Em falha parcial (statement N de M) mostra quais foram aplicados e recarrega a estrutura do servidor com opção [Recarregar].
Fechar com pendências: diálogo Save/Discard/Cancel. Tabela alterada externamente (detectado no Refresh/Apply): banner âmbar "A tabela mudou no servidor. [Recarregar] [Manter minhas alterações]".
Modo "Create": botão rotulado "Create Table"; DDL = CREATE TABLE.

## 4. Estados

| Estado | Comportamento |
|---|---|
| Loading estrutura | Skeleton nas páginas + spinner na aba |
| Erro de carga | InlineErrorPanel com [Tentar de novo] |
| Sem permissão ALTER | Aba em modo leitura, banner "Sem privilégio ALTER" |
| Conexão read-only | Idem, Apply desabilitado |
| Pendente | "•" na aba, Apply/Discard habilitados |
| Sucesso | toast + limpar destaques |

## 5. Atalhos

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

## 6. Temas e acessibilidade
Tokens de 01 §9; destaques por mistura status.* a 15%; legendas não dependem só de cor (ícones +, ✎, ✕ na primeira coluna). Grades navegáveis por teclado (role grid), erros ligados por aria-describedby.

## 7. Componentes
SideNavTabs, EditableGrid (com validação por célula), MasterDetailList (lista + detalhe), TypeCombo, ColumnPicker, SplitPreview (DDL), ApplyChangesDialog, DependencyWarningDialog, Banner, InlineErrorPanel, Skeleton (todos de 01/03 quando existentes).

## 8. Critérios de aceite
- Todas as páginas editam o modelo pendente e o DDL ALTER/CREATE reflete cada mudança em até 300ms.
- Validações listadas bloqueiam o Apply com mensagem inline.
- Apply mostra SQL, avisos destrutivos e tem estados loading/sucesso/erro; falha não perde pendências.
- Funciona em claro/escuro e 100% por teclado.
