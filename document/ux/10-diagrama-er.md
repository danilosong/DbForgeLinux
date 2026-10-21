# UX 10 — Database Diagram, Diagram Overview e Virtual Relation Manager

Reusa `01-shell.md`, `04` (Table Editor) e `09` (Canvas, TableCard). **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Database Design > Database Diagram; View > Other Windows > Virtual Relation Manager) e https://www.devart.com/tuxsql/mysql/studio/database-designer.html. Citações da busca vieram por redirecionamento; páginas individuais não foram abertas: confirmar detalhes. Fidelidade REA: rótulos conferidos contra REA ui-text.

## 1. Entradas
Explorer > database/tabelas > **Send to > Database Diagram** (ou New Database Diagram) [C: arrastar do Explorer]; comando New Database Diagram ("Create an empty database diagram") [C: REA ui-text]. Documento em aba; arquivo de diagrama salvável/aberto (original `*.dbd`, [C: REA ui-text]; clone pode usar formato próprio JSON [I]).

## 2. Layout
```
+ Aba: [Diagram1] -----------------------------------------------+
| Toolbar: [Select][Hand] [Table][View][Note][Container][Relation] |
|  | [Auto Layout] [Align ▾][Zoom][Fit] | [Export Image ▾][Print]  |
|  | [Show: Columns ▾ (Names|Names+Types|Keys only)] [Virtual Rel.] |
+------------------------------------------------+----------------+
| Canvas                                          | Diagram        |
|   cartões de tabela + linhas de relação         | Overview (dock |
|   containers, notas                             | 220px) minimapa|
+------------------------------------------------+----------------+
| Properties (F4) do item selecionado (dock inferior/direito)      |
+------------------------------------------------------------------+
```

## 3. Canvas
- Adicionar: arrastar tabelas/views/database inteiro do Explorer [C]; "Add Related" (expande FKs 1 nível, [I]). Itens: cartões Table/View, **Containers** (Insert Container / New Container) para agrupar objetos relacionados [C: REA ui-text], Notas (post-it texto), linhas de relação.
- Cartão: título (+ database se de outro), colunas com ícones PK/FK/unique, tipo opcional, colapsar/expandir, cor de cabeçalho por container [I]. Duplo clique → Table Editor (04) [I].
- **Relações físicas (FK)** aparecem como linhas com notação de cardinalidade (crow's foot ou setas, alternável em Options) [C: visualiza FKs]; seleção mostra tooltip (nome, ON DELETE/UPDATE).
- **Relações virtuais** [C]: linha tracejada com rótulo "virtual" (Virtual Relation Manager / New/Edit Virtual Relation, convertível em FK) [C: REA ui-text]; criar por ferramenta Relation ou arrastando coluna → coluna com Alt [I].
- Layout: Auto Layout (hierárquico/orgânico/ortogonal) [I], alinhar/distribuir, snap-to-grid, ajustar ao conteúdo. Seleção múltipla, copiar/colar itens entre diagramas, Delete remove **apenas do diagrama** (menu separado "Drop from database…" com confirmação forte).
- Edição de esquema a partir do diagrama (P1/[I]): menu do cartão > Add Column, Edit Table; mudanças viram pendentes → [Apply to database] gera ALTER via ApplyChangesDialog (04 §3).

## 4. Diagram Overview (painel dock) [C: painel existe em DefaultLayout]
Minimapa em escala com retângulo de viewport arrastável; clique reposiciona; zoom slider; atualiza em tempo real. Estado vazio: "Sem diagrama ativo". Ocultar via View > Diagram Overview.

## 5. Virtual Relation Manager [C]
Painel dock (View > Other Windows > Virtual Relation Manager [C]; também botão na toolbar do diagrama [C]). Grid de relações virtuais da **conexão/database ativa** (persistidas por conexão, em arquivo local, nunca no servidor):
| Coluna | Conteúdo |
|---|---|
| Name | editável |
| Child table.col(s) | seletor |
| Parent table.col(s) | seletor |
| Comment | editável [C] |
| Status | OK / Inconsistente (coluna inexistente) |
Ações: New, Edit (diálogo com mapeamento de colunas múltiplas), Delete, **Show DDL** [C: gera DDL], **Convert to Foreign Key** [C]: diálogo com ON DELETE/ON UPDATE, nome, prévia do `ALTER TABLE … ADD CONSTRAINT`, aviso de tipos incompatíveis/linhas órfãs ("N linhas violam a relação" com [Ver linhas]); executa via confirmação padrão. Filtros por tabela; busca. Relações virtuais alimentam Query Builder (09) e Documenter (13) [C].
Estados: loading skeleton; vazio "Nenhuma relação virtual" + [New]; erro de leitura do arquivo: banner + [Recriar].

## 6. Estados do diagrama
| Estado | Comportamento |
|---|---|
| Loading | Cartões skeleton com spinner até metadados |
| Objeto removido no servidor | Cartão com borda vermelha tracejada e ícone ⚠ "não existe mais" |
| Diagrama grande (>200 itens) | Aviso de desempenho; virtualização/LOD (esconde colunas em zoom <40%) |
| Salvar | "•" na aba; Save Ctrl+S; ao fechar Save/Discard |
| Exportar | Export to Image [C: REA ui-text]; PNG/SVG/PDF [I] com área selecionada/diagrama inteiro; toast com [Abrir pasta] |

## 7. Atalhos
Selecionar V; Mão H (ou Espaço); Zoom Ctrl+roda / Ctrl+= / Ctrl+-; Fit Ctrl+0; Copiar/Colar Ctrl+C/V; Delete; Auto Layout Ctrl+L [I]; Salvar Ctrl+S; Properties F4; Duplicar Ctrl+D.

## 8. Temas / acessibilidade
Tokens 01; cartões bg.surface, borda border.default, cabeçalho bg.surfaceAlt; linhas text.secondary; cardinalidade por símbolo+texto. Modo lista alternativa (tabela de objetos e relações) navegável por teclado/leitor de tela. Exportação respeita tema claro (opção).

## 9. Componentes
Canvas, TableCard, RelationLine, Container, Note, MiniMap, PropertiesPanel, RelationGrid, ConvertToFkDialog, ApplyChangesDialog, ExportImageDialog.

## 10. Critérios de aceite
- Arrastar tabelas do Explorer gera diagrama com FKs; Auto Layout e containers funcionam; salvar/abrir preserva posições.
- Virtual Relation Manager cria/edita/exclui relações, mostra DDL e converte para FK com validação de dados.
- Overview navega diagramas grandes; estados loading/erro/sucesso; claro/escuro; teclado.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Database Diagram | Tipo de documento/aba | `erd.title` |
| New Database Diagram | Comando Explorer/menu | `erd.cmd.new` |
| Create an empty database diagram | Descrição do comando | `erd.cmd.newHint` |
| Remove from Diagram | Menu do cartão (não apaga do banco) | `erd.cmd.removeFromDiagram` |
| Insert Container / New Container | Agrupar objetos | `erd.cmd.container` |
| Diagram Overview | Painel de navegação/minimapa | `erd.overview` |
| Layout Diagram | Auto layout | `erd.cmd.layout` |
| Export to Image... | Exportar diagrama | `erd.cmd.exportImage` |
| Virtual Relation Manager | Gerenciador de relações virtuais | `erd.vr.manager` |
| Create Virtual Relation? | Confirmação | `erd.vr.createConfirm` |
| Virtual Relation {0} will be converted to foreign key. | Aviso de conversão em FK | `erd.vr.convertFk` |
| The object '{0}' already exists on the diagram. | Erro ao adicionar duplicado | `erd.err.exists` |
| Referenced table {0} is not present on the diagram. | Aviso de FK sem tabela alvo | `erd.warn.refMissing` |
| Mismatched Relation (try to refresh the diagram) | Aviso de relação divergente | `erd.warn.mismatch` |
| Diagram deserialization failed | Erro ao abrir arquivo | `erd.err.open` |
| The error occurred while diagram exporting. | Erro de exportação | `erd.err.export` |
| Cannot change connection for non-empty diagram document. | Bloqueio de troca de conexão | `erd.err.changeConn` |
