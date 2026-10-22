Esta página vale para a versão 0.1.0.

# TuxSQL — Guia do Usuário

O **TuxSQL** é um cliente e ambiente integrado de desenvolvimento (IDE) independente para bancos de dados **MySQL** e **MariaDB**, desenvolvido especificamente para sistemas operacionais **Linux** da família Debian (Debian GNU/Linux, Ubuntu, Pop!_OS, Linux Mint e compatíveis).

O projeto é executado de forma nativa no Linux (arquitetura x86_64 / amd64), sem depender de emuladores, camadas de compatibilidade de outros sistemas ou dependências proprietárias.

---

## Instalação do Pacote .deb

O TuxSQL é distribuído como um pacote padrão `.deb`. Para instalar no seu sistema:

1. Baixe o pacote de instalação `tuxsql_0.1.0_amd64.deb`.
2. Abra o terminal no diretório do arquivo e execute:

```bash
sudo apt update
sudo apt install ./tuxsql_0.1.0_amd64.deb
```

Caso utilize `dpkg`, finalize as dependências com `apt`:

```bash
sudo dpkg -i tuxsql_0.1.0_amd64.deb
sudo apt install -f
```

---

## Como Abrir o Aplicativo

Após a instalação, você pode abrir o TuxSQL de duas maneiras:

- **Pelo menu do sistema:** Abra o lançador de aplicativos da sua interface gráfica (GNOME, COSMIC, KDE, Cinnamon) e procure por **TuxSQL**.
- **Pelo terminal:** Digite `tuxsql` e pressione Enter.

---

## Primeiro Passo em 3 Minutos

1. **Criar uma Conexão:**
   Na tela inicial, clique em **Nova Conexão** ou use o atalho `Ctrl+D Ctrl+N` (ou `Ctrl+Shift+N`). Informe o Host (`localhost` ou endereço IP), a Porta (`3306`), o Usuário e a Senha. Para conexões seguras com certificados ou túneis SSH, consulte o guia [Conexões e Segurança de Rede](01-conectar.md).

2. **Abrir o Editor SQL:**
   Com a conexão ativa no Database Explorer à esquerda, abra um novo documento de script pressionando `Ctrl+N` ou pelo menu **Arquivo > Novo Documento SQL**.

3. **Executar uma Consulta:**
   Digite uma instrução SQL no editor, como por exemplo:

```sql
SELECT VERSION(), CURRENT_TIMESTAMP;
```

   Pressione `F5` (ou `F8` para a instrução sob o cursor). Os dados serão exibidos imediatamente na grade inferior. Saiba mais sobre recursos do editor e manipulação de resultados em [Editor SQL e Grade de Resultados](02-editor-e-resultados.md).

4. **Explorar Ferramentas e Recursos:**
   Acesse ferramentas como comparadores de esquemas e dados, gerador de dados de teste, diagramas ER e designer de gráficos. Veja um resumo completo em [Ferramentas Integradas](03-ferramentas.md).

---

## Sumário da Documentação

- [Conexões e Segurança de Rede](01-conectar.md): Criação de conexões, modos SSL/TLS, túnel SSH, ambientes e aviso de produção.
- [Editor SQL e Grade de Resultados](02-editor-e-resultados.md): Execução com F5/F8, histórico, edição inline com Post/Apply, limite de linhas e cópia formatada.
- [Ferramentas Integradas](03-ferramentas.md): Visão geral de comparadores, geradores, diagramas, backups, documentador e depurador.
- [Atalhos de Teclado](04-atalhos.md): Tabela de comandos e atalhos rápidos do aplicativo.
- [Segurança e Privacidade](05-seguranca.md): Proteção de senhas com chaveiro seguro, confirmação em produção e ausência de telemetria.
- [Problemas Comuns e Soluções](06-problemas-comuns.md): Diagnóstico de certificados TLS, chaveiro bloqueado, mdbtools e AppArmor.
- [Sobre este Projeto](07-sobre-este-projeto.md): Licença MIT, escopo e componentes de código aberto.
