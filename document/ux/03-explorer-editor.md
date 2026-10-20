# UX 03 — Database Explorer, Editor SQL e Grid de resultados

Depende de `01-shell.md` (tokens/componentes) e `02-conexoes.md` (estados de conexão).

## 1. Database Explorer

### 1.1 Estrutura
Cabeçalho: título + [New Connection] [Refresh F5] [Collapse All] [Filtro 🔍]. Abaixo campo de busca (Ctrl+F com foco no painel): filtra por substring (case-insensitive) nos nós já carregados e destaca o trecho; botão x limpa; "Nenhum resultado para 'xyz'" quando vazio.

Árvore (virtualizada, indent 16px, linha 22px):
```
v [srv] prod-db (MySQL 8.0)            <- conexão (categoria opcional acima)
  v [db] shop                           <- database (ativo em negrito)
    v Tables (24)
        orders
        > customers
          columns / Indexes / Foreign Keys / Triggers (sub-nós)
    > Views (3)
    > Stored Procedures (5)
    > Functions (2)
    > Triggers (4)
    > Events (0)
  > [db] information_schema (sistema, esmaecido; oculto por padrão — opção "Show system databases")
```
Contadores entre parênteses aparecem após carregar. Nós de coluna mostram tipo em texto secundário (`id  int PK`), ícones: PK (chave), FK (chave vinculada), NOT NULL, unique, índice.

### 1.2 Carga preguiçosa e estados
| Estado | Aparência |
|---|---|
| Loading de nó | Chevron vira spinner; filho temporário "Loading…" (cinza) |
| Erro | Filho vermelho "Falha ao carregar: <msg>" + link [Tentar de novo]; erro também no Output |
| Vazio | Filho cinza "(vazio)" |
| Sucesso | Filhos ordenados alfabeticamente (opção: ordem do servidor) |
| Desconectado | Nós filhos recolhidos; expandir pede conectar |
| Sem permissão | Nó com cadeado e tooltip "Sem privilégio para listar" |
Refresh (F5) mantém expansões e seleção. Mudanças de DDL feitas via editor atualizam o nó afetado automaticamente (ou banner "Esquema alterado [Atualizar]").

### 1.3 Interações
- Clique seleciona; duplo clique: tabela/view → abre dados (Table Data); procedure/function → abre definição; database → define como ativo; conexão → conecta/expande.
- Setas ←→ recolhe/expande, ↑↓ navega, Home/End, Enter = ação do duplo clique, F2 renomear (P1), Delete = excluir (confirmação), Ctrl+C copia nome, digitação rápida (type-ahead).
- Arrastar nó para o editor insere nome com crases quando necessário (`` `tabela` ``); arrastar tabela com Alt insere `SELECT * FROM`.
- Seleção múltipla (Ctrl/Shift) para tabelas do mesmo tipo.
- Tooltip (500ms): tipo, nome completo, engine/linhas aprox./comentário.

### 1.4 Menu de contexto
**Conexão:** Connect / Disconnect, New SQL (Ctrl+N), Refresh, Edit Connection… (F2), Duplicate, Delete, Properties.
**Database:** Set as Active Database, New SQL, Refresh, Create > Table/View/Procedure/Function/Trigger/Event (abre template no editor SQL; designers visuais em P1), Drop Database…, Copy Name.
**Tabela:** Select Top 1000 Rows (abre Table Data), New SQL (com `SELECT * FROM`), Show Create Table (DDL em novo editor, somente leitura), Copy Name, Copy As > CREATE / INSERT (P1), Refresh, Truncate Table…, Drop Table… (itens destrutivos em vermelho, separador acima; confirmação com nome), Properties (painel).
**View/Procedure/Function/Trigger/Event:** Open/Show Create, Copy Name, Drop… , Refresh.
**Coluna:** Copy Name, Properties.
Itens desabilitados se conexão read-only (destrutivos).

### 1.5 Painel Properties (F4, P1)
Tabela chave/valor do nó selecionado (engine, collation, linhas aprox., tamanho, criação, comentário). Somente leitura em v1.

## 2. Editor SQL (Monaco)

### 2.1 Documento
Aba conforme 01. Corpo: **editor** (topo) + **splitter** + **painel de resultados** (base, 40% altura, Ctrl+Shift+R alterna; maximizar com duplo clique na aba de resultados). Gutter: números de linha, marcadores de erro, folding. Minimap desligado por padrão. Barra de execução usa toolbar SQL de 01.

### 2.2 Comportamentos
- Realce de sintaxe MySQL com tokens de 01; palavras-chave em maiúsculas opcional.
- Autocomplete (Ctrl+Space, também ao digitar `.`): lista com ícone por tipo (database, tabela, coluna, função, keyword, snippet), detalhe lateral (tipo da coluna, tabela). Contextual ao alias/FROM; carrega metadados do Explorer em cache; estado "Carregando…" ao pedir colunas não cacheadas.
- Snippets (prefixo + Tab), Format SQL (Ctrl+K Ctrl+D) com resultado imediato; desfazer único.
- Comentário Ctrl+/; duplicar linha Ctrl+Shift+D; mover linha Alt+↑/↓; multi-cursor Ctrl+Alt+↑/↓ (ou Alt+clique).
- Localizar/Substituir embutido (Ctrl+F/Ctrl+H): barra no canto superior direito com opções Aa, ab (palavra), .* (regex), contador "3 de 12".
- Delimiter: ponto-e-vírgula; suporte a `DELIMITER //` para rotinas.
- Squiggles: erro sintático (vermelho), aviso (âmbar) com hover explicativo; refletem em Error List.
- Quebra de linha desligada por padrão; fonte configurável; zoom Ctrl+roda.

### 2.3 Execução
| Ação | Regra |
|---|---|
| Execute (F5/Ctrl+Enter) | Se houver seleção → executa seleção; senão todo o script |
| Execute Current Statement (Ctrl+Shift+Enter) | Statement sob o cursor (delimitado por `;`) |
| Stop (Shift+F5) | Envia KILL QUERY; botão vira "Cancelando…" |
Sem conexão ativa: diálogo "Selecionar conexão" (lista) ou banner "Nenhuma conexão. [Conectar]". Statements destrutivos sem WHERE em conexão Prod/read-only: confirmação (ver 02). Vários statements: executa em sequência, uma aba de resultado por SELECT; em erro, pergunta (config.) [Parar] [Continuar] [Sempre continuar]; padrão Parar e posiciona cursor no erro.

Estados no documento:
- **Executando:** botão Execute desabilitado, Stop habilitado, barra de progresso indeterminada de 2px no topo do painel de resultados, cronômetro na status bar; editor continua editável mas execução usa snapshot do texto.
- **Sucesso:** aba Messages mostra `OK · 120 rows · 0.042 s` (verde); status bar atualizada.
- **Erro:** aba Messages foca automaticamente: ícone vermelho, `Error 1064 (42000): ...`, linha/coluna; clique salta ao local no editor; Error List recebe entrada.

## 3. Painel de resultados

Abas inferiores (nível 2): **Result 1 … Result N** (um por SELECT/SHOW/EXPLAIN com colunas), **Messages**, **Execution Plan/Explain** (P1), **History** (P2). Aba fixa com 📌 impede ser substituída na reexecução; sem fixar, reexecução substitui o conjunto. Rótulo da aba: `Result 1 (120)`. Menu de contexto da aba: Pin, Close, Close Others, Export… (P1).

Rodapé do painel (barra de 24px): `120 rows · 0.042 s · fetched 120/120` | botões [Load more] (quando paginado) | [Export ▾] | [Copy ▾] | filtro rápido.

Paginação/streaming: busca inicial 1000 linhas (configurável); rolar até o fim ou [Load more] busca mais; contagem "1000+" até conhecida; LIMIT automático opcional (Options) com aviso "Resultado limitado a 1000 linhas".

Resultados sem colunas (INSERT/UPDATE/DDL): somente Messages com "Affected rows: N", "Last insert id", tempo, warnings (link "Show Warnings").

## 4. Grid de dados

### 4.1 Aparência
Cabeçalho 28px (nome da coluna em semibold + tipo em texto pequeno secundário, ícone de PK/ordenação); linhas 22px; zebra sutil (bg.surfaceAlt); coluna de número de linha à esquerda (cinza, 48px, clicável para selecionar linha); grade horizontal/vertical 1px border.default. Largura inicial: auto por conteúdo (mín. 60, máx. 360px, amostra de 100 linhas); duplo clique na borda do cabeçalho = auto-fit; arrastar redimensiona; arrastar cabeçalho reordena (visual, não afeta query).

### 4.2 Formatação de valores
| Tipo | Exibição |
|---|---|
| NULL | `NULL` em itálico, cor grid.null |
| Número | alinhado à direita, fonte mono; separador de milhar opcional |
| Texto | alinhado à esquerda, truncado com … ; tooltip com valor completo (até 2000 chars) |
| Data/hora | ISO local `2026-10-20 01:37:22`; sem conversão de fuso salvo configuração |
| Boolean/TINYINT(1) | ✓ / ✗ (opção) |
| BLOB/BINARY | `[BLOB 12 KB]` (hex abreviado via Viewer); botão ▸ abre visualizador (texto/hex/imagem) |
| JSON | texto compacto; duplo clique abre viewer com pretty-print e colapso |
| Texto longo / multilinha | primeira linha + `⏎`; Viewer em painel (Shift+Enter / F2 no modo edição) |

### 4.3 Seleção, navegação, cópia
- Seleção de célula/intervalo/linhas/colunas (clique no número da linha ou cabeçalho; Ctrl+A tudo). Navegação: setas, Tab/Shift+Tab, PgUp/PgDn, Ctrl+Home/End.
- Copiar Ctrl+C: TSV; Ctrl+Shift+C: com cabeçalhos; menu "Copy As": CSV, JSON, SQL INSERT, Markdown, nomes de coluna.
- Ordenação: clique no cabeçalho alterna ASC/DESC/nenhum (setas ▲▼ + índice em multi-sort com Shift+clique). Em resultado de query: ordena localmente quando totalmente carregado; senão oferece "Reordenar no servidor" (reexecuta com ORDER BY — apenas para Table Data).
- Filtro rápido (Ctrl+F no grid): busca em células visíveis; filtro por coluna (ícone funil no cabeçalho: contém/igual/começa/>,<, é NULL) em Table Data → gera WHERE no servidor.
- Menu de contexto: Copy, Copy with Headers, Copy As…, Select Row, Set NULL (edição), Filter by this value, Open in Viewer, Refresh.

### 4.4 Table Data (edição, P0 leitura / P1 edição)
Aberto via duplo clique em tabela. Toolbar do documento: Refresh | Insert Row | Delete Row | Post/Apply | Cancel | Filter | Row limit | Export. Edição: F2/duplo clique/digitar; Enter confirma, Esc reverte célula; linhas alteradas ficam em destaque âmbar claro; novas em verde claro; excluídas riscadas em vermelho claro; botão **Apply** (Ctrl+S) executa batch em transação e mostra resumo ("3 updated, 1 inserted"); **Cancel** descarta. Requer PK/unique: sem chave → grid somente leitura com banner "Tabela sem chave primária: edição desabilitada". Erros por linha (ex.: duplicate key) marcam a célula/linha em vermelho com tooltip e não aplicam o lote (rollback), mantendo as alterações pendentes.

### 4.5 Estados do grid
| Estado | Aparência |
|---|---|
| Loading | Skeleton de 8 linhas + spinner; colunas aparecem assim que o cabeçalho chega |
| Vazio (0 rows) | Cabeçalho visível + mensagem central "Nenhuma linha retornada" |
| Sucesso | Dados + rodapé |
| Erro | Substitui o grid por painel de erro (ícone, mensagem, código, [Tentar de novo] [Ver no Editor]) |
| Cancelado | Mensagem "Execução cancelada" âmbar; dados parciais mantidos com selo "parcial" |
| Muito grande | Aviso "Mostrando as primeiras N linhas" + [Load more] |
Performance: virtualização de linhas e colunas; 100 mil linhas em memória sem travar a UI; larguras de coluna calculadas apenas sobre amostra.

## 5. Atalhos específicos

| Contexto | Ação | Atalho |
|---|---|---|
| Explorer | Atualizar / Filtrar / Abrir / Renomear / Excluir | F5 / Ctrl+F / Enter / F2 / Delete |
| Editor | Autocomplete / Formatar / Comentar | Ctrl+Space / Ctrl+K Ctrl+D / Ctrl+/ |
| Editor | Executar / Atual / Parar | F5 / Ctrl+Shift+Enter / Shift+F5 |
| Editor | Ir para linha / Duplicar linha / Mover linha | Ctrl+G / Ctrl+Shift+D / Alt+↑↓ |
| Resultados | Alternar painel / Próxima aba de resultado | Ctrl+Shift+R / Ctrl+Alt+PgDn |
| Grid | Copiar / Com cabeçalhos / Localizar / Viewer | Ctrl+C / Ctrl+Shift+C / Ctrl+F / Shift+Enter |
| Table Data | Aplicar / Cancelar / Inserir linha | Ctrl+S / Esc / Ctrl+Insert |

## 6. Temas

Todos os elementos usam tokens de `01-shell.md` §9. Específicos: linha selecionada do grid = bg.selected; célula editada = borda 2px accent.primary; linha alterada/nova/excluída usam mistura de status.warning/success/error a 15% de opacidade; squiggles com status.error/warning. Monaco com temas custom `dbforge-light`/`dbforge-dark` mapeando syntax.*. Contraste AA em ambos.

## 7. Adaptações Linux

Copy/paste: área de transferência CLIPBOARD (Ctrl+C/V) e PRIMARY (seleção do mouse + botão do meio no editor, ativado por padrão no Linux). Fontes monoespaçadas do fontconfig. Scroll com roda com suavização do sistema; Shift+roda = horizontal. Arrastar arquivos `.sql` da gerenciadora para a janela abre em novo editor (DnD via XDND). Abertura de exportações: `xdg-open`. Atalhos conflitantes com DE evitados (ver 01 §10).

## 8. Componentes novos desta tela

TreeView (virtualizado, lazy, type-ahead), TreeNodeStatus, ContextMenu, CodeEditor (wrapper Monaco + temas + completion provider), FindWidget, ResultTabs (fixar/fechar), DataGrid (virtualizado, colunas redimensionáveis/reordenáveis, seleção em intervalo, edição inline), CellRenderer (por tipo), CellViewer (texto/JSON/hex/imagem), GridFooter, ConfirmDestructiveDialog (digitar nome), InlineErrorPanel, Skeleton.

## 9. Critérios de aceite

- Árvore carrega por nível, mostra loading/erro/vazio e mantém estado após Refresh.
- F5 executa seleção ou script; múltiplos resultados em abas; Stop cancela e sinaliza.
- Grid exibe todos os tipos da §4.2, ordena, copia em TSV/CSV/JSON, e lida com 100k linhas sem congelar.
- Erros de SQL levam o cursor à linha/coluna e aparecem em Messages e Error List.
- Claro/escuro idênticos em funcionalidade; navegação completa por teclado.
