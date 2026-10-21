# UX 12 — Data Generator

Reusa `01-shell.md`, `06` (WizardDialog, ProgressList, ReportView), `04` (EditableGrid). **[I]** INFERIDO (sessão anterior / REA).

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Data Generator), catálogo interno `re/ui-strings/ui-text.txt` e notas de sessão anterior em `re/original-observation/NOTES.md` #09.
Auditoria de origem de evidência: **(b) Sessão anterior / (c) Inferência/REA**. Nenhuma captura foi feita na sessão corrente; pendente de confirmação por novas capturas da Lupa.

## 1. Entrada e Documento [I: sessão anterior]
- Explorer > database/tabela > **Generate Data…** (comandos New Data Generation... / Open Data Generation...).
- Abre diretamente um documento MDI `.dgen` (ex.: `sample (mysql-teste).dgen`).
- Cabeçalho superior: Servidor e database de origem/destino, indicador "N table to populate" e botão de engrenagem para configurações globais.

## 2. Layout do Documento [I: sessão anterior]
```
+ Aba: [sample (mysql-teste).dgen] -----------------------------------------------+
| Toolbar: [Populate Data ▶ Ctrl+Enter] [Stop] [Refresh F5] | [Save .dgen] [Open] |
|          [Generate Script...] [Options]                                         |
+---------------------------------------+-----------------------------------------+
| PAINEL ESQUERDO                       | PAINEL DIREITO                          |
| "Tables and columns to populate"      | "Table generation settings for orders"  |
|                                       |                                         |
| Árvore com checkbox por tabela e col: | Row distribution mode:                  |
| ▾ [x] orders (1000)                   | (•) By specified number of [1000]       |
|     [x] id: int PK -> ID (s)          | ( ) By proportion of existing data      |
|     [x] customer_id -> Foreign Key    | ( ) By generation of data by time       |
|     [x] order_date -> Date and Time   | ( ) By proportion from lookup table     |
| ▾ [x] customers (1000)                |                                         |
|     [x] name -> NickName              | Grade de Parâmetros do Gerador:         |
|     [x] email -> Email                | Min: [1]   Max: [10000]   Null: [0%]    |
|     [x] country -> Country Code 2     |                                         |
+---------------------------------------+-----------------------------------------+
| PAINEL INFERIOR (Prévia e Script):                                              |
| "Preview of data to be generated (first 50 rows of 1000)":                      |
| [id | ID (s)] | [customer_id | FK] | [order_date | DateTime] | [name | NickName]|
| 1             | 42                 | 2026-10-20 14:22:01     | Alice            |
| 2             | 107                | 2026-10-20 14:23:45     | Bob              |
+---------------------------------------------------------------------------------+
```

## 3. Painel de Tabelas e Mapeamento Semântico [C: observado na VM]
- **Árvore "Tables and columns to populate":**
  - Checkbox para incluir/excluir cada tabela e cada coluna individualmente.
  - Contagem configurável de linhas por tabela (padrão 1000).
  - Colunas da árvore: `Name` | `Properties` (tipo SQL, NOT NULL, UNIQUE, UNSIGNED, com ícone de restrição) | `Generator` (gerador atribuído).
- **Mapeamento Semântico Automático [C]:**
  - O sistema infere o gerador adequado com base no nome e significado da coluna:
    - `id` → Sequence / ID
    - `name` / `first_name` → NickName / First Name
    - `email` → Email Address
    - `country` → Country Code 2
    - `status` (ENUM) → Seleção ponderada dos literais do ENUM
    - Chaves Estrangeiras (`FK`) → `Foreign Key Generator` (sorteia valores válidos da tabela referenciada, respeitando dependências topológicas de forma que pais sejam gerados antes de filhos).
- **Catálogo de Perfis e Indústrias:**
  - Mais de 100 perfis semânticos categorizados por verticais de negócio: People, Healthcare, Airline, E-commerce, Finance, Cryptocurrency, Telecom, etc.

## 4. Modos de Execução e Destino [C: observado na VM]
- **Populate Data directly to Database:** executa inserções em lote em transações atômicas com barra de progresso e estatísticas de linhas por segundo.
- **Generate Script...:** gera script SQL contendo os statements `INSERT` parametrizados, abrindo em novo editor SQL ou salvando diretamente em arquivo.
- **Seed Determinístico:** suporte a definição de valor de semente fixa para garantir reprodutibilidade exata em suítes de testes automatizados de QA.

## 5. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Quatro Modos de Distribuição de Linhas (Pendente):** No original, o painel Table Generation Settings possui opções de distribuição por proporção de volume existente, série temporal e lookup table ("By proportion of existing data in volume", "By generation of data by time", "By proportion from lookup table"). No TuxSQL suporta-se apenas contagem numérica fixa por tabela (`By specified number of N`).
2. **Painel "Schema Update Script" Docado (Pendente):** O original exibe um painel docado sincronizado que acumula comandos DDL auxiliares necessários durante a geração. No TuxSQL esse painel não existe.
3. **Geradores Scriptáveis em C# / Python (Pendente):** No original há possibilidade de definir scripts customizados para regras de negócio específicas de geração. No TuxSQL os geradores são implementados estaticamente em TypeScript/JavaScript.

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
