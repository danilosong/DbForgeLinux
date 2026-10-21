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

## 3. Master-Detail Browser [I: sessão anterior]
- **Entrada e Documento:**
  - Documento MDI `MasterDetail1.mdet`.
  - Menu contextual de topo: **Layout**.
  - Toolbar: `[Refresh]` (`F5`), `[Browse Data]`, `[Set Master]`, `[Select all columns]`, `[Unselect all columns]`, `[Sort Ascending]`, Zoom combo (`100% ▾`).
  - Vistas inferiores do documento: `[Design]  [Data]`.
- **Comportamento [C]:**
  - Canvas inicial com instrução: *"You can drag objects from Database Explorer here."*
  - Ao arrastar duas ou mais tabelas vinculadas por Foreign Key, a relação Mestre-Detalhe é mapeada automaticamente.
  - Na aba **Data**, a seleção de um registro na grade mestre filtra instantaneamente as grades filhas correspondentes.

## 4. Data Report e Report Wizard [C: observado na VM]
- **Assistente "Data Report Wizard":**
  - Tela inicial: *"Welcome to the Data Report Wizard"*.
  - Tipos de Relatório:
    - `(•) Standard Report` (relatório colunar/tabular padrão).
    - `( ) Label Report` (etiquetas postais / código de barras).
    - `( ) Blank Report` (documento em branco para desenho livre).
  - Botão `[Save Command Line...]` para automatizar a geração de relatórios via linha de comando.
- **Report Designer (Superfície WYSIWYG):**
  - Divisão de bandas de impressão: `Report Header`, `Page Header`, `Group Header`, `Detail`, `Group Footer`, `Page Footer`, `Report Footer`.
  - Toolbox lateral de componentes: Label, Field, Table, Picture, Line, Shape, Chart, Page Info, Rich Text.
  - Painel de Propriedades com controle de réguas, margens e fontes.
  - Aba de **Preview** com paginação, zoom e exportação para PDF, HTML, XLSX e CSV.

## 5. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Designer Gráfico WYSIWYG de Relatórios em Bandas (Pendente):** No original há um ambiente vetorial de diagramação de relatórios com réguas milimétricas, divisão em 7 bandas e toolbox de controles arrastáveis. O TuxSQL executa exportações tabulares analíticas diretas, sem o editor visual de layouts de impressão.
2. **Documento MDI .mdet Master-Detail Interativo (Pendente):** No original há o documento dedicado `.mdet` para desenhar visualmente relações mestre-detalhe com atualização síncrona de grids filhas. No TuxSQL grids filhas operam de forma independente.
3. **Canvas de Pivot Table com Áreas Dropáveis (Pendente):** No original as colunas e linhas da tabela dinâmica são arrastadas para caixas visuais no canvas ("Drop Fields Here"). No TuxSQL o cálculo de pivots é executado via rotinas analíticas em memória (`quickPivot`), sem a interface gráfica drag-and-drop.
4. **Assistente Step-by-Step de Relatórios ("Data Report Wizard") (Pendente):** O original guia a criação de relatórios em etapas com escolha de templates. O TuxSQL foca nas ferramentas de exportação padrão do grid.

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
