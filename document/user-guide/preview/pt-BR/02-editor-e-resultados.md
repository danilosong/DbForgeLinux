Esta página vale para a versão 0.1.0.

# Editor SQL e Grade de Resultados

O editor de código e a grade de dados constituem o núcleo operacional do TuxSQL para redação, execução e análise de consultas.

Voltar ao [Sumário Principal](00-index.md).

---

## Executando Consultas SQL

O editor suporta múltiplos modos de disparo com controle granular pelo teclado:

- **Executar Script Inteiro (`F5` ou `Ctrl+Enter`):** Envia todo o conteúdo do documento ativo para execução sequencial no banco de dados. Caso haja texto selecionado, apenas a seleção será executada.
- **Executar Instrução sob o Cursor (`F8`):** Identifica a instrução SQL delimitada onde o cursor de texto se encontra e a executa isoladamente, sem necessidade de selecionar com o mouse.
- **Executar Seleção (`Ctrl+F8`):** Força a execução estrita do trecho demarcado.
- **Executar até o Cursor (`Ctrl+Shift+F10`):** Executa todas as instruções desde o início do arquivo até o ponto atual do cursor.
- **Interromper Execução (`Shift+F5` ou `Alt+Pause`):** Cancela o processamento de uma consulta em andamento no servidor MySQL/MariaDB.
- **Plano de Execução (`Ctrl+L`):** Exibe a análise de execução da consulta (árvore EXPLAIN) com estimativas de custo e uso de índices.

---

## Histórico de Consultas (Query History)

O TuxSQL registra automaticamente as consultas executadas na sessão local em um banco de histórico:

- Armazena data, hora exata, duração em milissegundos, número de linhas retornadas e mensagem de status (sucesso ou código de erro).
- Permite pesquisar por trechos de código e reinserir comandos antigos diretamente no editor ativo.
- O histórico é salvo localmente no diretório do usuário com retenção configurável em **Ferramentas > Opções > Documentos**.

---

## Grade de Resultados (ResultGrid)

A grade exibe as linhas retornadas em formato tabular responsivo com alta eficiência:

- **Identificação de Valores Nulos:** Campos com valor nulo são sinalizados com a etiqueta `(null)` em itálico para fácil diferenciação visual de strings vazias.
- **Múltiplos Conjuntos de Resultados:** Consultas compostas com múltiplos `SELECT` geram abas separadas de resultados no painel inferior.
- **Barra de Informações:** Exibe a contagem de linhas retornadas, o tempo total de resposta e atalhos rápidos de navegação.

---

## Edição de Dados em Linha (Post / Apply / Cancel)

É possível alterar registros diretamente nas células da grade de resultados quando a consulta permitir:

### Requisito Obrigatório

A tabela consultada **deve possuir Chave Primária (Primary Key) ou Índice Único com colunas não-nulas**. Caso a consulta seja originada de junções complexas (JOINs), tabelas sem chave única ou funções agregadas, a grade permanece em **modo somente leitura** para evitar atualizações ambíguas ou inconsistentes de registros.

### Fluxo de Edição

1. Dê um duplo clique na célula desejada ou posicione o cursor e pressione `Enter`.
2. Altere o valor do campo. A linha passa a ser destacada com o marcador de edição pendente.
3. Utilize os controles na barra inferior da grade:
   - **Post:** Valida a linha editada e prepara o comando para a transação.
   - **Apply (ou End Edit):** Confirma e grava as alterações no banco de dados.
   - **Cancel:** Descarta as modificações não gravadas e restaura o estado original da linha.

---

## Copiar Dados Formatados (Copy As)

Ao selecionar uma ou mais células, linhas ou colunas na grade, clique com o botão direito para escolher entre os formatos de exportação direta para a área de transferência:

- **Copiar com Cabeçalhos (`Ctrl+Shift+C`):** Copia os valores delimitados por tabulação incluindo os nomes das colunas.
- **Copiar como CSV:** Gera texto formatado com separador padrão de vírgulas ou ponto-e-vírgula.
- **Copiar como TSV:** Gera texto com separador de tabulações, ideal para colar em planilhas eletrônicas.
- **Copiar como JSON:** Converte as linhas selecionadas em um array de objetos JSON.
- **Copiar como XML:** Estrutura os registros em elementos XML com tags correspondentes aos nomes das colunas.
- **Copiar como Markdown:** Cria uma tabela formatada em Markdown com delimitadores `|`.
- **Copiar como INSERT SQL:** Gera instruções `INSERT INTO nome_tabela (...) VALUES (...);` prontas para replicação.
- **Copiar como UPDATE SQL:** Gera comandos `UPDATE nome_tabela SET ... WHERE chave_primaria = ...;`.

---

## Limite de Linhas e Timeout de Execução

Para resguardar a estabilidade do sistema e a memória da máquina local:

- **Limite de Linhas (Result Row Limit):** Por padrão, consultas de visualização aplicam um teto máximo de registros (configurável em **Ferramentas > Opções > Execução**). Esse limite evita que consultas acidentais a tabelas de milhões de linhas travem o cliente ou esgotem a memória RAM.
- **Timeout de Comando (Command Timeout):** Define o tempo máximo (em segundos) que uma consulta pode aguardar resposta do servidor antes de ser interrompida automaticamente, protegendo contra joins cartesianos acidentais ou bloqueios de tabela (*locks* prolongados). O valor `0` desativa o tempo limite.

---

## Próximos Passos

- Conheça os utilitários avançados em [Ferramentas Integradas](03-ferramentas.md).
- Consulte todos os atalhos de navegação e formatação em [Atalhos de Teclado](04-atalhos.md).
- Saiba como suas senhas e dados são protegidos em [Segurança e Privacidade](05-seguranca.md).
