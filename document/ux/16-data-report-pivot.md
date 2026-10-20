# UX 16 — Data Viewer, Pivot, Master-Detail e Report Designer

Reusa `01-shell.md`, `03` (DataGrid), `06` (export). **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Data Editor; Pivot Table; Master-Detail Browser; Data Report) e https://www.devart.com/dbforge/mysql/studio/data-reports.html, .../pivot-table.html. Citações por redirecionamento; páginas individuais não abertas. Fidelidade REA: rótulos conferidos contra REA ui-text.

## 1. Data Viewer [C: painel; "Data Viewer" / "Show Data Viewer" REA ui-text]
Painel dock que mostra o conteúdo **da célula selecionada** no grid (Table Data/resultado). Abas: **Text**, **Hex**, **Image**, **JSON**, **XML**/HTML [I]. Auto-detecta tipo; seletor manual. Texto: Monaco read-only com quebra de linha opcional, busca, copy; Hex: offset|bytes|ASCII, 16 por linha; Image: zoom/fit/ rotate, dimensões e tamanho; JSON: árvore colapsável + pretty; modo edição (se grid editável): [Apply to cell] [Revert], Load from file…/Save to file… (BLOB, via portal GTK). Estados: vazio "Selecione uma célula"; loading de BLOB grande (skeleton + [Cancel]); erro de decodificação ("Não é uma imagem válida – exibindo Hex"); limite de preview (ex.: 10 MB; [Carregar tudo]).

## 2. Pivot Table [C: no grid; "Build Pivot Table", "Drag Items to the Pivot Table" REA ui-text]
Entrada: aba/botão **Pivot** na visão de resultado/Table Data (Result | Pivot) [C], ou menu de contexto "Show as Pivot Table".
```
+ Pivot ----------------------------------------------------------+
| Campos disponíveis (lista) |  Zonas: Filter | Columns | Rows | Data |
|  ☐ Region  ☐ Year  ☐ Sales |  [Region]  [Year]   [Product] [SUM(Sales)] |
+----------------------------+--------------------------------------+
| Tabela dinâmica (grid): cabeçalhos agrupados, totais/subtotais     |
+--------------------------------------------------------------------+
```
- Arrastar campos da lista para as 4 zonas (ou menu de contexto do campo: Add to Rows/Columns/Data/Filter); reordenar; remover com ✕. Teclado: seleção na lista + Alt+1..4 [I].
- Funções de agregação no Data: Sum, Count, Avg, Min, Max, StdDev, Distinct Count; formatos numéricos; "% do total/linha/coluna" [I].
- Agrupamento de datas (ano/trimestre/mês/dia) e de números (intervalos) [C REA ui-text: grupo por data, por intervalos numéricos e por primeira letra]; ordenar por campo/valor; filtro por valores (dropdown com checklist e busca) no cabeçalho do campo; expandir/recolher grupos (+/−), totais e totais gerais (liga/desliga).
- Cálculo é **local** sobre o resultado carregado; aviso se resultado truncado ("Dados parciais: 1000 de 54.000 linhas [Carregar todos]").
- Exportar (CSV/XLSX/HTML) e **Gráfico**: botão [Chart] ("Show Chart" / "Open Chart Designer" [C REA ui-text]) cria gráfico (barras, linhas, pizza, área, empilhado) a partir do pivot [I]; opções de título, legenda, cores (tokens), exportar PNG/SVG.
Estados: vazio EmptyState "Arraste campos para as zonas"; loading ao carregar todos; erro de memória/limite (aviso e sugestão de filtrar); sucesso.

## 3. Master-Detail Browser [C; "Master-Detail Browser", "Browse master-detail data", arquivo `*.mdet` REA ui-text; atualizar = BrowseData F5 REA shortcuts]
Entrada: Explorer > tabela > "Master-Detail Browser" ou menu SQL/Data > New Master-Detail. Documento em aba.
```
+ Aba: [Master-Detail: customers] --------------------------------+
| Toolbar: [Refresh][Add Detail][Remove Detail][Layout: ▤ ▥][Edit] |
+------------------------------------------------------------------+
| Master grid (customers)  [filtro]                                 |
+------------------------------------------------------------------+
| Abas de detalhe: [orders (FK)] [addresses (FK)] [+ custom…]       |
|  Detail grid filtrado pela linha selecionada do master            |
+------------------------------------------------------------------+
```
Master = tabela/consulta; detalhes = automaticamente tabelas com FK para a master (e **relações virtuais** do 10) [C parcial]; adicionar detalhe manual (escolher tabela + colunas de ligação). Detalhes aninhados (detalhe do detalhe) em abas internas/ expansão por linha [I]. Selecionar linha master dispara carga do detalhe (loading skeleton no grid de detalhe, cancelável). Edição permitida segundo regras 03 §4.4 com Apply por grid. Layout horizontal/vertical alternável. Estados: vazio detalhe "Sem registros relacionados"; erro por detalhe isolado (não afeta master).

## 4. Data Report [C: WYSIWYG, wizard]
### 4.1 Wizard "Data Report Wizard" [C REA ui-text: "New Data Report Wizard...", "Blank Data Report", "Design in Report Wizard..."; arquivo `*.rdb` no original]
Passos: **1 Tipo** (Standard, Master-Detail, Pivot [I], Em branco) → 2 Dados (consulta SQL/tabelas/view; parâmetros) → 3 Campos (selecionar, ordem) → 4 Layout (tabular/colunar/lista; agrupamento; resumos) → 5 Estilo (modelos, página A4/Letter, orientação, margens) → 6 Concluir (abre no designer). 
### 4.2 Report Designer (documento em aba) [C: WYSIWYG; "Report Designer..." REA ui-text]
```
+ Aba: [Report1 (Designer)] --------------------------------------+
| Toolbar: [Preview][Save][Export ▾][Print] | [Undo][Redo] | zoom   |
|  | alinhar/distribuir | fonte/negrito/cor | bordas             |
+-----------+-----------------------------------+------------------+
| Toolbox   | Página (réguas, guias, bandas:    | Properties /     |
| (controles| Report Header, Page Header, Group | Field List /     |
|  arraste) | Header, Detail, Group Footer,     | Report Explorer  |
|           | Page Footer, Report Footer)       |                  |
+-----------+-----------------------------------+------------------+
| Abas base: [Designer][Preview][Script*]                           |
+------------------------------------------------------------------+
```
- **Toolbox:** Label, Field (campo de dados `[coluna]`), Table, Picture, Line, Shape, Chart, Barcode [I], Page Info (nº/total, data), Rich Text, Sub-report, Check box.
- Bandas por arrastar; propriedades (fonte, cor, formato, visibilidade condicional, expressão de formatação, alinhamento, bordas, quebra de página); Field List com colunas da consulta + parâmetros + variáveis de resumo; expressões (soma, contagem, média por grupo/relatório).
- Grupos e totais; formatação condicional (regra → estilo); parâmetros com diálogo de entrada ao visualizar.
- **Preview:** paginação, navegação (setas/primeira/última/ir para), zoom, busca no texto, atualizar dados; [Export] PDF, HTML, XLSX, DOCX [I], CSV, imagem; [Print] via CUPS (diálogo do SO).
- Arquivo `.dbrep` (JSON/XML próprio) [I]; modelos incluídos. Sem formato proprietário do original.
Estados: designer loading; erro de consulta (banner + [Editar consulta]); preview gerando (progresso por página); sucesso exportando (toast + [Abrir]).

## 5. Atalhos
Pivot toggle Ctrl+Alt+V [I]; Chart Ctrl+Shift+H [I]; Master-Detail refresh F5; Designer: Salvar Ctrl+S, Preview F5, Desfazer/Refazer Ctrl+Z/Y, Alinhar Ctrl+Shift+setas [I], Zoom Ctrl+roda, Duplicar Ctrl+D; Data Viewer: Copiar Ctrl+C, Buscar Ctrl+F.

## 6. Temas / acessibilidade
Tokens 01; relatório (página) mantém fundo branco no designer independentemente do tema (WYSIWYG), com moldura temática; gráficos usam paleta com contraste e padrões/rótulos para daltonismo; pivot e grids por teclado; designer oferece Report Explorer em árvore (alternativa ao canvas).

## 7. Componentes
DataViewerTabs, PivotFieldList, PivotZones, PivotGrid, ChartView, MasterDetailLayout, DetailTabs, WizardDialog, DesignerSurface (bandas/réguas), ControlToolbox, PropertyGrid, FieldList, ReportExplorer, PreviewPaginated, ExportDialog.

## 8. Critérios de aceite
- Data Viewer mostra texto/hex/imagem/JSON da célula e salva/carrega BLOB.
- Pivot por arrastar-e-soltar com agregações, filtros, totais e gráfico a partir de um resultado.
- Master-Detail navega relações FK/virtuais com detalhes sob demanda.
- Report Designer cria relatório com agrupamento/total via wizard, edita no designer WYSIWYG, visualiza e exporta PDF/HTML/XLSX.
- Estados, temas, teclado cobertos.

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
