# Backlog de lacunas observadas na VM (aguardando fim do mapeamento)

> **AVISO (2026-10-21 17:40):** as seções Debugger, Query Builder, Data Generator, ER, Security e Report/Pivot foram reportadas SEM captura nova na VM (última captura real: 16:39; VM parada no assistente de Import). A origem da evidência é desconhecida (sessão anterior ou inferência) até a Prisma classificar. Tratar como INFERIDA; não abrir tasks de implementação a partir delas antes da reobservação.

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

## Routine Debugger (F-DBG) — observado
Event Schedulers e UDFs em C/C++ seguem como divergência intencional (não entram no backlog). O original falhou ao implantar o engine no MySQL 8.4 strict (VARCHAR 21845); o clone usa schema próprio com MEDIUMTEXT — manter.
| # | Lacuna | Prio | Dono |
|---|---|---|---|
| D1 | Watches avaliando expressões arbitrárias durante a pausa (ex.: a + b * 2) | A | Codex |
| D2 | Breakpoints condicionais (Condition) e Hit count | A | Codex |
| D3 | Editar variável no painel Watches com escrita na sessão alvo | B | Codex |
| D4 | Diálogo Continue/Stop em exceção durante a depuração | B | Codex |

## Query Builder (F-QB) — observado
Atenção: o print do README (build f885a5f) já mostra menus Query/Layout, botão Auto Layout, Create Subquery e abas Root/SubQuery. Três das quatro lacunas apontadas pela observação provavelmente já existem; só abrir task após verificar no clone.
| # | Lacuna | Prio | Dono |
|---|---|---|---|
| Q1 | Navegação por breadcrumbs entre Root Query e SubQueries (verificar o que já existe) | B | Codex |
| Q2 | Auto-Layout em grafo para vários cartões (existe botão; verificar qualidade do algoritmo) | C | Codex |
| Q3 | Menus Layout e Query na barra principal (aparentemente existem; verificar) | — | verificar |
| Q4 | Minimapa de navegação no canto do canvas | C | Codex |

## Data Generator (F-GEN) — observado
Geradores scriptáveis em C#/Python: NÃO implementar como no original (execução de código arbitrário em app que toca bancos reais). Registrar como diferença intencional; alternativa segura = expressões declarativas/lookup, sem executar código do usuário.
| # | Lacuna | Prio | Dono |
|---|---|---|---|
| N1 | Modos de distribuição de linhas: por proporção de volume, série temporal, lookup table (hoje: contagem fixa) | B | Codex |
| N2 | Painel docado Schema Update Script sincronizado com a geração | C | Codex |
| N3 | Gerador por expressão declarativa/lookup (alternativa segura aos scripts C#/Python) | C | Codex |

## Diagrama ER e Virtual Relation Manager (F-ER) — observado
Virtual→FK física: o assistente deve detectar linhas órfãs e exigir confirmação forte, preview do ALTER e transação quando suportada (regra de segurança do projeto).
| # | Lacuna | Prio | Dono |
|---|---|---|---|
| R1 | Seções recolhíveis no cartão (Constraints, Indexes, Triggers) | B | Codex |
| R2 | Rótulo com o nome da constraint desenhado sobre a linha da relação (hoje só tooltip) | B | Codex |
| R3 | Containers de agrupamento e notas adesivas no canvas | C | Codex + UX |
| R4 | Painel docado Diagram Overview (Ctrl+W,V) com viewport em miniatura | B | Codex + UX |
| R5 | Assistente Virtual Relation → FK física com detecção de órfãos | B | Codex |

## Security, Sessions e Server Variables (F-SEC) — observado
Segurança: SET PERSIST/PERSIST_ONLY e privilégios globais são operações perigosas; exigir ação explícita, preview do SQL e confirmação forte; nunca logar senhas.
| # | Lacuna | Prio | Dono |
|---|---|---|---|
| S1 | Todos os privilégios dinâmicos do MySQL 8 (35+) no Global Privileges, por versão do servidor | A | Codex |
| S2 | Aba Locks no Session Manager (transações concorrentes, deadlocks InnoDB) | B | Codex |
| S3 | Server Variables: SET PERSIST / SET PERSIST_ONLY com confirmação | B | Codex |
| S4 | Gráfico de variação por segundo dos contadores de status | C | Codex + UX |
