# UX 10 — Database Diagram, Diagram Overview e Virtual Relation Manager

Reusa `01-shell.md`, `04` (Table Editor) e `09` (Canvas, TableCard). **[I]** INFERIDO (sessão anterior / REA).

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Database Design > Database Diagram), catálogo interno `re/ui-strings/ui-text.txt` e notas de sessão anterior em `re/original-observation/NOTES.md` #11.
Auditoria de origem de evidência: **(b) Sessão anterior / (c) Inferência/REA**. Nenhuma captura foi feita na sessão corrente; pendente de confirmação por novas capturas da Lupa.

## 1. Entradas e Documento [I: sessão anterior]
- **Entradas:**
  - Menu Database > **New Database Diagram** ou Database > Tasks > **New Database Diagram**.
  - Database Explorer > clique com botão direito no banco ou tabelas selecionadas > **Send to > Database Diagram**.
  - Abertura de arquivo salvo `.dbd` (no TuxSQL em formato JSON limpo e portável `.dbd.json`).
- **Estrutura MDI do Documento (`Diagram1.dbd`):**
  - Tela inicial vazia contendo instrução central: *"You can drag database objects from Database Explorer here."*
  - **Toolbar Superior do Diagrama:**
    - Zoom combo (`100% ▾`), Zoom In, Zoom Out, Fit (`Ctrl+0`).
    - Ferramentas da Paleta: Seleção (Ponteiro), Tabela, View, Relação, Container, Nota, Comentário.
    - Botões de Ação: `[Auto Layout]`, `[Align ▾]`, `[Export to Image...]`, `[Print]`.
    - Menu contextual de topo dedicado: **Layout** (adicionado dinamicamente à barra de menus).

## 2. Layout do Canvas e Cartões de Tabela [I: sessão anterior]
```
+ Aba: [Diagram1.dbd] ------------------------------------------------------------+
| Toolbar: [Select] [Hand] [Table] [View] [Relation] | [Auto Layout] [Zoom 100% ▾]|
|          [Fit] | [Export to Image...] | [Virtual Relation Manager]              |
+---------------------------------------------------------------------------------+
| CANVAS:                                                                         |
|                                                                                 |
|  +-------------------------+                     +-------------------------+    |
|  | orders              [-] |                     | customers           [-] |    |
|  +-------------------------+                     +-------------------------+    |
|  | [PK] id        INT      |                     | [PK] id        INT      |    |
|  | [FK] cust_id   INT      |                     |      name      VARCHAR  |    |
|  |      total     DECIMAL  |                     |      email     VARCHAR  |    |
|  +-------------------------+                     +-------------------------+    |
|  | ▸ Constraints (2)       |                     | ▸ Constraints (1)       |    |
|  | ▸ Indexes (3)           |                     | ▸ Indexes (2)           |    |
|  | ▸ Triggers (1)          |                     +-------------------------+    |
|  +-------------------------+                                                    |
|            |                                                 ^                  |
|            +--- fk_orders_customer (ortogonal com losango) --+                  |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

### 2.1 Anatomia do Cartão de Tabela
- **Cabeçalho:** Ícone do tipo de objeto, nome da tabela e botão recolher/expandir (`[-]`).
- **Linhas de Coluna:**
  - Ícone semântico: Chave Primária (ícone de chave amarela `[PK]`), Chave Estrangeira (ícone de chave vinculada azul `[FK]`), Coluna Comum.
  - Nome da coluna.
  - Tipo de dado simplificado (ex.: `INT`, `VARCHAR`, `DECIMAL`, `DATETIME` — omitindo comprimento/precisão para economizar espaço visual).
  - Selo visual ou indicador de `NOT NULL`.
- **Seções Recolhíveis no Cartão [C]:**
  - Sub-seções internas expansíveis dentro do próprio cartão: `▸ Constraints`, `▸ Indexes` e `▸ Triggers`.
- **Relações Físicas (Foreign Keys) [C]:**
  - Conectores de linhas ortogonais automáticas interligando a coluna filha à coluna pai.
  - Marcadores de cardinalidade nas pontas (notação pé-de-galinha / crow's foot).
  - **Rótulo Textual da FK:** o nome da constraint (`fk_orders_customer`) é renderizado diretamente sobre a linha da relação.

## 3. Relações Virtuais (Virtual Relations) [C]
- Relacionamentos lógicos entre tabelas mantidos exclusivamente no nível da aplicação/projeto TuxSQL (sem alterar tabelas ou criar constraints físicas no servidor MySQL).
- Exibidas visualmente no diagrama com linha tracejada e indicação de relação virtual.
- Painel **Virtual Relation Manager** (`View > Other Windows > Virtual Relation Manager`):
  - Grade: `Name` | `Child table.col` | `Parent table.col` | `Comment` | `Status`.
  - Permite criar, editar, excluir e documentar relações virtuais.
  - Relações virtuais são reconhecidas e utilizadas pelo Query Builder (09) para desenhar JOINs automáticos e pelo Documenter (13).

## 4. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Seções Recolhíveis Internas de Constraints/Indexes/Triggers no Cartão (Pendente):** No original, cada cartão de tabela possui gavetas colapsáveis para Constraints, Índices e Triggers. No TuxSQL o cartão exibe apenas a lista de colunas com ícones de chave.
2. **Rótulo Textual Fixo sobre a Linha da Relação (Pendente):** No original, o nome da chave estrangeira (`fk_orders_customer`) é desenhado como etiqueta de texto sobre o traço da linha. No TuxSQL o nome da relação é acessível via tooltip ao passar o cursor sobre a linha.
3. **Elementos Adicionais no Canvas (Containers, Notas e Comentários) (Pendente):** O original possui paleta com containers retangulares coloridos para agrupar tabelas por módulo, além de post-its de notas adesivas e imagens. O TuxSQL suporta apenas nós de tabelas e views.
4. **Painel Docado "Diagram Overview" (`Ctrl+W, V`) (Pendente):** O original possui uma janela dock dedicada com minimapa e retângulo de arraste rápido. O TuxSQL executa navegação via pan e zoom direto no canvas.
5. **Assistente de Conversão de Relação Virtual em FK Física (Pendente):** No original há opção de converter uma relação virtual em constraint física real no banco via diálogo com verificação de dados órfãos. No TuxSQL as relações virtuais permanecem estritamente no armazenamento local do usuário.

## 5. Estados de Interface
| Estado | Comportamento |
|---|---|
| Canvas Vazio | Instrução central para arrastar objetos do Database Explorer |
| Carregando Tabelas | Shimmer skeleton nos cartões recém-adicionados enquanto busca metadados |
| Tabela Alterada no Banco | Indicador de aviso no cabeçalho sugerindo atualização com F5 |
| Exportando Imagem | Diálogo de configuração (formato PNG/SVG, resolução, área total vs seleção) |
| Erro de Conexão | Cartões permanecem em cache local marcados como offline |

## 6. Atalhos de Teclado
- Ferramenta Seleção: `V`
- Mover / Mão: `H` (ou segurar barra de espaço)
- Zoom In / Out: `Ctrl+=` / `Ctrl+-` (ou `Ctrl+Roda`)
- Enquadrar Tudo (Fit): `Ctrl+0`
- Atualizar Metadados: `F5`
- Salvar Diagrama: `Ctrl+S`
- Propriedades do Item Selecionado: `F4`
- Remover do Diagrama: `Delete`

## 7. Temas e Acessibilidade
- Conformidade total com temas Claro e Escuro de `01-shell.md`.
- Cores de cabeçalhos de cartão com alto contraste; linhas de relacionamento com espessura de 2px e marcadores geométricos bem definidos.
- Suporte a modo lista acessível para inspeção de nós e relacionamentos por teclado e leitores de tela.

## 8. Componentes
`DiagramDocument`, `DiagramCanvas`, `TableCardElement`, `RelationOrthogonalLine`, `VirtualRelationManagerDock`, `ExportImageModal`, `DiagramMiniMap`.

## 9. Critérios de Aceite
- Permite arrastar tabelas do Explorer e visualizá-las com colunas, tipos e relacionamentos automáticos.
- Algoritmo de layout organiza tabelas pai e filhas tolerando grafos cíclicos de relacionamento.
- Suporta criação e persistência local de relações virtuais.
- Exportação em formato vetorial SVG funcional.

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
