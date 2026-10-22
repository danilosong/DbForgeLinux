# UX 02 — Conexões

**Fidelidade REA & Observação VM:** rótulos conferidos contra REA ui-text e **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas em `re/original-observation/01-conexao/` e `re/original-observation/p2-01-erros-conexao/`).
- **[C]** (Confirmada na VM e REA ui-text): Database Connection Properties, Test Connection, Connection Manager, Allow saving password, Allow saving passphrase, Use security protocol (SSL / SSH), Fingerprint:, Key file:, Private key:, Passphrase:, Authentication type: (Password authentication / Public key authentication), Keyboard Interactive Mode, Keep connection alive, Ping timeout, Connection timeout:, Execute timeout:, Detect MySQL character set, Use compression, Environment Category, Show all databases, HTTP tunnel (Base64, Keep alive, credentials, proxy).
- **[C] Erros e Mensagens Reais de Conexão (`p2-01`):** Erro 1045 com senha incorreta (`re/original-observation/p2-01-erros-conexao/05-wrong-password-result-1812.png`), Erro 2003 de porta recusada (`re/original-observation/p2-01-erros-conexao/03-erro-2003-porta-3-recusada-1811.png`), Erro 2003 de host desconhecido (`re/original-observation/p2-01-erros-conexao/07-host-result-1812.png`), Erro 2003 de timeout com spinner de espera (`re/original-observation/p2-01-erros-conexao/13-timeout-waiting-1813.png`, `14-timeout-result-1813.png`), Aviso modal sem database padrão (`re/original-observation/p2-01-erros-conexao/15-connect-wrong-password-1814.png`), criação do nó no Explorer após falha de Connect (`re/original-observation/p2-01-erros-conexao/17-after-cancel-1814.png`), menu de contexto (`re/original-observation/p2-01-erros-conexao/18-failed-connection-node-context-1814.png`) e diálogo de confirmação de exclusão (`re/original-observation/p2-01-erros-conexao/19-delete-connection-confirm-1815.png`).
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
- **Adaptação para Linux:** `libmysqld` não é carregada. A aba informa essa diferença e oferece abrir o painel **Servidor local descartável**, que cria MySQL/MariaDB via Docker ou Podman com porta de loopback, armazenamento efêmero e perfil opcional salvo pelo TuxSQL; detalhes e limites em `document/paridade/F-CON.md`.

---

## 3. Comportamento de Test Connection

1. Validação local dos campos obrigatórios antes do envio de rede.
2. **Estado de carregamento [C]:**
   - Diálogo com campos desabilitados e spinner central girando sobre a interface (`re/original-observation/p2-01-erros-conexao/13-timeout-waiting-1813.png`). O diálogo de propriedades fica visível e esmaecido ao fundo.
3. **Resultado com Sucesso [C]:**
   - Diálogo / status exibindo a versão exata do MySQL:
     `Successfully connected. Server version: MySQL 8.4.11` (`re/original-observation/01-conexao/teste-ok.png`).
   - Opção de prosseguir diretamente com a conexão (`[ Connect ]`) ou fechar o diálogo (`[ Cancel ]`).
4. **Mensagens e Diálogos de Erro Reais [C] (`re/original-observation/p2-01-erros-conexao/`):**
   - Renderizadas em caixa modal de diálogo intitulada `"dbForge Studio for MySQL"` (no TuxSQL: `"TuxSQL"`) com ícone de erro vermelho e botão único `[ OK ]`.
   - **Senha Incorreta (`05-wrong-password-result-1812.png`):**
     `1045: Access denied for user 'obs'@'172.19.0.1' (using password: YES)`
   - **Porta sem serviço / Recusada (`03-erro-2003-porta-3-recusada-1811.png`):**
     `2003: Can't connect to MySQL server on '10.0.2.2' (10061): Nenhuma ligação pôde ser feita porque o computador de destino as recusou ativamente 10.0.2.2:3`
   - **Host Inexistente / DNS (`07-host-result-1812.png`):**
     `2003: Can't connect to MySQL server on 'hostquenaoexiste.invalid' (10061): Este anfitrião não é conhecido`
   - **Timeout de Conexão (`14-timeout-result-1813.png`):**
     Após aguardar o intervalo configurado (padrão 15s na aba Advanced), emite:
     `2003: Can't connect to MySQL server on '10.255.255.1' (10061): Server did not respond within the specified timeout interval`
   - Sanitização de segurança: strings de senha digitadas são expurgadas da mensagem de erro antes da renderização.

---

## 4. Fluxo de conexão (Connect)

1. **Aviso de Banco Padrão Não Especificado [C] (`re/original-observation/p2-01-erros-conexao/15-connect-wrong-password-1814.png`):**
   - Ao clicar em `[ Connect ]` sem selecionar um database padrão no combo, abre caixa modal com ícone de alerta amarelo e botões `[ OK ]` e `[ Cancel ]`:
     *"You have not specified a default database for this connection. Specifying a default database is not required to create a connection, but it is strongly recommended."*
   - Clicar `Cancel` aborta a tentativa mantendo o diálogo aberto; clicar `OK` avança com a conexão ao host.
2. **Tentativa de Autenticação e Erro [C] (`re/original-observation/p2-01-erros-conexao/16-connect-after-ok-1814.png`):**
   - Se a autenticação falhar, exibe o modal de erro (ex.: código 1045).
3. **Persistência da Conexão após Falha [C] (`re/original-observation/p2-01-erros-conexao/17-after-cancel-1814.png`):**
   - **Comportamento Notável Original:** Ao clicar em `[ Cancel ]` após a falha de conexão, o registro da conexão **não é descartado**; ele é adicionado na árvore do Database Explorer como nó desconectado no final da lista, e o cabeçalho do Database Explorer é atualizado para exibir `Database Explorer - {host}:{port}`.
4. **Menu de Contexto do Nó no Explorer [C] (`re/original-observation/p2-01-erros-conexao/18-failed-connection-node-context-1814.png`):**
   - Itens na ordem exata: `New Connection...`, `Modify Connection...`, `Open`, `Create Connection Like...`, `New Database`, `New SQL`, `Source Control >`, `Tasks >`, `Find Object... Ctrl+D,F`, `Show Details`, `Edit Privileges`, `Rename F2`, `Delete Delete`, `Refresh F5`, `Properties Ctrl+W,P`.
5. **Confirmação de Exclusão de Conexão [C] (`re/original-observation/p2-01-erros-conexao/19-delete-connection-confirm-1815.png`, `20-after-delete-1815.png`):**
   - Acionar `Delete` abre modal com ícone de interrogação e botões `[ Yes ]` e `[ No ]`:
     *"Are you sure you want to remove database connection '{connection_name}'?"*
   - Ao confirmar `Yes`, o nó é removido do Explorer e a seleção retorna à conexão anterior.

---

## 5. Estados do nó de conexão (Explorer)

| Estado | Ícone/indicador | Evidência |
|---|---|---|
| Desconectado | servidor cinza | `re/original-observation/p2-01-erros-conexao/17-after-cancel-1814.png` |
| Conectando | spinner âmbar / indicador de carga | `re/original-observation/p2-01-erros-conexao/13-timeout-waiting-1813.png` |
| Conectado | servidor com ponto verde | `re/original-observation/01-conexao/general.png` |
| Erro | servidor com triângulo vermelho / alerta | `re/original-observation/p2-01-erros-conexao/05-wrong-password-result-1812.png` |
| Somente leitura | cadeado pequeno | `document/ux/01-shell.md` |
| Ambiente Prod | faixa vermelha lateral 3px | `document/evidence/ui/01-connection/connection-general-dark.png` |

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
