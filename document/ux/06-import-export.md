# UX 06 — Wizards de Import/Export de dados

> Fidelidade REA: rótulos conferidos contra REA ui-text (Data Export/Import Wizard, modos Append/Update/Append-Update/Delete, Errors handling, templates .det/.dit) e **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas em `re/original-observation/07-import-export/` e varredura completa em `re/original-observation/p2-03-import-export/`).
- **[C] Evidências Reais de Exportação (`re/original-observation/p2-03-import-export/`):**
  - Entrada pelo nó de tabelas e menu de contexto: `re/original-observation/p2-03-import-export/01-tables-node-1829.png`, `re/original-observation/p2-03-import-export/02-table1-context-1830.png`.
  - Passo 1 (Export format, 14 formatos): `re/original-observation/p2-03-import-export/03-export-wizard-1-1830.png`, `re/original-observation/07-import-export/export-1.png`, `re/original-observation/07-import-export/export-csv-selecionado.png`.
  - Passo 2 (Source e prompt de reload externo): `re/original-observation/p2-03-import-export/04-export-source-1830.png`, `re/original-observation/p2-03-import-export/06-source-after-reload-1830.png`.
  - Passo 3 (Output settings com timestamp preview e zip): `re/original-observation/p2-03-import-export/05-export-output-1830.png`, `re/original-observation/p2-03-import-export/07-output-settings-1830.png`, `re/original-observation/07-import-export/export-csv-2.png`.
  - Passo 4 (Options com delimitadores, quotes e encoding UTF-8): `re/original-observation/p2-03-import-export/08-export-options-1831.png`, `re/original-observation/07-import-export/export-csv-3.png`.
  - Passo 5 (Data formats, abas Columns e Formats): `re/original-observation/p2-03-import-export/09-export-data-formats-1831.png`, `re/original-observation/07-import-export/export-csv-4.png`.
  - Passo 6 (Exported rows, all/selected/range): `re/original-observation/p2-03-import-export/10-export-rows-1831.png`, `re/original-observation/07-import-export/export-csv-5.png`.
  - Passo 7 (Errors handling, abort/prompt/ignore e log): `re/original-observation/p2-03-import-export/11-errors-handling-1831.png`, `re/original-observation/07-import-export/export-csv-6.png`.
  - Passo 8 (Export / Execução): `re/original-observation/p2-03-import-export/12-export-page-1831.png`, `re/original-observation/p2-03-import-export/14-export-result-1831.png`.
  - Passo 9 (Finish com links Open result file/folder e estatísticas): `re/original-observation/p2-03-import-export/13-finish-page-1831.png`, `re/original-observation/p2-03-import-export/15-after-finish-1831.png`, `re/original-observation/07-import-export/export-csv-7.png`.
- **[C] Evidências Reais de Importação (`re/original-observation/p2-03-import-export/`):**
  - Passo 1 (Source file, 10 formatos e browser nativo): `re/original-observation/p2-03-import-export/16-import-wizard-1-1832.png`, `re/original-observation/p2-03-import-export/17-import-file-browser-1832.png`, `re/original-observation/p2-03-import-export/18-import-file-selected-1832.png`, `re/original-observation/07-import-export/import-1.png`.
  - Passo 2 (Destination, New table vs Existing table): `re/original-observation/p2-03-import-export/19-import-destination-1832.png`.
  - Passo 3 (Options, codepage 65001, header position, preview 50 linhas): `re/original-observation/p2-03-import-export/20-import-options-1832.png`.
  - Passo 4 (Data formats, Null String, data/hora autodetect): `re/original-observation/p2-03-import-export/21-import-data-formats-1832.png`.
  - Passo 5 (Mapping, grade de colunas e toolbar): `re/original-observation/p2-03-import-export/22-import-mapping-1832.png`.
  - Passo 6 (Modes, Append/Update/Delete/Repopulate e transação única): `re/original-observation/p2-03-import-export/23-import-modes-1832.png`.
  - Passo 7 (Output, direto no banco ou gerar script): `re/original-observation/p2-03-import-export/24-import-output-1833.png`.
  - Passo 8 (Errors handling e log): `re/original-observation/p2-03-import-export/25-import-errors-handling-1833.png`, `re/original-observation/p2-03-import-export/26-import-last-page-1833.png`.
  - Passos 9 e 10 (Import execução, resultado e fechamento): `re/original-observation/p2-03-import-export/27-import-result-1833.png`, `re/original-observation/p2-03-import-export/28-import-closed-1833.png`.

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

### 3.1 Passo 1: Export format [C: re/original-observation/p2-03-import-export/03-export-wizard-1-1830.png, re/original-observation/07-import-export/export-1.png]
- Categorias no topo: `All Items` | `Formats` | `Templates`.
- Alternância de visualização: Grade de cartões de ícones grandes vs Lista detalhada.
- 14 Formatos de referência [C]: HTML, Text, MS Excel, MS Excel 2007, Google Sheets (P3), MS Access (Windows), RTF, PDF, JSON, XML, CSV (selecionado por padrão [C: `re/original-observation/07-import-export/export-csv-selecionado.png`]), ODBC (Windows), DBF (Windows), SQL.
- No TuxSQL (Linux): formatos suportados são CSV, TSV, JSON, XML, SQL, Excel (XLSX), HTML e Markdown.
- Painel inferior: descrição explicativa do formato focado ("Export to Comma-separated values file").
- Seção "User Templates" com link "Load Template...".

### 3.2 Passo 2: Source [C: re/original-observation/p2-03-import-export/04-export-source-1830.png, re/original-observation/p2-03-import-export/06-source-after-reload-1830.png]
- Conexão e Database (seletores combo).
- Árvore de objetos "Tables and Views" com caixas de seleção (checkbox).
- Campo de busca instantânea com filtro por nome.
- Ao abrir pelo menu de contexto de uma tabela (`re/original-observation/p2-03-import-export/02-table1-context-1830.png`), ela já vem marcada por padrão.
- Detecção de modificação externa: se o objeto foi alterado fora do assistente, exibe diálogo modal "Object {name} was modified outside of the editor. Do you want to reload? [Yes] [No]" (`re/original-observation/p2-03-import-export/04-export-source-1830.png`).
- Validação: bloqueia avanço se nenhum objeto for selecionado ("Select at least one table or view").

### 3.3 Passo 3: Output settings [C: re/original-observation/p2-03-import-export/05-export-output-1830.png, re/original-observation/p2-03-import-export/07-output-settings-1830.png, re/original-observation/07-import-export/export-csv-2.png]
- Modo de destino:
  - `( ) Export data into separated files`: campo de pasta de destino (`Folder`), gravando um arquivo por tabela.
  - `(•) Export data into single file`: campo de arquivo único (`File name`, padrão `~/Documents/TuxSQL/Export/<tabela>.<ext>`).
- Opções de arquivo:
  - `☑ Append timestamp to the file name`: adiciona carimbo de data e hora formatado (`table1_202610211830.csv`).
  - `☐ Auto delete old files`: política de retenção (arquivos com mais de N dias ou quantidade maior que N).
  - `☐ Use compression (Zip)`: compactação com nível de compressão, senha, comentário e criptografia.
- "Exported files preview": exibe em tempo real o caminho e nome final gerado com o timestamp resolvido.

### 3.4 Passo 4: Options (Específicas por formato) [C: re/original-observation/p2-03-import-export/08-export-options-1831.png, re/original-observation/07-import-export/export-csv-3.png]
| Formato | Opções Disponíveis |
|---|---|
| CSV/TSV [C] | Encoding (Unicode UTF-8 padrão, Latin1, ASCII), Field Delimiter (`,`, `;`, Tab, `|`, custom), Field Quote (`"`, `'`, None), Quote strategy (Needed, All, Strings only), Escape char, ☑ Include column header, ☐ Force field quotes, Line ending (LF Linux padrão / CRLF), Null as (vazio, `NULL`, custom) |
| JSON [I] | Estrutura (Array de objetos ou Objeto único por tabela), Pretty print com indentação, Binary as base64, Null as null |
| XML [I] | Root element name, Row element name, Atributos vs Elementos filhos, Pretty print, Encoding |
| SQL [I] | Incluir DDL (CREATE TABLE, DROP IF EXISTS), INSERT multi-row (lote padrão 500 linhas), Nomes de colunas explícitos nos INSERTs, Disable foreign key checks, Quote identificadores com crases, Dados e/ou estrutura |
| Excel (XLSX) [I] | Uma planilha por tabela ou arquivo único, Cabeçalhos em negrito, Auto-ajuste de largura de colunas, Divisão de abas em caso de limite de 1.048.576 linhas |
| HTML / Markdown [I] | Tabela HTML estilizada responsiva / Markdown Pipe table com escape de pipes |

### 3.5 Passo 5: Data formats [C: re/original-observation/p2-03-import-export/09-export-data-formats-1831.png, re/original-observation/07-import-export/export-csv-4.png]
- Abas superiores: `Columns` | `Formats`.
- Aba `Columns`: Grade com `[☑] Include` | `Column Name` | `Alias` (editável) | `Data Type` (Integer, String, HexString para BLOBs, DateTime, Float).
- Aba `Formats`: Formato de data/hora (ISO padrão, customizado), separador decimal (ponto/vírgula), separador de milhares, representação booleana (True/False, 1/0).

### 3.6 Passo 6: Exported rows [C: re/original-observation/p2-03-import-export/10-export-rows-1831.png, re/original-observation/07-import-export/export-csv-5.png]
- Seletor de escopo de registros:
  - `(•) Export all rows`: todas as linhas da tabela.
  - `( ) Export selected rows only`: apenas linhas marcadas previamente no grid de dados.
  - `( ) Export a range of rows`: intervalo personalizado (`Start from: [1]`, `Count: [1000]`; 0 para todas a partir do início).

### 3.7 Passo 7: Errors handling [C: re/original-observation/p2-03-import-export/11-errors-handling-1831.png, re/original-observation/07-import-export/export-csv-6.png]
- Estratégia de falha:
  - `(•) Abort at the first error`: interrompe a exportação imediatamente no primeiro erro.
  - `( ) Prompt a user for an action`: exibe diálogo interativo perguntando se deseja parar ou ignorar.
  - `( ) Ignore all errors`: continua a exportação ignorando registros ou tabelas problemáticas.
- Configurações de log:
  - `☑ Write a report to a log file`: grava arquivo de log detalhado em `$XDG_STATE_HOME/tuxsql/logs/DataExport.log`.

### 3.8 Passo 8: Export (Execução) [C: re/original-observation/p2-03-import-export/12-export-page-1831.png, re/original-observation/p2-03-import-export/14-export-result-1831.png]
- Barra de progresso determinada com percentual.
- Tabela por objeto: Objeto | Status (⏳ Executando / ✓ Concluído / ✕ Erro) | Linhas Exportadas | Taxa (linhas/seg) | Tempo Decorrido.
- Botão `[Cancel]` com interrupção segura.
- Botão `[Run in background]` para liberar a janela do assistente [I].

### 3.9 Passo 9: Finish (Conclusão e Relatório) [C: re/original-observation/p2-03-import-export/13-finish-page-1831.png, re/original-observation/p2-03-import-export/15-after-finish-1831.png, re/original-observation/07-import-export/export-csv-7.png]
- Título de conclusão: "Data Export finished successfully." (verde) ou "Data Export finished with errors." (âmbar).
- Total de linhas e tabelas processadas ("Exported {0} of {1} rows.", "Errors count: 0").
- Ações rápidas de encerramento:
  - `[Open result file...]` (abre o arquivo exportado via `xdg-open`).
  - `[Open result folder...]` (abre a pasta no gerenciador de arquivos).
  - `[Show log file...]` (abre o arquivo de log).
  - `[Export more]` (retorna ao passo inicial para nova tarefa).
  - `[Close]`.

---

## 4. IMPORT DATA WIZARD (10 Passos Observados na VM)

Passos: **1 Source file → 2 Destination → 3 Options → 4 Data formats → 5 Mapping → 6 Modes → 7 Output → 8 Errors handling → 9 Import → 10 Finish**.

### 4.1 Passo 1: Source file [C: re/original-observation/p2-03-import-export/16-import-wizard-1-1832.png, re/original-observation/p2-03-import-export/17-import-file-browser-1832.png, re/original-observation/p2-03-import-export/18-import-file-selected-1832.png, re/original-observation/07-import-export/import-1.png]
- Formatos de importação na grade (10 observados): CSV, Text, MS Excel, MS Excel 2007, XML, JSON, Google Sheets, MS Access, DBF, ODBC.
- No TuxSQL: CSV, TSV, Text, MS Excel (XLSX), XML, JSON, SQL. (Google Sheets, MS Access e ODBC desabilitados/fora de escopo).
- Campo `File name:` no rodapé com botão `[...]` para seleção via FilePicker nativo (`re/original-observation/p2-03-import-export/17-import-file-browser-1832.png`).
- Validação: botões `Next >` e `Import` ficam desabilitados enquanto nenhum arquivo for selecionado (`re/original-observation/p2-03-import-export/16-import-wizard-1-1832.png`). Ao selecionar arquivo válido, habilitam-se (`re/original-observation/p2-03-import-export/18-import-file-selected-1832.png`).

### 4.2 Passo 2: Destination [C: re/original-observation/p2-03-import-export/19-import-destination-1832.png]
- Seleção de Conexão e Database de destino (`mysql-teste / obs_p2`).
- Escolha da tabela:
  - `(•) New table`: sugere automaticamente o nome derivado (ex.: `table11`).
  - `( ) Existing table`: lista as tabelas existentes com botão Refresh.

### 4.3 Passo 3: Options (Opções de Leitura) [C: re/original-observation/p2-03-import-export/20-import-options-1832.png]
- CSV/TSV: Encoding (Unicode UTF-8 - Codepage 65001), Field Quote (`"`), Skip Lines (`1`), Header Position (`1`), Field Delimiter (Auto defined).
- Preview dinâmico: primeiras 50 linhas do arquivo lidas com o parser ativo ("Preview (first 50 rows)").

### 4.4 Passo 4: Data formats [C: re/original-observation/p2-03-import-export/21-import-data-formats-1832.png]
- Abas superiores: `Common Formats` | `Column Settings`.
- Common Formats: Null String (`null`), Thousand separator (`,`), Decimal separator (`,`), Boolean (`true;false`), Date and Time format com `[☑] Autodetect Date and Time format`.

### 4.5 Passo 5: Mapping (Mapeamento de Colunas) [C: re/original-observation/p2-03-import-export/22-import-mapping-1832.png]
- Toolbar superior: `New Column...` | `Delete` | `▲ / ▼` | `Fill Mapping` | `Clear Mappings`.
- Grade de mapeamento: `Key` (PK) | `Column` | `Type` | `Source column`.
- Painel inferior com abas de detalhe da coluna mapeada selecionada.

### 4.6 Passo 6: Modes (Modo de Importação) [C: re/original-observation/p2-03-import-export/23-import-modes-1832.png]
- Modos suportados na grade com descrição:
  - **Append** (`INSERT`): adiciona novos registros.
  - **Update**: atualiza registros existentes que coincidam na chave primária.
  - **Append/Update**: insere novos e atualiza existentes (`ON DUPLICATE KEY UPDATE`).
  - **Delete**: remove registros existentes correspondentes.
  - **Repopulate**: limpa tabela e insere todos (`TRUNCATE + INSERT`).
- Opções de execução:
  - `☑ Use a single transaction`: executa a importação em transação única com rollback automático em caso de erro.
  - `☑ Synchronize position of the identity/auto_increment column` [I].

### 4.7 Passo 7: Output [C: re/original-observation/p2-03-import-export/24-import-output-1833.png]
- Modo de execução:
  - `(•) Execute data import directly against the database`: executa diretamente via conexão MySQL.
  - `( ) Open the data import script in the internal editor`: gera script SQL completo contendo os statements para revisão e execução manual.
  - `( ) Save the data import script to a file`: grava script SQL em arquivo no disco.

### 4.8 Passo 8: Errors handling [C: re/original-observation/p2-03-import-export/25-import-errors-handling-1833.png, re/original-observation/p2-03-import-export/26-import-last-page-1833.png]
- Estratégia de erro: `(•) Abort at the first error`, `( ) Prompt a user for an action`, `( ) Ignore all errors`.
- Log: `☑ Write a report to a log file` com caminho customizável.

### 4.9 Passo 9: Import (Execução) e 4.10 Passo 10: Finish [C: re/original-observation/p2-03-import-export/27-import-result-1833.png, re/original-observation/p2-03-import-export/28-import-closed-1833.png]
- Ao concluir a importação, exibe mensagem: "Data Import finished successfully." / "Errors count: 0" / "Imported 0 rows." (`re/original-observation/p2-03-import-export/27-import-result-1833.png`).
- Ações: `[Show log file...]` (desabilitado se vazio), `[Import more]`, `[Close]`.
- Ao fechar, o wizard é encerrado limpamente retornando ao editor/explorer (`re/original-observation/p2-03-import-export/28-import-closed-1833.png`).
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
