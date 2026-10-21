# UX 18 — Ferramentas extras

Reusa `01-shell.md`, `03`, `06`, `07`. **[I]** INFERIDO (sessão anterior / REA).

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Database > Tasks; Find Invalid Objects; SQL Search; Code Analysis; Copy Databases; Backup/Restore; Service Control; Start Page; Toolbox; Document Outline; Snippets), catálogo interno `re/ui-strings/ui-text.txt` e notas de sessão anterior em `re/original-observation/NOTES.md` #11 e #19.
Auditoria de origem de evidência: **(b) Sessão anterior / (c) Inferência/REA**. Nenhuma captura foi feita na sessão corrente; pendente de confirmação por novas capturas da Lupa.

## 1. Find Invalid Objects [I: sessão anterior]
- Entrada: Database Explorer > database > **Tasks > Find Invalid Objects** ou menu Database > Tasks > Find Invalid Objects (`Ctrl+Alt+F`).
- **Layout do Documento:**
  - Toolbar superior: `[Analyze]`, `[Script as ALTER ▾]`, `[Script as DROP ▾]`.
  - Painel esquerdo: Seletor de Conexão (combo) + flyout de Databases (com campo de busca, botões `Check All` / `Uncheck All` e lista de bancos com checkboxes).
  - Painel central: Instrução inicial para selecionar bancos e clicar em Analyze; após a execução exibe a grade de objetos com erro (Nome, Tipo, Código de erro, Linha da inconsistência).

## 2. SQL Search / Find Object [I: sessão anterior]
- Entrada: Atalho de acorde `Ctrl+D, F` ou menu Database > Find Object...
- **Layout do Documento "Search":**
  - Toolbar: botões de alvo `[DDL]` e `[Data]`, caixa de texto Search, botão de expressão regular/regex, combo de tipos de objeto ("All objects ▾"), combo de database, combo de conexão e botão `[Export to CSV...]`.
  - Área central: Instrução inicial *"Enter a condition and start a search."*; após a busca exibe a árvore de ocorrências com contagem `"N objects found"`.
  - Painel inferior docado: Pré-visualização do script DDL do objeto selecionado na busca com destaque visual das palavras encontradas.

## 3. Database Backup e Restore [C: observado na VM]
- **Backup Database Wizard:**
  - Passos: `General` | `Backup content` | `Options` | `Errors handling` | `Progress` | `Finish`.
  - Opções avançadas: inclusão/exclusão seletiva de tabelas/views/rotinas/triggers, modo de transação única (`--single-transaction`), compressão ZIP nativa com senha e retenção automática de arquivos antigos.
- **Restore Database Wizard:**
  - Seleção de arquivo `.sql` / `.sql.gz`, validação de compatibilidade com o servidor alvo e barra de progresso por linha/bloco executado.

## 4. Service Control [C: observado na VM]
- Entrada: Atalho de acorde `Ctrl+D, R` ou menu Tools > Service Control.
- Documento de monitoramento de serviços locais:
  - No Linux, adapta-se aos daemons do `systemd` (`mysql.service`, `mysqld.service`, `mariadb.service`).
  - Colunas: Nome do Serviço | Estado (● Ativo / Parado / Falha) | Inicialização no Boot.
  - Comandos: `[Start]`, `[Stop]`, `[Restart]`, `[Refresh]` com confirmação modal e elevação segura via `polkit`.

## 5. Start Page e Document Outline [C: observado na VM]
- **Start Page:** Documento inicial exibindo ações rápidas (New SQL, New Connection, Open File, Open Project), histórico de conexões recentes com status de reconexão e lista de arquivos `.sql` recentes.
- **Document Outline (`Ctrl+Alt+U`):** Painel docado sincronizado em tempo real com o cursor do editor Monaco, exibindo a hierarquia de statements, rotinas e blocos de código SQL.

## 6. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Assistente de Manutenção de Tabelas ("Table Maintenance Wizard") (Pendente):** No original, `Database > Tasks > Table Maintenance` abre assistente para selecionar tabelas e executar em lote operações de `CHECK TABLE`, `ANALYZE TABLE`, `REPAIR TABLE` e `OPTIMIZE TABLE`. No TuxSQL essas operações devem ser executadas via script SQL manual.
2. **Assistente de Execução de Scripts Gigantes ("Execute Large Script") (Pendente):** No original há um assistente isolado em 3 passos para rodar arquivos `.sql` de dezenas de gigabytes por streaming direto para o socket do servidor, contornando limitações de memória do editor. No TuxSQL scripts são executados via editor ou spool padrão.
3. **Gerenciador Visual de Snippets ("Snippets Manager") (Pendente):** No original há uma janela em `Tools > Snippets Manager` com árvore de mais de 40 snippets, editor de corpo com marcadores literais (`$CARET$`, `$DATE$`, `$TIME$`) e variáveis de usuário (`$database_name$`). No TuxSQL o catálogo de snippets é estático no código.
4. **Assistente de Formatação de Arquivos em Lote ("SQL Formatter Wizard") (Pendente):** No original há assistente para varrer diretórios e formatar centenas de arquivos `.sql` em disco. No TuxSQL formata-se apenas o arquivo ativo ou seleção (`Ctrl+K, D`).
5. **Recompilação Automática em "Find Invalid Objects" (Pendente):** No original há botões diretos `Script as ALTER` e `Script as DROP` com árvore de dependências para recriar objetos quebrados após migrações. O TuxSQL possui checagem básica de views quebradas.

## 7. Estados de Interface
| Estado | Comportamento |
|---|---|
| Buscando Objetos | Spinner na toolbar e barra de progresso no rodapé da busca |
| Executando Backup | Progresso por tabela com contagem de bytes e estimativa de tempo |
| Serviço Parado | Ícone cinza/vermelho com botão Start habilitado |
| Script Inválido | Banner de erro detalhando linha com instrução SQL incorreta |
| Conclusão de Tarefa | Toast verde com atalhos para abrir a pasta de destino ou o log gerado |

## 8. Atalhos de Teclado
- Find Object (SQL Search): `Ctrl+D, F`
- Service Control: `Ctrl+D, R`
- Document Outline: `Ctrl+Alt+U`
- Start Page: `Ctrl+Alt+S`
- Find in Files: `Ctrl+Shift+F`
- Atualizar Ferramenta Ativa: `F5`

## 9. Temas e Acessibilidade
- Conformidade total com tokens de design system de `01-shell.md`.
- Indicadores de status de serviço utilizam marcadores visuais nítidos e texto explícito.
- Árvores de busca e listas de tarefas totalmente navegáveis por teclado.

## 10. Componentes
`SqlSearchDocument`, `FindResultsDock`, `BackupWizardDialog`, `RestoreWizardDialog`, `ServiceControlDocument`, `StartPageDocument`, `DocumentOutlineTree`, `CodeAnalysisPanel`.

## 11. Critérios de Aceite
- SQL Search localiza objetos por nome e código com filtros de escopo.
- Backup e Restore executam sem erros de permissão em caminhos válidos do usuário no Linux.
- Start Page permite iniciar novas tarefas e reabrir conexões e arquivos recentes.
- Document Outline sincroniza nós de estrutura com o editor ativo.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Find Invalid Objects... | Menu Database/Tasks | `tools.invalid.cmd` |
| Find invalid objects in databases | Descrição do comando | `tools.invalid.desc` |
| Searching for invalid objects in the '{0}' database. | Progresso | `tools.invalid.progress` |
| Invalid objects found. | Resultado | `tools.invalid.found` |
| None of the invalid objects were found in the specified database(s). | Estado vazio/sucesso | `tools.invalid.none` |
| Find Object... / Find Object Results | Comando e painel de resultados | `search.findObject / search.results` |
| Select object types to search across | Filtro de tipos | `search.types` |
| Getting objects for search... | Progresso | `search.progress` |
| Entered search mask "{0}" is invalid | Erro de máscara | `search.err.mask` |
| Clear Search Results | Ação | `search.clear` |
| Code analysis complete / Code Analysis Error / Preparing Code Analysis... | Estados da análise | `analysis.state.*` |
| Choose a source server to copy databases from / ...target server to copy databases to | Passos Copy Databases | `copydb.source / copydb.target` |
| Backup Database... / Restore Database... | Menu | `backup.cmd / restore.cmd` |
| Backup complete. / Backup failed / Backup aborted by a user. | Resultado do backup | `backup.ok / backup.fail / backup.aborted` |
| Backup folder is not specified. / Backup folder is not valid. | Validação | `backup.err.folder*` |
| Specify the path to the folder to save the backup to. | Campo de destino | `backup.pathHint` |
| Some objects have not been included in backup: | Aviso | `backup.warn.skipped` |
| Restore complete: {0} errors | Resultado do restore | `restore.done` |
| Restore aborted by a user. | Cancelamento | `restore.aborted` |
| Service Control / Show Service Control | Painel | `svc.title` |
| Start Page | Aba inicial | `start.title` |
| Toolbox | Painel | `toolbox.title` |
| Document Outline / Document Outline: Refreshing... | Painel e status | `outline.title / outline.refreshing` |
| Script contains too much nodes. Building outline may take much time. Do you want to show Document Outline? | Confirmação de script grande | `outline.bigConfirm` |
| Snippets Manager / Insert Snippet... | Menu | `snippets.manager / snippets.insert` |
| Can't create the snippet. The snippet's text can't be empty. | Validação | `snippets.err.empty` |
| Snippet "{0}" was modified. Do you want to save changes? | Confirmação | `snippets.saveConfirm` |
