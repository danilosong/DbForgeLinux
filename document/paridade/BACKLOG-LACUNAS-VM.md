# Backlog de lacunas observadas na VM (aguardando fim do mapeamento)

> **AUDITORIA (17:50):** a Prisma confirmou que os módulos 3 a 10 vieram de sessão anterior (pastas NN-* de re/original-observation, reais mas antigas) e de análise estática (REA), sem captura nova nesta rodada; estão marcados INFERIDA nos F-*.md. A Lupa reobserva cada um e os promove a CONFIRMADA com PNG datado.
> **AVISO (2026-10-21 17:40):** as seções Query Builder, Data Generator, ER, Security e Report/Pivot foram reportadas SEM captura nova na VM (última captura real: 16:39; VM parada no assistente de Import). A origem da evidência é desconhecida (sessão anterior ou inferência) até a Prisma classificar. Tratar como INFERIDA; não abrir tasks de implementação a partir delas antes da reobservação.

Regra: só implementar depois que a Fase A de observação terminar. Cada item: módulo, lacuna, origem (F-*.md), prioridade (A uso diário, B útil, C acabamento), dono sugerido.

## Editor SQL e Autocomplete (F-SQL, F-AC) — CONFIRMADO pela Lupa (20 PNGs, 2026-10-21 17:34-17:38, re/original-observation/01-editor-sql/)
Confirmado com captura: Execute To Cursor Ctrl+Shift+F10, Run To Cursor Ctrl+F10, Jump Between Syntax Pairs Ctrl+F12, Go To Definition F12, Insert Snippet Ctrl+K,X, submenus Format e Refactoring. Com Code Completion desativada o menu perde Insert Snippet/Go To Definition/Jump/Refactoring. Pendente: execução com vários statements, abas Messages, Active Format Profile, Ctrl+Space.
| # | Lacuna | Prio | Dono |
|---|---|---|---|
| E1 | Execute To Cursor (Ctrl+Shift+F10) e Run To Cursor (Ctrl+F10) | A | Codex |
| E2 | Jump Between Syntax Pairs (Ctrl+F12) | B | Codex |
| E3 | Parameter Info interativo com argumento ativo em destaque | B | Codex |
| E4 | Diálogo Stop/Continue/Ignore All em erro de lote | A | Codex |
| E5 | Snippets Manager gráfico (literais e variáveis customizadas) | B | Codex + UX |
| E6 | SQL Formatter Wizard em lote (arquivos/diretórios) | C | Codex |
| E7 | Edição visual das regras de formatação (hoje 9 perfis embutidos) | C | Codex + UX |

## Grid de resultados e edição (F-GRID) — PARCIALMENTE CONFIRMADO pela Lupa (11 PNGs, 17:40-17:41, re/original-observation/02-grid/)
Confirmado com captura: menu de contexto da célula (Copy With Headers Ctrl+Shift+C, Auto-search Ctrl+I, Data Viewer Ctrl+W,R, Quick Filter com =, <>, >, >=, <, <=, Condition), Copy Data As (Column Names Only/Names and Types/CSV/XML/HTML/JSON/EXCEL, cada um To File e To Clipboard), Set Value To (NULL Ctrl+0, Empty String, Now, Zero, Unique Identifier), Data Layout Grid/Card, Generate Script As (INSERT, BULK INSERT, WHERE IN, WHERE AND OR, UPDATE), Send to (Query Builder, Data Report, Chart Designer, Pivot Table). Desconhecido: efeito dos filtros, edição inline em aba de dados de tabela, conteúdo copiado, texto do Generate Script As.
Itens novos a verificar no clone antes de virar task: Set Value To (G5), Send to Chart Designer (G6; o clone tem strings 'Chart Designer' em i18n, verificar se o fluxo existe), Copy Data As EXCEL (G7).
Atenção: G2 e G3 conflitam com o que a matriz já registra como implementado (Pivot e Master-Detail, módulo 18). Verificar no clone antes de abrir task; pode ser só o acoplamento ao grid.
| # | Lacuna | Prio | Dono |
|---|---|---|---|
| G1 | Visualizador espacial (GIS) na aba Spatial do Cell Viewer | C | Codex |
| G2 | Pivot Table interativa acoplada ao grid (verificar vs. módulo 18) | B | Codex |
| G3 | Master-Detail síncrono acoplado ao grid por FK (verificar vs. módulo 18) | B | Codex |
| G4 | Construtor visual em árvore de filtros compostos (AND/OR/BETWEEN) | B | Codex + UX |

## Routine Debugger (F-DBG) — PARCIALMENTE CONFIRMADO pela Lupa (19 PNGs, re/original-observation/03-debugger/)
Confirmado: menu Compile (Compile Ctrl+F7, Compile for Debugging Ctrl+Alt+F7) com mensagem de sucesso 'compiled with debug info'; Step Into F11 abre Edit Parameters (Null value marcado por padrão, OUT desabilitado, Show after execute); paineis Watches, Breakpoints, Call Stack; menu Debug com Continue Ctrl+F5, Break All Ctrl+Alt+Pause, Stop Shift+F5, Restart Ctrl+Shift+F5, Step Into/Over/Out F11/F10/Shift+F11, Delete All Breakpoints Ctrl+Shift+F9; F9 só em linha de comando (não em END); fim da execução abre View Output Parameters e mostra o resultset na aba Data. Desconhecido: breakpoint condicional (D2 segue INFERIDO), edição de variável, Stop/Restart/Break All, mensagens de erro, call stack com várias rotinas.
Itens novos a verificar no clone: janela 'View Output Parameters' ao fim da execução (D5); Break All (D6). Possível contradição: Edit Parameters mostrou BIGINT para parâmetro declarado INT UNSIGNED — checar tipos no clone.
Event Schedulers e UDFs em C/C++ seguem como divergência intencional (não entram no backlog). O original falhou ao implantar o engine no MySQL 8.4 strict (VARCHAR 21845); o clone usa schema próprio com MEDIUMTEXT — manter.
| # | Lacuna | Prio | Dono |
|---|---|---|---|
| D1 | Watches avaliando expressões arbitrárias durante a pausa (ex.: a + b * 2) | A | Codex |
| D2 | Breakpoints condicionais (Condition) e Hit count | A | Codex |
| D3 | Editar variável no painel Watches com escrita na sessão alvo | B | Codex |
| D4 | Diálogo Continue/Stop em exceção durante a depuração | B | Codex |

## Query Builder (F-QB) — PARCIALMENTE CONFIRMADO pela Lupa (9 PNGs, re/original-observation/04-query-builder/)
Confirmado: menus Layout (Align Lefts/Centers/Rights/Tops/Middles/Bottoms/to Grid, Make Same Size, Horizontal/Vertical Spacing, Order) e Query (Execute F5, Stop Alt+Pause, Refresh, Change Type Select/Insert Results/Insert Values/Update/Delete, Parent Query, Create Subquery, Wrap to Subquery, Wrap to Insert, Group By, Sort, Select/Unselect all columns, Select All rows from left/right table, Show Tabbed Editor, Send Query to Report); join por FK criado sozinho ao soltar orders+customers; aba Text formatada; Create Subquery gera abas Root Query e SubQuery. Desconhecido: execução, tipos de join, Wrap to Subquery em ação, ligação subquery-raiz.
Novo a verificar no clone: submenu Layout completo (Align/Make Same Size/Spacing/Order) (Q5) e Change Type Insert Results/Insert Values/Update/Delete (Q6).
Atenção: o print do README (build f885a5f) já mostra menus Query/Layout, botão Auto Layout, Create Subquery e abas Root/SubQuery. Três das quatro lacunas apontadas pela observação provavelmente já existem; só abrir task após verificar no clone.
| # | Lacuna | Prio | Dono |
|---|---|---|---|
| Q1 | Navegação por breadcrumbs entre Root Query e SubQueries (verificar o que já existe) | B | Codex |
| Q2 | Auto-Layout em grafo para vários cartões (existe botão; verificar qualidade do algoritmo) | C | Codex |
| Q3 | Menus Layout e Query na barra principal (aparentemente existem; verificar) | — | verificar |
| Q4 | Minimapa de navegação no canto do canvas | C | Codex |

## Data Generator (F-GEN) — PARCIALMENTE CONFIRMADO pela Lupa (11 PNGs, re/original-observation/05-data-generator/)
Confirmado: entrada por clique direito na tabela > Generate Data... (não está no menu Tools); abre DOCUMENTO .dgen (não wizard linear) com árvore Tables and columns, painel Table generation settings (Row distribution: specified number / proportion of existing data / by time / proportion from lookup table; Truncate before generation; Related tables Parent/Child) e Column generation settings (Generator, Set values unique, Include NULL/empty, Random by timestamp/seed); preview das 50 primeiras linhas; Project Properties com defaults (1.000 linhas, truncate marcado, seed 1, Include NULL 10%). N1 passa a CONFIRMADO. Desconhecido: execução da geração, lista completa de geradores, mensagens finais.
Menu Database capturado: Security Manager Ctrl+D,Q, Session Manager Ctrl+D,S, Server Variables Ctrl+D,V, Service Control Ctrl+D,R, Find Object Ctrl+D,F, Diagram, Master-Detail Browser, Report Designer, Pivot Table, Execute Large Script, Table Maintenance, Flush. Verificar no clone: Service Control, Find Object, Execute Large Script, Table Maintenance (N4). Comparar o desenho do clone (se for wizard por passos) com o documento único do original (N5).
Geradores scriptáveis em C#/Python: NÃO implementar como no original (execução de código arbitrário em app que toca bancos reais). Registrar como diferença intencional; alternativa segura = expressões declarativas/lookup, sem executar código do usuário.
| # | Lacuna | Prio | Dono |
|---|---|---|---|
| N1 | Modos de distribuição de linhas: por proporção de volume, série temporal, lookup table (hoje: contagem fixa) | B | Codex |
| N2 | Painel docado Schema Update Script sincronizado com a geração | C | Codex |
| N3 | Gerador por expressão declarativa/lookup (alternativa segura aos scripts C#/Python) | C | Codex |

## Diagrama ER (F-ER) — PARCIALMENTE CONFIRMADO pela Lupa (16 PNGs, re/original-observation/06-diagrama-er/)
Confirmado: Database > Database Diagram abre Diagram1.dbd; cartões com ícones PK/FK, tipos sem tamanho, selo NOT NULL e seções recolhíveis Constraints/Indexes/Triggers (R1 confirmado); relações IE (pé-de-galinha) com RÓTULO do nome da FK sobre a linha, inclusive auto-relação (R2 confirmado); menu do canvas (New Table/View/Procedure/Function/Container/Note/Stamp/Image, Zoom 10-400%, Preserve Routing, Layout Diagram, Export to Image, Select All, Synchronize Document Outline, Options); Layout Diagram organiza em linha; Diagram Overview = MINI-MAPA FLUTUANTE pela lupa no canto inferior direito (R4 confirmado, mas é flutuante, não painel docado); Export to Image BMP/JPG/GIF/PNG/TIF/EMF; Options com 4 abas (General, Notation, Page, Print). Containers e Notes confirmados (R3).
Desconhecido: Virtual Relations — a Lupa NÃO achou em nenhum menu. R5 (assistente Virtual→FK) fica sem evidência; não implementar até haver prova.
Virtual→FK física: o assistente deve detectar linhas órfãs e exigir confirmação forte, preview do ALTER e transação quando suportada (regra de segurança do projeto).
| # | Lacuna | Prio | Dono |
|---|---|---|---|
| R1 | Seções recolhíveis no cartão (Constraints, Indexes, Triggers) | B | Codex |
| R2 | Rótulo com o nome da constraint desenhado sobre a linha da relação (hoje só tooltip) | B | Codex |
| R3 | Containers de agrupamento e notas adesivas no canvas | C | Codex + UX |
| R4 | Painel docado Diagram Overview (Ctrl+W,V) com viewport em miniatura | B | Codex + UX |
| R5 | Assistente Virtual Relation → FK física com detecção de órfãos | B | Codex |

## Security, Sessions e Server Variables (F-SEC) — PARCIALMENTE CONFIRMADO pela Lupa (13 PNGs, re/original-observation/07-seguranca-sessoes/)
Confirmado: Security Manager como documento com árvore Users (por host) e Roles, Create User/Create Role, Save/Undo/Script Changes; abas General (autenticação caching_sha2_password, expiração, limites por hora, bloqueio de conta), Roles (Granted/Admin Option/Default), Users, Global Privileges (With Grant Option, privilégios dinâmicos do MySQL 8 — S1 confirmado), Object Privileges; Server Variables com toggle System/Status; Session Manager (Id/User/Host/Database/Command/Time/State, refresh 02:00, confirmação de kill 'Do you really want to kill selected session?'). A Lupa respondeu NÃO ao kill; nada foi alterado no servidor. Aba Locks (S2) e SET PERSIST (S3) NÃO foram vistos: seguem INFERIDOS.
Desconhecido: criar/salvar usuário, Service Control, mensagem pós-kill.
Segurança: SET PERSIST/PERSIST_ONLY e privilégios globais são operações perigosas; exigir ação explícita, preview do SQL e confirmação forte; nunca logar senhas.
| # | Lacuna | Prio | Dono |
|---|---|---|---|
| S1 | Todos os privilégios dinâmicos do MySQL 8 (35+) no Global Privileges, por versão do servidor | A | Codex |
| S2 | Aba Locks no Session Manager (transações concorrentes, deadlocks InnoDB) | B | Codex |
| S3 | Server Variables: SET PERSIST / SET PERSIST_ONLY com confirmação | B | Codex |
| S4 | Gráfico de variação por segundo dos contadores de status | C | Codex + UX |

## Report, Pivot e Master-Detail (F-RPT) — CONFIRMADO pela Lupa (21 PNGs, re/original-observation/08-report-pivot-masterdetail/)
Confirmado: Master-Detail Browser como documento .mdet (mestre roxo, detalhe cinza, seta de FK, Browse Data com detalhe filtrado, Fetch Limit e Where Condition, abas Design/Data); Data Report Wizard em 8 passos (tipo Standard/Label/Blank, conexão + tabela/Custom Query, colunas, agrupamento com prioridade, layout Columnar/Tabular/Justified + orientação, estilo Bold/Casual/Compact/Corporate/Formal) que termina em documento Report1.rdb com Designer/Preview, Report Explorer, Properties, Data Source, Toolbox, Group and Sort; Pivot Table como documento com zonas Filter/Data Items/Column/Row, soma + Grand Total.
Resolve G2 e G3: o original TEM esses recursos, e o clone também (gaps 19, 20 e 21 já implementados). Falta apenas comparar fluxo a fluxo (verificar: assistente de 8 passos vs entrada direta no designer do clone; título padrão do relatório deve ser 'TuxSQL Report', nunca o do original).
Desconhecido: relatório Label/Blank, salvar/exportar, opções do pivot, Custom Query.

## Data Compare (F-CMP) — CONFIRMADO pela Lupa (17 PNGs, re/original-observation/09-data-compare/)
Confirmado: assistente de 3 páginas (Source and Target com Database/Scripts Folder e botões Copy/swap; Options com grupos Auto Mapping, Comparison Options e Display Options, ajuda contextual e My Defaults/Devart Defaults; Mapping com Comparison Key, 'n of m columns', Map Objects/Unmap/Reset/Custom Query/Filter e aviso de objetos sem par); resultado com contador 'x of y rows selected', grupos Different/Identical, colunas Only in Source/Different/Identical/Only in Target e detalhe por registro com abas All/Only in Source/Different/Only in Target/Identical; Data Synchronization Wizard (F8) em 4 páginas: Output (editor interno, arquivo com timestamp ou execução direta), Options (concorrência, Bulk Insert 300KB, desabilitar FKs), Additional Scripts, Summary com Action Plan (disable triggers, drop FKs, tabelas, create FKs, enable triggers) e Warnings ('A foreign key might not recover after synchronization.').
Segurança (diferença intencional a manter): Output padrão = editor/arquivo, nunca execução direta; confirmação forte antes de qualquer DROP/DELETE; Esc no assistente deve pedir confirmação (o original fecha tudo sem avisar).
Verificar no clone (módulo 15 já em 100%): 4 abas de detalhe por registro, Bulk Insert configurável, Additional Scripts antes/depois, Action Plan com disable/enable triggers e drop/create FKs (C1).
Desconhecido: mensagens da execução do Synchronize, Generate Comparison Report, Map Objects, Edit Comparison.

## Tools e Options (F-TOOLS, F-OPT) — CONFIRMADO pela Lupa (28 PNGs, re/original-observation/10-tools-options/, valores padrão em NOTAS.md)
Confirmado: menu Tools só tem SQL Formatter, Snippets Manager, Skin, Import/Export Settings, Customize, Reset Toolbar Layout, Options; Options com 17 categorias (Environment, AI Assistant, Schema/Data Comparison, Text Editor, Generate Scripts, Data Editor, Data Export, Copy Databases, Data Generation, Database Explorer, Query Builder, Database Diagram, Source Control, Debugging, Master-Detail, Query Profiler). Padrões do original: Skin Visual Studio Light; startup = última sessão; Environment Categories Development/Production/Sandbox/Test; Text Editor: números de linha DESLIGADOS, tab 2 com espaços, completion em 200 ms, confirma só com Tab, alias na confirmação ligado, formatação ao digitar ligada, margem 80, 9 perfis de formatação (Collapsed, Commas before, Compact, Default, Extended, Indented, MSDN SQL, Right aligned, Stack compact); Data Editor abre SOMENTE LEITURA, página de 1000; Explorer: ação padrão da tabela = Open Object Editor; Debugging timeout 30 s; Query Builder grid 8; Profiler histórico 10. Snippets Manager (literais CARET/DATE/TIME/USER/DB/SERVER, arquivos .snippet) e SQL Formatter Wizard (Files/Directories) capturados — fecham E5 e E6 com evidência.
Tarefa de verificação (O1): comparar os padrões do clone com esta lista; divergências intencionais (telemetria desligada, JSON em XDG) ficam documentadas. Candidato forte a bom padrão para segurança: manter Data Editor em modo somente leitura por padrão.
Correção: a hipótese do módulo 1 de que espaço confirma o autocomplete caiu (só Tab confirma por padrão); a causa da expansão 'select id,total' segue DESCONHECIDA.

## AI Assistant (F-AI) — CONFIRMADO só a casca deslogada (Lupa, 10 PNGs, re/original-observation/11-ai-assistant/)
Confirmado: existe no trial mas exige login (a Lupa NÃO fez login nem enviou feedback). Botão 'AI Assistant' na barra de título abre Sign In / Open Chat Window / Discover All Features / Send Feedback; o painel de chat mostra 4 cartões (Convert Natural Language to SQL, Schema-Aware Code & Explanations, SQL Troubleshooting, Error Analysis & Recommendations); menu de contexto do editor tem 'AI Assistant > Sign In' e Options > AI Assistant com Default model desabilitado e 'Auto-Attach Active Document'.
Decisão (diferença intencional, já registrada): o original exige conta na nuvem; o clone usa chave própria/modelo local, sem telemetria e sem enviar schema sem aprovação. Fluxo logado (chat, modelos, Explain/Fix, histórico) é DESCONHECIDO e NÃO verificável pela VM; paridade do módulo AI só vale para a casca e para os 4 casos de uso listados.
Tarefa (A1): garantir que o clone cubra os 4 casos de uso (NL→SQL, explicar com schema, troubleshooting de SQL, análise de erro) e a opção Auto-Attach Active Document (com aprovação explícita do payload).

## Start Page, menus e erros (F-CON, F-SQL) — CONFIRMADO pela Lupa (18 PNGs, re/original-observation/12-start-menus-erros/)
Prazo: Help > About mostra 'Trial period expires on: 20/11/2026' (Enterprise Edition, 2026.2.82). A observação só é possível até essa data; não reinstalar nem mexer no relógio. Backup das capturas: ~/backups/tuxsql-vm-observation-*.tar.gz (pasta re/ fica fora do git).
Confirmado: Start Page (Recent Files + abas SQL Development, Database Design, Database Sync, Administration, Data Pump, Data Analysis); menus File/Edit/View/Window/Help; Error List com contadores Errors/Warnings/Messages e colunas Description/Location/Line/Column, erros 1146 (tabela inexistente, linha/coluna) e 1064 (sintaxe).
Desconhecido: erros de conexão (senha errada, host inexistente, timeout), texto completo do 1064, submenus de Edit/View.
Próximos alvos da Lupa (segunda passada, antes de 20/11): 1) erros de conexão, 2) Table Designer/editores de objetos, 3) assistentes Import/Export, 4) Schema Compare, 5) Query Profiler, 6) F8/F10 com vários statements, 7) Documenter, 8) edição inline na aba de dados de tabela.

## Segunda passada — P2-01 Erros de conexão (F-CON) — CONFIRMADO pela Lupa (20 PNGs, re/original-observation/p2-01-erros-conexao/)
Confirmado (mensagens do servidor/driver; parafrasear na UI do clone, manter o código do erro): senha errada = erro 1045 'Access denied for user ... (using password: YES)'; host inexistente = 2003 'Can't connect to MySQL server on <host>' + motivo do sistema; porta fechada = 2003; timeout padrão 15 s com spinner e campos desabilitados = 2003 'Server did not respond within the specified timeout'. Erro mostrado em caixa modal com OK. Sem banco padrão: aviso 'recomendado especificar' com OK/Cancel antes de conectar (clone já faz: aviso de DB padrão ausente, rodada 10). Abas e padrões: Advanced (connection timeout 15 s, execute timeout 0, utf8, detect charset/compression, keep alive 240 s), Security (SSL/SSH, key/cert/CA, cipher, TLS 1.2), HTTP (tunnel, proxy 8080), Embedded (my.ini, base/data folder).
Achado do original (NÃO copiar): mesmo com o login falhando, Connect CRIA o nó da conexão no Explorer. O clone deve criar/guardar só o perfil por ação explícita (Save) e mostrar erro sem deixar nó fantasma.
Tarefas: (C2) verificar no clone as mensagens de erro de conexão (1045/2003/timeout 15 s) e os padrões da aba Advanced; (C3) diferença intencional: 'Embedded' não existe no Linux (documentar); mensagem do SO do original vinha em pt-PT — o clone localiza pela UI, não pelo SO.
Desconhecido: usuário inexistente/sem permissão, banco inexistente, SSL/SSH/HTTP em uso, queda no meio da sessão.

## Segunda passada — P2-02 Table Designer e editores de objetos (F-OBJ) — CONFIRMADO pela Lupa (63 PNGs, re/original-observation/p2-02-table-designer/)
Escritas só no schema de teste obs_p2 (sample/sample_b intocados); a Lupa apaga obs_p2 no fim.
Confirmado: menu do banco e New Object (Table/View/Procedure/Function/Trigger/Event). Table Designer com sub-abas General/Constraints/Indexes/Options/Triggers/Partitioning/Data/SQL e rodapé Refresh Object/Apply Changes/Script Changes; DDL ao vivo; coluna nova nasce VARCHAR(255) NULL; marcar PK força NOT NULL; só UMA coluna Auto Increment (a caixa desabilita na segunda); nome de coluna duplicado = ícone + tooltip; renomear objeto no Script Changes pergunta se deve refatorar dependentes (Yes/No/Cancel) e gera ALTER ... RENAME COLUMN em nova aba, com aviso para fazer backup. View: erro quando a consulta está vazia; após Apply o DDL é relido do servidor e normalizado. Procedure: validação LOCAL na Error List e erro 1064 do servidor em caixa modal. Function: o template padrão FALHA com 1418 (falta DETERMINISTIC/NO SQL/READS SQL DATA com binlog ligado) e mostra duas caixas encadeadas. Trigger: só General/SQL, combo de tabela, Timing Before/After, Follows/Precedes. Event: Status, Recurrent, Drop on completion, painéis Start/End/Recurrence.
Tarefas: (T1) clone: o template padrão de FUNCTION deve incluir DETERMINISTIC ou READS SQL DATA para não falhar com binlog (melhoria sobre o original); (T2) verificar que o clone relê o DDL do servidor após Apply; (T3) verificar limite de uma coluna Auto Increment e bloqueio de nome duplicado; (T4) refatoração de dependentes ao renomear (clone: avisar objetos dependentes, sem alterar sem confirmação); (T5) não copiar o cabeçalho 'Script was generated by ...' do original — o clone usa o próprio.
Desconhecido: eventos INSERT/UPDATE/DELETE do trigger, FK/índices em uso, ALTER ao mudar tipo.

## Segunda passada — P2-03 Import/Export (F-IMEX) — CONFIRMADO pela Lupa (28 PNGs, re/original-observation/p2-03-import-export/)
Escritas só no schema de teste obs_p2 (table1 vazia). O export gerou um CSV na VM; o import o releu sem gravar linhas.
Confirmado: Export Data com páginas Export format / Source / Output settings / Options / Data formats / Exported rows / Errors handling / Export / Finish; 14 formatos (HTML, Text, Excel, Excel 2007, Google Sheets, MS Access, RTF, PDF, JSON, XML, CSV padrão, ODBC, DBF, SQL); arquivo com timestamp no nome; CSV com UTF-8, vírgula, aspas, cabeçalho; Errors handling Abort/Prompt/Ignore; tela final com contagens. Import Data: formatos Text, Excel, Excel 2007, Google Sheets, MS Access, XML, JSON, CSV, ODBC, DBF; destino tabela nova (sugere nome) ou existente; Options (encoding, Skip Lines, Header Position, delimitador automático); Data formats (Null String, separadores, Boolean, data/hora autodetectada); Mapping com PK; Modos Append/Update/Append-Update/Delete/Repopulate + transação única + bulk insert; Output editor/arquivo/direto; tela final com Errors/Warnings/Rows imported.
Já coberto pelo clone (F-IMEX, rodadas 8-11): tela Finish com os botões, formatos principais, modos, Zip com senha, retenção. Verificar (I1): páginas Errors handling Abort/Prompt/Ignore, Skip Lines e Header Position no import, Null String e Boolean nas Data formats, modos Update/Append-Update/Delete/Repopulate, 'Import more'.
Achado do original a manter no clone: ao abrir o editor de objeto, avisa 'Object ... was modified outside of the editor. Reload?' — verificar se o clone detecta alteração externa antes do Apply (I2).
Fora de escopo/intencional: Google Sheets (OAuth), MS Access, ODBC, DBF (formatos Windows legados).
Desconhecido: import com linhas reais, formatos não exportados (Excel/JSON/XML), modos Update/Delete, log, script gerado.

## Report Wizard (F-RPT) — implementado (rodada 12, commit c6aee61); lacunas honestas declaradas pela Forja
Implementado: assistente opcional de 8 passos (SELECT-only), colunas transferíveis, ordem de agrupamento, layout/orientação/ajuste de página, 5 estilos, título padrão 'TuxSQL Report', fluxo Blank, zonas do Pivot Filter/Column/Row/Data, persistência do Master-Detail (JSON próprio, consulta validada como somente leitura).
Pendente (prio B): (W1) layout Columnar/Tabular/Justified, orientação e os 5 estilos hoje só são PERSISTIDOS no modelo; aplicar composições visuais distintas no designer e na prévia; (W2) o assistente só oferece a conexão ativa; (W3) abrir um Master-Detail salvo não troca a conexão ativa.
