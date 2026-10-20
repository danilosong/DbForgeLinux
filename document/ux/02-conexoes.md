# UX 02 — Conexões

**Fidelidade REA:** rótulos conferidos contra REA ui-text. **[C]** (REA ui-text): Database Connection Properties, Test Connection, Connection Manager, Save password, Allow saving passphrase, Use SSL, Fingerprint:, Key file:, Private key:, Passphrase:, Authentication type: (Password authentication / Public key authentication), Keep connection alive, Connection timeout:, SSH Login, Proxy Login, Advanced connection properties. Atalho original de New Connection: Ctrl+D Ctrl+N (**REA shortcuts**); Ctrl+Shift+N do clone é **[I]**. Demais campos/estados desta spec permanecem **[I]** (ver `fidelidade-parts/A.md`).


Depende de `01-shell.md` (tokens, componentes). Driver inicial: MySQL/MariaDB (mysql2 + ssh2). Credenciais nunca em texto puro (libsecret/safeStorage).

## 1. Pontos de entrada

- File > New > Database Connection (Ctrl+Shift+N), botão da toolbar, botão do Explorer, Start Page, Database > New Connection.
- Editar: F2 / menu de contexto "Edit Connection…" / duplo clique em conexão desconectada no Explorer (conectada: abre SQL).
- Connection Manager (Tools): lista completa (seção 8).

## 2. Diálogo "Database Connection Properties"

Modal, 640x560 (min 600x520, redimensionável em altura). Estrutura:

```
+- Database Connection Properties ---------------------------- [x] -+
| +-----------+ +--------------------------------------------------+ |
| | General   | |  (conteúdo da página selecionada)                | |
| | Security  | |                                                  | |
| | SSH       | |                                                  | |
| | HTTP      | |                                                  | |
| | Advanced  | |                                                  | |
| +-----------+ +--------------------------------------------------+ |
| [ status do teste: ícone + mensagem em 1-2 linhas ]               |
| [Test Connection]          [Connect] [OK/Save]   [Cancel]         |
+-------------------------------------------------------------------+
```

Navegação lateral (esquerda, 140px) com ícone; página com erro de validação mostra ponto vermelho no item. Botões: **Test Connection** (secundário, esq.), **Connect** (primário; salva e conecta), **OK** (salva sem conectar; no modo "nova" rotulado "Save"), **Cancel**. Enter = primário, Esc = cancelar (confirma se há alterações). Ctrl+T executa teste.

### 2.1 General

| Campo | Controle | Padrão | Validação / notas |
|---|---|---|---|
| Type | Select (MySQL, MariaDB) | MySQL | MariaDB ajusta defaults |
| Connection name | Texto | `user@host` gerado | Obrigatório, único; sugestão automática até o usuário editar |
| Host | Texto | `localhost` | Obrigatório; aceita IPv4/IPv6/hostname; sem espaços |
| Port | Number (1–65535) | 3306 | Spinner; inválido → erro inline |
| Socket (Unix) | Texto + [Procurar…] | vazio | Se preenchido, Host/Port ficam desabilitados; dica "ex.: /var/run/mysqld/mysqld.sock" |
| User | Texto | `root` | Obrigatório |
| Password | Password + olho (mostrar/ocultar) | vazio | Nunca pré-preenche valor salvo (mostra `••••••••` placeholder) |
| Save password | Checkbox | marcado | Desmarcado → pergunta ao conectar. Aviso se libsecret indisponível |
| Database | Combo editável | vazio | Botão ▾ lista databases (usa credenciais atuais; estado loading no combo; erro → tooltip) |
| Connection color/environment | Select de cores + rótulo (None, Dev, Test, Prod, custom) | None | Prod = vermelho; faixa na aba/Explorer; confirma comandos destrutivos extra |
| Category / folder | Combo editável | vazio | Agrupa no Explorer |
| Comment | Texto multilinha | vazio | |

Aba "string de conexão": link "Edit as URL…" abre campo `mysql://user@host:port/db` (sem senha) para colar/copiar.

### 2.2 Security (SSL)

| Campo | Controle | Notas |
|---|---|---|
| Use SSL **[C REA ui-text]** (modos abaixo **[I]**) | Select: Disabled / Preferred / Required / Verify CA / Verify Identity | Padrão Preferred |
| CA certificate | Texto + [Procurar…] | .pem/.crt; habilitado se modo ≠ Disabled |
| Client certificate | idem | par com chave |
| Client key | idem | |
| Cipher | Texto opcional | avançado |
| TLS min. version | Select (Auto, 1.2, 1.3) | |
| Fingerprint: **[C REA ui-text]** | leitura (após teste) | exibe SHA-256 para conferência |

Arquivos validados: existência e legibilidade (erro inline "Arquivo não encontrado"). Verify* sem CA → erro "CA obrigatório".

### 2.3 SSH

| Campo | Controle | Notas |
|---|---|---|
| Use SSH tunnel | Checkbox | Habilita o restante |
| SSH host / port | Texto / Number (22) | |
| SSH user | Texto | |
| Authentication type: **[C]** | Radio: Password authentication [C] / Public key authentication [C] / ssh-agent [I] | ssh-agent usa `SSH_AUTH_SOCK` (padrão Linux; indicar se ausente) |
| SSH password | Password | só em Password |
| Key file: / Private key: **[C REA ui-text]** | Texto + Procurar (inicia em `~/.ssh`) | só em Private key |
| Passphrase | Password | opcional; salvo no cofre se "Save" marcado |
| Remote host/port (destino MySQL) | Texto/Number | padrão = General host/port visto do servidor SSH |
| Local bind port | Number ou "Auto" | |
| Keep connection alive **[C REA ui-text]** (s) | Number (30) | |
| Known hosts | Primeira conexão: diálogo de fingerprint "Confiar?" [Aceitar e salvar] [Aceitar uma vez] [Cancelar]; mudança de chave → erro bloqueante vermelho com [Cancelar] [Atualizar] |

Sem Pageant/PuTTY (.ppk): suporte somente OpenSSH/PEM (aviso se .ppk selecionado).

### 2.4 HTTP

Tunelamento via script HTTP (como `tunnel.php` do produto original; comportamento INFERIDO).
| Campo | Controle |
|---|---|
| Use HTTP tunneling | Checkbox |
| Tunnel URL | Texto (`https://…/tunnel.php`), validação URL |
| Auth HTTP (user/senha) | opcionais |
| Proxy (host/port/user/senha) | opcionais; padrão "Usar proxy do sistema" |
| Timeout (s) | Number (30) |
| Ignorar erros de certificado | Checkbox com aviso vermelho |
SSH e HTTP são mutuamente exclusivos: ligar um mostra aviso e desliga o outro (com confirmação).

### 2.5 Advanced

| Campo | Padrão |
|---|---|
| Connection timeout (s) | 15 |
| Command timeout (s) | 0 (sem limite) |
| Default charset | utf8mb4 |
| Collation | padrão do servidor |
| Time zone | Server / Local / valor |
| SQL mode (init) | vazio |
| Init command(s) | área multilinha executada após conectar |
| Keep-alive interval (s) | 0 |
| Compression | off |
| Allow multiple statements | on |
| Treat TINYINT(1) as boolean | on |
| Read-only session | off (marca conexão e bloqueia DML/DDL no editor) |
| Auto-reconnect | on |
| Custom parameters | tabela chave/valor |
Botão "Restaurar padrões" por página.

## 3. Test Connection

Fluxo: valida formulário → botão vira "Testing…" com spinner e [Cancel] → resultado na faixa de status do diálogo.
| Estado | Aparência |
|---|---|
| Loading | Spinner + "Conectando a host:3306…" (etapas: "Abrindo túnel SSH…", "Handshake TLS…", "Autenticando…") ; timeout conforme Advanced |
| Sucesso | Faixa verde: "Conexão bem-sucedida · MySQL 8.0.36 · 120 ms · TLS 1.3 · via SSH". Some após 8s ou ao editar |
| Erro | Faixa vermelha com mensagem humana + código (ex.: `ER_ACCESS_DENIED_ERROR 1045`) + [Detalhes] expande causa/etapa e sugestão |
Mapeamento de erros: ECONNREFUSED → "Servidor recusou conexão. Verifique host/porta e se o MySQL está ativo."; ETIMEDOUT → "Tempo esgotado..."; 1045 → "Usuário ou senha inválidos."; 1049 → "Database inexistente."; TLS → "Falha de certificado (…)"; SSH auth → "Autenticação SSH falhou (método)". Mensagens nunca incluem senha. Botão [Copiar detalhes].

## 4. Fluxo de conexão (Connect)

1. Salva (se novo). 2. Se senha ausente → diálogo "Enter password for user@host" (campo + "Remember" + OK/Cancel). 3. Conecta (status bar "Connecting…", nó do Explorer com spinner, cancelável). 4. Sucesso: nó expande, toast breve, Output registra. 5. Erro: nó vermelho com ícone de aviso e tooltip; toast de erro com [Editar conexão] [Tentar de novo].

## 5. Estados do nó de conexão (Explorer)

| Estado | Ícone/indicador |
|---|---|
| Desconectado | servidor cinza |
| Conectando | spinner âmbar |
| Conectado | servidor com ponto verde |
| Erro | servidor com triângulo vermelho |
| Somente leitura | cadeado pequeno |
| Ambiente Prod | faixa vermelha lateral 3px |

## 6. Lista de conexões (Connection Manager)

Janela/documento: barra superior [New] [Edit] [Duplicate] [Delete] [Import…] [Export…] + busca. Tabela: Nome | Tipo | Host:Porta | Usuário | Database | Categoria | Último uso | Status. Agrupamento por categoria (árvore colapsável), ordenação por coluna, multi-seleção. Menu de contexto: Connect, Disconnect, Edit, Duplicate, Delete, Move to category, Copy as URL.
- Delete: confirmação "Excluir 2 conexões? Credenciais salvas também serão removidas." [Excluir] [Cancelar].
- Import/Export: JSON sem senhas (aviso explícito); export com opção "incluir senhas" desabilitada por padrão e criptografada com passphrase (P2).
- Vazio: EmptyState "Nenhuma conexão salva" + [New Connection] + link "Importar".
- Erro de leitura do armazenamento: banner vermelho "Não foi possível ler as conexões" + [Tentar de novo] [Abrir pasta de configuração].
- Acesso rápido: no Explorer, Recent Connections em ordem de último uso; Start Page lista as 5 últimas.

## 7. Seguranca / regras

- Senha, passphrase, senha SSH/HTTP vão somente ao cofre do SO; arquivo de config guarda referência.
- Logs e Output mascaram segredos (`****`).
- Conexão Prod/ read-only: execução de statements destrutivos (DROP, TRUNCATE, DELETE/UPDATE sem WHERE) exige confirmação com digitação do nome do database (Prod).
- Clipboard: copiar senha limpa a área após 30s (se implementado).

## 8. Acessibilidade e teclado

Ordem de Tab segue visual; Ctrl+PgDn/PgUp alterna páginas; Alt+letra mnemônicos (G, S, H, A…); erros inline associados via aria-describedby; foco vai ao primeiro campo inválido ao salvar; faixa de teste com aria-live.

## 9. Componentes novos desta tela

FormField (label, controle, ajuda, erro), PasswordInput (olho), FilePicker (texto + procurar via portal GTK), SideNavTabs (páginas), StatusStrip (info/sucesso/erro com detalhes), ColorPicker/EnvironmentBadge, KeyValueTable, PromptDialog (senha/fingerprint), ConfirmDialog.

## 10. Critérios de aceite

- Todos os campos, padrões e validações acima implementáveis sem consulta adicional.
- Teste de conexão exibe os 3 estados e é cancelável.
- Senhas não aparecem em disco em texto puro, nem em logs.
- Tema claro/escuro (tokens de 01-shell) aplicados; navegação completa por teclado.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Database Connection Properties | Título do diálogo | `conn.dialog.title` |
| Connection Manager | Menu Tools / janela | `conn.manager.title` |
| New Connection | Menu / botão | `conn.new` |
| Create a new database connection | Tooltip de nova conexão | `conn.new.hint` |
| Connection Name: | Campo General | `conn.field.name` |
| Host: / Port: / User: / Password: / Database: | Campos General | `conn.field.host` |
| Save password | Checkbox General | `conn.savePassword` |
| Test Connection | Botão do diálogo | `conn.test` |
| Connect | Botão / menu de contexto | `conn.connect` |
| Connecting to {0}... | Estado loading da conexão | `conn.state.connecting` |
| Connection {0} was reconnected. | Toast após reconexão | `conn.state.reconnected` |
| Connection '{0}' was disconnected. | Toast/status ao desconectar | `conn.state.disconnected` |
| Cannot connect to {0} server. | Erro de conexão | `conn.error.cannot` |
| Server connection fail. | Resultado de teste com falha | `conn.test.fail` |
| Use SSL | Checkbox/página de segurança | `conn.ssl.use` |
| Client certificate: | Campo SSL | `conn.ssl.clientCert` |
| SSH Login | Página/grupo SSH | `conn.ssh.title` |
| Proxy Login | Página/grupo HTTP/proxy | `conn.proxy.title` |
| Authentication type: | Seletor SSH | `conn.ssh.authType` |
| Key file: / Passphrase: / Save passphrase | Campos SSH | `conn.ssh.keyFile` |
| {0} through {1} (SSH) | Rótulo da conexão via túnel | `conn.ssh.label` |
| Keep connection alive | Opção Advanced | `conn.adv.keepAlive` |
| Connection timeout: | Opção Advanced | `conn.adv.timeout` |
| Advanced connection properties | Página Advanced | `conn.adv.title` |
| Connection name can not contain any of the following characters: … | Validação do nome | `conn.error.nameChars` |
| Cannot delete connection while database operation is in progress. | Bloqueio ao excluir | `conn.error.deleteBusy` |
| Do you want to apply all unsaved changes? (ao fechar editores após editar conexão) | Confirmação | `conn.confirm.applyChanges` |
