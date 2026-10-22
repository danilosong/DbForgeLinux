# UX 15 — Source Control e Projects

Reusa `01-shell.md`, `07` (DiffTree, SideBySideDiff, SyncConfirmDialog), `03` (TreeView, CodeEditor). **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Source Control; Project Explorer / SQL Projects), catálogo interno `re/ui-strings/ui-text.txt` e **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas em `re/original-observation/20-source-control/link-1.png` e `project-explorer.png`). Escopo Linux: Git com fluxo completo; SVN (Subversion) e Mercurial somente leitura (`status`, `log`, `diff`) quando os clientes `svn`/`hg` estiverem instalados. TFS/Azure DevOps Server está fora do escopo Linux por decisão do dono do produto.

## 1. Project Explorer [C: painel; REA ui-text "Project Explorer"]
Painel docado auto-ocultável (original na borda direita `Ctrl+W, J`, personalizável para qualquer borda; no TuxSQL suporta docking direcional esquerdo, direito, superior e inferior conforme 01).
- Árvore de **Projetos de Banco de Dados** (`.dbproj.json` [I; no original `.dbproj` em XML MSBuild]):
  - Nó raiz: Projeto (nome editável, caminho no disco).
  - Subpastas estruturadas:
    - **Connections**: referências salvas de conexões associadas, sem senhas.
    - **Tables & Views**: scripts DDL individuais por objeto (`<tabela>.sql`).
    - **Programmability**: Stored Procedures, Functions, Triggers, Events em arquivos `.sql` separados.
    - **Scripts**: scripts avulsos, queries auxiliares de migração e manutenção.
    - **Static Data**: arquivos de dados de tabelas versionadas (ex.: tabelas de domínio, tipos, parâmetros).
- **Ações da Toolbar:**
  - `New Project...` (abre assistente de criação).
  - `Open Project...` (`Ctrl+Shift+O`).
  - `Add Existing File...` / `New Script`.
  - `Refresh` (`F5`).
- **Menu de Contexto:**
  - Open, Rename (`F2`), Delete (da lista ou do disco com confirmação explícita).
  - Add > New SQL Script / New Folder / Existing File...
  - Show in File Manager (`xdg-open` na pasta).
  - Copy Full Path.
  - Set Connection (associa o script ou projeto a uma conexão ativa).
  - Compare with Database (abre Schema Compare entre os scripts locais e o banco ao vivo).
- **Database Project Wizard & Script Database to Folder:**
  - Diálogo modal para engenharia reversa do banco para estrutura de arquivos:
    - Seleção de conexão e database de origem.
    - Seleção granular de objetos (com filtros por tipo).
    - Opções: um arquivo por objeto, incluir scripts DROP/CREATE, incluir dados estáticos.
    - Pasta de destino com validação de permissões no Linux.
    - Estados: loading com barra de progresso, lista de erros por objeto, sucesso com contagem total de arquivos gerados.
- **Estado Vazio:** Ilustração neutra + "No project opened" com botões de ação rápida [New Project] e [Open Project...].

## 2. Assistente "Link Database to Source Control" [C: observado na VM]
Iniciado via Database Explorer (menu de contexto do banco > **Link Database to Source Control...** `sc.link.cmd`) ou menu Database > Source Control > Link Database to Source Control...
Assistente modal em 3 passos com stepper lateral/topo: **1 Link → 2 Progress → 3 Finish**.

### 2.1 Passo 1: Link (Configuração do Vínculo)
```
+-----------------------------------------------------------------------------+
| Link Database to Source Control                                         [X] |
+-----------------------------------------------------------------------------+
| Passos:            | Connection: [mysql-teste (10.0.2.2:33067)        ▾]     |
| [•] Link           | Database:   [sample                              ▾]     |
| [ ] Progress       |                                                        |
| [ ] Finish         | Source control repository:                             |
|                    | [git@github.com:empresa/db-schema.git             ▾] [+] [.]|
|                    | Source control system:                                 |
|                    | [Git                                                 ] |
|                    | (somente leitura; preenchido ao selecionar o repositório)   |
|                    |                                                        |
|                    | Database development model:                            |
|                    | (•) Dedicated                                          |
|                    |     Each developer will work on their own copy of the  |
|                    |     database                                           |
|                    | ( ) Shared                                             |
|                    |     All developers will work on a single shared        |
|                    |     database                                           |
+-----------------------------------------------------------------------------+
| [< Back (desab.)]                           [Next >]  [Link]  [Cancel]       |
+-----------------------------------------------------------------------------+
```
- **Campos e Controles:**
  - `Connection`: combo de conexões existentes salvas no Connection Manager.
  - `Database`: combo com os bancos disponíveis no servidor conectado.
  - `Source control repository`: combo com repositórios previamente registrados ou locais + botão `+` (Create New Repository / Clone) e botão `...` (Procurar pasta local / gerenciar credenciais).
  - `Source control system`: campo somente leitura de status que reflete o driver detectado (Git no Linux; no original detecta Git, SVN, TFS).
  - `Database development model`:
    - **Dedicated** [C]: Cada desenvolvedor trabalha em sua própria instância do banco (desenvolvimento isolado). Ao sincronizar, o diff compara o repositório com o banco local do dev.
    - **Shared** [C]: Todos os desenvolvedores compartilham o mesmo banco de dados de desenvolvimento. Operações de Get Latest e Commit exigem cautela e notificações sobre modificações concorrentes.
- **Autenticação Segura no Linux:**
  - Repositórios SSH usam `ssh-agent` do ambiente ou chave privada registrada em `~/.ssh`.
  - Repositórios HTTPS/PAT utilizam o cofre de credenciais nativo do sistema via `libsecret` / Electron `safeStorage`. Senhas e tokens nunca são persistidos em texto plano nos arquivos `.dbproj.json` ou configs locais.

### 2.2 Passo 2: Progress (Execução do Vínculo)
- Exibe o progresso em tempo real das etapas:
  1. Verificação da conexão com o repositório Git.
  2. Inicialização do repositório / clone da branch padrão (se remoto).
  3. Introspecção do schema do banco de dados selecionado.
  4. Geração dos arquivos DDL dos objetos no diretório de trabalho do repositório.
  5. Criação do arquivo de metadados do vínculo.
- Botão [Cancel] permite abortar a operação de forma segura com rollback de pastas temporárias.

### 2.3 Passo 3: Finish (Conclusão)
- Resumo do vínculo: Conexão, Database, URL/Caminho do repositório Git, Modelo (Dedicated ou Shared).
- Status final ("Database linked successfully").
- Checkbox opcional: "Perform initial commit now" (abre imediatamente a aba Changes com todos os arquivos preparados para o commit inicial).
- Botão [Finish].

## 3. Painel Source Control Manager
Acessível via View > Other Windows > Source Control Manager ou `Ctrl+Alt+G`.
```
+ Source Control Manager ---------------------------------------------------+
| Repository: [repo-loja-mysql ▾]  Branch: [main ▾]  ↑1 ↓0 [Fetch][Pull][Push]|
+---------------------------------------------------------------------------+
| Abas: [Changes] [History] [Branches] [Conflicts*]                         |
+---------------------------------------------------------------------------+
```
### 3.1 Aba Changes
- Compara **banco de dados ↔ working copy local ↔ HEAD do Git**:
  - Árvore de objetos agrupados por tipo (Tables, Views, Procedures, Functions, Static Data).
  - Ícone e letra de status: `[+] Added` (verde), `[~] Modified` (azul), `[-] Deleted` (vermelho), `[!] Conflicted` (laranja).
  - Checkbox por objeto permitindo commit parcial seletivo.
  - Toolbar de ações:
    - `[Commit]` ("Commit changes to the version control"): grava as alterações selecionadas na branch local do Git.
    - `[Get Latest]`: aplica as alterações do repositório ao banco de dados via Schema Compare/Synchronize (07 §6) com geração de script de sincronização, análise de risco e confirmação.
    - `[Change Link Direction]`: inverte a direção de sincronização visual entre DB → Repo e Repo → DB com destaque explícito do lado de destino.
    - `[Commit Selection]` e `[Revert Changes]`: reverte alterações locais de arquivos selecionados para o estado do HEAD.
  - Campo obrigatório de mensagem de commit com atalho `Ctrl+Enter`.
  - Identificação de autor (Nome e E-mail lidos da configuração global/local do Git).
  - Aba inferior com diff lado a lado do DDL (objeto no DB vs objeto no arquivo Git).

### 3.2 Aba History
- Lista de commits em ordem cronológica reversa:
  - Hash curto (SHA-1).
  - Mensagem do commit (primeira linha expandível).
  - Autor (nome e avatar/iniciais).
  - Data e hora formatadas (relativa e absoluta no tooltip).
- Painel inferior de detalhe do commit:
  - Mensagem completa.
  - Lista de arquivos/objetos alterados no commit com suas operações (Added, Modified, Deleted).
  - Visualizador de diff em modo split ou unificado.
  - Ações no commit: `Checkout`, `Revert commit`, `Copy SHA`, `Compare with working copy`.

### 3.3 Aba Branches
- Gestão de branches locais e remotas:
  - Lista de branches locais com indicação da branch ativa (`HEAD`).
  - Lista de branches remotas (`origin/*`).
  - Ações: `New Branch...`, `Checkout Branch`, `Merge into current...`, `Delete Branch` (com diálogo de confirmação), `Rename Branch`.

### 3.4 Aba Conflicts
- Exibida com badge de aviso quando o repositório estiver em estado de conflito (`MERGING`).
- Lista de objetos com colisão entre as versões `Ours` (local) e `Theirs` (remoto).
- Botões de ação rápida: `Accept Ours`, `Accept Theirs`, `Launch External Merge Tool`.
- Botão `[Abort Merge]` para retornar com segurança ao estado anterior ao merge.

## 4. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **SVN/Mercurial somente leitura e TFS fora do escopo Linux:** O painel usa `execFile` para consultar status, histórico e diferenças quando `svn` ou `hg` existem; sem o cliente, a opção fica desabilitada e explica como instalar. Git continua com os fluxos de escrita. TFS/Azure DevOps Server foi excluído do escopo pelo dono do produto por depender do ecossistema Windows.
2. **Editor Gráfico de 3 Vias Integrado (Pendente):** No original, a aba Conflicts possui um editor de 3 vias completo com colunas Base, Ours, Theirs e o resultado interativo com navegação de diferenças por teclas `F7`/`Shift+F7`. No TuxSQL o resolver gráfico ainda não está implementado na interface (requer resolução manual ou externa).
3. **Grafo Topológico DAG de Commits (Pendente):** O original renderiza nós gráficos com linhas multicoloridas conectando bifurcações e merges entre branches. O TuxSQL atualmente apresenta o histórico em grade linear tabular.
4. **Alerta Concorrente em Tempo Real para Modelo Shared (Pendente):** No modelo Shared, o original monitora metadados de sessão para alertar quando outro usuário do estúdio altera a mesma tabela simultaneamente no banco compartilhado. O TuxSQL persiste a opção Shared, mas ainda não dispõe de canal de sincronização de locks distribuídos em tempo real.

## 5. Estados de Interface
| Estado | Comportamento |
|---|---|
| Carregando status Git / Diff | Skeleton shimmer na árvore de mudanças + spinner no cabeçalho do painel |
| Erro de Autenticação / Rede | Banner vermelho com detalhe do erro do Git + botão [Configurar Chaves] [Tentar Novamente] |
| Repositório Sincronizado | Ilustração de check verde "Everything up to date" |
| Commit Realizado com Sucesso | Toast informativo "Commit {hash} created" e atualização imediata do contador `↑` |
| Conflito de Merge Ativo | Banner âmbar no topo do painel + ativação forçada da aba Conflicts |
| Operação Destrutiva (Revert/Delete) | Diálogo modal com confirmação explícita listando os objetos afetados |

## 6. Atalhos de Teclado
- Abrir Source Control Manager: `Ctrl+Alt+G`
- Abrir Project Explorer: `Ctrl+W, J`
- Abrir Projeto: `Ctrl+Shift+O`
- Executar Commit: `Ctrl+Enter` (com foco na caixa de texto da mensagem)
- Atualizar Status / Refresh: `F5`
- Pull Remoto: `Ctrl+Shift+L`
- Push Remoto: `Ctrl+Shift+K`
- Próxima Alteração / Conflito: `F7` / `Shift+F7`

## 7. Temas e Acessibilidade
- Total conformidade com o tema Claro (Visual Studio Light) e Escuro (VS Dark) seguindo tokens de `01-shell.md`.
- Indicadores de status utilizam forma e cor (ícones estilizados com tooltip e texto explicativo, nunca dependendo exclusivamente de cor).
- Teclado: navegação completa por foco (`Tab`, setas em árvores, `Space` para marcar checkboxes, `Enter` para abrir diff).

## 8. Componentes
`ProjectExplorer`, `ProjectTree`, `LinkWizardDialog`, `ChangeTree`, `SideBySideDiff`, `CommitHistoryGrid`, `BranchSelector`, `ConflictResolverPane`, `SyncConfirmDialog`.

## 9. Critérios de Aceite
- Assistente de vínculo permite configurar conexão, banco, repositório Git e modelo Dedicated/Shared com sucesso.
- Project Explorer carrega estrutura de pastas, exibe arquivos `.sql` e executa operações de contexto.
- Painel Source Control exibe status Git, realiza commits atômicos com mensagens e atualiza branches.
- Operações de leitura/escrita não violam limites de segurança do Linux (travessia de path e symlinks bloqueados).

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Source Control Manager | Título do painel | `sc.panel.title` |
| Link Database to Source Control... | Menu do database / wizard | `sc.link.cmd` |
| Select a database to link it to a source control. | Passo 1 do wizard | `sc.link.selectDb` |
| Select a source control repository or create a new one. | Passo de repositório | `sc.link.selectRepo` |
| Create New Repository | Wizard | `sc.repo.create` |
| Dedicated / Shared | Modelo de desenvolvimento | `sc.model.dedicated / sc.model.shared` |
| Source Control Link Static Data | Conteúdo do vínculo (static data) | `sc.link.staticData` |
| Branch: / Repository: / Repository Name: | Cabeçalho do painel | `sc.header.branch` |
| Commit changes to the version control | Tooltip do botão Commit | `sc.commit.hint` |
| Commit Selection | Ação Changes | `sc.commit.selection` |
| Get Latest | Aplicar repo → database | `sc.getLatest` |
| Revert Changes | Ação Changes | `sc.revert` |
| Change Link Direction | Alternar direção | `sc.link.direction` |
| Commit succeeded. / Commit failed. / Commit finished with warnings. | Resultado do commit | `sc.commit.ok / sc.commit.fail / sc.commit.warn` |
| Source Control: Committing... / Getting Latest... / Refreshing... | Progresso na statusbar | `sc.progress.*` |
| Git not found / Git repository not found | Erro de pré-requisito (adaptar: instalar git) | `sc.err.gitMissing / sc.err.repoMissing` |
| The folder for the link was not found on the repository. | Erro de vínculo | `sc.err.folderMissing` |
| Are you sure you want to delete Source Control link? | Confirmação de remoção do vínculo | `sc.link.deleteConfirm` |
| Are you sure you want to stop linking? | Cancelar wizard | `sc.link.stopConfirm` |
| Initializing repository: {0} | Progresso | `sc.progress.init` |
| Project Explorer / Project Wizard | Painel e wizard de projeto | `proj.explorer / proj.wizard` |
| Project Name: / Projects location: | Campos do wizard | `proj.field.name / proj.field.location` |
| Project file corrupted. | Erro de projeto | `proj.err.corrupt` |
| Project name is empty. | Validação | `proj.err.nameEmpty` |
| Compare with database | Menu de contexto | `sc.cmd.compareDb` |
