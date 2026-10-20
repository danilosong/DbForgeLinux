# UX 12 — Data Generator

Reusa `01-shell.md`, `06` (WizardDialog, ProgressList, ReportView), `04` (EditableGrid). **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Data Generator) e https://www.devart.com/dbforge/mysql/data-generator/. Citações por redirecionamento; páginas individuais não abertas.

## 1. Entrada
Explorer > database/tabela > **Generate Test Data…** (menu Tools > New Data Generation [I]). Abre documento em aba "Data Generator" (não modal), com assistente inicial de seleção.

## 2. Layout do documento
```
+ Aba: [Data Generation 1] ---------------------------------------+
| Toolbar: [Generate ▶ Ctrl+Enter] [Preview] [Stop] | [Save .dgen]  |
|  [Open] [Options] [Generate Script…]                              |
+-------------------+-----------------------------------------------+
| Tabelas (árvore   | Configuração da tabela selecionada            |
|  com checkbox,    |  Records: [1000]   Mode: [Append|Replace]     |
|  nº registros)    |  Grid de colunas (abaixo)                     |
|                   +-----------------------------------------------+
|                   | Preview (20 linhas geradas, regenerável)      |
+-------------------+-----------------------------------------------+
```
Seleção inicial (passo de assistente, 2 etapas: Connection/Database → Tables) e depois edição direta no documento.

## 3. Tabelas e colunas
- Lista de tabelas com ✓, **Records** por tabela (padrão 1000, editável; atalho "mesmo valor p/ todas"), ordem de geração calculada por dependências de FK (indicada; pais antes de filhos) [C: preserva FK]. Modo: **Append** (padrão) ou **Replace** (apaga existentes antes; confirmação destrutiva digitando nome) [I].
- **Grid de colunas** (EditableGrid): ✓ incluir | Coluna | Tipo | Generator (combo) | Parâmetros (resumo clicável) | Null % | Unique | Exemplo. Colunas AUTO_INCREMENT/geradas: "Skip (server)". Chaves estrangeiras: gerador **"Foreign key value"** automático [C]: sorteia valores existentes na tabela pai (ou recém-geradas) com distribuição (aleatória/sequencial/ponderada) [I].
- **Catálogo de generators** [C: biblioteca ampla]: Basic (Integer, Decimal, Boolean, Date/Time, Sequence, Constant, Random from list/file/SQL query), Pessoas (First/Last/Full name, Gender, Email, Phone, Username, Job title), Endereços (Street, City, State, Country, Zip, Lat/Long), Finanças (IBAN, Credit card, Currency, Price), Texto (Lorem ipsum, Words, Regex pattern [C], Title, URL, IP), Web/Tech (UUID, MAC, User agent), JSON/XML template [I], Expressão SQL, Script. Locale (en, pt-BR, es, de…) por generator/global [I].
- Diálogo de parâmetros do generator: campos próprios (min/max, formato, comprimento, distribuição, locale, valores) + prévia viva de 5 amostras e [Regenerate].
- Regras: validação contra tipo/tamanho da coluna (aviso se o gerador pode exceder VARCHAR(n) ou faixa), Unique (tenta evitar duplicatas; falha com mensagem se espaço insuficiente), Null % (0–100).
- Mapeamento automático por nome/tipo (ex.: coluna `email` → Email) [I] com indicação "sugerido" e botão [Reset to auto].

## 4. Preview
Painel inferior com 20 linhas (regeneráveis com F5), células destacadas quando violam restrições; loading curto; erro por coluna com tooltip.

## 5. Execução
**Generate** (Ctrl+Enter): diálogo de confirmação com resumo (tabelas, total de linhas, modo, destino/ambiente; Prod exige digitar nome do database). Opções: **gravar direto no banco** ou **gerar script SQL** (arquivo/novo editor) [C: script], tamanho de lote (500), transação única/por tabela, desabilitar FK checks (não recomendado, aviso), "Seed" fixo para reprodutibilidade [I].
ProgressList por tabela (⏳/✓/✕, linhas geradas/s), [Stop] (reverte lote atual). Relatório: totais por tabela, tempo, erros (ex.: duplicate key) com amostra, [Open table data] [Open script]. Falha em transação única → rollback total comunicado.

## 6. Projeto salvo [C: exportar/script a configuração]
Salvar/abrir `.dgen` (JSON: tabelas, generators, parâmetros, seed; sem segredos). Template "Gerar para o mesmo esquema em outra conexão" valida colunas ausentes.

## 7. Estados
Loading (metadados/preview) skeleton; vazio (sem tabelas) EmptyState + [Select Tables]; erro (sem permissão INSERT, FK circular não resolvida → aviso com opção de gerar parcial) InlineErrorPanel; sucesso ReportView verde.

## 8. Atalhos
Generate Ctrl+Enter; Preview/Regenerate F5; Salvar Ctrl+S; Parar Esc; Editar parâmetros F2; Aplicar a todas as linhas selecionadas Ctrl+D (copia generator da célula acima).

## 9. Temas / acessibilidade
Tokens 01; avisos com ícone+texto; grids por teclado; progresso com aria-valuenow.

## 10. Componentes
EditableGrid, TableCheckTree, GeneratorPicker, GeneratorParamsDialog (com preview de amostras), PreviewPane, ConfirmDestructiveDialog, ProgressList, ReportView.

## 11. Critérios de aceite
- Gerar 10k linhas em 3 tabelas relacionadas respeitando FK, unique e null %, em banco ou script.
- Preview reflete mudanças; configuração salvável e reaplicável; estados e confirmação em Prod.
- Claro/escuro e teclado completos.
