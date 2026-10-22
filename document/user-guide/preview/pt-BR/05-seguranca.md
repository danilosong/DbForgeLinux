Esta página vale para a versão 0.1.0.

# Segurança e Privacidade

O TuxSQL foi planejado para oferecer privacidade, transparência operacional e integração cuidadosa com os recursos de segurança do sistema operacional Linux.

Voltar ao [Sumário Principal](00-index.md).

---

## 1. Armazenamento Seguro de Credenciais (Keyring e Cofre Local)

O armazenamento de senhas e segredos no TuxSQL é gerenciado pelo componente de cofre (`PasswordVault`):

- **Integração com o Chaveiro do Sistema (GNOME Keyring / KWallet):** Em ambientes gráficos Linux com suporte à Secret Service API (via `safeStorage`/`libsecret`), o TuxSQL verifica se a criptografia do sistema está disponível e rejeita explicitamente os armazenamentos inseguros (`basic_text` e `unknown`). Quando disponível, as senhas salvas são cifradas e protegidas pelo chaveiro do próprio sistema operacional.
- **Cofre Local Criptografado (AES-256-GCM):** Caso o chaveiro do sistema esteja indisponível, bloqueado ou em sessões sem suporte a chaveiro gráfico, o TuxSQL utiliza um cofre local com criptografia simétrica AES-256-GCM. A chave mestra local (`local-master.key`) é gerada e salva com permissão estrita `0600` no diretório privado da conta (`~/.config/tuxsql/vault/`). Nesse caso, o aplicativo exibe um aviso informando que o cofre local protege as senhas contra outros usuários do sistema, mas não contra outros processos em execução na mesma conta de usuário, recomendando o desbloqueio do GNOME Keyring ou KWallet para proteção integral pelo sistema.
- **Modo Sem Gravação em Disco:** Ao desmarcar a opção **Lembrar Senha** nas propriedades da conexão, nenhuma credencial é gravada em disco (nem no chaveiro nem no cofre local). A senha permanece somente na memória volátil da sessão em execução e é descartada ao fechar o programa.

---

## 2. Categorias de Ambiente e Proteção de Produção (Production Guard)

Para prevenir execuções acidentais em bancos de dados críticos, o TuxSQL disponibiliza categorias de ambiente e mecanismos de confirmação:

- **Categorias de Ambiente:** Cada conexão pode ser associada a um ambiente em suas propriedades:
  - `Desenvolvimento` (`dev`): marcado por padrão com a forma Quadrado (`square`) e cor verde (`#2e7d32`).
  - `Teste` (`test`): marcado por padrão com a forma Losango (`diamond`) e cor laranja (`#ed6c02`).
  - `Produção` (`prod`): marcado por padrão com a forma Círculo (`circle`) e cor vermelha (`#c62828`).
  - `Sandbox` (`sandbox`): marcado por padrão com a forma Triângulo (`triangle`) e cor azul (`#1565c0`).
  - `Personalizado` (`custom`): forma Triângulo, com cor e rótulo personalizáveis.
  - `Nenhum` (`none`): sem identificador de ambiente.
  - As conexões também possuem um campo opcional de Categoria para agrupamento textual.
- **Sinalização Visual no Explorer e na Barra de Status:** O badge com a forma geométrica e a cor do ambiente é renderizado ao lado do nome da conexão na árvore do Database Explorer e na Barra de Status quando a conexão estiver ativa.
- **Avisos de Execução por Categoria:** Em **Ferramentas > Opções > Execução**, o usuário pode habilitar ou desabilitar avisos de confirmação individuais para instruções `TRUNCATE`, `DELETE` e `UPDATE` para cada categoria de ambiente (por padrão, ativos para Produção, Teste, Sandbox, Personalizado e Nenhum; inativos para Desenvolvimento).
- **Confirmação Obrigatória Digitada em Produção:** Quando uma instrução potencialmente destrutiva (como DDL ou DML perigoso) é disparada em uma conexão da categoria `Produção`, o TuxSQL exibe uma janela modal de bloqueio exigindo que o usuário digite exatamente o nome do banco de dados ativo para autorizar a operação (`Conexão de produção. Digite [banco] para confirmar.`). Se o texto digitado não for idêntico ao nome do banco, a execução é interrompida.

---

## 3. Conexões de Rede e Ausência de Telemetria

O TuxSQL não envia telemetria de uso. As conexões de rede realizadas pelo aplicativo restringem-se a:

1. **Servidores de Banco de Dados:** Conexões diretas aos hosts e portas que você cadastrar, incluindo eventuais túneis SSH intermediários ou túneis HTTP configurados.
2. **Provedor de Inteligência Artificial:** Ao endpoint ou serviço de IA configurado por você, ocorrendo somente após a sua aprovação explícita do conteúdo que será enviado.
3. **Verificação de Versão no GitHub:** Por padrão ao iniciar, o TuxSQL faz uma consulta à API pública de lançamentos do GitHub para verificar se há atualizações disponíveis do aplicativo (`updater.checkOnStartup: true`). Esse comportamento pode ser facilmente desativado desmarcando a opção correspondente em **Ferramentas > Opções > Atualizações**.
4. **Navegador do Sistema:** Ao acionar links externos (como links para o repositório, documentação ou licença), o endereço é aberto no navegador padrão do seu sistema operacional.

---

## 4. Assistente de IA sob Controle do Usuário

- **Sem Dependência de Nuvem Proprietária:** Não há serviço de nuvem compulsório atrelado ao funcionamento básico do aplicativo.
- **Modelo Local ou Chave Própria:** Você pode utilizar uma chave de API própria ou conectar a um modelo local autônomo (como Ollama ou vLLM) em execução na sua máquina ou na rede interna.
- **Aprovação Prévia do Payload:** Nenhuma consulta, esquema de tabela ou prompt é despachado para o serviço de IA sem que o usuário revise o texto e autorize explicitamente o envio.

---

## 5. Permissões de Arquivos no Linux e Elevação Mínima

- **Permissões de Pastas e Arquivos:** Os diretórios de configuração e dados em `~/.config/tuxsql` e `~/.local/share/tuxsql` são criados com permissão `0700` (`rwx------`), e os arquivos de credenciais e chaves do cofre são gravados com permissão `0600` (`rw-------`).
- **Elevação Mínima com pkexec:** Ações locais de gerenciamento de serviços do sistema (como `systemctl restart mysql`) solicitam elevação pontual através do utilitário nativo `pkexec` (Polkit) do Linux, evitando a necessidade de rodar o aplicativo principal como root.

---

## Próximos Passos

- Veja como lidar com servidores sem TLS ou chaveiro bloqueado em [Problemas Comuns e Soluções](06-problemas-comuns.md).
- Consulte as licenças de software em [Sobre este Projeto](07-sobre-este-projeto.md).
