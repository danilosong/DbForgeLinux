Esta página vale para a versão 0.1.0.

# Atalhos de Teclado

O TuxSQL foi projetado com suporte extensivo a navegação e operações pelo teclado. Todos os atalhos listados nesta página são reais, confirmados no código da aplicação e customizáveis em **Ferramentas > Opções > Teclado** (`Ctrl+,`).

Voltar ao [Sumário Principal](00-index.md).

---

## Comandos Globais e Navegação

Estes atalhos funcionam em qualquer tela da aplicação:

| Comando | Atalho Padrão | Contexto |
| :--- | :--- | :--- |
| Novo Documento SQL | `Ctrl+N` | Global |
| Nova Conexão | `Ctrl+D Ctrl+N` ou `Ctrl+Shift+N` | Global |
| Abrir Arquivo SQL | `Ctrl+O` | Global |
| Salvar Todos os Arquivos | `Ctrl+Shift+S` | Global |
| Fechar o Aplicativo | `Ctrl+Q` | Global |
| Paleta de Comandos (Command Palette) | `Ctrl+Shift+P` | Global |
| Opções e Configurações | `Ctrl+,` | Global |
| Ajuda e Documentação | `F1` | Global |
| Alternar Tela Cheia | `F11` | Global |
| Aumentar Zoom da Interface | `Ctrl+=` | Global |
| Diminuir Zoom da Interface | `Ctrl+-` | Global |
| Redefinir Zoom da Interface | `Ctrl+0` | Global |
| Exibir Database Explorer | `Ctrl+W Ctrl+L` | Global |
| Exibir Painel de Saída (Output) | `Ctrl+W Ctrl+O` | Global |
| Exibir Lista de Erros | `Ctrl+W Ctrl+E` | Global |
| Exibir Página Inicial (Start Page) | `Ctrl+W Ctrl+S` | Global |
| Exibir Project Explorer | `Ctrl+W Ctrl+J` | Global |
| Exibir Estrutura do Documento (Outline) | `Ctrl+W Ctrl+U` | Global |
| Exibir Gerenciador de Snippets | `Ctrl+W Ctrl+T` | Global |
| Exibir Janela de Propriedades | `Ctrl+W Ctrl+P` | Global |
| Localizar em Arquivos | `Ctrl+Shift+F` | Global |
| Localizar Objeto no Banco de Dados | `Ctrl+D Ctrl+F` | Global |
| Gerenciador de Segurança (Security Manager) | `Ctrl+D Ctrl+Q` | Global |
| Gerenciador de Sessões (Session Manager) | `Ctrl+D Ctrl+S` | Global |
| Variáveis do Servidor (Server Variables) | `Ctrl+D Ctrl+V` | Global |
| Controle de Serviços Linux (Service Control) | `Ctrl+D Ctrl+R` | Global |

---

## Editor SQL e Execução

Atalhos ativos durante a edição de código SQL:

| Ação | Atalho | Descrição |
| :--- | :--- | :--- |
| **Executar SQL** | `F5` ou `Ctrl+Enter` | Executa todo o script ou a seleção atual. |
| **Executar Instrução sob o Cursor** | `F8` | Executa apenas o comando delimitado onde o cursor está. |
| **Executar Seleção** | `Ctrl+F8` | Força a execução apenas do trecho selecionado. |
| **Executar até o Cursor** | `Ctrl+Shift+F10` | Executa do início do documento até a posição do cursor. |
| **Parar Execução** | `Shift+F5` ou `Alt+Pause` | Cancela a consulta em andamento no servidor. |
| **Plano de Execução (Explain)** | `Ctrl+L` | Gera a árvore de explicação da consulta atual. |
| **Alternar Painel de Resultados** | `Ctrl+Alt+Seta Baixo` | Oculta ou exibe a grade inferior de resultados. |
| **Salvar Documento Atual** | `Ctrl+S` | Grava o arquivo aberto no disco. |
| **Fechar Aba Atual** | `Ctrl+W` | Fecha a aba ativa. |
| **Formatar Documento** | `Ctrl+K Ctrl+D` | Formata todo o código com as regras ativas de estilo. |
| **Formatar Seleção** | `Ctrl+K Ctrl+F` | Formata apenas as linhas selecionadas. |
| **Formatar Instrução Atual** | `Ctrl+K Ctrl+S` | Formata o comando SQL delimitado atual. |
| **Alternar Comentário de Bloco** | `Ctrl+/` | Comenta ou descomenta com `--` ou `/* ... */`. |
| **Comentar Seleção** | `Ctrl+K C` | Adiciona marcação de comentário ao trecho. |
| **Descomentar Seleção** | `Ctrl+K U` | Remove marcas de comentário do trecho. |
| **Autocompletar Código** | `Ctrl+Espaço` | Abre sugestões de palavras-chave, tabelas e colunas. |
| **Ir para Linha** | `Ctrl+G` | Salta diretamente para o número de linha informado. |
| **Localizar no Editor** | `Ctrl+F` | Abre a barra de busca de texto no editor. |
| **Substituir no Editor** | `Ctrl+H` | Abre a barra de localização e substituição. |
| **Ir para Definição** | `F12` | Navega até a declaração do objeto (tabela/view/função). |
| **Alternar entre Pares de Sintaxe** | `Ctrl+F12` | Pula entre parênteses ou delimitadores correspondentes. |
| **Renomear Identificador** | `F2` | Permite renomeação contextual de variáveis ou nomes. |
| **Converter para Maiúsculas** | `Ctrl+Shift+U` | Converte o texto selecionado para letras maiúsculas. |
| **Converter para Minúsculas** | `Ctrl+U` | Converte o texto selecionado para letras minúsculas. |
| **Mover Linha para Cima** | `Alt+Seta Cima` | Desloca a linha atual para a linha imediatamente superior. |
| **Mover Linha para Baixo** | `Alt+Seta Baixo` | Desloca a linha atual para a linha imediatamente inferior. |
| **Adicionar Crases em Identificadores** | `Ctrl+K Ctrl+[` | Envolve nomes de tabelas e colunas em crases (`` `nome` ``). |
| **Remover Crases Desnecessárias** | `Ctrl+K Ctrl+]` | Remove crases de identificadores que não sejam palavras reservadas. |
| **Qualificar Nomes de Objetos** | `Ctrl+K Ctrl+Q` | Adiciona o prefixo do esquema (`banco.tabela`). |
| **Expandir Curinga (`*`)** | `Ctrl+K Ctrl+Y` | Substitui `*` pela lista explícita das colunas da tabela. |
| **Selecionar Instrução Atual** | `Ctrl+Shift+A` | Seleciona todo o texto da instrução sob o cursor. |

---

## Marcadores (Bookmarks) no Editor

| Ação | Atalho | Descrição |
| :--- | :--- | :--- |
| **Alternar Marcador** | `Ctrl+B T` | Cria ou remove um marcador na linha atual. |
| **Próximo Marcador** | `Ctrl+B N` | Salta o cursor para o próximo marcador abaixo. |
| **Marcador Anterior** | `Ctrl+B P` | Salta o cursor para o marcador imediatamente acima. |
| **Limpar Todos os Marcadores** | `Ctrl+B C` | Remove todos os marcadores do arquivo ativo. |

---

## Depurador de Rotinas (Debugger)

Atalhos ativos no painel do depurador de stored procedures e triggers:

| Ação | Atalho | Descrição |
| :--- | :--- | :--- |
| **Iniciar / Continuar Depuração** | `Alt+F9` ou `Ctrl+F5` | Inicia a sessão ou continua a execução até o próximo breakpoint. |
| **Executar até o Cursor** | `Ctrl+F10` ou `F4` | Executa o fluxo e pausa na linha onde o cursor se encontra. |
| **Reiniciar Sessão de Depuração** | `Shift+F9` | Reinicia a rotina a partir da primeira instrução. |
| **Compilar para Depuração** | `Ctrl+Alt+F7` | Instrumenta a rotina selecionada para habilitar pontos de interrupção. |
| **Compilar Dependentes** | `Ctrl+Alt+F9` | Prepara objetos dependentes para permitir depuração entre rotinas. |
| **Compilar Rotina** | `Ctrl+F7` | Compila o procedimento armazenado ativo. |
| **Compilar Função** | `Ctrl+F9` | Compila a função armazenada ativa. |

---

## Database Explorer

| Ação | Atalho | Descrição |
| :--- | :--- | :--- |
| **Propriedades do Objeto** | `F4` | Exibe o painel de propriedades detalhadas do objeto selecionado na árvore. |

---

## Personalização de Atalhos

Você pode alterar qualquer atalho ou escolher esquemas predefinidos acessando **Ferramentas > Opções > Teclado**:

1. Selecione o comando desejado na tabela.
2. Posicione o cursor no campo de entrada do atalho.
3. Pressione a combinação de teclas desejada no teclado.
4. O TuxSQL detecta e avisa automaticamente em caso de conflitos com outros comandos antes de salvar.

---

## Próximos Passos

- Conheça os padrões de integridade do app em [Segurança e Privacidade](05-seguranca.md).
- Solucione eventuais problemas técnicos em [Problemas Comuns e Soluções](06-problemas-comuns.md).
- Veja detalhes sobre o projeto em [Sobre este Projeto](07-sobre-este-projeto.md).
