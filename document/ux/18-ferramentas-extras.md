# UX 18 — Ferramentas extras

Reusa `01-shell.md`, `03`, `06`, `07`. **[C]** CONFIRMADO / **[I]** INFERIDO. Painéis alvo (roadmap): Find Invalid Objects, Find Results, Copy Databases, Service Control, Start Page, Toolbox, Document Outline, Find and Replace, Code Snippets, Object Viewer, Schema View, Schema Update Script, Autotest.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Database > Tasks; Find Invalid Objects; SQL Search; Code Analysis; Copy Databases; Backup/Restore; Service Control; Start Page; Toolbox; Document Outline; Snippets) e https://www.devart.com/dbforge/mysql/studio/. Citações por redirecionamento; páginas individuais não abertas.

## 1. Find Invalid Objects [C]
Entrada: Explorer > database > **Tasks > Find Invalid Objects** [C], menu Database > Tasks. Painel/documento:
```
+ Find Invalid Objects -------------------------------------------+
| Database: [conexão ▾][database ▾] Tipos: ☑Views ☑Procs ☑Funcs ☑Triggers ☑Events |
| [Find ▶] [Stop] [Select All] [Drop Selected] [Edit]              |
+------------------------------------------------------------------+
| Grid: ☐ | Objeto | Tipo | Motivo (ex.: "Unknown column 'x'") |  |
+------------------------------------------------------------------+
| Preview do código com a referência problemática destacada [C]     |
+------------------------------------------------------------------+
```
Fluxo: Find verifica cada view (`SELECT … LIMIT 0`/`SHOW CREATE` + checagem) e rotinas/triggers (parser + resolução de nomes contra metadata) [I]. Ações: duplo clique abre o editor do objeto (05); **Drop Selected** com confirmação listando objetos e dependentes; Copy report; Export CSV. Estados: loading com progresso "Verificando 34/120"; vazio verde "Nenhum objeto inválido"; erro por objeto; sucesso com contagem. Resultado vai também ao Error List.

## 2. SQL Search [C: objetos, texto, dados]
Painel **Find in Database** (Ctrl+Shift+F quando foco no Explorer; no editor, Ctrl+Shift+F = busca em arquivos do projeto [01]). Campos: texto, opções Aa/palavra/regex; Escopo: conexão/databases (multi-seleção), **Buscar em**: ☑ Nomes de objetos ☑ Definições (DDL/código de views/rotinas/triggers) ☐ Dados (tabelas selecionadas; colunas texto; aviso de custo "pode ser lento", limite de linhas por tabela, cancelável). Resultados em aba **Find Results** (dock inferior): árvore Objeto > ocorrências com trecho e destaque; duplo clique abre objeto/linha; botões [Refresh] [Clear] [Export]. Estados: loading com progresso e [Stop]; vazio "Nada encontrado"; erro por database (permissão) em aviso.
Quick search do Explorer (filtro da árvore, 03 §1.1) é separado.

## 3. Code Analysis [C]
Entrada: botão **Code Analysis** na toolbar SQL / SQL > Analyze Code (Ctrl+Alt+A [I]); também em lote (Tools). Roda regras no script: ex.: `SELECT *`, DELETE/UPDATE sem WHERE, comparação com NULL (`= NULL`), JOIN sem condição, funções em colunas indexadas no WHERE, tipos incompatíveis, LIMIT sem ORDER BY, `UNION` vs `UNION ALL`, identificadores reservados, falta de índice usado [I]. Resultado na **Error List** (01 §6) com categoria (Performance/Correctness/Style/Security), severidade (Error/Warning/Info), mensagem, linha; clique navega; menu "Ignorar esta regra/neste arquivo". Configuração: Options > Code Analysis (ligar/desligar regras e severidade; perfis; exportar regras JSON). Estados: analisando (spinner curto), sem problemas (verde), erro de parser.

## 4. Copy Databases [C: schema, dados ou ambos, mesmo ou outro servidor]
Wizard (padrão 06): **1 Origem** (conexão/database) → **2 Destino** (conexão; novo database nome/collation ou existente) → **3 Objetos** (CheckTree: tabelas, views, rotinas, triggers, events; ☑ schema ☑ dados) → **4 Opções** (DROP IF EXISTS, desativar FK checks, tamanho de lote, copiar usuários/privilégios? não, [I]; modo Se existir: Pular/Substituir) → **5 Resumo/confirmação** (destino destacado; Prod digitar nome) → **6 Execução** (ProgressList por objeto, linhas copiadas) → **7 Relatório**. Mesmo servidor usa `CREATE TABLE LIKE` + `INSERT…SELECT`; entre servidores usa streaming. Cancelar: pergunta manter/limpar parcial. Estados e erros por objeto padrão 06.

## 5. Backup e Restore [C]
- **Backup** (Database > Tasks > Back Up Database…): wizard: database(s) → objetos/tabelas → opções (estrutura, dados, DROP, CREATE DATABASE, triggers/events/rotinas, single-transaction, lock tables, INSERT estendido, charset, compactar `.gz`/`.zst`, nome com data) → destino (pasta) → execução → relatório. Agendamento: fora v1 (usar /schedule do SO via exemplo de cron exibido).
- **Restore** (…Restore Database…): escolher arquivo `.sql/.sql.gz`, database destino (existente/novo), opções (Parar/continuar em erro, ignorar erros de duplicata, desabilitar FK checks), pré-visualização (tamanho, nº de statements estimado, 1ªs linhas), confirmação (sobrescreve dados — digitar nome em Prod), execução com progresso por statement/bytes, [Cancel], relatório (erros com linha do arquivo, copiável).
Estados padrão (loading/erro/sucesso/cancelado). Segredos nunca gravados no arquivo/log.

## 6. Service Control [C: painel]
Painel para o **serviço do servidor MySQL local** (Linux: `systemd` via `systemctl`/`polkit`): lista de serviços detectados (mysql, mysqld, mariadb), colunas Nome | Estado (● running/stopped/failed) | Habilitado no boot. Botões: Start, Stop, Restart, Enable/Disable (pedem elevação via polkit; falha clara "Permissão negada"), Refresh, Ver logs (journalctl últimas 200 linhas em painel read-only). Estado vazio: "Nenhum serviço MySQL/MariaDB local encontrado". Ações destrutivas (Stop/Restart) com confirmação; avisa quando há conexões ativas da própria app. Adaptação: no original usa Windows Services; em containers/Docker mostra aviso e alternativa (`docker ps` [I]).

## 7. Start Page [C: painel]
Aba inicial (01 §5): seções: **Ações** (New SQL, New Connection, Open File, Open Project), **Conexões recentes** (últimas 5, clique conecta+abre SQL, menu), **Arquivos recentes**, **Novidades/Dicas** (texto local rotativo; sem tracking/rede; atualização opcional de feed do projeto [I]), atalhos úteis, checkbox "Mostrar ao iniciar". Layout em 2 colunas, responsivo para 1; estados: vazio amigável.

## 8. Toolbox [C: painel]
Dock contextual (View > Toolbox, Ctrl+Alt+X [I]) cujo conteúdo muda com o documento ativo: Editor SQL → **Snippets/Templates** e objetos comuns; Query Builder/Diagrama → tabelas e formas; Report Designer → controles (16). Itens arrastáveis para o documento; busca; categorias colapsáveis; vazio "Sem itens para este documento".

## 9. Document Outline [C: painel]
Árvore estrutural do documento ativo: SQL → statements (SELECT/CREATE/…), rotinas, blocos BEGIN/END, rótulos e comentários de seção `-- #region` [I]; Diagrama → itens; Report → bandas. Clique navega; auto-sincroniza com o cursor (toggle), filtro, expandir tudo. Atualiza com debounce 500ms; erro de parse mostra nós parciais.

## 10. Find and Replace [C: painel]
Além do widget do editor (03 §2.2), painel/diálogo: Ctrl+F (documento), Ctrl+H (substituir), **Ctrl+Shift+F (Find in Files/Documentos abertos/Projeto)** [escopo: seleção, documento, documentos abertos, projeto, pasta], Aa/palavra/regex (com grupos `$1`), preview de substituição ([Replace All] com contagem e confirmação, desfazível por documento), resultados no **Find Results** com agrupamento por arquivo. Histórico de termos (dropdown).

## 11. Code Snippets [C: painel; 35+ snippets confirmados no pacote original]
Painel/gerenciador (View > Snippets Manager; Ctrl+K Ctrl+X insere [I]): árvore de categorias/snippets (SELECT, INSERT, CREATE TABLE, CASE, cursores, loops…), busca, preview do corpo (Monaco read-only), ações New/Edit/Delete/Import/Export (arquivos `.snippet`-like JSON próprios; não copiar os do original, criar conjunto equivalente descrito). Editor de snippet: nome, **prefixo** (gatilho + Tab), descrição, corpo com placeholders `$1`, `${2:padrão}`, `$0`, variáveis (`$CURRENT_DATE`, `$SELECTION`), escopo (sql). Inserção: digitar prefixo + Tab, autocomplete (ícone snippet), menu de contexto "Insert Snippet…", "Surround With…" (seleção); Tab/Shift+Tab percorre placeholders. Snippets do usuário em `$XDG_CONFIG_HOME/dbforgelinux/snippets`. Estados: vazio (categoria), erro de sintaxe do snippet (inline), duplicado de prefixo (aviso).

## 12. Demais painéis do roadmap (resumo)
- **Object Viewer / Schema View [C]:** visão somente leitura do objeto selecionado: Propriedades + DDL + dependências (reuso do painel Properties 03 §1.5 com abas); Schema View = árvore completa de objetos do database com contadores por tipo e atalhos de abrir.
- **Schema Update Script [C]:** painel que lista o script gerado pelos editores pendentes (04/05) e pelo Schema Compare (07): Monaco read-only + [Copy] [Open in SQL] [Execute…].
- **Autotest [C]:** painel de testes de unidade de banco (execução de casos SQL com asserções, resultados ✓/✕ em lista, detalhe de falha, execução em transação com rollback). Escopo P3; fora desta rodada: marcar como "a especificar" em ADR antes de implementar.

## 13. Atalhos (resumo)
Find Invalid Objects (sem atalho); Find in Database Ctrl+Shift+F (foco Explorer); Code Analysis Ctrl+Alt+A [I]; Toolbox Ctrl+Alt+X [I]; Outline Ctrl+Alt+U [I]; Find Ctrl+F; Replace Ctrl+H; Find in Files Ctrl+Shift+F; Insert Snippet Ctrl+K Ctrl+X [I]; Start Page Ctrl+Alt+S [I]. Conflitos de DE: ver 01 §10.

## 14. Temas / acessibilidade
Tokens 01; status por ícone+texto; todas as listas/árvores/grids por teclado; progresso com aria-valuenow; diálogos com foco preso e Esc.

## 15. Componentes
WizardDialog, CheckTree, DataGrid, CodeEditor (preview com destaque), DockPanel, ProgressList, ReportView, ConfirmDestructiveDialog, EmptyState, ResultsTree (Find Results), SnippetEditor, ServiceList.

## 16. Critérios de aceite
- Cada ferramenta acima abre pelos pontos de entrada indicados, executa com estados loading/erro/sucesso e confirma ações destrutivas.
- Backup→Restore e Copy Databases reproduzem um database fielmente.
- Snippets inserem com placeholders; Find/Replace cobre escopos; Outline sincroniza.
- Temas e teclado cobertos.
