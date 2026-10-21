# UX 02 — Conexões

**Fidelidade REA & Observação VM:** rótulos conferidos contra REA ui-text e **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas em `/tmp/vm_tab_*.png` e `re/original-observation/01-conexao/`).
- **[C]** (Confirmada na VM e REA ui-text): Database Connection Properties, Test Connection, Connection Manager, Allow saving password, Allow saving passphrase, Use security protocol (SSL / SSH), Fingerprint:, Key file:, Private key:, Passphrase:, Authentication type: (Password authentication / Public key authentication), Keyboard Interactive Mode, Keep connection alive, Ping timeout, Connection timeout:, Execute timeout:, Detect MySQL character set, Use compression, Environment Category, Show all databases, HTTP tunnel (Base64, Keep alive, credentials, proxy).
- Atalho original de New Connection: `Ctrl+D, Ctrl+N` (**REA shortcuts**); `Ctrl+Shift+N` no clone mantido como atalho universal Linux alternativo.

Depende de `01-shell.md` (tokens, componentes). Driver: MySQL/MariaDB (mysql2 + ssh2). Credenciais nunca em texto puro (libsecret/safeStorage).

---

## 1. Pontos de entrada

- File > New > Database Connection (`Ctrl+D, Ctrl+N` / `Ctrl+Shift+N`), botão da toolbar principal, botão do Explorer, Start Page, Database > New Connection.
- Editar: F2 / menu de contexto "Modify Connection…" / duplo clique em conexão desconectada no Explorer (conectada: abre SQL).
- Connection Manager (Tools): lista completa (seção 6).

---

## 2. Diálogo "Database Connection Properties"

Modal, 640x560 (min 600x520, redimensionável em altura).

### 2.0 Estrutura Visual Observada na VM

No produto original observado, a navegação ocorre por **abas horizontais no topo** (`General | Advanced | Security | HTTP | Embedded`), mantendo o rodapé fixo com botões de ação:

```
+- Database Connection Properties --------------------------------- [x] -+
| [ General ] [ Advanced ] [ Security ] [ HTTP ] [ Embedded ]            |
|------------------------------------------------------------------------|
|  Specify following to connect to MySQL:                                |
|                                                                        |
|  (conteúdo da aba selecionada)                                         |
|                                                                        |
|------------------------------------------------------------------------|
| [ status/feedback do teste: ícone + mensagem em 1-2 linhas ]           |
| [Test Connection]                                 [Connect]  [Cancel]  |
+------------------------------------------------------------------------+
```

> [!NOTE]
> **Adaptação TuxSQL:** No TuxSQL, para compatibilidade com o fluxo de edição sem conectar, o rodapé suporta tanto o fluxo direto do original (`[Test Connection]`, `[Connect]`, `[Cancel]`) quanto a persistência sem conexão imediata (`[Save]`), apresentando `[Save]` apenas quando não estiver em estado de sucesso de teste.

---

### 2.1 Aba General

| Campo | Controle | Padrão | Validação e comportamento observado na VM |
|---|---|---|---|
| Type | Combo (`TCP/IP`, `Named pipe` / `Socket`) | `TCP/IP` | No Windows oferece `Named pipe`; no Linux TuxSQL oferece `TCP/IP` e `Unix Socket`. |
| Host | Combo editável | `localhost` | Aceita IPv4, IPv6 ou hostname. Dropdown guarda histórico recente. |
| Port | Spinner numérico | `3306` | Validação estrita entre 1 e 65535. Desabilitado em modo Socket. |
| User | Combo editável | `root` | Campo obrigatório. Dropdown guarda histórico recente. |
| Password | Password field | vazio | Nunca pré-preenche senhas salvas em texto puro (exibe placeholder `••••••••`). |
| Allow saving password | Checkbox | marcado (☑) | Quando desmarcado, solicita senha ao conectar. |
| Database | Combo editável | vazio (`Choose a database`) | Dropdown lista bancos da conexão via botão `[▾]` ou `[Refresh]`. |
| Show all databases | Checkbox | desmarcado (☐) | Quando marcado, exibe databases de sistema (`information_schema`, `mysql`, `performance_schema`, `sys`). |
| Connection Name | Texto | `localhost` / `host:port` | **Auto-preenchido dinamicamente** no formato `host:port` ao digitar host e porta até que o usuário edite o nome manualmente. |
| Environment Category | Combo + botão `[...]` | `None` | Categorias: `None`, `Dev`, `Test`, `Prod`. Botão `[...]` abre gerenciador de categorias de ambiente. |

#### Alerta de Validação de Banco Padrão
Quando o usuário clica em `[Connect]` sem selecionar um banco em `Database`, o dbForge emite o diálogo modal de aviso:
> *"You have not specified a default database for this connection. Specifying a default database is not required to create a connection, but it is strongly recommended."* `[ OK ]` `[ Cancel ]`

---

### 2.2 Aba Advanced

| Campo | Controle | Padrão Observado | Validação e notas |
|---|---|:---:|---|
| Connection timeout: | Spinner numérico | `15` seconds | Timeout de estabelecimento de socket TCP/SSH. |
| Execute timeout: | Spinner numérico | `0` seconds | Timeout de execução de comandos (0 = infinito). |
| Encoding: | Combo box | `utf8 -> Unicode (UTF-8)` | Mapeamento de charset cliente. |
| Detect MySQL character set | Checkbox | desmarcado (☐) | Negociação dinâmica de charset com o handshake do servidor. |
| Use compression | Checkbox | desmarcado (☐) | Habilita compactação no protocolo cliente/servidor MySQL. |
| Keep connection alive | Checkbox | desmarcado (☐) | Habilita heartbeat periódico na conexão ociosa. |
| Ping timeout: | Spinner numérico | `240` seconds | Intervalo do ping keep-alive (habilitado apenas se Keep connection alive estiver ativo). |

---

### 2.3 Aba Security (SSL e SSH)

Na referência observada, **SSH não é uma aba independente**: vive dentro da aba `Security`, selecionado via seletor de protocolo:
- `☐ Use security protocol` (habilita os controles abaixo)
- Seletor de rádio: `(•) SSL` vs `( ) SSH`

#### Modo SSL
| Campo | Controle | Notas |
|---|---|---|
| Client key | Texto + `[...]` Browse | Caminho do arquivo `.key`/`.pem` da chave privada do cliente. |
| Client certificate | Texto + `[...]` Browse | Caminho do certificado cliente `.crt`/`.pem`. |
| Authority certificate | Texto + `[...]` Browse | Certificado da autoridade certificadora (CA). |
| Cipher | Texto | Lista de cifras suportadas (`DES(40)`, `3DES`, `AES(128)`, `AES(256)`, `RC4`...). |
| Transport layer security | Combo box | Versão mínima do protocolo TLS: `1.2`, `1.3`, `Auto`. |

#### Modo SSH Tunnel
| Campo | Controle | Notas e Comportamento Observado |
|---|---|---|
| Tipo de Autenticação | Rádio | `(•) Password authentication` \| `( ) Public key authentication` \| `( ) Via PuTTY CLI` |
| Host / Port | Texto / Spinner | Padrão porta `22`. |
| User | Texto | Usuário SSH remoto. |
| Password | Password field | Exibido apenas em Password authentication. |
| Save password | Checkbox | Persiste a senha SSH no cofre seguro. |
| Keyboard Interactive Mode | Checkbox (☐) | **Observado na VM:** Suporta servidores SSH com desafio PAM interativo (TuxSQL integra via prompt seguro). |
| Passphrase | Password field | Exibido apenas em Public key authentication. |
| Save passphrase | Checkbox | Persiste passphrase da chave no cofre seguro. |
| Private key | Texto + `[...]` Browse | Caminho da chave privada OpenSSH (`id_rsa`, `id_ed25519`). |
| *Adaptação Linux* | Rádio `ssh-agent` | TuxSQL adiciona opção `ssh-agent` utilizando o socket `SSH_AUTH_SOCK` nativo do ambiente Linux. |

---

### 2.4 Aba HTTP

Tunelamento via script HTTP (`tunnel.php`):
| Campo | Controle | Comportamento Observado na VM |
|---|---|---|
| Use HTTP tunnel | Checkbox (☐) | Habilita tunelamento HTTP (mutuamente exclusivo com SSH). |
| URL: | Texto | URL do script de túnel (ex.: `https://servidor/tunnel.php`). |
| Keep connection alive | Checkbox (☐) | Manter conexão HTTP aberta entre requisições. |
| Use Base64 | Checkbox (☐) | Codificação Base64 para payload binário através de proxies e WAFs. |
| Use credentials | Checkbox (☐) | Credenciais HTTP Basic/Digest (User, Password, Save password). |
| Use proxy server | Checkbox (☐) | Configuração de proxy web (Address, Port padrão `8080`, User, Password, Save password). |

---

### 2.5 Aba Embedded

- No produto original Windows: oferece `☐ Use embedded server`, `☑ Use my.ini file`, `Base folder` e `Data folder` para inicializar instâncias locais `libmysqld`.
- **Divergência de Plataforma Linux Documentada:** A biblioteca `libmysqld` foi depreciada e removida no MySQL moderno, sendo inaplicável e instável no Linux. O TuxSQL mantém a aba desabilitada com aviso explícito de indisponibilidade no Linux, documentado em `document/paridade/F-CON.md`.

---

## 3. Comportamento de Test Connection

1. Validação local dos campos obrigatórios antes do envio de rede.
2. Estado de carregamento: indicador visual com tempo decorrido e possibilidade de cancelamento.
3. **Resultado com Sucesso:**
   - Diálogo / status exibindo a versão exata do MySQL:
     `Successfully connected. Server version: MySQL 8.4.11`
   - Opção de prosseguir diretamente com a conexão (`[ Connect ]`) ou fechar o diálogo (`[ Cancel ]`).
4. **Resultado com Erro:**
   - Exibe o código numérico de erro e a mensagem crua original do servidor MySQL (ex.: `1045: Access denied for user 'root'@'...' (using password: YES)`).
   - Sanitização de segurança: strings de senha digitadas são expurgadas da mensagem de erro antes da renderização.

---

## 4. Fluxo de conexão (Connect)

1. Salva (se novo). 2. Se senha ausente → diálogo "Enter password for user@host" (campo + "Remember" + OK/Cancel). 3. Conecta (status bar "Connecting…", nó do Explorer com spinner, cancelável). 4. Sucesso: nó expande, toast breve, Output registra. 5. Erro: nó vermelho com ícone de aviso e tooltip; toast de erro com [Editar conexão] [Tentar de novo].

---

## 5. Estados do nó de conexão (Explorer)

| Estado | Ícone/indicador |
|---|---|
| Desconectado | servidor cinza |
| Conectando | spinner âmbar |
| Conectado | servidor com ponto verde |
| Erro | servidor com triângulo vermelho |
| Somente leitura | cadeado pequeno |
| Ambiente Prod | faixa vermelha lateral 3px |

---

## 6. Lista de conexões (Connection Manager)

Janela/documento: barra superior [New] [Edit] [Duplicate] [Delete] [Import…] [Export…] + busca. Tabela: Nome | Tipo | Host:Porta | Usuário | Database | Categoria | Último uso | Status. Agrupamento por categoria (árvore colapsável), ordenação por coluna, multi-seleção. Menu de contexto: Connect, Disconnect, Edit, Duplicate, Delete, Move to category, Copy as URL.
- Delete: confirmação "Excluir 2 conexões? Credenciais salvas também serão removidas." [Excluir] [Cancelar].
- Import/Export: JSON sem senhas (aviso explícito); export com opção "incluir senhas" desabilitada por padrão e criptografada com passphrase (P2).
- Vazio: EmptyState "Nenhuma conexão salva" + [New Connection] + link "Importar".
- Erro de leitura do armazenamento: banner vermelho "Não foi possível ler as conexões" + [Tentar de novo] [Abrir pasta de configuração].
- Acesso rápido: no Explorer, Recent Connections em ordem de último uso; Start Page lista as 5 últimas.

---

## 7. Seguranca / regras

- Senha, passphrase, senha SSH/HTTP vão somente ao cofre do SO; arquivo de config guarda referência.
- Logs e Output mascaram segredos (`****`).
- Conexão Prod/ read-only: execução de statements destrutivos (DROP, TRUNCATE, DELETE/UPDATE sem WHERE) exige confirmação com digitação do nome do database (Prod).
- Clipboard: copiar senha limpa a área após 30s (se implementado).

---

## 8. Acessibilidade e teclado

Ordem de Tab segue visual; Ctrl+PgDn/PgUp alterna páginas; Alt+letra mnemônicos (G, S, H, A…); erros inline associados via aria-describedby; foco vai ao primeiro campo inválido ao salvar; faixa de teste com aria-live.

---

## 9. Componentes desta tela

FormField (label, controle, ajuda, erro), PasswordInput (olho), FilePicker (texto + procurar via portal GTK), HorizontalNavTabs (abas superiores General, Advanced, Security, HTTP, Embedded), StatusStrip (info/sucesso/erro com detalhes), ColorPicker/EnvironmentBadge, KeyValueTable, PromptDialog (senha/fingerprint), ConfirmDialog.

---

## 10. Critérios de aceite

- Todos os campos, padrões e validações acima implementáveis sem consulta adicional.
- Teste de conexão exibe os 3 estados e é cancelável.
- Senhas não aparecem em disco em texto puro, nem em logs.
- Tema claro/escuro (tokens de 01-shell) aplicados; navegação completa por teclado.

---

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
