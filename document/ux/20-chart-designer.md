# UX 20 — Chart Designer

Reusa `01-shell.md` (diálogos modais, temas e docking), `03-explorer-editor.md` (ResultGrid e menus de contexto de resultados) e `16-data-report-pivot.md` (Pivot Chart e gráficos analíticos). **[C]** CONFIRMADO / **[I]** INFERIDO / **[D]** DESCONHECIDO.

> **Status de Verificação na VM:** **CONFIRMADO NA VM COM ACERVO AUTORAL (2026-10-22).**  
> Verificado em laboratório na VM `dbforge-ref` através de 16 capturas de tela e caderno de anotações em `re/original-observation/13-chart-designer/` (`re/original-observation/13-chart-designer/01-dbforge-aberto-0132.png` a `re/original-observation/13-chart-designer/09-aba-properties-serie-0139.png` e `re/original-observation/13-chart-designer/NOTAS.md`).
> Escopo de Produto: Implementação das **11 famílias 2D completas** no TuxSQL. As variantes tridimensionais (3D) são tratadas como **DIFERENÇA INTENCIONAL** com mapeamento direto para seus equivalentes 2D (declarado formalmente em `document/paridade/DIVERGENCIAS-ORIGINAL.md`).

---

## 1. Ponto de Acesso e Invocação [C: re/original-observation/13-chart-designer/01-dbforge-aberto-0132.png, re/original-observation/13-chart-designer/02-send-to-submenu-0137.png]

O Chart Designer é uma ferramenta modal avançada acessível diretamente a partir de qualquer grade de dados ou resultado de consulta SQL (`re/original-observation/13-chart-designer/01-dbforge-aberto-0132.png`):
- **Menu de Contexto da Grade (ResultGrid):** Clique com botão direito em qualquer célula ou cabeçalho da grade de resultados SQL abre menu de contexto contendo o submenu `Send to ▶`.
- **Composição do Submenu `Send to` [C: re/original-observation/13-chart-designer/02-send-to-submenu-0137.png]:**
  - `Query Builder`
  - `Data Report`
  - `Chart Designer…` (as reticências indicam abertura de janela modal de configuração dedicada)
  - `Pivot Table`
- **Contexto dos Dados:** O conjunto de dados ativo (colunas, tipos inferidos e linhas retornadas pela consulta) é associado automaticamente como a fonte de dados primária do designer (`Data_Report1` ou `Query_Result1`).

---

## 2. Estrutura da Janela Modal do Chart Designer [C: re/original-observation/13-chart-designer/03-chart-designer-aberto-0137.png]

A janela modal possui título `"Chart Designer"`, dimensões amplas (default 960x640px, redimensionável) e organiza-se em 4 zonas operacionais bem definidas:

```
+----------------------------------------------------------------------------------------------------+
| Chart Designer                                                                            [ _ O X ]|
+----------------------------------------------------------------------------------------------------+
| [ + ▾ Add ] [ ↶ Undo ] [ ↷ Redo ] [ 🪄 Wizard ]                                                    |
+--------------------------+---------------------------------------------+---------------------------+
| Árvore de Elementos      | Área Central de Pré-visualização            | Painel Lateral Direito    |
| (Tree View)              | (Live Preview)                              | [Options] [Properties] [Data]
|                          |                                             |                           |
| ▾ Chart                  |  ┌────────────────────────────────────────┐ | Appearance                |
|   ▸ Series (0)           |  │                                        │ |   Appearance: [Default ▾] |
|     Legend               |  │   "There are no visible series         │ |   Palette:    [Nature  ▾] |
|     Additional Legends(0)|  │    in the chart..."                    │ |   Back Color: [White   ▾] |
|     Titles (0)           |  │                                        │ |                           |
|     Annotations (0)      |  │   (Gráfico ao vivo após adicionar)     │ | Behavior                |
|                          |  │                                        │ |   Auto Layout: [☑]        |
|                          |  └────────────────────────────────────────┘ |                           |
+--------------------------+---------------------------------------------+---------------------------+
| [☑] Display the designer every time a new chart is added                            [ OK ] [ Cancel ]|
+----------------------------------------------------------------------------------------------------+
```

### 2.1. Barra de Ferramentas Superior (Toolbar) [C: re/original-observation/13-chart-designer/03-chart-designer-aberto-0137.png, re/original-observation/13-chart-designer/04-add-menu-0137.png]
- **Botão `[ + ▾ Add ]`:** Botão com menu suspenso de adições rápidas (ver §3).
- **Botão `[ ↶ Undo ]`:** Desfaz a última ação estrutural (adição/remoção de série, alteração de tipo ou propriedade). Habilitado após qualquer mutação; atalho `Ctrl+Z`.
- **Botão `[ ↷ Redo ]`:** Refaz a ação previamente desfeita; atalho `Ctrl+Y`.
- **Botão `[ 🪄 Wizard ]`:** Ícone de varinha mágica para assistente passo a passo de gráficos [D: comportamento interno não aberto na VM].

### 2.2. Árvore Estrutural do Gráfico (Chart Hierarchy Tree) [C: re/original-observation/13-chart-designer/03-chart-designer-aberto-0137.png, re/original-observation/13-chart-designer/07-serie-bar-adicionada-0139.png]
Painel lateral esquerdo (largura ~220px) exibindo a árvore hierárquica do objeto gráfico:
- **Nó Raiz:** `Chart`
- **Subnós Padrão:**
  - `Series (n)`: Lista as séries ativas (ex.: `Series 1`, `Series 2`). Ao selecionar uma série na árvore, o painel direito exibe as propriedades específicas dela.
  - `Legend`: Configurações da legenda principal do gráfico (visibilidade, orientação, alinhamento).
  - `Additional Legends (n)`: Coleção de legendas adicionais para gráficos com múltiplos eixos ou séries heterogêneas.
  - `Titles (n)`: Títulos e subtítulos do gráfico com formatação de fonte e alinhamento.
  - `Annotations (n)`: Notas explicativas e marcadores de texto apontados para pontos do gráfico.

### 2.3. Área Central de Gráfico com Prévia ao Vivo [C: re/original-observation/13-chart-designer/03-chart-designer-aberto-0137.png, re/original-observation/13-chart-designer/07-serie-bar-adicionada-0139.png]
- **Empty State (Sem séries):** Exibe área de tela neutra com texto explicativo centralizado em tom suave:
  *"There are no visible series in the chart..."* (`re/original-observation/13-chart-designer/03-chart-designer-aberto-0137.png`).
- **Live Preview State (Com séries adicionadas):** Ao adicionar uma série (ex.: `Bar` em `re/original-observation/13-chart-designer/07-serie-bar-adicionada-0139.png`), renderiza instantaneamente o gráfico correspondente com eixos cartesianos ou polares, legenda à direita e dados sintéticos de prévia enquanto o mapeamento da aba `Data` não é concluído.
- Renderização implementada no TuxSQL via Canvas / SVG nativo de alta performance no renderer React.

### 2.4. Painel Lateral Direito com Três Abas [C: re/original-observation/13-chart-designer/03-chart-designer-aberto-0137.png, re/original-observation/13-chart-designer/08-aba-data-0139.png, re/original-observation/13-chart-designer/09-aba-properties-serie-0139.png]
Três abas horizontais no topo do painel direito:
- **Aba `Options`:** Configurações globais de estética e comportamento do gráfico (`re/original-observation/13-chart-designer/03-chart-designer-aberto-0137.png`).
- **Aba `Properties`:** Grade detalhada de propriedades do elemento selecionado na árvore (`re/original-observation/13-chart-designer/09-aba-properties-serie-0139.png`).
- **Aba `Data`:** Mapeamento visual das colunas da consulta aos papéis do gráfico (`re/original-observation/13-chart-designer/08-aba-data-0139.png`).

### 2.5. Conteúdo da Aba `Options` [C: re/original-observation/13-chart-designer/03-chart-designer-aberto-0137.png]
- **Grupo Appearance:**
  - `Appearance`: Tema de estilo visual (combobox: `Default`, `Dark`, `Clean`, `Classic`).
  - `Palette`: Paleta de cores das séries (combobox: `Nature`, `Pastel`, `Office`, `Vibrant`, `Monochrome`, `Devart Default`).
  - `Back Color`: Cor de fundo do canvas do gráfico (seletor de cor / dropdown de cores padrão).
- **Grupo Behavior:**
  - `Auto Layout`: Checkbox booleano para ajuste automático de margens, legendas e espaçamento entre eixos.

### 2.6. Rodapé do Diálogo [C: re/original-observation/13-chart-designer/03-chart-designer-aberto-0137.png]
- **Checkbox:** `[☑] Display the designer every time a new chart is added` (persiste a preferência do usuário de abrir este modal ao solicitar novos gráficos).
- **Botões de Ação:**
  - `[ OK ]`: Confirma as configurações, fecha o modal e gera/atualiza a visualização do gráfico associada ao resultado da consulta SQL.
  - `[ Cancel ]`: Descarta quaisquer alterações realizadas na sessão atual do designer e fecha a janela.

---

## 3. Menu Suspenso de Adição de Elementos (`+`) [C: re/original-observation/13-chart-designer/04-add-menu-0137.png]

O clique no botão `[ + ▾ Add ]` abre um menu categorizado em 3 seções lógicas:

| Seção | Itens do Menu | Descrição e Estado |
|---|---|---|
| **Chart Elements** | `Series…` | Abre a Galeria de Séries (ver §4). Sempre habilitado. |
| | `Legend` | Adiciona legenda ao gráfico. |
| | `Pane` | Adiciona um painel de plotagem separado (multi-pane layout). |
| | `Secondary Axis X` | Adiciona eixo X secundário (topo). Desabilitado até haver série aplicável. |
| | `Secondary Axis Y` | Adiciona eixo Y secundário (direita). Desabilitado até haver série aplicável. |
| | `Chart Title` | Adiciona bloco de título ao gráfico. |
| | `Annotation…` | Adiciona anotação de texto ancorada. |
| **Series Elements** | `Indicator` | Indicadores de tendência e limites em séries aplicáveis. |
| | `Title` | Título específico vinculado à série selecionada. |
| **Axis Elements** | `Constant Line` | Linha de referência horizontal/vertical fixa em valor de corte. |
| | `Strip` | Faixa destacada entre dois valores de referência no eixo. |
| | `Scale Break` | Interrupção visual de escala para dados com picos extremos. |

---

## 4. Galeria de Séries por Família [C: re/original-observation/13-chart-designer/05-series-tipos-0137.png a re/original-observation/13-chart-designer/06-series-grupos-p8-0138.png]

Ao clicar em `Series…`, abre-se o diálogo de seleção de tipos de série (`re/original-observation/13-chart-designer/05-series-tipos-0137.png`), dotado de:
- **Campo de Busca:** Caixa de texto superior *"Search..."* com filtragem em tempo real por nome do tipo (ex.: "Stacked", "Spline", "Candle", "Gantt").
- **Seletor de Famílias à Esquerda:** Lista vertical com as categorias principais.
- **Painel de Miniaturas à Direita:** Grade de botões/cartões com ícone representativo do traçado e rótulo textual do tipo de série.

### 4.1. Catálogo Completo das 11 Famílias 2D no Escopo do TuxSQL

Conforme a diretriz de produto, o TuxSQL implementa as **11 famílias 2D completas**:

1. **Bar (Barras e Colunas) [C: re/original-observation/13-chart-designer/06-series-grupos-p1-0138.png]:**
   - `Bar` (coluna vertical tradicional)
   - `Bar Stacked` (colunas empilhadas)
   - `Bar Stacked 100%` (colunas empilhadas percentuais)
   - `Side By Side Bar Stacked` (grupos de barras lado a lado empilhadas)
   - `Side By Side Bar Stacked 100%`
   - `Waterfall` (gráfico cascata para fluxos cumulativos positivos e negativos)
2. **Point and Bubble (Pontos e Dispersão) [C: re/original-observation/13-chart-designer/06-series-grupos-p2-0138.png]:**
   - `Point` (dispersão simples XY)
   - `Bubble` (bolhas com dimensão Z/tamanho do marcador)
   - `Swift Point` (renderização otimizada para séries com centenas de milhares de pontos)
3. **Line (Linhas) [C: re/original-observation/13-chart-designer/06-series-grupos-p3-0138.png]:**
   - `Line` (linha contínua)
   - `Line Stacked` (linhas empilhadas)
   - `Line Stacked 100%`
   - `Step Line` (degraus retos)
   - `Spline` (interpolação curva suave de Bézier)
   - `Scatter Line` (pontos dispersos interligados por linha)
   - `Swift Plot` (traçado acelerado para streaming de dados)
4. **Area (Áreas) [C: re/original-observation/13-chart-designer/06-series-grupos-p4-0138.png]:**
   - `Area` (área preenchida padrão)
   - `Area Stacked`
   - `Area Stacked 100%`
   - `Area Step`
   - `Area Step Stacked (100%)`
   - `Spline Area` (área curva suave)
   - `Spline Area Stacked`
5. **Range (Intervalos) [C: re/original-observation/13-chart-designer/06-series-grupos-p5-0138.png]:**
   - `Range Bar` (barras com valor mínimo e máximo flutuante)
   - `Side By Side Range Bar`
   - `Range Area` (área preenchida entre duas curvas de valor)
6. **Pie and Doughnut (Circulares) [C: re/original-observation/13-chart-designer/06-series-grupos-p6-0138.png]:**
   - `Pie` (gráfico de pizza setorial clássico)
   - `Doughnut` (rosca com raio interno configurável)
   - `Nested Doughnut` (múltiplas séries circulares concêntricas)
7. **Funnel (Funil) [C: re/original-observation/13-chart-designer/06-series-grupos-p7-0138.png]:**
   - `Funnel` (funil vertical de conversão e etapas com afunilamento proporcional)
8. **Radar (Coordenadas Polares Retangulares) [C: re/original-observation/13-chart-designer/06-series-grupos-p7-0138.png]:**
   - `Radar Point`
   - `Radar Line`
   - `Scatter Radar Line`
   - `Radar Area`
   - `Radar Range Area`
9. **Polar (Coordenadas Angulares/Raio) [C: re/original-observation/13-chart-designer/06-series-grupos-p8-0138.png]:**
   - `Polar Point`
   - `Polar Line`
   - `Scatter Polar Line`
   - `Polar Area`
   - `Polar Range Area`
10. **Financial (Mercado Financeiro) [C: re/original-observation/13-chart-designer/06-series-grupos-p8-0138.png]:**
    - `Stock` (OHLC — Open, High, Low, Close em barras com traços laterais)
    - `Candle Stick` (velas japonesas com corpos cheios/vazios e sombras)
11. **Gantt (Cronograma e Tarefas) [C: re/original-observation/13-chart-designer/06-series-grupos-p8-0138.png]:**
    - `Gantt` (barras temporais de início e fim no eixo horizontal)
    - `Side By Side Gantt`

### 4.2. Tratamento das Variantes 3D (Diferença Intencional)
No dbForge original, existem versões 3D para `Bar 3D`, `Line 3D`, `Area 3D`, `Range Area 3D`, `Pie 3D`, `Doughnut 3D` e `Funnel 3D` (`re/original-observation/13-chart-designer/06-series-grupos-p1-0138.png` a `re/original-observation/13-chart-designer/06-series-grupos-p7-0138.png`). Conforme diretriz de produto:
- **Classificação:** `DIFERENÇA INTENCIONAL (equivalente 2D)`.
- **Justificativa:** Gráficos 3D em ferramentas analíticas introduzem oclusão visual e distorções de perspectiva que prejudicam a interpretação de métricas de negócio. No TuxSQL, se o usuário pesquisar por "3D", a interface sugere com transparência o respectivo tipo 2D de alta fidelidade visual com sombras e paletas modernas.

---

## 5. Mapeamento de Dados na Aba `Data` [C: re/original-observation/13-chart-designer/08-aba-data-0139.png]

A aba `Data` permite conectar as colunas resultantes da consulta SQL aos canais de dados da série selecionada (`re/original-observation/13-chart-designer/08-aba-data-0139.png`):

```
+-------------------------------------------------------------+
| [Options]  [Properties]  [Data]                             |
+-------------------------------------------------------------+
| Choose a datasource:                                        |
| [ Data_Report1 (Query Result)                             ▾]|
+-------------------------------------------------------------+
| Drag data members to the corresponding cell to define       |
| chart data:                                                 |
|                                                             |
| +---------------------+-----------------------------------+ |
| | Argument            | [ customer_name                 x]| |
| +---------------------+-----------------------------------+ |
| | Value               | [ total_amount                  x]| |
| +---------------------+-----------------------------------+ |
| | Color               | [ category                      x]| |
| +---------------------+-----------------------------------+ |
|                                                             |
| Colunas Disponíveis da Consulta:                            |
| [ id ]  [ customer_name ]  [ total_amount ]  [ category ]   |
| [ order_date ]  [ status ]                                  |
+-------------------------------------------------------------+
```

- **Seletor de Datasource:** Dropdown *"Choose a datasource"* listando as fontes disponíveis (ex.: a tabela ou resultado de consulta ativo).
- **Instrução Visual:** *"Drag data members to the corresponding cell to define chart data"*.
- **Canais de Mapeamento (Drop Targets / Selectors):**
  - **`Argument`:** O eixo X ou categorização primária (ex.: data, nome do cliente, país).
  - **`Value`:** O eixo Y ou magnitude numérica agregável (ex.: total, contagem, preço). Séries financeiras (OHLC) e Gantt expandem múltiplos valores (Open/High/Low/Close ou Start/End Date).
  - **`Color`:** Dimensão categórica para coloração e agrupamento automático de séries por cor.
- Suporta tanto arraste das colunas para as caixas quanto seleção direta por combobox em cada canal.

---

## 6. Grade de Propriedades Pesquisável (Aba `Properties`) [C: re/original-observation/13-chart-designer/09-aba-properties-serie-0139.png]

A aba `Properties` expõe as propriedades detalhadas do elemento atualmente selecionado na árvore (`re/original-observation/13-chart-designer/09-aba-properties-serie-0139.png`), com caixa de busca rápida superior e agrupamento em 4 categorias:

### 6.1. Grupo `Appearance`
- `Labels Visibility`: Alterna visibilidade dos rótulos de valores nos pontos (`True` / `False`).
- `Visible`: Booleano para ligar/desligar a renderização da série na prévia.

### 6.2. Grupo `Behavior`
- `Argument Scale Type`: Tipo da escala do argumento (`Qualitative`, `Numerical`, `DateTime`, `Auto`).
- `Value Scale Type`: Tipo da escala do valor (`Numerical`, `DateTime`, `TimeSpan`).
- `Checkable in Legend` / `Checked in Legend`: Habilita caixa de seleção na legenda para ligar/desligar a série interativamente pelo usuário final.
- `Show in Legend`: Booleano para exibir ou ocultar a série da legenda do gráfico.
- `Series Points Sorting`: Critério de ordenação dos pontos (`None`, `Ascending`, `Descending`).
- `Crosshair Options`: Comportamento das linhas cruzadas guias sob o ponteiro do mouse.
- `Tool Tip Options`: Configuração das caixas de dica flutuantes (formato do texto, métricas expostas).
- `Top N Options`: Opção para filtrar automaticamente os N maiores valores e agrupar o restante em "Others".

### 6.3. Grupo `Data`
- `Argument Data Member`: Nome da coluna vinculada ao argumento.
- `Value Data Member`: Nome da coluna vinculada ao valor primário.
- `Color Data Member`: Nome da coluna vinculada à cor.
- `Filter String`: Expressão de filtro declarativo aplicada à série antes da plotagem.
- `Data Sorted`: Indicador de pré-ordenação dos dados de entrada.
- `Numeric Summary`: Função de agregação quando houver argumentos repetidos (`SUM`, `AVG`, `COUNT`, `MIN`, `MAX`).

### 6.4. Grupo `Elements`
- `Label`: Propriedades avançadas do rótulo da série (posição, rotação de texto, formatação de número ou moeda).
- `View`: Opções específicas do motor de desenho da família selecionada (espessura de linha, raio do ponto, opacidade de preenchimento, curvatura de Bézier).

---

## 7. Itens Desconhecidos na Referência [D]

Conforme registrado na auditoria na VM (`re/original-observation/13-chart-designer/NOTAS.md`):
- **Efeito do Botão OK [D]:** Não foi possível observar se o clique em OK gera um documento MDI independente `.chart`, embute o gráfico como aba acoplada na visualização de resultados ou anexa o componente a um relatório do Data Report.
- **Ícone Wizard na Toolbar [D]:** O assistente passo a passo não foi acionado durante a captura na VM.
- **Panes Adicionais e Eixos Secundários em Ação [D]:** O menu de adição oferece `Pane`, `Secondary Axis X` e `Secondary Axis Y`, porém os diálogos de configuração de eixos múltiplos não foram explorados.
- **Exportação do Gráfico [D]:** Ações de exportar gráfico gerado para imagem (PNG/SVG/PDF) ou copiar para clipboard.

---

## 8. Critérios de Aceite para Implementação pelo Codex

1. **Acesso e Invocação:**
   - O menu de contexto de qualquer célula ou resultado no `ResultGrid` exibe `Send to > Chart Designer…`.
   - Clicar na opção abre o diálogo modal `Chart Designer` centralizado sobre a janela principal do TuxSQL.
2. **Layout e Componentes:**
   - A barra superior possui botões operacionais `+ Add`, `Undo`, `Redo` e `Wizard`.
   - A árvore à esquerda exibe nós `Chart`, `Series`, `Legend`, `Additional Legends`, `Titles` e `Annotations`.
   - O empty state exibe o texto canônico *"There are no visible series in the chart..."*.
3. **Cobertura das 11 Famílias 2D:**
   - A galeria de séries possui campo de busca e categoriza corretamente as 11 famílias 2D (Bar, Point/Bubble, Line, Area, Range, Pie/Doughnut, Funnel, Radar, Polar, Financial, Gantt).
   - Ao selecionar ao menos um tipo de cada família 2D, o motor de gráficos renderiza a prévia ao vivo com eixos correspondentes e legenda.
4. **Mapeamento de Dados:**
   - A aba `Data` identifica a fonte de dados ativa e lista as colunas da consulta.
   - O usuário pode associar colunas aos canais `Argument`, `Value` e `Color`.
5. **Grade de Propriedades e Busca:**
   - A aba `Properties` organiza os parâmetros nos 4 grupos (`Appearance`, `Behavior`, `Data`, `Elements`) e filtra dinamicamente via caixa de busca.
6. **Desfazer / Refazer:**
   - Adicionar ou remover uma série pode ser desfeito via `Ctrl+Z` / botão `Undo` e restaurado via `Ctrl+Y` / botão `Redo`.
7. **Persistência e Fechamento:**
   - Clicar em `OK` persiste a configuração do gráfico no estado do documento e fecha o modal.
   - Clicar em `Cancel` descarta mutações não confirmadas.
   - O checkbox `"Display the designer every time a new chart is added"` persiste seu estado nas configurações do usuário sob `$XDG_CONFIG_HOME/tuxsql`.
