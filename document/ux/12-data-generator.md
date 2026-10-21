# UX 12 — Data Generator

# UX 12 — Data Generator

Reusa `01-shell.md`, `06` (WizardDialog, ProgressList, ReportView), `04` (EditableGrid). **[C]** CONFIRMADO (capturas da Fase A em `re/original-observation/05-data-generator/`).

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Data Generator), catálogo interno `re/ui-strings/ui-text.txt` e **capturas reais da Fase A na VM `dbforge-ref`** (`re/original-observation/05-data-generator/` e `NOTAS.md` #05).

## 1. Entrada e Documento [C: confirmado na VM]
- **Entrada:** Clique com botão direito numa tabela ou schema no Database Explorer > **Generate Data…** (`re/original-observation/05-data-generator/03-table-context-menu-1747.png`).
- **Estrutura MDI do Documento:** Abre um documento MDI dedicado `.dgen` (ex.: `sample (mysql-teste).dgen` em `04-generate-data-opened-1747.png`).
- **Cabeçalho Superior:**
  - Campo de busca rápida de tabelas e colunas.
  - Indicador de Origem/Destino: Conexão (`mysql-teste`), Versão do Servidor (`8.4.11`), Schema (`sample`).
  - Contador dinâmico: *"N table to populate"*.
  - Ícone de engrenagem para abrir as Propriedades do Projeto (*Data Generator Project Properties*).

## 2. Layout do Documento `.dgen` [C: confirmado na VM]
```
+ Aba: [sample (mysql-teste).dgen] -----------------------------------------------+
| Header: [Search 🔍]  Connection: mysql-teste · sample | [1 table to populate] [⚙]|
| Toolbar: [Populate Data ▶] [Stop] [Refresh F5] | [Save .dgen] [Generate Script...]|
+---------------------------------------+-----------------------------------------+
| PAINEL ESQUERDO                       | PAINEL DIREITO                          |
| "Tables and columns to populate"      | "Table generation settings for orders"  |
|                                       |                                         |
| Árvore com checkbox por tabela e col: | Row distribution mode:                  |
| ▾ [x] orders (1000)                   | (•) By specified number of [1000] rows  |
|     [x] id: int PK -> ID (s)          | ( ) By proportion of existing data      |
|     [x] customer_id -> Foreign Key    | ( ) By generation of data by time       |
|     [x] order_date -> Date and Time   | ( ) By proportion from lookup table     |
| ▾ [x] categories (1000) ⚠️            |                                         |
|     [x] id -> ID (s)                  | [x] Truncate data from table before gen |
|     [x] parent_id -> FK categories.id |                                         |
|     [x] name -> NickName              | Related tables:                         |
|                                       | ▾ Parent tables > categories (1000)     |
|                                       | ▾ Child tables > categories (1000)      |
+---------------------------------------+-----------------------------------------+
| PAINEL INFERIOR (Prévia de Dados em Tempo Real):                                |
| "Preview of data to be generated (first 50 rows of 1000)":                      |
| [id | ID (s)] | [parent_id | FK]   | [name | NickName]                          |
| 1             | 48                 | Conrad1997                                 |
| 2             | 44                 | Drew9                                      |
| 3             | 50                 | Kim1953                                    |
| 4             | 39                 | Latonya2022                                |
+---------------------------------------------------------------------------------+
```

## 3. Os 4 Modos de Distribuição de Linhas (Row Distribution Mode) [C: confirmado na VM]
Confirmado via painel direito em `re/original-observation/05-data-generator/04-generate-data-opened-1747.png` e opções em `10-project-options-settled-1748.png`:
1. **`(•) By specified number of [N] rows`**:
   - Padrão em todas as tabelas (default: 1.000 linhas).
   - Insere exatamente a quantidade fixa de registros informada no campo numérico.
2. **`( ) By proportion of existing data in volume of [P] %`**:
   - Calcula a quantidade de linhas a serem geradas com base no volume atual já existente na tabela (default: 10%).
   - Útil para expandir bases existentes proporcionalmente ao tamanho atual sem recalcular manualmente a cardinalidade. Se a tabela estiver vazia, gera o piso padrão ou emite aviso.
3. **`( ) By generation of data by time [S] sec`**:
   - Modo contínuo orientado a tempo (default: 10 segundos).
   - O gerador insere registros em streaming ininterrupto pelo período de tempo configurado, permitindo testes de carga, benchmark de IOPS e vazão transacional do servidor MySQL.
4. **`( ) By proportion from lookup table`**:
   - Distribui registros mantendo a proporção de linhas de uma tabela pai ou tabela de referência (lookup).
   - Permite definir multiplicadores relacionais (ex.: gerar exatamente 5 pedidos para cada cliente existente).

### 3.1 Opções de Tabela e Integridade Relacional [C]
- **Truncamento:** Checkbox `[x] Truncate data from table before generation` (limpa os dados existentes da tabela antes de popular os novos).
- **Tabelas Relacionadas (Related Tables):** Árvore exibindo dependências hierárquicas:
  - `Parent tables`: Tabelas de onde esta tabela recebe chaves estrangeiras.
  - `Child tables`: Tabelas que referenciam as chaves desta tabela.
  - A geração respeita estritamente a ordenação topológica (tabelas pai são populadas antes de tabelas filhas).

## 4. Configurações por Coluna e Catálogo de Geradores [C: confirmado na VM]
Confirmado via `06-generator-cell-clicked-1747.png` e `07-generator-dropdown-1747.png`:
- Ao selecionar uma coluna na árvore da esquerda, o painel direito exibe *"Column generation settings for <coluna>"*:
- **Combo Generator:** Seletor com busca e categorias de geradores de dados realistas (ex.: `ID (s)`, `NickName`, `Foreign Key`, `Permanent Account Number`, `Phone Extension`, `Phone Number`, `Twitter ID`, `UK National Insurance`, `Country Code`, `Email`, etc.).
- **Fill Settings:**
  - `[x] Set values to be unique`: Garante que não haja colisões de valores gerados para atender restrições `UNIQUE`.
  - `[ ] Include NULL values [P] % of rows`: Percentual de linhas que receberão valor `NULL` (desabilitado se a coluna for `NOT NULL`).
  - `[ ] Include empty values [P] % of rows`: Percentual de strings vazias.
- **Value Distribution Mode:**
  - `( ) Random by timestamp`
  - `(•) Random by seed [N]`: Geração pseudoaleatória determinística baseada em semente para testes reprodutíveis.
  - `( ) Sequential`: Sequencial estrito incremental.

## 5. Propriedades do Projeto (*Project Properties*) [C: confirmado na VM]
Confirmado via `re/original-observation/05-data-generator/08-gear-options-1747.png` a `11-after-cancel-1748.png`:
- Botão de engrenagem no cabeçalho do documento abre diálogo modal com passos:
  - **Connection:** Conexão ativa, versão do MySQL detectada, banco selecionado.
  - **Options:** Padrões globais de distribuição de linhas, truncamento, sementes padrão, tratamento de nulos/vazios e **Country-specific data** (dropdown para regionalização de nomes, telefones, endereços e códigos postais).
  - Botões: `[Save Command Line...]`, `[< Back]`, `[Next >]`, `[Open]`, `[Cancel]`.
  - Confirmação de cancelamento: *"Are you sure you want to close wizard? [Yes][No]"*.

## 6. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Painel "Schema Update Script" Docado (Pendente):** O original exibe um painel docado inferior acumulando scripts DDL necessários para alterações temporárias de integridade. No TuxSQL o DDL é gerenciado em transação única sem painel visual dedicado de DDL.
2. **Geradores Scriptáveis em C# / Python (Pendente):** No original há possibilidade de definir scripts customizados para regras de negócio específicas de geração. No TuxSQL os geradores são implementados estaticamente em TypeScript/JavaScript.

## 6. Projeto salvo [C: exportar/script a configuração]
Salvar/abrir `.dgen` (no TuxSQL em formato JSON limpo e estruturado: tabelas, geradores, parâmetros, seed; sem credenciais de segurança). Permite reaplicar a mesma configuração em múltiplos ambientes (Dev, Test, Staging).

## 7. Estados de Interface
| Estado | Comportamento |
|---|---|
| Carregando Estrutura | Shimmer skeleton na árvore de tabelas e na grade de pré-visualização |
| Gerando Prévia | Atualização instantânea com indicador de carregamento discreto |
| Executando Geração | Barra de progresso com contador dinâmico de linhas gravadas e velocidade |
| Conclusão com Sucesso | Relatório consolidado verde com tempo decorrido e opção de abrir os dados |
| Violação de Restrição | Aviso inline indicando coluna e restrição conflitante |

## 8. Atalhos de Teclado
- Iniciar Geração: `Ctrl+Enter`
- Atualizar Prévia (Preview): `F5`
- Salvar Projeto `.dgen`: `Ctrl+S`
- Parar / Cancelar: `Esc`
- Editar Parâmetros do Gerador: `F2`

## 9. Temas e Acessibilidade
- Conformidade total com os tokens de design system de `01-shell.md`.
- Cores de destaque e indicadores de integridade possuem ícones associados para não depender exclusivamente de cor.
- Árvores e grades de propriedades totalmente navegáveis por teclado.

## 10. Componentes
`DataGeneratorDocument`, `TableColumnTree`, `GeneratorSettingsPanel`, `PreviewGrid`, `DistributionModeRadioGroup`, `ReportSummaryDialog`.

## 11. Critérios de Aceite
- Permite selecionar tabelas e colunas, configurando geradores individuais ou por lote.
- Respeita integridade referencial de Foreign Keys gerando dados dependentes em ordem válida.
- Gera dados diretamente no banco ou exporta para script SQL.
- Prévia de dados reflete imediatamente qualquer alteração nos parâmetros do gerador.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Data Generator | Título do documento | `dg.title` |
| New Data Generation... / Open Data Generation... | Comandos de projeto (`*.dgen`) | `dg.cmd.new` / `dg.cmd.open` |
| Choose connection and database for data generation. | Passo de origem | `dg.step.source` |
| Truncate table data before the data generation process. | Opção de modo | `dg.opt.truncate` |
| Generate test data and instantly populate your database | Destino: gravar no banco | `dg.out.populate` |
| Open the data population script in the internal editor | Destino: script no editor | `dg.out.script` |
| Data Generation. Populating ({0}%): writing changes to {1}. | Progresso | `dg.progress.populate` |
| Data Generation. Generating script ({0}%): writing changes to {1}. | Progresso | `dg.progress.script` |
| Data population {0} done. | Log de conclusão | `dg.log.done` |
| An error occurred during the data generation process: '{0}' | Erro | `dg.err.generic` |
| Column '{0}' excluded from data generation. | Aviso por coluna | `dg.warn.colExcluded` |
| Data Generator cannot be created for the '{0}' foreign key column. | Erro de FK | `dg.err.fk` |
| The '{0}' column of the '{1}' table does not contain a data generator. | Erro de coluna sem generator | `dg.err.noGenerator` |
| The {0} table has circular foreign key self-references... cannot resolve. | Erro de ciclo | `dg.err.circular` |
| A circular dependency has been detected. To populate data, enable the 'Disable foreign keys' option. | Dica de ciclo | `dg.hint.disableFk` |
| The generator selected may generate improper values due to the CHECK constraint. | Aviso de CHECK | `dg.warn.check` |
| The specified number of rows requires a significant amount of disk space. | Aviso de espaço | `dg.warn.disk` |
| Selected tables have errors and data generation may fail. Check settings. | Aviso antes de gerar | `dg.warn.tables` |
| Save Generator As... / Insert data generator | Gerador customizado | `dg.cmd.saveGen` |
