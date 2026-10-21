# UX 08 — Security Manager, Session Manager e Server Variables

> Fidelidade REA: rótulos conferidos contra REA ui-text (Security Manager, Session Manager, Server Variables, Kill*, privilégios) e notas de sessão anterior em `re/original-observation/NOTES.md` #08.
Auditoria de origem de evidência: **(b) Sessão anterior / (c) Inferência/REA**. Nenhuma captura foi feita na sessão corrente; pendente de confirmação por novas capturas da Lupa.

Reusa `01-shell.md`, `03` (DataGrid, TreeView), `04` (MasterDetailList, EditableGrid) e `07` (SyncConfirmDialog padrão de confirmação). Todos abrem como documentos MDI em aba ligados a **uma conexão** ativa.
Entradas principais:
- Atalhos em acordes (chords): **Security Manager** `Ctrl+D, Q` | **Session Manager** `Ctrl+D, S` | **Server Variables** `Ctrl+D, V`.
- Menu Tools > Security Manager / Session Manager / Server Variables.
- Database Explorer > clique com botão direito na conexão > Security Manager / Session Manager / Server Variables.

## 1. Security Manager [I: sessão anterior]

### 1.1 Layout do Documento
```
+ Aba: [Security Manager - mysql-teste] ------------------------------------------+
| Toolbar: Connection: [mysql-teste ▾] [Refresh F5] [Save Ctrl+S] [Undo]           |
|          [Script Changes] | [Create User ▾] [Delete]                             |
+------------------------------------+--------------------------------------------+
| PAINEL ESQUERDO                    | PAINEL DIREITO                             |
| (Árvore de Contas e Roles)         | "Details for user obs@%"                   |
|                                    |                                            |
| ▾ Users                            | Abas: [General] [Roles] [Global Privileges]|
|   ▾ % (5)                          |       [Object Privileges] [Limits]         |
|     • root@%                       |                                            |
|     • obs@%                        |                                            |
|   ▾ localhost (3)                  | Aba Global Privileges:                     |
|     • mysql.sys@localhost          | [x] With Grant Option                      |
|     • root@localhost               | Grade de Privilégios:                      |
| ▸ Roles (2)                        | [x] | Name                       | Granted |
|                                    | [x] | SELECT                     | Yes     |
|                                    | [x] | INSERT                     | Yes     |
|                                    | [ ] | AUDIT_ADMIN                | No      |
|                                    | [ ] | BACKUP_ADMIN               | No      |
+------------------------------------+--------------------------------------------+
```

### 1.2 Abas de Detalhe do Usuário [C: observado na VM]
- **General:**
  - `User name`: texto do usuário.
  - `Host`: endereço ou wildcard (`%` padrão).
  - `Authentication type`: combo com plugins suportados (`caching_sha2_password`, `mysql_native_password`, `auth_socket`).
  - `Authentication String` / `Password` / `Confirm Password`.
  - `Password Expire`: seletor de expiração (`Never`, `Interval DEFAULT`, `Expire Date`).
  - `Account Locked`: checkbox para bloqueio administrativo da conta.
- **Global Privileges [C]:**
  - Checkbox mestre: `☑ With Grant Option`.
  - Tabela com lista completa de privilégios (`Name` | `Granted`):
    - Privilégios relacionais: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`, `FILE`, `INDEX`, `ALTER`, etc.
    - Privilégios administrativos: `SUPER`, `PROCESS`, `RELOAD`, `SHUTDOWN`, `SHOW DATABASES`, `CREATE USER`.
    - Privilégios dinâmicos modernos do MySQL 8: `ALLOW_NONEXISTENT_DEFINER`, `APPLICATION_PASSWORD_ADMIN`, `AUDIT_ADMIN`, `BACKUP_ADMIN`, `BINLOG_ADMIN`, `CONNECTION_ADMIN`, `PERSIST_RO_VARIABLES_ADMIN`, etc.
- **Object Privileges:** Árvore de banco de dados, tabelas e colunas, permitindo concessão seletiva de permissões em nível de objeto.
- **Roles:** Concessão e revogação de papéis (roles) associados à conta.
- **Limits:** Definição de limites de uso (`MAX_QUERIES_PER_HOUR`, `MAX_UPDATES_PER_HOUR`, `MAX_CONNECTIONS_PER_HOUR`, `MAX_USER_CONNECTIONS`).

### 1.3 Operações Seguras e Preview DDL
- **Save (`Ctrl+S`):** Aplica as alterações no banco com execução de `GRANT`, `REVOKE` e `ALTER USER`.
- **Script Changes:** Abre o editor SQL com o script DDL equivalente gerado para revisão manual.
- **Salvaguardas no Linux:** Senhas são mascaradas no preview (`'***'`); exclusão ou revogação de privilégios da própria conta ativa conectada é estritamente bloqueada com aviso impeditivo.

## 2. Session Manager [I: sessão anterior]

### 2.1 Layout e Monitoramento
- **Toolbar Superior:**
  - Seletor de conexão: `Connection [mysql-teste ▾]`.
  - Botão `[Refresh]` (`F5`).
  - Botões de Ação: `[Kill Query]`, `[Kill Session]`.
  - Controle de taxa: `Refresh interval: [02:00 ▾]` (desligado, 2s, 5s, 10s, 30s, 2min).
  - Indicador temporal: `Last refreshed at: 17:14:02`.
- **Grade de Processos Ativos:**
  - Colunas: `Id` | `User` | `Host` | `Database` | `Command` | `Time (s)` | `State` | `Info`.
  - Identifica e exibe tanto conexões de clientes externos quanto threads de segundo plano do sistema (ex.: `event_scheduler`, `Command Daemon`).
- **Painel Inferior de Detalhe:**
  - Exibe o texto completo e não-truncado da consulta da sessão selecionada na grade em editor Monaco somente leitura com destaque de sintaxe e botão de cópia.

### 2.2 Terminação de Processos
- Ações `Kill Query` (`KILL QUERY id`) e `Kill Session` (`KILL id`) exigem confirmação modal explícita informando que transações ativas serão revertidas.
- A sessão conectada do próprio estúdio é protegida contra auto-terminação acidental.

## 3. Server Variables [I: sessão anterior]
- Documento MDI **"View Server Variables"**:
  - Toolbar com toggle segmentado no topo: **[System | Status]** para alternar entre variáveis de configuração de sistema (`SHOW VARIABLES`) e contadores operacionais de status (`SHOW STATUS`).
  - Botão `[Refresh]` (`F5`), botão `[Apply]` (`Ctrl+S`), caixa de busca instantânea e campo de filtro "Only dynamic".
  - Grade de dados: `Name` | `Value` | `Description`.
  - Edição inline para variáveis dinâmicas com destaque âmbar na célula alterada antes da aplicação.
  - Aplicação via diálogo com `SET GLOBAL` e `SET SESSION`.

## 4. O que o TuxSQL ainda NÃO faz (Diferenças Objetivas em relação ao Original)
1. **Aba "Locks" de Transações InnoDB no Session Manager (Pendente):** No original há uma aba dedicada para inspecionar árvores de deadlocks e transações concorrentes travadas no InnoDB (`information_schema.innodb_trx` / `data_locks`). O TuxSQL exibe a lista geral de processos do `SHOW PROCESSLIST`.
2. **Cobertura Completa de Todos os 35+ Privilégios Dinâmicos do MySQL 8 (Pendente):** O original mapeia exaustivamente todos os privilégios dinâmicos introduzidos no MySQL 8.0/8.4 com checkboxes individuais. O TuxSQL oferece suporte a privilégios padrão e um subconjunto de dinâmicos essenciais.
3. **Persistência de Variáveis com `SET PERSIST` no Disco (Pendente):** O original suporta persistência automática de variáveis globais gerando comandos `SET PERSIST` que modificam o `mysqld-auto.cnf` do servidor. O TuxSQL emite comandos `SET GLOBAL` e `SET SESSION` em memória transitória.
4. **Gráfico Temporal de Variação de Taxas de Status (Pendente):** No original há monitores com gráficos de linha calculando variações por segundo de contadores (consultas/seg, bytes/seg). O TuxSQL apresenta os valores estáticos tabelados.

## 5. Estados de Interface
| Estado | Comportamento |
|---|---|
| Carregando Processos / Variáveis | Shimmer skeleton na grade com indicador na status bar |
| Auto-Refresh Ativo | Indicador de cronômetro atualizando no cabeçalho sem roubar foco da grade |
| Privilégios Administrativos Faltantes | Banner informativo alertando que a conta atual não possui grant `PROCESS` ou `SUPER` |
| Sessão Encerrada com Sucesso | Toast verde informativo e remoção imediata da linha correspondente na grade |
| Tentativa de Kill na Própria Sessão | Botões Kill desabilitados com tooltip "Cannot kill current studio session" |

## 6. Atalhos de Teclado
- Abrir Security Manager: `Ctrl+D, Q`
- Abrir Session Manager: `Ctrl+D, S`
- Abrir Server Variables: `Ctrl+D, V`
- Atualizar (`Refresh`): `F5`
- Aplicar Alterações: `Ctrl+S`
- Encerrar Consulta / Sessão Selecionada: `Delete` / `Shift+Delete`
- Localizar na grade: `Ctrl+F`

## 7. Temas e Acessibilidade
- Conformidade integral com tokens de design system de `01-shell.md`.
- Indicadores de tempo de consulta (alertas de queries lentas) combinam texto numérico com fundo colorido translúcido.
- Grades e árvores de privilégios suportam navegação completa por teclado e marcação por barra de espaço.

## 8. Componentes
`SecurityManagerDocument`, `UserHierarchyTree`, `PrivilegesMatrixGrid`, `SessionManagerDocument`, `ProcessListGrid`, `QueryDetailViewer`, `ServerVariablesDocument`, `KillConfirmModal`.

## 9. Critérios de Aceite
- Permite gerenciar contas de usuário, senhas e concessões globais e por objeto.
- Session Manager lista conexões em tempo real, exibe o SQL associado e emite KILL com segurança.
- Server Variables diferencia variáveis de sistema e status e aplica alterações dinâmicas com confirmação.
- Atalhos em acordes (`Ctrl+D, Q/S/V`) abrem os respectivos módulos com foco direto.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Security Manager | Menu Tools, título da aba | `sec.title` |
| Session Manager | Menu Tools, título da aba | `sess.title` |
| Server Variables | Menu Tools, título da aba | `vars.title` |
| Privileges / Global Privileges | Aba/escopo global | `sec.privileges / sec.privileges.global` |
| Database Privileges / Object Privileges | Escopos de privilégio | `sec.priv.database / sec.priv.object` |
| Available Privileges: | Lista de privilégios | `sec.priv.available` |
| Grant All Privileges / Revoke All Privileges | Ações de privilégios | `sec.priv.grantAll / sec.priv.revokeAll` |
| Revoke Selected Privilege | Ação de privilégios | `sec.priv.revokeSelected` |
| Grant Option | Checkbox de privilégio | `sec.priv.grantOption` |
| Role Members / Role Privileges | Aba Roles | `sec.roles.members / sec.roles.privileges` |
| Account Locked / Password Expire | Campos General | `sec.acct.locked / sec.acct.passwordExpire` |
| Authentication type: / Authentication String: | Campos General | `sec.auth.type / sec.auth.string` |
| Max Queries / Max Updates / Max Connections | Aba Limits | `sec.limits.queries / updates / connections` |
| Host: / User: / Password: | Campos General | `sec.field.host / user / password` |
| Password cannot be empty. | Erro de validação | `sec.err.passwordEmpty` |
| User {0} created. / User {0} altered. | Mensagem de sucesso | `sec.msg.created / sec.msg.altered` |
| Grant succeeded / Revoke succeeded | Resultado de execução | `sec.msg.grantOk / sec.msg.revokeOk` |
| User '{0}' was modified. Do you want to save changes? | Confirmação ao fechar/trocar | `sec.dirtyConfirm` |
| Insufficient privileges. | Estado sem permissão | `sec.err.insufficient` |
| Kill Query / Kill Session / Kill User Sessions | Ações do Session Manager | `sess.kill.query / session / user` |
| Do you really want to kill selected session? | Confirmação | `sess.kill.confirm` |
| Are you sure you want to kill all sessions with user name '{0}'? | Confirmação (por usuário) | `sess.kill.userConfirm` |
| Session statistics | Painel/aba de estatísticas | `sess.stats` |
| Compare changes of STATUS VARIABLES | Ação em Server Variables | `vars.compareStatus` |
| Apply / Apply Changes | Toolbar | `common.apply / common.applyChanges` |
