Esta página vale para a versão 0.1.0.

# Problemas Comuns e Soluções

Esta página lista diagnósticos e soluções diretas para situações frequentes de configuração no ambiente Linux.

Voltar ao [Sumário Principal](00-index.md).

---

## 1. Falha de Conexão: Servidor MySQL sem suporte a TLS / Erro de Handshake SSL

### Sintoma
A tentativa de conexão falha com mensagens como `SSL connection error`, `TLS unavailable`, `Handshake failed` ou `This server does not offer TLS`.

### Causa
O TuxSQL prioriza a segurança e por padrão tenta conexões cifradas com TLS. Servidores legados ou instâncias locais padrão sem certificados SSL configurados rejeitam o handshake seguro.

No modo `preferred`, o TuxSQL tenta TLS primeiro e recua para conexão em texto claro **somente em alvos de loopback local** (`localhost`, `127.0.0.1` ou socket Unix). Em servidores remotos, o modo `preferred` não faz fallback silencioso para texto claro e gera erro por segurança.

### Solução
1. Abra as propriedades da conexão no TuxSQL.
2. Na aba **SSL / TLS**, configure o **Modo SSL**:
   - Para conexões em loopback local (`localhost` ou `127.0.0.1`), mantenha `preferred`.
   - Para servidores remotos que comprovadamente não suportam TLS em redes privadas, selecione expressamente `disabled` (as credenciais transitarão em texto claro).
3. Para conexões corporativas remotas ou de produção, a recomendação é habilitar certificados TLS diretamente no servidor MySQL editando o arquivo `/etc/mysql/my.cnf`.

Consulte a descrição dos 5 modos em [Conexões e Segurança de Rede](01-conectar.md).

---

## 2. Erro de Chaveiro (Keyring Bloqueado ou Sessão Headless)

### Sintoma
Ao salvar ou carregar conexões com senhas salvas, o aplicativo exibe aviso de que o chaveiro está bloqueado ou indisponível (`Keyring indisponível. Senhas serão protegidas por cofre local AES-GCM...`).

### Causa
No Linux, o armazenamento preferencial de senhas utiliza a Secret Service API (GNOME Keyring ou KWallet). Esse serviço pode estar bloqueado se o login no desktop tiver sido realizado sem autenticação automática do chaveiro (comum após troca de senha do usuário Linux ou em logins SSH/VNC sem sessão PAM completa).

### Solução
- **Comportamento Automático do TuxSQL:** Na ausência do chaveiro do sistema, o TuxSQL armazena a senha em um cofre local com criptografia AES-256-GCM com chave privada (`0600`). O aplicativo exibe um aviso lembrando que o cofre local protege contra outros usuários do sistema operacional, mas não contra outros processos da mesma conta de usuário.
- **Para restaurar a proteção pelo sistema:** Abra o aplicativo **Senhas e Chaves** (Seahorse) no GNOME ou o KWalletManager no KDE e certifique-se de que o chaveiro padrão de início de sessão está desbloqueado.
- **Em sessões remotas ou terminais headless:** Nas propriedades da conexão, desmarque a caixa **Lembrar Senha**. O aplicativo solicitará a senha ao abrir a conexão e a manterá apenas na memória volátil da sessão em execução.

---

## 3. Depurador de Rotinas: Performance Schema Desativado

### Sintoma
Ao iniciar a depuração de uma Stored Procedure, Function ou Trigger, o depurador falha ou não consegue listar variáveis locais, pontos de interrupção ou a pilha de chamadas.

### Causa
O mecanismo de depuração e instrumentação de rotinas do TuxSQL depende do subsistema `performance_schema` do MySQL/MariaDB ativado no servidor para monitorar o estado de execução das instruções.

### Solução
Verifique se o Performance Schema está ativo executando no editor SQL:

```sql
SHOW VARIABLES LIKE 'performance_schema';
```

Caso o valor seja `OFF`:
1. Abra o arquivo de configuração do MySQL como superusuário (geralmente em `/etc/mysql/mysql.conf.d/mysqld.cnf` ou `/etc/mysql/my.cnf`).
2. Adicione ou ajuste a diretiva sob o bloco `[mysqld]`:

```ini
[mysqld]
performance_schema = ON
```

3. Reinicie o serviço do banco de dados pelo terminal:

```bash
sudo systemctl restart mysql
```

---

## 4. Importação de Arquivos MS Access (.mdb / .accdb): mdbtools Ausente

### Sintoma
Ao tentar importar tabelas ou ler arquivos de bancos Microsoft Access (`.mdb` ou `.accdb`), o TuxSQL exibe um erro informando que o utilitário `mdbtools` (`mdb-tables` ou `mdb-export`) não foi encontrado no sistema.

### Causa
O TuxSQL é um aplicativo nativo para Linux e não utiliza drivers proprietários do Windows. A leitura de arquivos Access é realizada de forma aberta através da suíte utilitária `mdbtools` do ecossistema Linux.

### Solução
Instale o pacote `mdbtools` através do gerenciador de pacotes da sua distribuição Linux:

```bash
sudo apt update
sudo apt install mdbtools
```

Após a instalação do pacote, a importação assistida de arquivos `.mdb` e `.accdb` em modo somente leitura funcionará normalmente no assistente de importação.

---

## 5. Restrição de Perfil AppArmor no Ubuntu 24.04+ (Noble Numbat)

### Sintoma
No Ubuntu 24.04 LTS ou versões mais recentes, ao tentar abrir o TuxSQL após descompactar binários manuais, o aplicativo não inicia e emite mensagens no terminal relacionadas a `unprivileged user namespace restricted` ou permissões negadas de sandbox.

### Causa
A partir do Ubuntu 24.04, o sistema operacional introduziu por padrão restrições de segurança do AppArmor que impedem a criação de namespaces de usuário desprivilegiados para executáveis que não possuam um perfil de segurança cadastrado.

### Solução
- **Solução Recomendada:** Instale o aplicativo através do pacote oficial `.deb` (`sudo apt install ./tuxsql_0.1.0_amd64.deb`). O instalador Debian configura automaticamente o perfil AppArmor correto em `/etc/apparmor.d/tuxsql` e registra as permissões necessárias no sistema.
- **Para execução a partir de arquivo avulso:** Certifique-se de configurar uma regra de permissão AppArmor para o binário ou prefira a instalação via pacote `.deb` oficial mantido para a distribuição.

---

## Próximos Passos

- Conheça os padrões e permissões em [Segurança e Privacidade](05-seguranca.md).
- Consulte as informações de licença e autoria em [Sobre este Projeto](07-sobre-este-projeto.md).
