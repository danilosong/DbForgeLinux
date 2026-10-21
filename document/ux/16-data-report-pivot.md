# UX 16 — Data Viewer, Pivot, Master-Detail e Report Designer

Reusa `01-shell.md`, `03` (DataGrid), `06` (export). **[I]** INFERIDO (sessão anterior / REA).

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Data Editor; Pivot Table; Master-Detail Browser; Data Report), catálogo interno `re/ui-strings/ui-text.txt` e notas de sessão anterior em `re/original-observation/NOTES.md` #18.
Auditoria de origem de evidência: **(b) Sessão anterior / (c) Inferência/REA**. Nenhuma captura foi feita na sessão corrente; pendente de confirmação por novas capturas da Lupa.

## 1. Data Viewer [I: painel; REA ui-text]
Painel docado que mostra o conteúdo **da célula selecionada** no grid (Table Data/resultado de consulta).
- Abas de exibição: **Text**, **Hex**, **Image**, **JSON**, **XML/HTML** e **Spatial** (para tipos geométricos).
- Auto-detecção do formato do dado ou seleção manual pelo usuário.
- Suporte a edição direta para tipos BLOB (carregar arquivo binário do disco via portal de arquivos / salvar em arquivo).

## 2. Pivot Table [I: sessão anterior]
- **Entrada e Documento:**
  - Documento MDI `PivotTable1.sql` (ou aba na visão de resultados do grid).
  - Toolbar superior: `[Refresh]`, `[Edit SQL Text]`, Seletor de Conexão, Filtro, Formatação, `[Show Chart]`.
  - Vistas inferiores: `[Pivot Table]  [+]`.
- **Canvas com Áreas Dropáveis [I]:**
  - Quatro áreas retangulares com bordas pontilhadas e textos explicativos:
    - `"Drop Filter Fields Here"` (filtros globais).
    - `"Drop Column Fields Here"` (cabeçalhos de coluna dinâmicos).
    - `"Drop Row Fields Here"` (agrupamentos de linhas).
    - `"Drop Data Items Here"` (campos numéricos agregados com SUM, COUNT, AVG, MIN, MAX).
    - `"Grand Total"` (totais gerais de linha e coluna).
  - Dica central: *"You can drag database objects from Database Explorer here, design SQL query or write it manually."*
  - Painel lateral direito: Lista de campos disponíveis com botão `[Add To ▾]`.
  - Agrupamento temporal inteligente para datas (por ano, trimestre, mês ou dia).

## 3. Master-Detail Browser [C: confirmado na VM]
Confirmado via `re/original-observation/08-report-pivot-masterdetail/01-master-detail-1754.png` a `03-browse-data-1755.png`.
- **Entrada e Documento:**
  - Menu Database > **Master-Detail Browser** abre o documento MDI `MasterDetail1.mdet`.
  - Vistas inferiores: abas `[Design]` e `[Data]`.
  - Toolbar: `[Refresh]`, `[Browse Data]`, `[Set Master]`, `[Select all columns]`, `[Unselect all columns]`, `[Sort Ascending]`, Zoom combo (`100% ▾`), Seletor de Database.
  - Rodapé: Indicadores *"There are no selected objects"*, *"Fetch Limit [0]"* e campo *"Where Condition"*.
- **Comportamento e Mapeamento Automático:**
  - Canvas inicial com instrução: *"You can drag objects from Database Explorer here."*
  - Ao soltar tabelas vinculadas por Foreign Key (ex.: `customers` e `orders` em `02-two-tables-1754.png`):
    - O estúdio atribui automaticamente o cabeçalho roxo **`MASTER`** para o lado 1 da relação (`customers`) e o cabeçalho cinza **`DETAIL`** para o lado N (`orders`).
    - Desenha uma seta de relacionamento conectando `customers.id` (PK) a `orders.customer_id` (FK).
  - Ao clicar no botão **`[Browse Data]`** (`03-browse-data-1755.png`):
    - Alterna para a aba `Data` exibindo em split horizontal: a grade mestre em cima e a grade de detalhe embaixo filtrada em tempo real pelo registro mestre selecionado (`customer_id = 1`).

## 4. Data Report e o Assistente de 8 Passos (Data Report Wizard) [C: confirmado na VM]
Confirmado via capturas completas `re/original-observation/08-report-pivot-masterdetail/04-report-designer-1755.png` a `18-report-preview-1757.png`.
- **Entrada:** Menu Database > **Report Designer...** (ou Database > Tasks > New Data Report...).
- **Assistente "Data Report Wizard" (8 Passos):**
  - **Passo 1: Welcome & Report Type (`04-report-designer-1755.png`):**
    - Título: *"Welcome to the Data Report Wizard"*.
    - Instrução: *"This wizard helps you automatically create a report according to the selected wizard options. Choose a report type and click Next."*
    - Tipos de Relatório:
      - `(•) Standard Report` (relatório padrão com campos tabulares ou em colunas).
      - `( ) Label Report` (etiquetas postais / código de barras).
      - `( ) Blank Report` (documento em branco para desenho livre no designer).
  - **Passo 2: Choose Data Connection (`05-wizard-step2-1755.png` a `07-wizard-connection-chosen-1755.png`):**
    - Título: *"Choose a data connection"*.
    - Descrição: *"The data connection specifies how to find and log into a specific server and database."*
    - Dropdown `Connection` (com `<Manage...>` e conexões cadastradas, ex.: `mysql-teste`).
    - Opção de fonte:
      - `(•) Simple Table/View`: seleção direta de objeto do banco.
      - `( ) Custom Query`: consulta SQL customizada digitada pelo usuário.
    - O botão `Next >` só é habilitado após selecionar uma conexão válida.
  - **Passo 3: Choose Table or View (`08-wizard-step3-1755.png` a `10-wizard-orders-selected-1756.png`):**
    - Título: *"Choose the table or view"*.
    - Descrição: *"The table or view you choose determines which columns will be available in your report."*
    - Painel esquerdo: `Available item(s)` (árvore de schemas > Tables / Views).
    - Painel direito: `Selected item`.
    - Botões de transferência: `[ > ]` e `[ < ]`.
  - **Passo 4: Choose Columns (`11-wizard-step4-1756.png` e `12-wizard-fields-added-1756.png`):**
    - Título: *"Choose columns to display in your report"*.
    - Descrição: *"Your report can display any of the columns available in the dataset."*
    - Painel esquerdo: `Available fields` (ex.: `id`, `customer_id`, `status`, `total`, `ordered_at`, `notes`).
    - Painel direito: `Fields to display in a report`.
    - Botões de transferência: `[ > ]`, `[ >> ]` (adicionar todos), `[ < ]`, `[ << ]` (remover todos).
  - **Passo 5: Grouping Levels (`13-wizard-step5-1756.png`):**
    - Título: *"Do you want to add any grouping levels?"*.
    - Descrição: *"You can have several groups, each with a single field value, or specify several fields in the same group."*
    - Lista de campos disponíveis com botões de transferência e botões de prioridade de nível `[Priority Up]` e `[Priority Down]`.
    - Miniatura de pré-visualização hierárquica do agrupamento.
  - **Passo 6: Report Layout & Orientation (`14-wizard-step6-1756.png`):**
    - Título: *"How would you like to lay out your report?"*.
    - Descrição: *"The report's layout specifies the way in which the selected data fields are arranged on report's pages."*
    - `Layout`: `(•) Columnar` | `( ) Tabular` | `( ) Justified`.
    - `Orientation`: `(•) Portrait` (retrato) | `( ) Landscape` (paisagem).
    - Checkbox: `[x] Adjust the field width so all fields fit on page`.
    - Pré-visualização gráfica interativa da diagramação das colunas na página.
  - **Passo 7: Report Style (`15-wizard-step7-1756.png`):**
    - Título: *"What style would you like?"*.
    - Descrição: *"The report's style specifies the appearance of your report."*
    - Lista de estilos visuais predefinidos:
      - `Bold` (padrão com cabeçalhos e títulos destacados em vermelho escuro/vinho).
      - `Casual`
      - `Compact`
      - `Corporate`
      - `Formal`
    - Miniatura de amostra renderizando o cabeçalho, linhas de grade e tipografia do estilo escolhido.
  - **Passo 8: Report Title & Finish (`16-wizard-step8-1756.png`):**
    - Título: *"What title do you want for your report?"*.
    - Campo de texto para o título do relatório (padrão no original *"dbForge Studio Report"*; no TuxSQL *"TuxSQL Report"*).
    - Texto explicativo: *"That's all the information the wizard needs to create your report."*
    - Botões inferiores: `[Save Command Line...]`, `[< Back]`, `[Finish]`, `[Cancel]`.
- **Report Designer e Preview (`17-report-designer-doc-1757.png` e `18-report-preview-1757.png`):**
  - Documento MDI `Report1.rdb` com abas **`[Designer]`** e **`[Preview]`**.
  - **Bandas do Designer:** `TopMargin`, `ReportHeader` (contendo o título), `Detail` (campos de dados formatados com o estilo selecionado), `BottomMargin`.
  - **Painéis de Apoio:** `Report Explorer` (árvore de bandas e estilos), `Properties`, `Data Source`, `Toolbox` (componentes Label, Field, Table, Shape, Chart, Page Info), `Group and Sort` (Add a Group, Add a Sort, Delete, Move Up, Move Down; colunas Field Name, Sort Order, Show Header, Show Footer).
  - Barra de formatação de fonte (Família, Tamanho, Negrito, Itálico, Sublinhado, Alinhamento e Cores).
  - Aba **Preview (`18-report-preview-1757.png`)**: renderiza as páginas finais paginadas com navegação, busca, zoom e botões de exportação (PDF, HTML, CSV).

### 4.1 Especificação de Acabamento Visual e Espaçamento de Bandas (Layout Justified)

> **Diagnóstico Visual em `document/evidence/ui/16-data-report-pivot/data-report-justified-light.png`:**
> A captura do clone exibe a lista de bandas com o texto `'idstatustotal'` colado horizontalmente sem espaçamento dentro da banda `Detail`, e a régua/cabeçalho de banda encostando diretamente sobre o conteúdo superior sem área de respiro, comprometendo a legibilidade visual.

#### Proposta de Ajustes de Espaçamento e Tipografia para Bandas:

1. **Separação e Delimitação dos Campos na Banda `Detail`:**
   - **Gutter Horizontal Obrigatório:** Os elementos da banda `Detail` não podem ser concatenados em texto contínuo. Devem utilizar contêiner flexível com espaçamento explícito:
     ```css
     display: flex;
     flex-wrap: wrap;
     gap: 12px 16px; /* gap horizontal de 16px, vertical de 12px */
     align-items: center;
     ```
   - **Formatação de Badges/Chips de Campo:** Cada coluna (`id`, `status`, `total`) deve ser renderizada em um chip individual delimitado:
     - `padding: 4px 10px;`
     - `border-radius: 4px;`
     - `background-color: var(--surface-sunken);`
     - `border: 1px solid var(--border-subtle);`
     - `font-family: var(--font-mono); font-size: 12px;`
     - Rótulo formatado: `id` | `status` | `total` (com separação nítida entre nome do campo e metadado de tipo).

2. **Espaçamento e Respiro do Cabeçalho de Banda (`Band Header`):**
   - **Margem de Respiro Superior/Inferior:**
     - O cabeçalho de banda (`ReportHeader` ou a aba indicadora da banda `Detail`) deve possuir espaçamento inferior dedicado: `margin-bottom: 12px;`.
     - Padding interno da área útil da banda: `padding: 12px 16px;`.
   - **Divisor Visual de Banda:**
     - A linha de divisão de banda deve utilizar `border-bottom: 1px solid var(--border-subtle);`.
     - O identificador textual da banda (ex.: tag roxa/cinza com o nome `Detail`) fica posicionado em aba externa superior, nunca sobrepondo o primeiro campo de dados da lista.

3. **Altura Mínima e Estados Responsivos:**
   - Altura mínima da banda `Detail`: `min-height: 48px;` garantindo que os elementos não fiquem achatados.
   - No tema Escuro (`data-report-justified-dark.png`), o fundo da folha do designer mantém alto contraste com bordas delimitadoras `var(--border-strong)` e badges com contraste mínimo de 4.5:1.

## 5. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Designer WYSIWYG com Bandas Vetoriais em Tempo Real:** No TuxSQL as exportações de relatórios são geradas de forma declarativa e renderizadas em HTML/PDF sanitizado, sem o canvas de desenho vetorial com réguas físicas do Windows Forms.
2. **Exportação em Formato Proprietário `.rdb` / Word DOCX:** TuxSQL utiliza formatos abertos interoperáveis (JSON, HTML, CSV e PDF).

## 6. Estados de Interface
| Estado | Comportamento |
|---|---|
| Pivot Vazio | Painel com áreas delimitadas e convite para arrastar campos da lista lateral |
| Calculando Agregações | Shimmer skeleton na grade dinâmica com indicador de cálculo |
| Master sem Detalhe Selecionado | Grade detalhe exibe mensagem neutra "No related records for current selection" |
| Erro de Sintaxe na Consulta do Relatório | Alerta impeditivo no assistente de relatório com link para editar a consulta SQL |
| Exportando Relatório | Diálogo modal com barra de progresso por página gerada |

## 7. Atalhos de Teclado
- Atualizar Dados: `F5`
- Salvar Documento / Template: `Ctrl+S`
- Alternar Visualização Designer / Preview: `Ctrl+Shift+P`
- Desfazer / Refazer no Designer: `Ctrl+Z` / `Ctrl+Y`
- Duplicar Elemento Selecionado: `Ctrl+D`

## 8. Temas e Acessibilidade
- Conformidade total com os tokens de design system de `01-shell.md`.
- No modo Report Designer a folha de impressão mantém fundo branco para garantir fidelidade de cores de saída (WYSIWYG), com bordas contrastantes no tema escuro.
- Tabelas dinâmicas e grades totalmente acessíveis via teclado com navegação por setas e anúncio de cabeçalhos hierárquicos.

## 9. Componentes
`DataViewerDock`, `PivotCanvas`, `DropZoneContainer`, `PivotSummaryGrid`, `MasterDetailDocument`, `CascadeDataGrid`, `ReportDesignerSurface`, `BandLayoutDivider`, `ReportToolbox`.

## 10. Critérios de Aceite
- Cálculo correto de agregações e totais em dados agrupados por dimensões categóricas e temporais.
- Exportação de dados do pivot para CSV, HTML e PDF funcional e sanitizada.
- Data Viewer decodifica e exibe conteúdos de texto, hexadecimal, JSON e imagens com suporte a leitura e gravação de BLOBs.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Data Viewer / Show Data Viewer | Painel e comando | `report.dataViewer` |
| Build Pivot Table | Comando do grid | `pivot.build` |
| Drag Items to the Pivot Table | Placeholder do designer pivot | `pivot.dragHint` |
| Pivot Table | Título/aba | `pivot.title` |
| Select data range in the pivot table or press "show all data" button. | Aviso de intervalo | `pivot.rangeHint` |
| An error has occurred while loading pivot table chart. | Erro do gráfico pivot | `pivot.err.chart` |
| Show Chart / Open Chart Designer / Chart Layout | Gráfico | `pivot.chart.*` |
| Master-Detail Browser / Browse master-detail data | Comando e título | `md.browser` |
| New Master-Detail | Comando | `md.new` |
| Cannot retrieve master-detail data. The cycle in table {0} was found. | Erro de ciclo FK | `md.err.cycle` |
| Unable to read the Master-Detail document file. The file '{0}' is not a valid document file. Error: {1}. | Erro de arquivo | `md.err.badFile` |
| Data Report Wizard / Welcome to the Data Report Wizard | Wizard | `report.wizard.title` |
| Create a new data report via step-by-step wizard | Descrição do comando | `report.wizard.desc` |
| Blank Data Report / New Blank Data Report | Comando | `report.newBlank` |
| Design in Report Wizard... | Comando | `report.designInWizard` |
| Which connection do you want to use in your report? | Passo de conexão | `report.wizard.connection` |
| Specify the keys that relate tables in your report. | Passo master-detail | `report.wizard.keys` |
| The SQL query in the editor will be executed while creating the data report. | Aviso do wizard | `report.wizard.queryNote` |
| Can't create data report upon invalid SQL query. | Erro | `report.err.invalidQuery` |
| Parameter name '{0}' is not presented in report query. | Erro de parâmetro | `report.err.param` |
| Can't export data report. | Erro | `report.err.export` |
| There is no report to show for the selected document. | Estado vazio | `report.empty` |
| Generating report: | Progresso | `report.progress` |
| The circles and arcs are not currently supported by Data Viewer. | Aviso | `report.dataViewer.unsupported` |
