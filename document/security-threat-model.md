# Modelo de ameaça do TuxSQL

Escopo: TuxSQL para Linux da família Debian (Ubuntu, Pop!_OS), Electron + TypeScript, pacotes `.deb` e AppImage. Revisão de 2026-10-22. As ferramentas, uma a uma, estão em `security-tools-matrix.md`; o hardening de sistema, em `security-linux-hardening.md`.

## 1. Ativos (em ordem de valor)

1. **Dados dos bancos dos usuários.** O TuxSQL conecta a servidores reais; perder, alterar ou vazar linhas é o pior desfecho.
2. **Credenciais.** Senhas MySQL, SSH, proxy, HTTP tunnel e chave da IA, guardadas no keyring (libsecret via `safeStorage`) ou no cofre local AES-GCM (`PasswordVault.ts`).
3. **Integridade do servidor MySQL.** Contas e privilégios (Security Manager), variáveis globais/persistidas, sessões, serviço systemd.
4. **Metadados e histórico.** Schema, histórico SQL, logs, resultados em spool, exports, backups, snapshots e estado dos agendamentos.
5. **Integridade do próprio app.** Binário, atualizador, perfil AppArmor, units systemd que o app grava.

## 2. Atacantes considerados

| Atacante | Capacidade | Exemplos |
|---|---|---|
| **Arquivo malicioso aberto pelo usuário** | Controla o conteúdo de `.sql .zip .csv .json .xml .xlsx .mdb .dbf .ddoc .scomp .dgen .mdet .rdb`, snapshots e projetos de Source Control | DDL com `DEFINER`, scripts com DROP escondido, ZIP bomb, XML com entidades, repositório com hooks Git, symlinks para fora do projeto |
| **Servidor MySQL malicioso ou comprometido** | Controla o handshake, os erros, os resultados e os nomes de objetos | Downgrade de TLS, `LOAD DATA LOCAL` pedido pelo servidor, nomes com caracteres hostis/HTML/ANSI, resultados enormes |
| **Rede (MITM)** | Lê e altera tráfego não autenticado | Conexão sem TLS ou sem verificação; feed de atualização; provedor de IA |
| **Usuário induzido ao erro** | O próprio usuário, cansado ou enganado | DML sem WHERE em Prod, colar script da internet, sincronizar no destino errado, SET PERSIST, KILL |
| **Dependência npm comprometida** | Código no main ou no renderer em tempo de build | Pacote com postinstall malicioso, troca de versão |
| **Outro usuário local** (outra conta UNIX na mesma máquina) | Lê o que for legível por grupo/outros; acessa portas em loopback | Perfil 0775, `/tmp` previsível, container exposto em `127.0.0.1` |
| **Atualizador / canal de distribuição** | Publica um release | Conta GitHub comprometida |

## 3. Fronteiras de confiança

```
 [arquivos externos] ──(diálogo nativo + limites + parsers)──┐
 [servidor MySQL] ──(TLS, mysql2, mapeamento de erros)───────┤
                                                             ▼
 renderer (React, sandbox Chromium, sem Node) ──IPC──► main (Node, guard IPC) ──► mysqldump/git/systemctl/pkexec/docker
        ▲ confiável só se carregado de file:// do pacote       │
        └── navegação externa bloqueada, sem preload           └──► ~/.config/tuxsql (0700), keyring, ~/.config/systemd/user
```

- **Renderer → main:** o guard (`app/src/main/ipc/guard.ts`) só aceita frames do renderer empacotado e valida a forma de cada payload. Decisão de projeto: o renderer é **confiável para intenção do usuário** (confirmações vivem nele), mas **não** para caminhos de arquivo, SQL de sincronização recalculado, nomes de unit ou containers, que o main revalida.
- **Main → servidor MySQL:** toda escrita passa pelo `MysqlDriver`; o perfil read-only é aplicado no servidor em todas as conexões do pool (corrigido nesta rodada). Se um servidor malicioso pedir `LOAD DATA LOCAL`, o mysql2 3.x (sem `infileStreamFactory`, que o app não define) responde com arquivo vazio (`node_modules/mysql2/lib/commands/query.js:154-162`), então nenhum arquivo local é lido. Defesa extra sugerida (LOW): anunciar `flags: ['-LOCAL_FILES']`.
- **Main → sistema:** processos externos sempre por `execFile` com array, sem shell; root só via polkit.
- **App → disco:** perfil e arquivos sensíveis 0600/0700; temporários em `mkdtemp`.

## 4. Premissas

- A conta UNIX do usuário é confiável. **Um processo malicioso rodando na mesma conta está fora do alcance de qualquer defesa local**: ele lê o cofre local, injeta em `~/.profile`, chama o keyring desbloqueado. O que fazemos para ele é só não piorar (sem segredos em `argv`, sem arquivos legíveis por grupo/outros).
- O usuário escolhe a conta MySQL. A proteção mais forte contra perda de dados é uma **conta com privilégio mínimo**; os recursos de confirmação e o read-only são proteção contra **erro**, não fronteira de segurança contra o próprio usuário.
- O kernel, o systemd, o polkit e o AppArmor da distribuição são confiáveis.

## 5. Fora de escopo

- Windows, macOS e recursos exclusivos deles (DPAPI, UAC, serviços do Windows, assinatura Authenticode). Equivalentes Linux estão em `security-linux-hardening.md`.
- Atacante com root ou com acesso físico à máquina desbloqueada.
- Atacante na mesma conta UNIX (ver premissas).
- Vulnerabilidades do próprio servidor MySQL/MariaDB.
- Proteger o usuário de comandos que ele digita **conscientemente** com privilégio para isso; o objetivo é que a ação seja deliberada (confirmação proporcional ao risco), não impossível.

## 6. Riscos aceitos/residuais (registrados)

| Risco | Por que fica | Mitigação |
|---|---|---|
| Restore executa rotinas/triggers do arquivo | É a função do restore | CD com nome do banco; usar só backups confiáveis |
| Endpoint HTTPS de IA configurável | Escolha do usuário | HTTPS obrigatório, schema só com aprovação |
| Updater confia na conta GitHub | Sem assinatura independente hoje | Proposta minisign/APT assinado (`security-tools-matrix.md`) |
| Cofre local sem keyring | Não protege contra a mesma conta | Aviso na UI; recomendação de instalar/desbloquear gnome-keyring/KWallet |
| Perfil AppArmor `unconfined` + `userns` | Só libera o sandbox do Chromium no Ubuntu 24.04+; confinar o Electron inteiro quebraria diálogos, keyring e GPU | Sandbox do Chromium + fuses; perfil em modo `complain` como trabalho futuro |
