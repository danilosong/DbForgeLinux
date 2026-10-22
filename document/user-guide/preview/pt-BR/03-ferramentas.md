Esta página vale para a versão 0.1.0.

# Ferramentas Integradas

O TuxSQL reúne um conjunto abrangente de ferramentas de engenharia, administração e modelagem de dados voltadas para desenvolvedores e administradores de banco de dados.

Voltar ao [Sumário Principal](00-index.md).

---

## 1. Schema Compare (Comparação de Esquema)

O **Schema Compare** permite comparar a estrutura DDL entre dois bancos de dados ou scripts SQL:

- Analisa tabelas, colunas, tipos de dados, chaves primárias e estrangeiras, índices, restrições, views, rotinas (procedures e functions) e triggers.
- Agrupa as diferenças em categorias visuais (Objetos Ausentes, Diferentes e Adicionais).
- Gera um script DDL de sincronização preciso, pronto para ser revisado e executado contra o banco de destino.

Acesse pelo menu **Ferramentas > Schema Compare** ou pelo menu de contexto de um banco de dados no Database Explorer.

---

## 2. Data Compare (Comparação de Dados)

O **Data Compare** analisa o conteúdo linha a linha entre tabelas homônimas de dois bancos de dados:

- Utiliza as chaves primárias ou índices únicos para cruzar e parear registros correspondentes.
- Identifica com clareza registros com valores divergentes, linhas faltantes no destino ou exclusivas da origem.
- Gera script SQL de sincronização contendo instruções `INSERT`, `UPDATE` e `DELETE` compensatórias.

Acesse pelo menu **Ferramentas > Data Compare**.

---

## 3. Query Builder (Construtor Visual de Consultas)

O **Query Builder** oferece uma interface gráfica para montagem e diagramação de consultas SQL:

- Arraste tabelas do Database Explorer diretamente para o painel de desenho.
- Crie junções relacionais (INNER, LEFT, RIGHT JOIN) ligando colunas correspondentes com o mouse.
- Defina critérios de seleção, ordenação (ORDER BY), agrupamento (GROUP BY) e filtros (WHERE e HAVING) por meio de grades intuitivas.
- O código SQL é atualizado bidirecionalmente em tempo real na aba de texto.

Acesse pelo menu **Ferramentas > Query Builder**.

---

## 4. Diagrama ER (Entidade-Relacionamento)

A ferramenta de **Diagrama ER** gera a representação visual da modelagem física de dados:

- Carrega tabelas selecionadas com suas colunas, chaves primárias, índices e chaves estrangeiras.
- Conecta tabelas com linhas que indicam as cardinalidades dos relacionamentos.
- Oferece recursos de zoom, navegação panorâmica, alinhamento automático de cartões e exportação do diagrama em imagem ou documento.

Acesse clicando com o botão direito sobre um banco no Database Explorer e escolhendo **Diagrama de Banco de Dados**.

---

## 5. Data Generator (Gerador de Dados de Teste)

O **Data Generator** automatiza a criação de massa de dados de teste coerente e volumosa:

- Conta com mais de 100 geradores semânticos distribuídos por categorias práticas: dados pessoais (Nomes, CPF, CNPJ, RG, Passaporte), geográficos (Endereços, Cidades, CEP), contatos (E-mail, Telefones), negócios (Moedas, Cartões de Crédito, SKUs), tecnologia (IPs, MAC, UUID, Hashes) e saúde.
- Preserva automaticamente a integridade referencial ao preencher chaves estrangeiras vinculadas a tabelas dependentes.
- Desativa temporariamente verificações de integridade apenas durante a carga controlada, restaurando-as obrigatoriamente ao final.

Acesse pelo menu **Ferramentas > Gerador de Dados**.

---

## 6. Importação e Exportação de Dados

O módulo de transferência de dados permite movimentar registros com facilidade entre diferentes formatos:

- **Exportação:** Exporta tabelas e resultados de consultas para arquivos CSV, JSON, XML, HTML, Markdown, planilhas Excel (.xlsx) e scripts SQL de inserção.
- **Importação:** Assistente guiado para leitura de arquivos CSV, JSON e XML, com mapeamento visual de colunas, conversão de tipos de dados e tratamento de erros de linha.
- **Leitura de MS Access (.mdb / .accdb):** Suporte de somente leitura no Linux através da integração com o utilitário de código aberto `mdbtools`. Veja detalhes de instalação em [Problemas Comuns e Soluções](06-problemas-comuns.md).

Acesse pelo menu de contexto de tabelas no Database Explorer: **Importar Dados...** ou **Exportar Dados...**.

---

## 7. Backup e Restore (com Agendamento por systemd e cron)

O utilitário de cópias de segurança realiza backups lógicos confiáveis de bancos e tabelas MySQL/MariaDB:

- **Criação de Backup:** Exporta estruturas DDL, dados ou ambos, com opções de compactação e inclusão de rotinas e triggers.
- **Restauração:** Reconstitui esquemas e dados a partir de arquivos `.sql` gerados.
- **Agendamento no Linux:** A ferramenta gera automaticamente os arquivos de configuração necessários para rodar backups periódicos via **systemd timer** (`.service` e `.timer` em `~/.config/systemd/user/`) ou entradas para a tabela do **cron** (`crontab -e`), integrando-se nativamente com a infraestrutura do Linux sem depender de serviços externos.

Acesse pelo menu **Banco de Dados > Backup...** e **Banco de Dados > Restaurar...**.

---

## 8. Documenter (Gerador de Documentação)

O **Documenter** gera relatórios completos da estrutura do banco de dados para documentação técnica e auditoria:

- Documenta esquemas, tabelas, comentários, descrições de colunas, restrições, relacionamentos, views, rotinas e permissões de usuários.
- Gera documentação em formato **HTML** autocontido (com índice lateral e busca instantânea) e em arquivos **Markdown**.
- Pode ser acionado tanto na interface quanto via linha de comando (`tuxsql-doc`) para pipelines de integração contínua (CI/CD).

Acesse pelo menu **Ferramentas > Documenter**.

---

## 9. Profiler (Perfilador de Consultas)

O **Profiler** investiga o desempenho e o custo de execução de consultas no servidor:

- Intercepta execuções e mede o tempo detalhado em cada etapa interna do motor de processamento do MySQL/MariaDB (estágios de parsing, abertura de tabelas, otimização, envio de dados).
- Exibe o plano de acesso e o consumo de I/O em gráficos informativos para detecção de gargalos de desempenho e ausência de índices.

Acesse marcando a opção **Ativar Profiling** no menu **Consulta** ou no painel inferior de ferramentas.

---

## 10. Debugger de Rotinas (Stored Procedure Debugger)

O depurador integrado do TuxSQL permite executar stored procedures, funções armazenadas e triggers passo a passo:

- Inserção de pontos de interrupção (breakpoints) no código da rotina.
- Controles de execução padrão: Continuar (`Alt+F9`), Avançar sobre instrução (`F10`), Entrar em sub-rotina (`F11`) e Executar até o cursor (`Ctrl+F10`).
- Painéis dedicados para inspeção de variáveis locais e parâmetros, pilha de chamadas (call stack) e observação de expressões (*watches*).

*Nota técnica:* A depuração de rotinas exige que o subsistema `performance_schema` esteja ativado no servidor MySQL. Consulte [Problemas Comuns e Soluções](06-problemas-comuns.md).

Acesse clicando com o botão direito em uma rotina no Database Explorer e selecionando **Depurar Rotina**.

---

## 11. Security Manager, Session Manager e Server Variables

Ferramentas essenciais para a administração diária do servidor:

- **Security Manager (`Ctrl+D Ctrl+Q`):** Interface para criar e editar contas de usuários, alterar senhas, definir políticas de autenticação e conceder ou revogar privilégios em nível global, de banco ou de tabela.
- **Session Manager (`Ctrl+D Ctrl+S`):** Monitora conexões ativas no servidor em tempo real. Exibe ID do processo, usuário conectado, IP de origem, banco em uso, tempo decorrido e a consulta em execução, com suporte ao encerramento forçado de sessões travadas (*Kill Process*).
- **Server Variables (`Ctrl+D Ctrl+V`):** Tabela pesquisável com todas as variáveis de sistema do MySQL/MariaDB. Permite consultar e ajustar parâmetros globais e de sessão suportados pelo servidor.

---

## 12. Chart Designer (Designer de Gráficos)

O **Chart Designer** transforma resultados de consultas tabulares em gráficos analíticos interativos:

- Acesso direto a partir da grade de resultados: clique com o botão direito na grade e selecione **Enviar para > Chart Designer...**.
- Suporte a diversas famílias 2D: Barras, Linhas, Área, Pontos/Dispersão, Pizza, Rosca, Radar e Polar.
- Painel visual para mapear colunas de argumentos, valores métricos e agrupamentos de séries.
- Pré-visualização dinâmica e exportação do gráfico gerado em formatos de imagem vetorial e rasterizada.

---

## 13. Source Control (Controle de Versão Git)

O módulo de controle de versão integra o TuxSQL com repositórios **Git** locais:

- Mapeie uma pasta de repositório Git contendo scripts e migrações do banco.
- Inspecione arquivos modificados, crie novos commits, alterne entre branches e sincronize alterações (push e pull).
- Suporta a geração de scripts DDL individuais por objeto para versionamento granular da estrutura do banco.

Acesse pelo menu **Arquivo > Abrir Projeto...** ou pelo Project Explorer (`Ctrl+W Ctrl+J`).

---

## 14. Servidor Local Descartável (Sandbox Docker / Podman)

Para testes seguros e experimentos sem risco para os ambientes corporativos:

- Inicia uma instância local e isolada de MySQL ou MariaDB em containers gerenciados pelo Docker ou Podman instalados na máquina Linux.
- Permite aplicar scripts de migração, testar backups ou validar rotinas em ambiente limpo com 1 clique.
- Ao concluir o trabalho, o container e os dados temporários podem ser destruídos imediatamente sem deixar resíduos no sistema operacional.

Acesse pelo painel **Servidor Local Descartável** na barra de atividades.

---

## 15. Service Control (Controle de Serviços Linux)

O **Service Control** (`Ctrl+D Ctrl+R`) permite controlar os daemons locais de banco de dados diretamente pelo aplicativo:

- Lista o status de serviços do sistema operacional gerenciados pelo `systemd` (como `mysql.service` e `mariadb.service`).
- Permite Iniciar, Parar, Reiniciar e Habilitar/Desabilitar serviços na inicialização do sistema.
- Solicita elevação segura de privilégios através do diálogo nativo do `pkexec` (Polkit) do Linux, sem necessidade de rodar o aplicativo principal como root.

---

## Próximos Passos

- Conheça os atalhos rápidos de teclado em [Atalhos de Teclado](04-atalhos.md).
- Veja detalhes sobre o modelo de proteção e permissões em [Segurança e Privacidade](05-seguranca.md).
- Consulte respostas para dúvidas e erros em [Problemas Comuns e Soluções](06-problemas-comuns.md).
