# UX 15 — Source Control e Projects

Reusa `01-shell.md`, `07` (DiffTree, SideBySideDiff, SyncConfirmDialog), `03` (TreeView, CodeEditor). **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Source Control; Project Explorer / SQL Projects) e https://www.devart.com/tuxsql/mysql/studio/source-control.html. Citações por redirecionamento; páginas individuais não abertas. Fidelidade REA: rótulos conferidos contra REA ui-text. Escopo Linux: **Git apenas** (SVN/TFS/Mercurial/Azure DevOps = fora [C existe no original; adaptação Linux por ADR/inventário]).

## 1. Project Explorer [C: painel; REA ui-text "Project Explorer"]
Dock (esquerdo, aba junto ao Database Explorer): árvore de **Projetos** (pasta local `.dbproj.json` [I]) com nós: Project > Connections (referências, sem senhas) > SQL Scripts > Diagramas > Documentação/Outros. Ações da toolbar: New Project, Open Project, Add Existing File, New Script, Refresh. Menu de contexto: Open, Rename (F2), Delete (da lista / do disco, confirmação), Add > New SQL/Folder/Existing, Show in File Manager, Copy Path, Set Connection (associa script a uma conexão). Duplo clique abre o arquivo em aba SQL. Arrastar para reordenar/mover entre pastas. Detecta alterações externas (watch) e atualiza; arquivos modificados mostram "•"/status Git.
Projeto de banco (**Database Project**) [C conceito]: pasta com um `.sql` por objeto (tabelas, views, rotinas…), gerada por **Script Folder** (Tools > Script Database to Folder): diálogo (database, objetos, destino, opções: um arquivo por objeto, incluir dados estáticos de tabelas selecionadas [C: static data]). Estados: loading com ProgressList; erro por objeto; sucesso com resumo.
Estado vazio: "Nenhum projeto" + [New Project] [Open Folder].

## 2. Painel Source Control ("Source Control Manager" [C REA ui-text]; Ctrl+Alt+G [I])
```
+ Source Control -------------------------------------------------+
| Branch: [main ▾] ↑2 ↓0 [Fetch][Pull][Push] [⟳]                   |
+------------------------------------------------------------------+
| Abas: [Changes][History][Branches][Conflicts*]                   |
+------------------------------------------------------------------+
```
### 2.1 Vincular database ao repositório [C: dedicated/shared]
Database Explorer > database > **Link Database to Source Control…** [C REA ui-text]: wizard 3 passos: (1) Repositório: Git local (pasta existente/clone — URL https/ssh, destino) ; (2) Modelo de desenvolvimento **Dedicated** (cada dev tem seu database) ou **Shared** [C REA ui-text] (todos no mesmo, bloqueio/avisos) [C]; (3) Conteúdo: objetos e **Source Control Link Static Data** [C REA ui-text] tables [C]; e opção de commit inicial. Autenticação Git: usa `ssh-agent`/chaves padrão ou credencial HTTPS/PAT via cofre do SO (libsecret); nunca em texto puro. Estado do vínculo indicado no nó do database (ícone Git + branch).
### 2.2 Changes [C]
Compara **database ↔ working copy** e **working copy ↔ HEAD**: lista de objetos alterados com estado (Added/Modified/Deleted/Conflicted ícones+texto), checkbox por item, diff lado a lado (07) por seleção. Direção: [Commit] ("Commit changes to the version control" [C REA ui-text]) [Get Latest] (aplica ao DB [C REA ui-text]); troca de direção = "Change Link Direction" [C REA ui-text]; "Revert Changes" e "Commit Selection" [C REA ui-text] — toggle de direção explícito, com **o lado que será modificado sempre destacado**. Campo mensagem (obrigatório), [Commit] / [Commit & Push]; autor mostrado (config. user.name/email, editável em Options). Dados estáticos: mesma lista com contagem de linhas diferentes.
Aplicar ao database (Get Latest) usa o fluxo de Schema Compare/Synchronize do 07 §6 (resumo, riscos, backup, confirmação) [C: Schema Compare no VCS]; dados estáticos usam Data Compare (07 §7).
### 2.3 History
Lista de commits (grafo simples [I], hash curto, mensagem, autor, data), filtros (autor, caminho, texto), detalhe com arquivos alterados e diff; ações: Checkout (apply to database), Revert, Cherry-pick [I], Copy hash, Compare with working copy/database.
### 2.4 Branches
Local/Remote: criar (de HEAD/commit), checkout (avisa e oferece aplicar ao DB), merge, rebase [I], delete (confirma), rename. Merge com conflitos → aba **Conflicts**.
### 2.5 Conflicts
Lista de arquivos/objetos em conflito; editor de 3 vias (Base | Ours | Theirs → Resultado) com [Accept Ours/Theirs/Both], navegação F7/Shift+F7, [Mark resolved]; [Abort merge]. Sem conflitos: EmptyState.

## 3. Estados
| Estado | Comportamento |
|---|---|
| Carregando status | skeleton + spinner |
| Erro Git (auth/rede/permissão) | InlineErrorPanel com mensagem do git + [Tentar de novo] [Editar credenciais] |
| Sem alterações | EmptyState verde "Tudo sincronizado" |
| Sucesso commit/push | toast "Commit a1b2c3d criado", contador ↑ atualizado |
| Push rejeitado | banner âmbar "Remoto avançou — faça Pull" |
| Repositório sujo/em merge | banners específicos |
Operações destrutivas (Revert, delete branch, force) com confirmação; Prod: aplicar ao database exige digitar nome.

## 4. Atalhos
Painel Ctrl+Alt+G [I]; Commit Ctrl+Enter (no campo mensagem); Refresh F5; Pull/Push Ctrl+Shift+L / Ctrl+Shift+K [I]; Próx. conflito F7; Novo projeto Ctrl+Shift+J [I].

## 5. Temas / acessibilidade
Tokens 01; estados com ícone+letra (A/M/D/C); diffs conforme 07 §9; árvores/listas por teclado.

## 6. Componentes
TreeView, ProjectTree, LinkWizard (WizardDialog), ChangeList (DiffTree), SideBySideDiff, ThreeWayMerge, CommitList, BranchSelect, Banner, InlineErrorPanel, SyncConfirmDialog.

## 7. Critérios de aceite
- Criar projeto, scriptar um database para pasta, vincular a repositório Git (dedicated/shared), ver mudanças DB↔repo, commitar e dar push; aplicar alterações do repo ao DB com confirmação.
- História, branches, merge com resolução de conflitos.
- Credenciais seguras; estados, temas, teclado cobertos.

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
