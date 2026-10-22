# Segurança "no nosso jeito Linux"

Equivalentes Linux (Debian/Ubuntu/Pop!_OS) ao que em outro sistema seria DPAPI, UAC, serviço do Windows ou assinatura de instalador. Medido em **Ubuntu 26.04.1 LTS, systemd 259, `kernel.apparmor_restrict_unprivileged_userns = 1`**, em 2026-10-22. Cada item diz o que **já existe** e o que **falta**.

Regra para testes que podem derrubar o binário: usar a cópia `app/dist/linux-unpacked/tuxsql` (nunca o app instalado em `/opt/TuxSQL`), com `-p LimitCORE=0` e `XDG_CONFIG_HOME` isolado, para não gerar relatório do apport nem mexer no perfil real.

## 1. Units `systemd --user` do backup agendado

**Já existe** (`app/src/modules/database-tools/scheduler.ts`): `.service` + `.timer` 0600 em `~/.config/systemd/user`, ID validado, escape de systemd (`%`, `\`, `"`), saída no journal, `Persistent=true`; o fallback cron usa escape de shell e crontab temporário 0600 com nome aleatório; a retenção agora só apaga nomes gerados pelo agendador (S3).

**Adicionado nesta rodada:** diretivas de sandbox na unit gerada, cada uma validada com o binário Electron real executando `--run-backup-schedule`, inclusive um **backup real** (TCP até o MySQL de teste, dump com as linhas, arquivo 0600, estado `success`):

```ini
[Service]
Type=oneshot
ExecStart="/opt/TuxSQL/tuxsql" "--no-sandbox" "--run-backup-schedule" "<id>"
StandardOutput=journal
StandardError=journal
NoNewPrivileges=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK
LockPersonality=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
SystemCallArchitectures=native
UMask=0077
```

### Tabela: diretiva systemd → compatível com o Electron em `--run-backup-schedule`?

`rc=218` = a unit nem sobe (o gerenciador de usuário não tem a capacidade). "Sem efeito" = aceita, mas não aplicada: provado escrevendo em `~/.cache` e em `/tmp` de dentro da unit e vendo o arquivo do lado de fora.

| Diretiva | Compatível? | Por quê / evidência | Na unit gerada? |
|---|---|---|---|
| `NoNewPrivileges=yes` | **Sim** | rc=0; `NoNewPrivs: 1` em `/proc/self/status`; backup real ok. Com o sandbox do Chromium ativo também passa (userns via perfil AppArmor); quebraria só o fallback SUID `chrome-sandbox` | **Sim** |
| `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK` | **Sim** | rc=0; TCP ao MySQL e barramento do keyring funcionam; com só `AF_UNIX` o TCP falha ("família de endereços sem suporte"), ou seja, a diretiva é aplicada de fato | **Sim** |
| `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6` (sem NETLINK) | Parcial | rc=0, mas "Failed to initialize a udev monitor" | Não (usar a versão com NETLINK) |
| `LockPersonality=yes` | **Sim** | rc=0 | **Sim** |
| `RestrictRealtime=yes` | **Sim** | rc=0 | **Sim** |
| `RestrictSUIDSGID=yes` | **Sim** | rc=0 | **Sim** |
| `SystemCallArchitectures=native` | **Sim** | rc=0 | **Sim** |
| `UMask=0077` | **Sim** | rc=0; os arquivos já são gravados 0600, e isto cobre o que o Chromium criar | **Sim** |
| `KeyringMode=private` | Sim | rc=0; é o padrão em units de usuário | Não (redundante) |
| `ProtectHostname=yes`, `ProtectControlGroups=yes`, `ProtectKernelTunables=yes`, `ProtectProc=invisible` | Sobe, efeito incerto | rc=0, mas dependem de namespace de montagem, que este systemd de usuário não monta (ver linha abaixo) | Não |
| `ProtectHome=read-only` / `tmpfs` | **Sem efeito** | rc=0, mas a unit escreveu em `~/.cache` normalmente: o systemd de usuário não cria o namespace de montagem com userns restrito pelo AppArmor | Não (falsa sensação de proteção) |
| `ProtectSystem=strict` / `full` | **Sem efeito** | mesmo motivo | Não |
| `PrivateTmp=yes` | **Sem efeito** | arquivo criado em `/tmp` dentro da unit apareceu fora | Não |
| `PrivateNetwork=yes` | Não | sobe, mas cortaria o acesso ao MySQL | Não |
| `PrivateDevices=yes` | **Não** | rc=218, a unit não sobe | Não |
| `CapabilityBoundingSet=` | **Não** | rc=218 | Não |
| `ProtectKernelModules=yes`, `ProtectKernelLogs=yes`, `ProtectClock=yes` | **Não** | rc=218 | Não |
| `RestrictNamespaces=yes` | **Não** (com sandbox) | Com o sandbox do Chromium ativo: FATAL do `setuid_sandbox_host` → SIGTRAP. Só passa com `--no-sandbox` | Não |
| `SystemCallFilter=@system-service` | **Não** | Intermitente: "GPU process isn't usable. Goodbye." (FATAL) em 4 de 6 execuções | Não |
| `MemoryDenyWriteExecute=yes` | **Não** | "Failed to reserve virtual memory for CodeRange": o JIT do V8 precisa de W+X | Não |

**Falta:**
- `--no-sandbox` no `ExecStart`: com o `.deb` instalado (perfil AppArmor presente) o backup roda com o sandbox do Chromium ligado, e eu provei isso. Como o modo backup não carrega conteúdo web, o ganho é pequeno; só vale tirar quando `/etc/apparmor.d/tuxsql` existir e o executável for `/opt/TuxSQL/tuxsql`. Prioridade LOW.
- Units já instaladas só recebem as diretivas quando o agendamento for salvo de novo. Sugestão: reinstalar as units ao abrir o app quando o conteúdo gerado mudar.
- Depois de desinstalar o pacote, timers órfãos continuam disparando contra um binário que não existe mais. O `postrm` roda como root e não deve mexer no home dos usuários, então a correção é na unit: `ConditionPathExists=<executável>` em `[Unit]` (pula sem erro) e, no cron, `[ -x <executável> ] && …`.
- Cron não oferece nenhum sandbox: preferir systemd sempre que `cronToSystemdCalendar` conseguir representar a expressão (já é o comportamento).

## 2. Permissões em `~/.config/tuxsql`

**Já existe:** `connections.json`, histórico, agendamentos, estado de execução, `settings`, cofre: 0600; `vault/` e `query-results/`: 0700; exports, backups e snapshots: 0600.

**Corrigido nesta rodada (S4):** o diretório do perfil nascia 0775 (umask 002 do Ubuntu com grupo privado). Agora `ensurePrivateDirectory` (`app/src/main/security/privateDirectory.ts`) cria em 0700 e aperta um diretório existente; um perfil movido por symlink para outro disco continua funcionando (o alvo é ajustado).

**Falta (LOW):** `.legacy-migrated` é gravado 0664 (`legacyData.ts:26`, sem conteúdo sensível). Arquivos de perfis antigos copiados na migração mantêm o modo de origem. Com o diretório em 0700 isso deixa de importar.

## 3. Keyring (libsecret) e fallback local

**Já existe** (`PasswordVault.ts`): `safeStorage` do Electron com backend real (gnome-libsecret/kwallet); recusa `basic_text`. Sem keyring, cai para um cofre AES-256-GCM com chave mestra aleatória 0600, com aviso explícito na UI de que isso não protege contra a mesma conta. Segredos nunca vão para `connections.json` (`stripInlineSecrets`). Senha do Documenter CLI só por variável de ambiente.

**Falta:**
- Com fallback local ativo, oferecer "não salvar senha, perguntar a cada conexão" como padrão para conexões **Prod** (a opção `connections.storeCredentials` já existe).
- Backup agendado com keyring bloqueado (sessão sem login) falha com mensagem genérica; mostrar "keyring bloqueado" no estado do agendamento.

## 4. `/tmp` e symlinks

**Já existe:** `mkdtemp` (0700) para XLSX, env-file do container e trabalho temporário; nomes com UUID para temporários de export/crontab; arquivos 0600; Source Control e SQL Formatter recusam symlinks para fora; ZIP com limite real de descompressão.

**Falta (LOW):** os temporários de export (`ipc/import-export.ts:160-161`) e o crontab temporário usam `join(tmpdir(), uuid)` sem `flag: 'wx'`. Nomes imprevisíveis tornam a corrida inviável, mas `wx` (ou `mkdtemp`) fecha a classe toda.

## 5. polkit do Service Control

**Já existe:** allowlist `mysql|mysqld|mariadb.service`, confirmação digitada por ação+unit, `execFile` sem shell, `pkexec systemctl <ação> <unit>`.

**Falta (LOW):** trocar `pkexec systemctl …` por `systemctl <ação> <unit>` direto. O systemd pede autorização ao polkit com a ação `org.freedesktop.systemd1.manage-units`, e o prompt mostra a unit em vez do genérico "executar /usr/bin/systemctl como root". Assim nenhum processo root é criado pelo TuxSQL. Usar caminho absoluto `/usr/bin/systemctl`.

## 6. Perfil AppArmor do pacote

**Já existe:** o `postinst` padrão do electron-builder instala `/etc/apparmor.d/tuxsql` (`abi/4.0`, `flags=(unconfined)`, `userns,`) só se o parser aceitar, e o `postrm` descarrega e remove o perfil. Com ele, o sandbox do Chromium funciona no Ubuntu 24.04+ sem SUID. Fuses de release aplicados (`packaging/afterPack.cjs`).

**Falta:**
- O perfil não confina nada (`unconfined`): ele só libera userns. Um perfil real (em `complain` primeiro, coletando acessos por algumas versões) é trabalho futuro. Confinar o Electron inteiro de uma vez quebraria diálogos, keyring e GPU.
- **AppImage não tem perfil.** No Ubuntu 24.04+ o sandbox falha (comprovado com a cópia `linux-unpacked`: FATAL do `chrome-sandbox`). Recomendar o `.deb` como canal suportado e **nunca** documentar `--no-sandbox` como solução para a interface.

## 7. `postinst`/`postrm`, desktop file e MIME

**Já existe:** `update-alternatives` para `/usr/bin/tuxsql`; SUID no `chrome-sandbox` só sem userns; `update-mime-database`/`update-desktop-database`; o desktop file usa `Exec=/opt/TuxSQL/tuxsql %U`, `MimeType=application/sql;text/x-sql;`. Um `.sql` aberto pelo gerenciador de arquivos só é **carregado no editor**, nunca executado (`App.tsx:352-356` → `file:open-sql-path`, limite de 20 MB).

**Falta (LOW):** 121 entradas do `.deb` estão 0664 (`root:root`, gravável pelo grupo root). Não é explorável sem um usuário no grupo root, mas é sujeira: normalizar com `chmod -R go-w` no `afterPack`. `postrm` não limpa timers/crontab dos usuários (ver §1, `ConditionPathExists`).

## 8. Modo "Production seguro"

**Já existe** (para conexões com ambiente **Production**): cor/forma no explorer e na barra de status; confirmação digitada no editor (DROP/TRUNCATE/DML sem WHERE), Explorer (drop/rename/truncate), grid (Apply) e editor de objetos; perfil read-only no servidor (agora em todas as conexões do pool); timeout por conexão; segredos mascarados no log SQL.

**Falta (proposta, delegável ao Martelo, área do editor):**

| Item | Proposta |
|---|---|
| Somente leitura por padrão | Ao marcar uma conexão como Prod, sugerir `readOnly = true` e mostrar um botão "Habilitar escrita por 15 min" com confirmação digitada; ao expirar, volta a ser só leitura (as conexões novas do pool já nascem READ ONLY) |
| DML sem WHERE | Ligar `isDestructiveStatement` (S2) e estender à classe administrativa: GRANT/REVOKE/KILL/SET GLOBAL/PERSIST/ALTER USER/FLUSH/LOAD DATA/INTO OUTFILE |
| Confirmação em todas as ferramentas | Data Compare, Schema Sync, Import (delete/repopulate), Execute Large Script, Source Control apply, Security Manager, Server Variables (PERSIST), Data Generator: confirmação digitada com o nome do banco de destino quando ele for Prod |
| Timeout | Padrão de 300 s em Prod quando `advanced.commandTimeoutSeconds = 0`, e fazer a opção global valer (S6) |
| Limite de linhas | `execution.resultRowLimit` aplicado no spool (hoje é ignorado) |
| Autocommit | Desligado por padrão em Prod, com o aviso "transação aberta há N s" (já existe `notifications.openTransactionSeconds`) |
| Log de auditoria local | `~/.config/tuxsql/audit.log` 0600, só **append**, uma linha JSON por operação destrutiva confirmada: data, conexão (nome/host/usuário, sem senha), banco, ferramenta, tipo, contagem de statements e hash SHA-256 do SQL (não o SQL, que pode conter dados). Rotação por tamanho. Ninguém além do usuário lê; serve para "o que eu rodei em produção ontem?" |
