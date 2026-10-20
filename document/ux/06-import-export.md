# UX 06 — Wizards de Import/Export de dados

Reusa `01-shell.md` (Dialog, FormField, Banner, ProgressBar) e `02` (FilePicker). Formatos v1: CSV, TSV, JSON, XML, SQL (INSERT), Excel (XLSX), HTML, Markdown (export); import: CSV, TSV, JSON, XML, XLSX, SQL. Google Sheets: P3 (fora, só desabilitado/oculto).

## 1. Entradas
- **Export:** Data > Export Data… ; Explorer > tabela/view/database > Export Data…; grid de resultado [Export ▾] (exporta o resultado atual); aba de resultado > Export.
- **Import:** Data > Import Data…; Explorer > tabela > Import Data… (destino pré-selecionado).
- Tarefas guardadas ("Save template", seção 6) acessíveis em Tools > Data Tasks.

## 2. Estrutura do wizard

Diálogo modal redimensionável 760x560 (min 680x500). Cabeçalho com título e **stepper** horizontal (passos numerados, atual destacado em accent, concluídos com ✓, futuros cinza; clique em passo concluído volta). Corpo da página. Rodapé: [Save Template…] à esquerda; [< Back] [Next >] [Cancel] à direita; último passo: [Export]/[Import]. Enter = Next/primário; Esc = cancelar (confirma se já configurou algo). Ctrl+←/→ Back/Next. Cada passo valida antes de avançar; Next desabilitado com tooltip se incompleto.

## 3. EXPORT

Passos: **1 Formato → 2 Origem → 3 Opções → 4 Colunas/Mapeamento → 5 Destino/Preview → 6 Execução → 7 Relatório**.

### 3.1 Formato
Grade de cartões (ícone + nome + descrição curta): CSV, TSV, JSON, XML, SQL, Excel, HTML, Markdown. Seleção por clique/teclado. Preselecionado o último usado.

### 3.2 Origem
Árvore com checkboxes de conexão > database > tabelas/views (lazy, estados do Explorer), ou "Resultado da consulta" (quando iniciado do grid, fixa a origem). Busca; Select all/none; contador "5 objetos". Opção por objeto: [Colunas…] [WHERE opcional] (campo SQL simples). Erro: "Selecione ao menos um objeto".

### 3.3 Opções (por formato)
| Formato | Opções |
|---|---|
| CSV/TSV | Delimiter (`,` `;` Tab `|` custom), Quote char (`"`), Quote: Needed/All/Strings, Escape, Header (checkbox), Null as (vazio/`NULL`/custom), Line ending (LF padrão Linux/CRLF), Encoding (UTF-8, UTF-8 BOM, Latin1…), Date format |
| JSON | Estrutura: array de objetos / objeto por tabela; Pretty print; Binary as base64; Null as null |
| XML | Root name, Row name, Atributos vs elementos, Pretty print, Encoding |
| SQL | Incluir CREATE TABLE, DROP IF EXISTS, INSERT multi-linha (tamanho do lote, padrão 500), Column names nos INSERT, Disable keys/FK checks, Quote com crases, Dados e/ou estrutura |
| Excel | Uma planilha por tabela / tudo em uma, Header em negrito, Auto-width, Limite 1.048.576 linhas (aviso e divisão em abas) |
| HTML | Tabela estilizada simples, escape de HTML |
| Markdown | Pipe table, escape de `|` |
Comuns: limite de linhas, formato de data/hora (ISO padrão), decimal separator, [Reset to defaults].

### 3.4 Colunas/Mapeamento
Por objeto selecionado (lista à esquerda), grade à direita: [✓ incluir] | Coluna origem | Tipo | Nome de saída (editável) | Formato. Reordenar por arrastar. [Select all/none].

### 3.5 Destino e Preview
- Destino: Pasta (FilePicker de diretório, padrão `~/Documents` via XDG) + padrão de nome `{table}_{date}.{ext}` (variáveis listadas); modo "Um arquivo por tabela" vs "Arquivo único" (quando suportado); Se existir: Perguntar/Sobrescrever/Renomear; Opção "Abrir pasta ao terminar" (xdg-open); "Copiar para a área de transferência" (apenas pequenos volumes, limite 10 MB).
- **Preview** (painel inferior): primeiras 20 linhas formatadas no formato final em Monaco somente leitura / grid, com estado loading e erro; atualiza ao mudar opções.

### 3.6 Execução
Tela com: barra de progresso global (determinada quando contagem conhecida), tabela por objeto (Objeto | Status ⏳/✓/✕ | Linhas | Tempo | Arquivo), contador de linhas/s, tempo decorrido, [Cancel] (para ao final do lote atual, "Cancelando…"), [Run in background] (minimiza para toast persistente com progresso; o Output registra). Erro em objeto: pergunta (config. padrão "Skip and continue") [Parar] [Continuar]. 

### 3.7 Relatório
Resumo: título ✓ verde "Export concluído" / âmbar "Concluído com avisos" / vermelho "Falhou". Tabela de resultados (por objeto: linhas, tamanho, tempo, caminho clicável), lista de avisos/erros (copiável), ações: [Open File] [Open Folder] [Copy Log] [Export again] [Close]. Log completo gravado em `$XDG_STATE_HOME/dbforgelinux/logs`.

## 4. IMPORT

Passos: **1 Origem → 2 Formato/Opções de leitura → 3 Destino → 4 Mapeamento → 5 Modo/Opções → 6 Preview/Validação → 7 Execução → 8 Relatório**.

### 4.1 Origem
FilePicker (arquivo, suporte a arrastar e soltar e múltiplos arquivos para formatos tabulares); formato detectado pela extensão (alterável). Mostra tamanho e data. Erro: arquivo ilegível/vazio.

### 4.2 Opções de leitura
CSV/TSV: delimiter (auto-detect com sugestão), quote, escape, encoding (auto-detect + select), header na 1ª linha, pular N linhas, tratar vazio como NULL, trim, formato de data (detectado). JSON: caminho do array (auto), achatar objetos aninhados (dotted). XML: elemento de linha (seleção em árvore). XLSX: planilha (select), intervalo, header. SQL: executa script (sem mapeamento; passos 3–4 pulados; aviso de segurança "Execute apenas scripts confiáveis"). Preview das primeiras 20 linhas atualiza em tempo real.

### 4.3 Destino
Seleção de conexão/database e **tabela existente** ou **Nova tabela** (nome sugerido pelo arquivo; tipos inferidos: INT/DECIMAL/DATETIME/VARCHAR(n)/TEXT/JSON, editáveis na grade do passo 4). Para múltiplos arquivos: um destino por arquivo (tabela de pares).

### 4.4 Mapeamento
Grade: Coluna origem (com amostra) | → | Coluna destino (combo, "<ignorar>") | Tipo destino | Transformação (None/Trim/Upper/Lower/Date format…) | Chave. Botões: Auto-map por nome (padrão), Clear, Map by position. Avisos: tipo incompatível (âmbar), destino NOT NULL sem origem/default (vermelho, bloqueia), coluna sem mapeamento. Nova tabela: coluna "Create" com PK opcional.

### 4.5 Modo e opções
Modo: **Append** (INSERT), **Update** (por chave), **Append/Update** (upsert via ON DUPLICATE KEY), **Delete** (por chave), **Repopulate** (TRUNCATE + INSERT, confirmação destrutiva digitando nome da tabela). Opções: tamanho do lote (500), usar transação única (padrão) vs por lote, comportamento em erro (Parar e reverter / Pular linha e registrar / Ignorar duplicados), desabilitar FK checks (aviso), arquivo de rejeitados (`.rejected.csv`), limitar linhas (teste).

### 4.6 Preview/Validação
Botão [Validate]: dry-run nas primeiras N linhas (rollback) com relatório: linhas OK/erro, mensagens por linha (conversão, truncamento, chave duplicada), grid com células problemáticas destacadas (status.error 15%). Resumo: "12.450 linhas · 3 com erro". [Next] só permitido com confirmação se houver erros.

### 4.7 Execução e Relatório
Mesmas telas de §3.6/§3.7 com contadores: Inseridas/Atualizadas/Ignoradas/Rejeitadas. Relatório oferece [Open rejected file] e [Open table data]. Em erro e modo transação única: "Importação revertida; nenhuma linha gravada" (vermelho). Cancelamento: reverte o lote atual (ou tudo no modo transação única) e informa.

## 5. Estados e erros comuns

| Estado | Comportamento |
|---|---|
| Loading (listas/preview) | Skeleton + spinner |
| Vazio (sem origem) | Mensagem + CTA |
| Erro de arquivo/permissão | InlineErrorPanel (ex.: "Sem permissão para gravar em /pasta") |
| Disco cheio / perda de conexão em execução | Falha do objeto; retry [Tentar de novo] se conexão voltar; relatório mostra o ponto de parada |
| Sucesso | Relatório verde + toast se rodando em background |
Segurança: caminhos nunca incluem credenciais; senhas nunca em templates; export de dados sensíveis sem aviso (nenhum), mas conexões Prod mostram faixa vermelha no passo Origem.

## 6. Templates (tarefas salvas)
[Save Template…] guarda formato, origem, opções, mapeamento e destino (sem segredos) com nome. [Load Template] no passo 1. Gerenciador simples (lista, renomear, excluir). Arquivo JSON em `$XDG_CONFIG_HOME/dbforgelinux/data-tasks`. Linha de comando/agendamento: fora do escopo (P3).

## 7. Atalhos
Next/Back Ctrl+→/Ctrl+←; Cancelar Esc; Executar Ctrl+Enter no último passo; Select all (listas) Ctrl+A; Preview refresh F5.

## 8. Temas e acessibilidade
Tokens de 01; stepper com texto + ícone (não só cor); progresso com aria-valuenow e anúncios em marcos de 25%; tabelas navegáveis por teclado.

## 9. Componentes
WizardDialog (stepper + rodapé), FormatCard, CheckTree, ColumnMappingGrid, OptionsForm (por formato), FilePicker/FolderPicker, PreviewPane, ProgressList, ReportView, TemplateManager, ConfirmDestructiveDialog.

## 10. Critérios de aceite
- Cada formato exporta com as opções descritas, e preview reflete mudanças.
- Import permite mapeamento, validação dry-run e todos os modos; erros geram arquivo de rejeitados.
- Execução cancelável com semântica de reversão clara; relatório sempre exibido.
- Claro/escuro e teclado completos; templates salvos e recarregados.
