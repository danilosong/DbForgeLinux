# UX 08 — Security Manager, Session Manager e Server Variables

Reusa `01-shell.md`, `03` (DataGrid, TreeView), `04` (MasterDetailList, EditableGrid) e `07` (SyncConfirmDialog padrão de confirmação). Todos abrem como documentos em aba ligados a **uma conexão** (nome da conexão e faixa de ambiente no cabeçalho). Entradas: Tools > Security Manager / Session Manager / Server Variables; Explorer > conexão > mesmo menu. Requerem privilégios; sem eles, ver §6.

## 1. Security Manager

### 1.1 Layout
```
+ Aba: [Security Manager - prod-db] -------------------------------+
| Toolbar: [New User] [Clone] [Delete] [Refresh F5] [Apply Ctrl+S]  |
|  [Discard] | [Search users...]                                    |
+----------------------+--------------------------------------------+
| Lista de usuários    | Detalhe do usuário                         |
| (Name@Host, locked   | Abas: [General][Privileges][Roles]         |
|  ícone, auth plugin) |        [Limits][Preview SQL]               |
+----------------------+--------------------------------------------+
```
Lista 300px: ícone (usuário, bloqueado com cadeado, expirado âmbar, role cinza), `user@host`, filtro por texto e por tipo (Users/Roles/Locked). Ordenação alfabética. Alterações ficam **pendentes** (como 04) até Apply; usuário novo/alterado/removido recebe marcas +, ✎, ✕.

### 1.2 General
| Campo | Controle | Notas |
|---|---|---|
| User name | texto | obrigatório; vazio = anônimo (aviso) |
| Host | texto | `%` padrão, aceita wildcards/IP/máscara; dica de formato |
| Authentication plugin | select (caching_sha2_password, mysql_native_password, auth_socket, …) | lista conforme servidor |
| Password / Confirm | PasswordInput | força indicada (barra); botão "Generate" (24 chars, copiar); vazio no existente = não alterar |
| Account locked | toggle | |
| Password expiration | select (Default/Never/Now/Interval N days) | |
| Require SSL/X509 | select (None/SSL/X509/Issuer/Subject) | |
| Comment/Attribute | texto | MySQL 8 |
Validação: duplicado user@host; senhas diferentes; política de senha do servidor (erro retornado ao Apply com mensagem clara).

### 1.3 Privileges
Seletor de **escopo** à esquerda (árvore): Global (*.*), cada Database (db.*), expansível para Tables/Columns/Routines (lazy; estados loading/erro de 03). Painel direito: grupos de checkboxes para o escopo selecionado:
- **Data:** SELECT, INSERT, UPDATE, DELETE, FILE
- **Structure:** CREATE, ALTER, DROP, INDEX, CREATE VIEW, SHOW VIEW, CREATE ROUTINE, ALTER ROUTINE, EXECUTE, TRIGGER, EVENT, REFERENCES, CREATE TEMPORARY TABLES, LOCK TABLES
- **Administration (só global):** PROCESS, RELOAD, SHUTDOWN, SUPER, REPLICATION SLAVE/CLIENT, CREATE USER, CREATE TABLESPACE, SHOW DATABASES, GRANT OPTION, privilégios dinâmicos do 8 (lista pesquisável)
Cada checkbox tri-state: marcado (concedido neste escopo), vazio, indeterminado (herdado de escopo superior, texto cinza + tooltip "Herdado de *.*"). Botões: [Select All] [Clear] [Preset ▾ (Read only, Read/Write, DBA)], **GRANT OPTION** destacado com aviso âmbar. Resumo no topo "Privilégios efetivos: 14". Colunas: no escopo tabela, subgrade de colunas com SELECT/INSERT/UPDATE/REFERENCES. Concessões perigosas (ALL, SUPER, GRANT OPTION, *.* para host `%`) mostram banner vermelho de aviso e exigem confirmação ao Apply.

### 1.4 Roles / Limits / Preview SQL
- **Roles** (MySQL 8+/MariaDB 10.0.5+; aba oculta se não suportado): listas "Roles concedidas" ↔ "Disponíveis" (duplo clique move), default role.
- **Limits:** MAX_QUERIES_PER_HOUR, MAX_UPDATES_PER_HOUR, MAX_CONNECTIONS_PER_HOUR, MAX_USER_CONNECTIONS (number, 0 = ilimitado).
- **Preview SQL:** Monaco somente leitura com CREATE USER/ALTER USER/GRANT/REVOKE/DROP USER gerados; senhas mascaradas como `'***'` (exibição); botão Copy (copia com marcador `<senha>`).

### 1.5 Apply, Delete
Apply: diálogo (padrão SyncConfirmDialog): resumo de contagens, lista de SQL (senha mascarada), riscos (DROP USER, REVOKE do próprio usuário atual — **bloqueado** com mensagem "Não é possível remover os próprios privilégios de administração desta conexão" salvo confirmação forte —, concessão global), [Apply] [Cancel]. Execução com progresso por statement; resultado ✓/✕ por item; falha parcial lista o que ficou aplicado; `FLUSH PRIVILEGES` automático quando necessário. Delete: "Excluir `user@host`? Sessões ativas do usuário não serão encerradas." com checkbox "Encerrar sessões ativas" (abre Session Manager filtrado). Usuário `root@localhost`/usuário da conexão atual: Delete desabilitado com tooltip.
Clone: copia privilégios para novo user@host (pede nome/host/senha).

### 1.6 Estados
Loading lista: skeleton; vazio com filtro: "Nenhum usuário"; erro de leitura (mysql.user inacessível): InlineErrorPanel "Sem acesso às contas — requer SELECT em mysql.* ou CREATE USER" [Tentar de novo]; sucesso: toast "Alterações aplicadas".

## 2. Session Manager (processos)

### 2.1 Layout
```
+ Aba: [Sessions - prod-db] ---------------------------------------+
| Toolbar: [Refresh F5] [Auto-refresh: Off|2s|5s|10s|30s ▾]         |
|  [Kill Query] [Kill Session] | Filtros: [Sleep ☐ ocultar] [Mine ☐] |
|  [Search...]                                                      |
+-------------------------------------------------------------------+
| Grid de sessões (topo)                                            |
+-------------------------------------------------------------------+
| Detalhe da sessão selecionada: [Query] [Locks*] [Info]            |
+-------------------------------------------------------------------+
```
Grid (DataGrid de 03, somente leitura, ordenável): ID | User | Host | DB | Command | Time (s) | State | Info (query truncada) | Memory/Rows examined (se disponível). Linhas coloridas: Time > 60s âmbar, > 300s vermelho 15% (limites configuráveis); sessão própria em negrito com marca "(você)".
Detalhe: **Query** (Monaco somente leitura com SQL completo, [Copy] [Open in SQL Editor]), **Locks** (transações/locks InnoDB, P1 — mensagem "Indisponível" se sem permissão), **Info** (propriedades da sessão).

### 2.2 Ações
- **Kill Query** (`KILL QUERY id`) e **Kill Session** (`KILL id`): multiseleção; diálogo de confirmação "Encerrar 2 sessões? Transações em andamento serão revertidas." [Encerrar] [Cancelar]. A própria sessão e threads do sistema: desabilitado com tooltip. Resultado: toast verde / erro vermelho por sessão; refresh automático em seguida.
- Auto-refresh: liga/desliga preservando seleção e scroll; indicador "Atualizado 12:03:44" + spinner sutil durante o fetch; falha de refresh: banner âmbar "Falha ao atualizar — tentando de novo" sem apagar dados anteriores (marcados "obsoletos" cinza).
- Contadores no rodapé: "42 sessões · 3 ativas · 1 lenta".
- Menu de contexto: Kill Query, Kill Session, Copy Query, Copy as row, Open Query in SQL Editor, Filter by User/Host/DB.

### 2.3 Estados
Loading inicial skeleton; vazio "Nenhuma sessão" (raro); erro de permissão: "Você só vê suas próprias sessões — requer privilégio PROCESS para ver todas" (banner informativo, grid mostra as próprias); erro de conexão: InlineErrorPanel [Reconectar].

## 3. Server Variables

### 3.1 Layout
Toolbar: [Refresh F5] [Apply Ctrl+S] [Discard] | escopo **[Session | Global]** (toggle segmentado) | busca | filtros [Only modified] [Only dynamic] [Hide read-only] | [Export…] [Compare…(P2)] | aba extra **Status** (SHOW STATUS, somente leitura, mesma grade).
Grade (EditableGrid): Name | Value | Default (se conhecido) | Dynamic (✓/✗) | Scope (Global/Session/Both) | Category | Description (tooltip longo/painel inferior). Agrupamento opcional por Category (InnoDB, Replication, Connections, Query Cache, Logging…).
Valor editável apenas se Dynamic; tipos de editor: booleano (ON/OFF toggle), enum (select), numérico (com unidade e validação min/max), texto. Variáveis estáticas: linha cinza com cadeado "Requer reinício do servidor / arquivo my.cnf".
Valor modificado: destaque âmbar + ícone ✎ + botão "Reset" por linha (volta ao valor atual do servidor).

### 3.2 Apply
Alterações pendentes aplicam via `SET GLOBAL`/`SET SESSION`. Diálogo: lista nome, valor antigo → novo, escopo, aviso "SET GLOBAL afeta todas as novas conexões e não persiste após reinício (use `SET PERSIST` no MySQL 8)": checkbox "Persistir (SET PERSIST)" disponível no 8+. Variáveis críticas (max_connections, innodb_*, sql_mode, read_only, super_read_only) mostram aviso âmbar; Prod: digitar nome da conexão. Resultado por item ✓/✕ (erro SQL exibido na linha, ex.: "Variable 'x' is a read only variable"). Falha não desfaz sucessos anteriores (informado). Sucesso: toast e Refresh.
Sem SUPER/SYSTEM_VARIABLES_ADMIN: grade somente leitura com banner.

### 3.3 Estados
Loading skeleton (centenas de linhas virtualizadas); vazio de busca "Nenhuma variável corresponde"; erro InlineErrorPanel; sucesso toast. Export: CSV/JSON/`my.cnf` (somente modificadas).

## 4. Atalhos

| Ação | Atalho |
|---|---|
| Refresh | F5 |
| Apply | Ctrl+S |
| Discard | Ctrl+Z (pendências) |
| Busca | Ctrl+F |
| Kill Query / Kill Session | Delete / Shift+Delete (com confirmação) |
| Alternar auto-refresh | Ctrl+Alt+R |
| Escopo Session/Global | Ctrl+Shift+G |
| Copiar linha | Ctrl+C |
| Próxima aba interna | Ctrl+PgDn |

## 5. Temas e acessibilidade
Tokens de 01; linhas lentas/modificadas usam opacidade 15% + ícone/texto adicional; tri-state com marca textual (✓, —, herdado); grids e árvores navegáveis por teclado; anúncios aria-live para auto-refresh só em mudanças relevantes (evitar spam).

## 6. Permissões e segurança (transversal)
- Detecção de privilégios ao abrir; ações indisponíveis ficam desabilitadas com tooltip do privilégio faltante, nunca ocultas.
- Conexão read-only: apenas leitura em todas as três telas.
- Senhas: nunca registradas em Output/log/clipboard por padrão; Preview mascara; gerador copia só com ação explícita (clipboard limpa em 30s).
- Todas as ações destrutivas (DROP USER, KILL, SET GLOBAL crítico) com confirmação; Prod com digitação do nome.

## 7. Componentes
MasterDetailList, PrivilegeMatrix (checkbox tri-state por grupos + herança), ScopeTree, PasswordInput (+ strength + generate), DualList (roles), DataGrid/EditableGrid, AutoRefreshControl, ConfirmDialog/SyncConfirmDialog, SegmentedToggle, Banner, InlineErrorPanel, Skeleton, Toast.

## 8. Critérios de aceite
- Security Manager cria/edita/clona/exclui usuários e privilégios por escopo (global/db/tabela/coluna), exibe herança, mostra SQL com senha mascarada e aplica após confirmação com resumo de riscos.
- Session Manager lista, filtra, atualiza automaticamente, e mata query/sessão com confirmação, protegendo a própria sessão.
- Server Variables edita só variáveis dinâmicas, distingue Session/Global, explica persistência e aplica com resultado por item.
- Estados loading/erro/sucesso e falta de permissão cobertos; claro/escuro; teclado completo.
