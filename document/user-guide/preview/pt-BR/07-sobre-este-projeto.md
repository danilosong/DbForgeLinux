Esta página vale para a versão 0.1.0.

# Sobre este Projeto

O TuxSQL é um ambiente de desenvolvimento e gerenciamento de bancos de dados independente, gratuito e de código aberto, concebido especificamente para atender a comunidade de usuários e profissionais de Linux.

Voltar ao [Sumário Principal](00-index.md).

---

## Escopo e Propósito

Muitas ferramentas de banco de dados disponíveis no mercado foram criadas historicamente para outros sistemas operacionais e dependem de emuladores pesados ou traduções imperfeitas para rodar no Linux.

O TuxSQL nasceu com o propósito de ser um **cidadão de primeira classe no Linux**:

- Focado nas distribuições da **família Debian** (Debian GNU/Linux, Ubuntu, Pop!_OS, Linux Mint e derivadas).
- Integrado diretamente aos padrões do desktop Linux: suporte a chaveiros nativos (Secret Service API), integração com serviços gerenciados pelo `systemd`, elevação com `pkexec` (Polkit) e respeito integral às diretrizes de atalhos e compositores de janelas do sistema operacional.
- Binário de 64 bits (x86_64) otimizado e empacotado em formato `.deb` nativo.

---

## Licença de Código Aberto (MIT)

O TuxSQL é distribuído sob os termos da **Licença MIT** (*The MIT License*), uma das licenças mais liberais, transparentes e consagradas do ecossistema de software livre.

Isso garante a você:

- Liberdade para usar o aplicativo para fins pessoais, acadêmicos, profissionais ou comerciais sem restrições.
- Acesso integral ao código-fonte para estudo, modificação e auditoria independente de segurança.
- Certeza de que o software não contém rotinas secretas de telemetria, bloqueios artificiais ou licenças proprietárias limitadoras.

---

## Autoria e Comunidade

- **Criador e Mantenedor:** Danilo Song.
- **Repositório Oficial de Código:** `https://github.com/danilosong/TuxSQL`
- **Controle de Versão e Comunidade:** O desenvolvimento é conduzido de forma colaborativa com apoio da comunidade de software livre. Sugestões de melhorias, correções de problemas e contribuições de código são bem-vindas diretamente no repositório.

---

## Tecnologias e Licenças de Terceiros

O TuxSQL é construído com base em excelentes componentes de código aberto:

| Componente | Função Principal | Licença de Código Aberto |
| :--- | :--- | :--- |
| **Electron** | Runtime multiplataforma baseado em Chromium e Node.js | Licença MIT |
| **React** | Biblioteca de interface reativa para componentes | Licença MIT |
| **TypeScript** | Linguagem tipada e compilador para confiabilidade | Apache 2.0 |
| **Monaco Editor** | Mecanismo de edição de código com suporte a sintaxe | Licença MIT |
| **MySQL2** | Driver de alta performance para conexões com MySQL/MariaDB | Licença MIT |
| **Chart.js** | Mecanismo de renderização de gráficos 2D em canvas | Licença MIT |

A cópia completa do texto da licença do TuxSQL e os avisos de atribuição de dependências de terceiros podem ser consultados diretamente no arquivo `LICENSE` no repositório oficial ou acionando o botão **Licença** na janela **Sobre o TuxSQL** (menu **Ajuda > Sobre...**).

---

## Navegação na Documentação

- [Início e Instalação](00-index.md)
- [Conexões e Modos SSL/TLS](01-conectar.md)
- [Editor SQL e Grade de Resultados](02-editor-e-resultados.md)
- [Ferramentas Integradas](03-ferramentas.md)
- [Atalhos de Teclado](04-atalhos.md)
- [Segurança e Privacidade](05-seguranca.md)
- [Problemas Comuns e Soluções](06-problemas-comuns.md)
