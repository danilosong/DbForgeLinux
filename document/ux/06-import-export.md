# UX 06 — Wizards de Import/Export de dados

> Fidelidade REA: rótulos conferidos contra REA ui-text (Data Export/Import Wizard, modos Append/Update/Append-Update/Delete, Errors handling, templates .det/.dit) e **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas em `re/original-observation/07-import-export/`).

Reusa `01-shell.md` (Dialog, FormField, Banner, ProgressBar) e `02` (FilePicker). Formatos v1: CSV, TSV, JSON, XML, SQL (INSERT), Excel (XLSX), HTML, Markdown (export); import: CSV, TSV, JSON, XML, XLSX, SQL. Google Sheets: P3 (desabilitado/oculto). Formatos legados Windows (MS Access, DBF, ODBC): fora do escopo Linux.

## 1. Entradas
- **Export:** Menu Data > Export Data…; Database Explorer > tabela/view/database > Export Data…; grid de resultado [Export ▾] (exporta o resultado da consulta atual); aba de dados > Export.
- **Import:** Menu Data > Import Data…; Database Explorer > tabela > Import Data… (destino pré-selecionado).
- Tarefas guardadas ("Save template", seção 6) acessíveis em Tools > Data Tasks.

## 2. Estrutura do wizard
Diálogo modal redimensionável 780x580 (min 700x520). 
- Cabeçalho: Título dinâmico que reflete o formato selecionado (ex.: "Data Export CSV" ou "Data Import from CSV").
- Stepper lateral/horizontal com passos numerados (passo ativo em accent, concluídos com ✓, futuros em cinza; clique em passo anterior concluído permite navegação direta).
- Rodapé padronizado:
  - Esquerda: botão com dropdown `[Save ▾]` ("Save Template..." e "Save Command Line File...").
  - Direita: `[< Back]` `[Next >]` `[Export]` / `[Import]` `[Cancel]`.
  - Teclas: `Enter` = Next/ação primária; `Esc` = Cancelar (com diálogo de confirmação se já houver configurações feitas); `Ctrl+←` / `Ctrl+→` = Back/Next. Validação em cada etapa antes de avançar.

## 3. EXPORT DATA WIZARD (9 Passos Observados na VM)

Passos: **1 Export format → 2 Source → 3 Output settings → 4 Options → 5 Data formats → 6 Exported rows → 7 Errors handling → 8 Export → 9 Finish**.

### 3.1 Passo 1: Export format
- Categorias no topo: `All Items` | `Formats` | `Templates`.
- Alternância de visualização: Grade de cartões de ícones grandes vs Lista detalhada.
- 14 Formatos de referência: HTML, Text, MS Excel, MS Excel 2007, Google Sheets (P3), MS Access (Windows), RTF, PDF, JSON, XML, CSV, ODBC (Windows), DBF (Windows), SQL.
- No TuxSQL (Linux): formatos suportados são CSV, TSV, JSON, XML, SQL, Excel (XLSX), HTML e Markdown.
- Painel inferior: descrição explicativa do formato focado.
- Seção "User Templates" com link "Load Template...".

### 3.2 Passo 2: Source
- Conexão e Database (seletores combo).
- Árvore de objetos "Tables and Views" com caixas de seleção (checkbox).
- Campo de busca instantânea com filtro por nome.
- Ao abrir pelo menu de contexto de uma tabela, ela já vem marcada por padrão.
- Validação: bloqueia avanço se nenhum objeto for selecionado ("Select at least one table or view").

### 3.3 Passo 3: Output settings
- Modo de destino:
  - `( ) Export data into separated files`: campo de pasta de destino (`Folder`), gravando um arquivo por tabela.
  - `(•) Export data into single file`: campo de arquivo único (`File name`, padrão `~/Documents/TuxSQL/Export/<tabela>.<ext>`).
- Opções de arquivo:
  - `☑ Append timestamp to the file name`: adiciona carimbo de data e hora formatado.
  - `☐ Auto delete old files`: política de retenção (arquivos com mais de N dias ou quantidade maior que N).
  - `☐ Use compression (Zip)`: compactação com nível de compressão, senha, comentário e criptografia.
- "Exported files preview": exibe em tempo real o caminho e nome final gerado com o timestamp resolvido.

### 3.4 Passo 4: Options (Específicas por formato)
| Formato | Opções Disponíveis |
|---|---|
| CSV/TSV | Encoding (Unicode UTF-8 padrão, Latin1, ASCII), Field Delimiter (`,`, `;`, Tab, `|`, custom), Field Quote (`"`, `'`, None), Quote strategy (Needed, All, Strings only), Escape char, ☑ Include column header, ☐ Force field quotes, Line ending (LF Linux padrão / CRLF), Null as (vazio, `NULL`, custom) |
| JSON | Estrutura (Array de objetos ou Objeto único por tabela), Pretty print com indentação, Binary as base64, Null as null |
| XML | Root element name, Row element name, Atributos vs Elementos filhos, Pretty print, Encoding |
| SQL | Incluir DDL (CREATE TABLE, DROP IF EXISTS), INSERT multi-row (lote padrão 500 linhas), Nomes de colunas explícitos nos INSERTs, Disable foreign key checks, Quote identificadores com crases, Dados e/ou estrutura |
| Excel (XLSX) | Uma planilha por tabela ou arquivo único, Cabeçalhos em negrito, Auto-ajuste de largura de colunas, Divisão de abas em caso de limite de 1.048.576 linhas |
| HTML / Markdown | Tabela HTML estilizada responsiva / Markdown Pipe table com escape de pipes |

### 3.5 Passo 5: Data formats
- Abas superiores: `Columns` | `Formats`.
- Aba `Columns`: Grade com `[☑] Include` | `Column Name` | `Alias` (editável) | `Data Type` (Integer, String, HexString para BLOBs, DateTime, Float).
- Aba `Formats`: Formato de data/hora (ISO padrão, customizado), separador decimal (ponto/vírgula), separador de milhares, representação booleana (True/False, 1/0).

### 3.6 Passo 6: Exported rows
- Seletor de escopo de registros:
  - `(•) Export all rows`: todas as linhas da tabela.
  - `( ) Export selected rows only`: apenas linhas marcadas previamente no grid de dados.
  - `( ) Export a range of rows`: intervalo personalizado (`Start from: [1]`, `Count: [1000]`; 0 para todas a partir do início).

### 3.7 Passo 7: Errors handling
- Estratégia de falha:
  - `(•) Abort at the first error`: interrompe a exportação imediatamente no primeiro erro.
  - `( ) Prompt a user for an action`: exibe diálogo interativo perguntando se deseja parar ou ignorar.
  - `( ) Ignore all errors`: continua a exportação ignorando registros ou tabelas problemáticas.
- Configurações de log:
  - `☑ Write a report to a log file`: grava arquivo de log detalhado em `$XDG_STATE_HOME/tuxsql/logs/DataExport.log`.

### 3.8 Passo 8: Export (Execução)
- Barra de progresso determinada com percentual.
- Tabela por objeto: Objeto | Status (⏳ Executando / ✓ Concluído / ✕ Erro) | Linhas Exportadas | Taxa (linhas/seg) | Tempo Decorrido.
- Botão `[Cancel]` com interrupção segura.
- Botão `[Run in background]` para liberar a janela do assistente.

### 3.9 Passo 9: Finish (Conclusão e Relatório)
- Título de conclusão: "Data Export finished successfully." (verde) ou "Data Export finished with errors." (âmbar).
- Total de linhas e tabelas processadas ("Exported {0} of {1} rows.").
- Ações rápidas de encerramento:
  - `[Open File]` (abre o arquivo exportado no visualizador padrão via `xdg-open`).
  - `[Open Containing Folder]` (abre a pasta no gerenciador de arquivos).
  - `[Show log file]` (abre o arquivo de log).
  - `[Export more]` (retorna ao passo inicial para nova tarefa).
  - `[Close]`.

---

## 4. IMPORT DATA WIZARD (10 Passos Observados na VM)

Passos: **1 Source file → 2 Destination → 3 Options → 4 Data formats → 5 Mapping → 6 Modes → 7 Output → 8 Errors handling → 9 Import → 10 Finish**.

### 4.1 Passo 1: Source file
- Formatos de importação (10): CSV, TSV, Text, MS Excel (XLSX), XML, JSON, SQL. (Google Sheets, MS Access e ODBC desabilitados/fora de escopo).
- Campo `File name:` no rodapé com botão `[...]` para seleção via FilePicker ou suporte a arrastar e soltar (drag & drop).
- Exibição de metadados do arquivo: tamanho em bytes, data de modificação e codificação detectada.

### 4.2 Passo 2: Destination
- Seleção de Conexão e Database de destino.
- Escolha da tabela:
  - **Tabela existente**: selecionada no combo com listagem das tabelas do banco.
  - **Nova tabela** (`New Table`): digitação do nome de uma nova tabela a ser criada dinamicamente. Os tipos e constraints são inferidos automaticamente a partir dos dados no passo de mapeamento.

### 4.3 Passo 3: Options (Opções de Leitura)
- CSV/TSV: Delimitador de campos, caractere de aspas, caractere de escape, número da linha de cabeçalho (Header row), quantidade de linhas a pular no início, tratamento de strings vazias como `NULL`.
- JSON: caminho do array raiz, opção de achatar (flatten) objetos aninhados com notação de ponto.
- XML: seleção do nó raiz e elemento repetidor de registro (row element).
- Excel: seleção da planilha/aba interna e intervalo de células.
- Preview instantâneo das primeiras 20 linhas lidas com o parser ativo.

### 4.4 Passo 4: Data formats
- Formato de interpretação de datas e horas (`YYYY-MM-DD`, `DD/MM/YYYY`, etc.).
- Tratamento de casas decimais e separadores de milhar.
- Representação de valores booleanos e campos binários (Hex / Base64).

### 4.5 Passo 5: Mapping (Mapeamento de Colunas)
- Grade de mapeamento:
  - `Coluna de Origem (com amostra de dados)` → `[→]` → `Coluna de Destino` | `Tipo de Dados Destino` | `Chave Primária (PK)` | `Transformação` (Nenhuma, Trim, Maiúsculas, Minúsculas).
- Botões de conveniência: `[Auto-map by Name]`, `[Map by Position]`, `[Clear Mapping]`.
- Avisos visuais: incompatibilidade de tipos de dados (âmbar), coluna NOT NULL sem valor padrão e sem mapeamento (vermelho, bloqueante).
- Nova tabela: permite definir nomes de colunas, tipos SQL (`INT`, `VARCHAR(255)`, `DATETIME`, `DECIMAL`, `TEXT`), nulabilidade e seleção de PK.

### 4.6 Passo 6: Modes (Modo de Importação)
- Modos suportados:
  - **Append** (`INSERT`): insere novas linhas; falha em chaves duplicadas.
  - **Update**: atualiza registros existentes que coincidam na chave primária/única.
  - **Append/Update**: upsert (`INSERT ... ON DUPLICATE KEY UPDATE`).
  - **Delete**: remove do banco as linhas existentes que correspondam às chaves do arquivo.
  - **Repopulate**: executa `TRUNCATE TABLE` seguido de inserção completa (exige confirmação destrutiva digitando o nome da tabela).
- Opções de execução:
  - Tamanho do lote (batch size, padrão 500 linhas).
  - Usar transação única com rollback total vs transação por lote.
  - Desabilitar temporariamente checagem de Foreign Keys (`FOREIGN_KEY_CHECKS=0`).

### 4.7 Passo 7: Output
- Modo de execução:
  - `(•) Execute data import directly against the database`: executa a importação direta via driver MySQL com queries parametrizadas.
  - `( ) Generate synchronization script and open in editor`: gera script SQL completo contendo os INSERTs/UPDATEs para revisão e execução manual.

### 4.8 Passo 8: Errors handling
- Estratégia de erro idêntica à exportação: Abort at first error, Prompt user for action, Ignore all errors.
- Geração de arquivo de rejeitados: `☑ Write rejected rows to a separate file` (`<origem>.rejected.csv`).
- Arquivo de log detalhado.

### 4.9 Passo 9: Import (Execução)
- Progresso em tempo real: linhas lidas, inseridas, atualizadas, ignoradas e rejeitadas.
- Estimativa de tempo restante e velocidade em linhas por segundo.
- Botão `[Cancel]` com reversão de transação se configurado modo transação única.

### 4.10 Passo 10: Finish (Conclusão e Relatório)
- Relatório consolidado: linhas processadas com sucesso vs linhas rejeitadas.
- Ações:
  - `[Open rejected file]` (se houver erros).
  - `[Open table data]` (abre o grid de dados da tabela no editor).
  - `[Show log file]`.
  - `[Import more]`.
  - `[Close]`.

---

## 5. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Conector Google Sheets com OAuth 2.0 (Pendente/P3):** No original há opção de autenticação direta em nuvem para planilhas Google Sheets. No TuxSQL o conector está oculto/desabilitado por focar em ferramentas locais sem telemetria/nuvem.
2. **Compactação Zip com Criptografia no Wizard de Exportação (Pendente):** No original há a opção direta "Use compression (Zip)" com senha no passo Output Settings. O TuxSQL exporta os arquivos diretamente no sistema de arquivos local.
3. **Regra de Limpeza Periódica de Arquivos Antigos (Pendente):** O original implementa rotina de exclusão automática no destino ("Auto delete old files older than N days / quantity more than N"). O TuxSQL preserva os arquivos sem remoção automática em background.
4. **Formato Binário de Templates .det e .dit:** O original usa serializadores binários de templates do Windows. O TuxSQL adota formato JSON limpo em `$XDG_CONFIG_HOME/tuxsql/data-tasks`.
5. **Drivers Legados Windows MS Access, DBF e ODBC DSN (Divergência Intencional Linux):** Suporte exclusivo a formatos abertos e universais.

## 6. Estados de Interface
| Estado | Comportamento |
|---|---|
| Carregando dados / Preview | Shimmer skeleton na grade de pré-visualização + spinner no rodapé |
| Arquivo de Origem Vazio / Inválido | Banner de erro bloqueando o botão [Next >] |
| Violação de Mapeamento (NOT NULL) | Ícone de exclamação vermelho na linha da coluna com tooltip explicativo |
| Execução em Andamento | Barra de progresso com contador dinâmico e cálculo de velocidade (linhas/s) |
| Falha Parcial com Rejeitados | Selo âmbar no Finish com link direto para abrir arquivo `.rejected.csv` |
| Modo Repopulate (Destrutivo) | Diálogo com fundo vermelho exigindo digitação do nome exato da tabela |

## 7. Atalhos de Teclado
- Próximo passo: `Ctrl+→` ou `Enter`
- Passo anterior: `Ctrl+←`
- Cancelar: `Esc`
- Executar (último passo): `Ctrl+Enter`
- Selecionar tudo nas listas: `Ctrl+A`
- Atualizar preview: `F5`

## 8. Temas e Acessibilidade
- Tokens de design system de `01-shell.md` plenamente respeitados no tema Claro e Escuro.
- Stepper possui marcação `aria-current="step"`, números explícitos e ícones de status além da cor.
- Grids de mapeamento totalmente navegáveis por teclado (`Tab`, setas, `Space` para alternar combos).

## 9. Componentes
`WizardDialog`, `Stepper`, `FormatGalleryCard`, `ObjectCheckTree`, `OutputSettingsForm`, `OptionsForm`, `ColumnMappingGrid`, `DataFormatForm`, `ExecutionProgressCard`, `ReportSummaryView`, `TemplateManagerModal`.

## 10. Critérios de Aceite
- Exportação nos formatos CSV, TSV, JSON, XML, SQL e XLSX gera arquivos válidos com opções customizáveis.
- Importação executa mapeamento automático por nome, validação de tipos e modos Append/Update/Upsert/Repopulate.
- Importação em tabela nova infere tipos primitivos corretos e gera schema MySQL compatível (`utf8mb4`).
- Tela Finish oferece ações seguras de abertura de arquivo, pasta e log através de IPC.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Data Export Wizard / Data Import from | Título do diálogo | `io.export.title / io.import.title` |
| Export Data... | Menu Data, Explorer | `io.export.menu` |
| Export format | Passo Formato (Export) | `io.export.format` |
| Export data into single file / Export data into separated files | Modo de destino | `io.export.mode.single / io.export.mode.separate` |
| Choose a source table for export. | Dica do passo Origem | `io.export.source.hint` |
| Choose a destination table for import. | Dica do passo Destino (Import) | `io.import.target.hint` |
| Choose an import mode. | Dica do passo Modo | `io.import.mode.hint` |
| Append / Update / Append/Update / Delete | Modos de importação | `io.import.mode.*` |
| Delimiter; Encoding:; Null String:; Include column header | Opções CSV/TXT | `io.opt.delimiter / encoding / nullString / header` |
| Errors handling | Seção de tratamento de erros | `io.errors.title` |
| Abort at the first error; Ignore all errors | Opções de erro | `io.errors.abort / io.errors.ignore` |
| Check "Open folder" to open a folder that contains a result file after the wizard is closed. | Tooltip da opção Open folder | `io.dest.openFolder.hint` |
| Exported files preview: | Preview de arquivos exportados | `io.export.preview` |
| Exporting: {0}{1} / Exporting ({2,2}%): {0}{1} | Execução (progresso) | `io.export.progress` |
| Importing data from {0} to table {1} | Execução (progresso) | `io.import.progress` |
| {0} rows imported, {1}% | Execução (contador) | `io.import.rowsPct` |
| Exported {0} of {1} rows. | Relatório | `io.export.rowsOfTotal` |
| Are you sure you want to stop exporting data? | Confirmação ao cancelar | `io.export.cancelConfirm` |
| Do you want to continue data exporting? | Pergunta após erro em objeto | `io.export.continueAfterError` |
| Data Export finished successfully. | Relatório (sucesso) | `io.export.done` |
| Data Export finished with errors. | Relatório (com erros) | `io.export.doneWithErrors` |
| Data export failed. / Data Import failed. | Relatório (falha) | `io.export.failed / io.import.failed` |
| Data Import aborted by a user. | Relatório (cancelado) | `io.import.aborted` |
| Data, selected for import, has NULL values for not nullable columns. | Validação de mapeamento (Import) | `io.import.nullViolation` |
| Option {0} is not supported by the import format | Validação de opções | `io.import.optionUnsupported` |
| Open File / Open Containing Folder | Ações do relatório | `io.report.openFile / io.report.openFolder` |
| Data Export Template files (*.det) / Data Import Template files (*.dit) | Filtros de arquivo de template | `io.template.filter` |
| Load Template... | Rodapé do wizard | `io.template.load` |
| Export to Google Sheets / Import from Google Sheets | Formato (P3, oculto) | `io.format.googleSheets` |
