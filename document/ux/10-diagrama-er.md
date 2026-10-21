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

### 2.2 Diagram Overview (Mini-Mapa Flutuante) [C: confirmado na VM]
- **Evidência VM:** Confirmado via `re/original-observation/06-diagrama-er/07-overview-magnifier-1750.png`.
- **Natureza:** O *Diagram Overview* no dbForge Studio for MySQL **não é um painel docado separado**, mas sim uma **sobreposição flutuante (floating overlay / popup ancorado)** no canto inferior direito da área de visualização do canvas do diagrama.
- **Acionamento:**
  - Botão com ícone de lupa / mapa fixo no canto inferior direito do canvas (`07-overview-magnifier-1750.png`).
  - Ao clicar, abre o mini-mapa flutuante de dimensões compactas (~220x160 px) com borda sutil e sombra projetada (`shadow.lg`).
  - Clicar novamente no botão de lupa ou fora do popup fecha/recolhe o mini-mapa.
- **Conteúdo e Interatividade:**
  - **Miniatura Vetorial:** Renderiza a miniatura completa de todos os nós de tabelas e linhas de relacionamento contidos no documento, independente do nível de zoom atual do canvas principal.
  - **Retângulo de Viewport:** Um retângulo semitransparente em azul claro (`accent.primary` com 25% de opacidade e borda sólida) delimita com precisão a área atualmente visível na tela.
  - **Pan e Navegação Arrastável:**
    - O usuário pode arrastar o retângulo de viewport com o mouse diretamente dentro do mini-mapa para deslocar o canvas principal em tempo real com taxa de atualização suave (60 FPS).
    - Clicar em qualquer ponto da miniatura centraliza instantaneamente a visualização do canvas principal naquela coordenada do diagrama.

### 2.3 Layout Automático e Zoom [C: confirmado na VM]
- **Evidência VM:** Confirmado via `06-after-layout-diagram-1750.png`.
- **Layout Diagram:** Comando disponível na toolbar, no menu contextual do canvas e no menu superior Layout.
  - Reorganiza os cartões de tabela no canvas distribuindo-os em grafo hierárquico horizontal (tabelas pai à esquerda, filhas à direita), minimizando cruzamentos de linhas de chaves estrangeiras.
  - Aplica escala e auto-fit automático, ajustando o zoom do canvas para enquadrar perfeitamente todo o diagrama (ex.: zoom redefinido automaticamente para `62.34%` para caber na janela).
- **Controle de Zoom:** Combo na toolbar com níveis predefinidos (10%, 25%, 33%, 50%, 66%, 75%, 100%, 125%, 150%, 200%, 300%, 400%) e botões de `Zoom In`, `Zoom Out` e `Fit to Window` (`Ctrl+0`).

## 3. Relações Virtuais e Exportação [C: confirmado na VM]
- **Relações Virtuais (Virtual Relations):**
  - Relações lógicas gerenciadas no TuxSQL para bancos sem foreign keys físicas declaradas no schema, desenhadas com estilo tracejado e integradas ao Query Builder e Documenter.
- **Export to Image (`10-export-to-image-1751.png`, `11-export-types-1751.png`):**
  - Diálogo de exportação suportando imagens vetoriais (SVG) e rasterizadas (PNG, JPEG, BMP).
- **Opções do Diagrama (`12-diagram-options-1751.png` a `15-options-print-1751.png`):**
  - Quatro abas configuráveis: General (Auto Scale on Drop, Preserve Routing, Show Grid, Snap to Grid, Shadows), Notation (Notação IE pé-de-galinha, gavetas de Constraints/Indexes/Triggers, Field Details Level), Page (tamanho do papel, margens e orientação) e Print.

## 4. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Elementos Adicionais no Canvas (Containers, Notas e Comentários) (Pendente):** O original possui paleta com containers retangulares coloridos para agrupar tabelas por módulo, além de post-its de notas adesivas e carimbos de stamp (`04-ctx-new-submenu-1750.png`). O TuxSQL suporta apenas nós de tabelas e views.
2. **Impressão Física Direta com Driver Windows (Divergência Linux):** O original suporta drivers gráficos de impressão Win32/GDI. O TuxSQL exporta para formatos padrão abertos (SVG e PDF).

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
