# UX 13 — Documenter

Reusa `01-shell.md`, `06` (WizardDialog, ProgressList, ReportView), `10` (diagrama). **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Database Documenter), catálogo interno `re/ui-strings/ui-text.txt` e **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas em `re/original-observation/16-documenter/doc-1.png` e `doc-generate.png`).

## 1. Entrada e Arquitetura do Documenter [C: observado na VM]
- **Entradas:**
  - Menu Database > Tasks > **New Documentation...** (abre novo documento `.ddoc`).
  - Database Explorer > clique com botão direito no banco > **Generate Documentation…** (`doc.cmd.generate`).
  - Menu File > Open Project / File... (`Ctrl+O`) selecionando arquivo `.ddoc` existente.
- **Estrutura MDI do Documento (`Documentation1.ddoc`):**
  - **Toolbar Superior:**
    - `[Select Connections...]`: abre modal para inclusão de múltiplos servidores/conexões.
    - `[Refresh]` (`F5`): recarrega metadados dos bancos selecionados.
    - `[Generate...]`: abre o diálogo modal de geração ("Generate Documentation").
    - Seletor de Tema: dropdown com paleta de cores (`Default ▾`, `Metro Light`, etc.).
  - **Painel Esquerdo (Árvore de Documentação com Checkboxes):**
    - Nó raiz `Cover Page ☑`: ativa/desativa a página de capa na saída.
    - Nós de Servidor: `Servers ▶ <conexão>`:
      - `Databases`: cada banco listado com nós filhos por tipo de objeto (Tables, Views, Stored Procedures, Functions, Triggers, Events) com contagem entre parênteses.
      - `Users`: usuários do servidor e privilégios.
    - Cada nó possui checkbox permitindo seleção e exclusão granular de seções da documentação.
  - **Painel Central / Direito (Cover Page Designer):**
    - Designer interativo da capa da documentação:
      - Controle `Breadcrumbs` (Toggle On / Off).
      - Área de Cabeçalho (`Header`).
      - Caixa de Logotipo (`Logo`): área para carregar imagem personalizada (PNG/SVG).
      - Título da Documentação (`Title`): campo de texto formatado (ex.: nome do banco ou projeto).
      - Descrição do Projeto (`Project Description`): caixa de texto multi-linha com suporte a rich text/Markdown.
      - Metadados do Autor (`Author`): preenchido por padrão com o nome do usuário do sistema.
      - Direitos Autorais (`© Copyright`): texto de copyright padrão.
      - Data de Criação (`Created`): carimbo de data gerado automaticamente.

## 2. Diálogo "Generate Documentation" [C: observado na VM]
Acionado pelo botão `[Generate...]` da toolbar do documento `.ddoc`.

```
+-----------------------------------------------------------------------------+
| Generate Documentation                                                  [X] |
+-----------------------------------------------------------------------------+
| Abas de Formato: [ HTML ]  [ PDF ]  [ Markdown ]                            |
+-----------------------------------------------------------------------------+
| Output settings:                                                            |
|                                                                             |
| Save in:                                                                    |
| [/home/usuario/Documents/TuxSQL/Documentation                        ] [...]|
|                                                                             |
| Folder name:                                                                |
| [mysql-teste_sample_{timestamp}                                            ]|
|                                                                             |
| ☑ Append timestamp to the folder name                                       |
| ☑ Open documentation after generation                                       |
|                                                                             |
+-----------------------------------------------------------------------------+
| [Save Command Line...]                              [Generate]   [Cancel]   |
+-----------------------------------------------------------------------------+
```

### 2.1 Opções de Saída e Formatos
- **Abas de Formato:**
  - **HTML:** Gera documentação como site estático offline. Inclui navegação lateral em árvore, busca instantânea client-side, visualização detalhada de cada objeto e links cruzados navegáveis entre chaves estrangeiras e dependências. Sem dependências de bibliotecas de CDN externas (funciona isolado da rede).
  - **PDF:** Documento paginado com capa gráfica, sumário com numeração de páginas, quebras automáticas de seção e tabelas de colunas e índices.
  - **Markdown:** Estrutura em pasta contendo `README.md` (índice mestre) e subpastas `tables/`, `views/`, `routines/` com arquivos `.md` individuais compatíveis com GitHub/GitLab.
- **Configurações de Pasta:**
  - `Save in`: diretório de destino (padrão `~/Documents/TuxSQL/Documentation`).
  - `Folder name`: padrão sugerido `<conexão>_<database>_<timestamp>`.
  - `☑ Append timestamp to the folder name`: adiciona sufixo no formato `YYYY-MM-DD_hh-mm-ss`.
  - `☑ Open documentation after generation`: abre automaticamente o arquivo gerado (navegador padrão ou visualizador de PDF).
- **Botão `[Save Command Line...]`:**
  - Gera arquivo de script bash/CLI (`.sh`) ou argumentos para execução automatizada em pipelines de CI/CD via `npm run documenter:cli`.

## 3. Conteúdo Gerado por Objeto de Schema
- **Tabelas:**
  - Nome, descrição/comentário, engine de armazenamento, collation, contagem estimada de linhas e tamanho no disco.
  - Grade de Colunas: Nome, Tipo de Dados, Permite NULL, Valor Padrão, Extra (auto_increment, etc.), Chave (PK, FK, UK) e Descrição.
  - Grade de Índices: Nome, Tipo (BTREE, FULLTEXT), Único (Sim/Não), Colunas e Cardinalidade.
  - Relações e Chaves Estrangeiras: Nome da FK, Colunas de Origem, Tabela e Colunas de Destino, Ações `ON UPDATE` / `ON DELETE`.
  - Triggers associadas e Script DDL completo de recriação (`CREATE TABLE`).
- **Views:**
  - Algoritmo, Definer, Security Type, Script SQL de definição (`CREATE VIEW`) com destaque de sintaxe e colunas resultantes.
- **Stored Procedures e Functions:**
  - Parâmetros (Direção IN/OUT/INOUT, Nome, Tipo), Determinismo, Acesso a Dados (READS SQL DATA, etc.), Comentário e Código SQL completo.

## 4. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Designer WYSIWYG Interativo de Capa no Editor (Pendente):** No original, a aba central do `.ddoc` permite editar visualmente o layout da capa (Breadcrumbs toggle, arrastar/subir logo, formatar cabeçalhos). No TuxSQL os metadados de capa são definidos via campos em diálogo modal de opções antes da geração.
2. **Seletor de Paleta de Temas na Toolbar (Pendente):** No original há um seletor visual com paletas de cores prontas (`Metro Light`, `Default`, etc.) que alteram as cores primárias do tema HTML gerado. O TuxSQL gera HTML moderno com paleta única de alto contraste e suporte automático a `prefers-color-scheme` (dark mode).
3. **Geração Nativa de PDF em Linha de Comando (CLI) (Pendente):** O gerador em lote CLI (`npm run documenter:cli`) do TuxSQL compila documentação em HTML e Markdown. A geração de PDF no clone depende do motor Chromium/Electron em modo gráfico (print-to-PDF).
4. **Documentação de Contas de Usuários e Privilégios (Pendente):** O original documenta o nó "Users", listando permissões globais e de objetos dos usuários MySQL. O TuxSQL atualmente documenta apenas objetos de schema (tabelas, views, rotinas, triggers, eventos).

## 5. Estados de Interface
| Estado | Comportamento |
|---|---|
| Carregando Metadados | Árvore exibe nós com spinners discretos e desabilita temporariamente o botão [Generate...] |
| Falha na Introspecção | Notificação inline no nó com ícone de exclamação e opção de tentar novamente |
| Geração em Andamento | Diálogo de progresso com contador de objetos processados e botão [Cancel] |
| Conclusão com Sucesso | Notificação com botões [Open in Browser] e [Open Folder] |
| Erro de Gravação (Permissão) | Alerta de erro modal destacando caminho sem permissão de escrita |

## 6. Atalhos de Teclado
- Abrir diálogo de geração: `Ctrl+Shift+D`
- Atualizar metadados (`Refresh`): `F5`
- Confirmar geração: `Enter` no diálogo
- Fechar/Cancelar: `Esc`

## 7. Temas e Acessibilidade
- Conformidade total com temas Claro e Escuro de `01-shell.md`.
- Árvore de objetos suporta navegação integral via teclado (`Tab`, setas, `Space` para marcar/desmarcar checkboxes de objetos).
- HTML gerado validado para padrões WCAG AA com contraste adequado, elementos semânticos (`<main>`, `<nav>`, `<aside>`) e suporte nativo a leitores de tela.

## 8. Componentes
`DocumenterMdiEditor`, `DocumentationTree`, `CoverPageDesignerCanvas`, `GenerateDocumentationModal`, `ThemePaletteDropdown`, `ProgressDialog`, `ReportSummaryView`.

## 9. Critérios de Aceite
- Gera documentação em HTML e Markdown com navegação funcional entre tabelas e objetos relacionados.
- Todo comentário e metadado fornecido pelo usuário ou schema é sanitizado contra ataques XSS.
- CLI em lote compila documentação de múltiplos bancos sem interrupções não tratadas.
- Botão "Open documentation after generation" dispara visualizador externo de forma segura via IPC.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Generate Documentation | Comando/ação principal | `doc.cmd.generate` |
| New Documentation... / Open Documentation... | Comandos de projeto (`*.ddoc`) | `doc.cmd.new` / `doc.cmd.open` |
| Generate database documentation in HTML, PDF or Markdown file format | Descrição do comando | `doc.cmd.hint` |
| Choose objects for documentation | Passo Objetos | `doc.step.objects` |
| Documentation Generation | Título do assistente | `doc.wizard.title` |
| Generating documentation... | Progresso | `doc.progress` |
| Open documentation after generation | Checkbox final | `doc.opt.openAfter` |
| Documentation has not been saved. The path is invalid. | Erro de caminho | `doc.err.path` |
| Documentation is not available. | Estado vazio | `doc.empty` |
| Documenter Project Properties | Propriedades do projeto | `doc.project.props` |
