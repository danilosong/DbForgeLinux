Esta página vale para a versão 0.1.0.

# Conexões e Segurança de Rede

O TuxSQL permite gerenciar e conectar a múltiplas instâncias de servidores **MySQL** e **MariaDB** de forma simultânea e segura.

Voltar ao [Sumário Principal](00-index.md).

---

## Criando uma Nova Conexão

Para criar uma conexão:

1. No menu principal, clique em **Arquivo > Nova Conexão...** ou use o atalho `Ctrl+D Ctrl+N` (ou `Ctrl+Shift+N`).
2. No painel de configuração, preencha:
   - **Nome da Conexão:** Um rótulo legível para identificar o servidor na barra lateral (ex.: `MySQL Local`, `Cluster Testes`).
   - **Host:** Endereço IP, nome de domínio (`localhost`, `db.empresa.local`) ou caminho de socket Unix (ex.: `/var/run/mysqld/mysqld.sock`).
   - **Porta:** A porta TCP do serviço (padrão: `3306`).
   - **Usuário e Senha:** Credenciais de acesso ao servidor de banco de dados.
   - **Banco de Dados Padrão:** Esquema selecionado automaticamente ao abrir a sessão (opcional).

As senhas salvas são protegidas pelo chaveiro nativo do sistema operacional Linux ou pelo cofre local cifrado quando o chaveiro não estiver acessível. Veja detalhes em [Segurança e Privacidade](05-seguranca.md).

---

## Criptografia de Conexão: Modos SSL/TLS

O TuxSQL disponibiliza 5 modos de negociação SSL/TLS para atender desde ambientes locais isolados até servidores com requisitos de conformidade:

| Modo SSL/TLS | O que protege | Quando utilizar |
| :--- | :--- | :--- |
| `disabled` | **Sem criptografia.** O tráfego de dados e senhas transita em texto claro na rede. | Somente conexões em loopback local (`127.0.0.1`), sockets Unix locais ou redes privadas isoladas. |
| `preferred` | **Criptografia oportunista sem validação de certificado.** Tenta estabelecer sessão cifrada com TLS. Não valida autoridade certificadora nem nome do servidor. Caso o servidor não suporte TLS, o recuo para texto claro ocorre **somente em conexões locais de loopback** (`localhost`, `127.0.0.1` ou socket Unix). Em servidores remotos sem TLS, a conexão falha por segurança. | Servidores locais de desenvolvimento onde o suporte a TLS é opcional. Não protege contra ataques ativos de interceptação (MITM) na rede. |
| `required` | **Criptografia obrigatória sem validação de certificado.** Exige canal TLS. Se o servidor não suportar TLS ou o handshake falhar, a conexão falha. Não valida se o certificado foi emitido por uma autoridade confiável nem confere o nome do host. | Protege contra escuta passiva em conexões de rede onde não há autoridade certificadora própria configurada. |
| `verify-ca` | **Criptografia com validação de autoridade.** Exige TLS e valida a cadeia de confiança do certificado do servidor contra o arquivo de Autoridade Certificadora (`CA Certificate`) fornecido pelo usuário. | Protege contra escuta e contra servidores forjados (ataques Man-in-the-Middle) na rede. |
| `verify-identity` | **Criptografia com validação de autoridade e de identidade.** Exige TLS, valida a cadeia contra o arquivo CA e confirma se o nome do host ou IP conectado corresponde exatamente ao Common Name (CN) ou Subject Alternative Name (SAN) do certificado do servidor. | Proteção contra ataques de falsificação de identidade (spoofing) e redirecionamento DNS em redes abertas ou servidores em nuvem. |

Para utilizar autenticação mútua TLS, preencha os campos opcionais **Certificado do Cliente** e **Chave Privada do Cliente** na aba de segurança da conexão.

---

## Túnel SSH (SSH Tunneling)

Quando o servidor MySQL não estiver diretamente acessível pela Internet, utilize o recurso de túnel SSH integrado para trafegar de forma protegida através de um host intermediário (*bastion* ou *jump box*):

1. Na janela de conexão, ative a opção **Túnel SSH**.
2. Forneça o endereço do **Host SSH** e a **Porta** (padrão: `22`).
3. Informe o **Usuário SSH**.
4. Escolha o método de autenticação:
   - **Senha:** Digite a senha do usuário do servidor SSH.
   - **Chave Privada:** Selecione o arquivo da sua chave privada (como `~/.ssh/id_rsa` ou `~/.ssh/id_ed25519`). Se a chave estiver protegida por senha (*passphrase*), forneça-a no campo correspondente.

---

## Ambientes e o Aviso de Produção (Production Guard)

As conexões no TuxSQL podem ser associadas a categorias de ambiente nas propriedades da conexão:

- **Desenvolvimento (`dev`):** Marcador padrão com a forma Quadrado (`square`) e cor verde (`#2e7d32`).
- **Teste (`test`):** Marcador padrão com a forma Losango (`diamond`) e cor laranja (`#ed6c02`).
- **Produção (`prod`):** Marcador padrão com a forma Círculo (`circle`) e cor vermelha (`#c62828`).
- **Sandbox (`sandbox`):** Marcador padrão com a forma Triângulo (`triangle`) e cor azul (`#1565c0`).
- **Personalizado (`custom`):** Permite configurar forma (Quadrado, Círculo, Triângulo, Losango), cor e rótulo próprio.
- **Nenhum (`none`):** Conexão padrão sem indicador de ambiente.

### Sinalização Visual e Confirmação em Produção

1. O badge colorido com a forma geométrica configurada é exibido ao lado do nome da conexão no Database Explorer e na Barra de Status quando a conexão está ativa.
2. Em conexões marcadas como **Produção**, instruções potencialmente destrutivas (`DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, ou exclusões sem `WHERE`) acionam uma **caixa de diálogo bloqueante**, exigindo que o usuário digite o nome exato do banco de dados ativo para autorizar a execução (`Conexão de produção. Digite [nome_do_banco] para confirmar.`).

---

## Modo Somente Leitura (Read-Only)

Ao marcar a opção **Somente Leitura** nas configurações avançadas da conexão, o TuxSQL bloqueia no nível do aplicativo o envio de instruções DDL e DML de modificação de dados (`INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`), protegendo bases sensíveis contra alterações não intencionais.

---

## Próximos Passos

- Conheça o ambiente de execução e visualização em [Editor SQL e Grade de Resultados](02-editor-e-resultados.md).
- Consulte as ferramentas de administração em [Ferramentas Integradas](03-ferramentas.md).
- Se encontrar problemas de conexão com TLS ou chaveiro, veja [Problemas Comuns e Soluções](06-problemas-comuns.md).
