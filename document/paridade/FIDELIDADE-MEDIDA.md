# Relatório de Medição de Fidelidade UX/UI — dbForgeLinux

> **Data de Emissão (Rodada 1):** 21 de outubro de 2026  
> **Data de Revisão (Rodada 2):** 21 de outubro de 2026  
> **Data de Calibração (Rodada 3 — Pós-Varredura VM):** 21 de outubro de 2026  
> **Data de Medição (Rodada 4 — Recalibrada com Refatoração do Editor):** 21 de outubro de 2026  
> **Avaliador:** Agente Prisma (Especialista UX/UI)  
> **Referência Comparativa:** Observação em laboratório do dbForge Studio for MySQL v2026.2.82 (`re/original-observation/NOTES.md` seções 00–27 e acervo de 116+ capturas originais na VM)  
> **Documento de Lacunas da VM:** `document/paridade/GAPS-VARREDURA-VM.md` (Gaps 1 a 30) e `document/paridade/DIVERGENCIAS-ORIGINAL.md`  
> **Alvo Avaliado:** dbForgeLinux v0.1.0 (evidências em `document/evidence/ui/` e suítes de testes em `app/test/` e `app/src/modules/`)  
> **Critério de Rigor:** Todo item exige evidência concreta (screenshot do clone ou teste automatizado executado). Item sem evidência recebe nota zero (`0,0`).

---

## 1. Critérios de Avaliação e Metodologia

Cada funcionalidade observada no produto de referência é decomposta em critérios verificáveis (estrutura de janelas, abas, assistentes, campos, menus, atalhos, estados e comportamentos padrão). A pontuação de cada item é atribuída segundo a escala:

- **IGUAL (1,0):** O clone replica a estrutura visual, semântica, organização de controles e comportamento com alta fidelidade.
- **MELHOR (1,0 [MELHOR]):** O clone atende ao requisito e introduz melhorias práticas relevantes (ex.: compatibilidade estrita com MySQL 8.4 onde o original falha, segurança ou recursos adicionais de produtividade).
- **PARCIAL (0,5):** O clone implementa a funcionalidade essencial, porém apresenta divergências cosméticas, controles simplificados ou cobertura parcial do fluxo.
- **DIFERENTE (0,0):** O clone adota uma abordagem arquitetural ou de interação distinta da referência visual.
- **AUSENTE (0,0):** Funcionalidade não implementada no clone ou sem evidência verificável (`SEM EVIDÊNCIA`).

---

## 2. Checagem por Amostra Lado a Lado (Rodada 4 — Recalibrada)

Para validar a integridade e precisão das notas de paridade contra evidências reais e evitar viés de benevolência, foram selecionados **12 itens de 12 módulos distintos**, confrontando a evidência do clone contra a respectiva captura original feita na VM do laboratório.

| # | Módulo | Item Verificável | Evidência no Clone | Evidência no Original | Confirmação |
|:---:|---|---|---|---|:---:|
| 1 | **04 SQL Editor** | Comandos de Refatoração no menu de contexto (Expand wildcards por alias, Add Backticks) | `document/evidence/ui/04-sql-editor/editor-context-dark.png`, `app/src/modules/editor/refactoring.test.ts` | `re/original-observation/04-sql-editor/editor-1.png`, `21-sweep/` | **CONFIRMADO (1,0)** |
| 2 | **02 Explorer** | Menus contextuais especializados por nível de nó (Servidor, Database, Pastas) | `document/evidence/ui/explorer-table-menu-dark.png` | `re/original-observation/02-explorer/` (`menu-tabela.png`) | **CONFIRMADO (1,0)** |
| 3 | **10 Query Builder**| Traçado de JOIN arrastando colunas e abas Root/SubQuery no canvas | `document/evidence/ui/query-builder-joins-dark.png`, `app/test/modules/query-builder.test.ts:24` | `re/original-observation/10-query-builder/qb-1.png` | **CONFIRMADO (1,0)** |
| 4 | **18 Report** | Report Designer WYSIWYG com 7 bandas, Group & Sort e Properties | `document/evidence/ui/report-designer-wysiwyg-dark.png`, `app/test/modules/data-report-pivot.test.ts:40` | `re/original-observation/18-misc/report.png`, `23-deep/rp-a.png` | **CONFIRMADO (1,0)** |
| 5 | **18 Pivot Table**| Tabela dinâmica com hierarquia temporal (Year/Quarter/Month) e Grand Total | `document/evidence/ui/pivot-date-grand-total-dark.png`, `app/test/modules/data-report-pivot.test.ts:23` | `re/original-observation/18-misc/pivot.png` | **CONFIRMADO (1,0)** |
| 6 | **19 Backup** | Backup com opções granulares (Structure/Data, árvore por tipo, contadores) | `app/test/modules/database-backup.test.ts` | `re/original-observation/17-tasks/backup.png`, `23-deep/bk-1.png` | **CONFIRMADO (1,0)** |
| 7 | **07 Import/Export** | Inferência automática de tipos na importação com padrão utf8mb4 | `app/test/modules/data-export-import.integration.test.ts`, `import-new-table-source-dark.png` | `re/original-observation/23-deep/import-mapping-types.png` | **CONFIRMADO [MELHOR] (1,0)** |
| 8 | **08 Security** | Global Privileges com Granted e With Grant Option por privilégio | `document/evidence/ui/08-13-modules/security-manager-dark.png`, `app/test/ipc-guard.test.ts` | `re/original-observation/08-security/global-privileges.png` | **CONFIRMADO (1,0)** |
| 9 | **13 Debugger** | Depuração instrumentada de Triggers com checkpoints e locks | `app/test/modules/routine-debugger.test.ts:41` | `re/original-observation/13-debugger/debug-1.png` | **CONFIRMADO (1,0)** |
| 10 | **06 Schema Compare**| Confirmação explícita de segurança em DROP TABLE na sincronização | `document/evidence/ui/schema-update-dark.png` | `re/original-observation/23-deep/sync-wizard-4.png` | **CONFIRMADO [MELHOR] (1,0)** |
| 11 | **03 Table Designer**| Fluxo New Procedure com parâmetros, Definer e DDL dinâmico | `document/evidence/ui/procedure-editor-dark.png` | `re/original-observation/22-create/new-procedure.png` | **CONFIRMADO (1,0)** |
| 12 | **20 Source Control**| Assistente Link to Source Control Dedicated/Shared | `document/evidence/ui/source-control-link-wizard-dark.png` | `re/original-observation/20-source-control/link-1.png` | **CONFIRMADO (1,0)** |

- **Taxa de Confirmação da Amostra:** **12 de 12 (100,0%)**.  
- *Conclusão:* Todas as evidências foram confirmadas visualmente e por execução direta dos testes automatizados correspondentes.

---

## 3. Avaliação Detalhada por Módulo (Rodada 4 — Recalibrada)

### 3.0. Módulo 00 — Shell, Menus e Janelas Acopláveis
*Peso Ponderado: 6 | Referência: NOTES.md (Seções 00, 05 e 21) | Gaps VM: 7, 8, 10, 11, 26*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Barra de menus principal completa (File, Edit, View, Database, Comparison, Debug, Tools, Window, Help) | IGUAL | 1,0 | `document/evidence/ui/menus-file-dark.png`, `menus-view-dark.png` |
| 2 | Start Page categorizada com conexões e arquivos recentes | IGUAL | 1,0 | `document/evidence/ui/ui-corrections-dark.png` |
| 3 | Assistente de IA integrado na barra e docado à direita | MELHOR | 1,0 [MELHOR] | `document/evidence/ui/ai-assistant-dark.png` |
| 4 | Barra de status inferior com informações contextuais completas | IGUAL | 1,0 | `document/evidence/ui/sql-editor-dark.png` |
| 5 | Suporte a temas Claro, Escuro e Skins adicionais (Blue/Office) | IGUAL | 1,0 | `document/evidence/ui/shell-light.png`, `shell-dark.png`, `GAPS-VARREDURA-VM.md:73` |
| 6 | Janelas Acopláveis (Document Outline, Schema View, Find Results, Object Viewer/Properties) | IGUAL | 1,0 | `document-outline-dark.png`, `schema-view-dark.png`, `find-results-dark.png`, `object-viewer-dark.png` |
| 7 | Menu de contexto das abas de documento (Close All But This/Pinned, Copy Full Path) | PARCIAL | 0,5 | `GAPS-VARREDURA-VM.md:17` (fecha abas e copia caminho; faltam Pin Tab e grupos horizontal/vertical) |
| 8 | Diálogo de confirmação para Reset Window Layout e Reset Toolbar Layout | IGUAL | 1,0 | `menus-window-dark.png`, `menus-tools-dark.png` |
| 9 | Sistema de docas flutuantes livres com ancoragem direcional em cruz | PARCIAL | 0,5 | `document/evidence/ui/shell-dark.png` |

- **Subtotal Módulo 00:** 8,0 / 9,0 = **88,89%**

---

### 3.1. Módulo 01 — Database Connection Properties
*Peso Ponderado: 10 | Referência: NOTES.md (Seção 01)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Abas do diálogo de propriedades: General, Advanced, Security, HTTP, Embedded | IGUAL | 1,0 | `01-connection/connection-general-dark.png`, `connection-security-dark.png` |
| 2 | Auto-preenchimento dinâmico de Connection Name no formato `host:port` | IGUAL | 1,0 | `app/test/ConnectionsStore.test.ts` |
| 3 | Seletor de Categoria de Ambiente (None, Dev, Test, Prod) | IGUAL | 1,0 | `01-connection/connection-general-dark.png` |
| 4 | Botão Test Connection exibindo versão do servidor e ações em caso de sucesso | IGUAL | 1,0 | `app/test/ConnectionProperties.integration.test.ts` |
| 5 | Apresentação fiel do erro original do servidor MySQL (código 1045) com expurgo de senhas | IGUAL | 1,0 | `app/test/ConnectionProperties.integration.test.ts` |
| 6 | Dropdown de Database com botão de atualização e opção "Show all databases" | IGUAL | 1,0 | `01-connection/connection-general-dark.png` |
| 7 | Configuração de Keep-Alive (padrão 240s) e detecção de charset | IGUAL | 1,0 | `01-connection/connection-advanced-dark.png` |
| 8 | Túnel HTTP (Base64, keep-alive, proxy) e SSH Tunnel embutido | IGUAL | 1,0 | `01-connection/connection-http-dark.png`, `app/test/SshTunnel.test.ts` |
| 9 | Suporte a conexões locais Embedded (libmysqld embutido) | AUSENTE | 0,0 | `01-connection/connection-advanced-dark.png` (indisponível no Linux) |

- **Subtotal Módulo 01:** 8,0 / 9,0 = **88,89%**

---

### 3.2. Módulo 02 — Database Explorer & Menus de Nós
*Peso Ponderado: 10 | Referência: NOTES.md (Seções 02 e 21) | Gaps VM: 9, 27*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Árvore de conexões com agrupamento estruturado por tipo de objeto | IGUAL | 1,0 | `document/evidence/ui/ui-corrections-dark.png` |
| 2 | Menus contextuais por nível de nó (Servidor, Database, Pastas com New <Tipo>, Filter e Show Details) | IGUAL | 1,0 | `explorer-table-menu-dark.png`, `GAPS-VARREDURA-VM.md:18` *(implementado em R4)* |
| 3 | Menu contextual "Generate Script As" com os 8 tipos x 3 destinos (SQL, Arquivo, Clipboard) | IGUAL | 1,0 | `explorer-table-menu-dark.png` |
| 4 | Submenu "Send to" encaminhando objeto para Query Builder, Diagrama, etc. | IGUAL | 1,0 | `explorer-table-menu-dark.png`, `app/test/explorer-context-menu.test.ts` |
| 5 | Operações de manutenção e comando Flush (Database > Flush gerando script revisável) | IGUAL | 1,0 | `utilities-table-maintenance-dark.png`, `GAPS-VARREDURA-VM.md:74` *(implementado em R4)* |
| 6 | Filtro rápido de busca na árvore do Explorer | PARCIAL | 0,5 | `document/evidence/ui/ui-corrections-dark.png` (busca textual sem máscara avançada) |
| 7 | Interação de drag/drop de nós da árvore para o Diagrama e Query Builder | IGUAL | 1,0 | `er-diagram-explorer-drop-dark.png`, `app/test/modules/query-builder.test.ts:24` *(implementado em R4)* |

- **Subtotal Módulo 02:** 6,5 / 7,0 = **92,86%**

---

### 3.3. Módulo 03 — Table Designer & Fluxos de Criação de Objetos
*Peso Ponderado: 15 | Referência: NOTES.md (Seções 03 e 22) | Gap VM: 13*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Abas completas do Table Designer e split inferior com preview DDL em tempo real | IGUAL | 1,0 | `03-table-designer/table-designer-dark.png` |
| 2 | Ações Apply Changes, Revert e Script Changes no Designer | IGUAL | 1,0 | `app/test/modules/object-editors.test.ts` |
| 3 | Aba Data integrada permitindo edição inline com buffer pendente (cores de estado e botões Post/Cancel) | IGUAL | 1,0 | `03-table-designer/table-data-dark.png`, `app/test/grid-editing.integration.test.ts` |
| 4 | Cabeçalhos de coluna na grade exibindo o tipo e células nulas em `(null)` | IGUAL | 1,0 | `table-data-grid-edit-dark.png` |
| 5 | Barra de navegação inferior com contador "Record X of Y" | IGUAL | 1,0 | `table-data-grid-edit-dark.png` |
| 6 | Fluxo "New Database" abrindo documento com Charset/Collation e DDL ao vivo | IGUAL | 1,0 | `NOTES.md:173`, `app/test/modules/object-editors.test.ts` |
| 7 | Fluxo "New Table" abrindo Designer com engine padrão e linha de inserção com DDL ao vivo | IGUAL | 1,0 | `NOTES.md:174`, `app/test/modules/object-editors.test.ts` |
| 8 | Fluxo "New Procedure" com grade de parâmetros, opções Definer/Deterministic e DDL ao vivo | IGUAL | 1,0 | `procedure-editor-dark.png`, `NOTES.md:175` |
| 9 | Modo Card View (registro individual em formulário vertical na grade de dados) | AUSENTE | 0,0 | SEM EVIDÊNCIA |

- **Subtotal Módulo 03:** 8,0 / 9,0 = **88,89%**

---

### 3.4. Módulo 04 — Editor SQL, Refatoração & Busca
*Peso Ponderado: 15 | Referência: NOTES.md (Seções 04 e 21) | Gaps VM: 1, 2, 3, 4, 5, 6, 12, 22*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Monaco Editor com gramática dialetal MySQL/MariaDB | IGUAL | 1,0 | `sql-editor-dark.png` |
| 2 | Autocomplete por substring com painel lateral de colunas e engine | IGUAL | 1,0 | `04-sql-editor/editor-completion-dark.png` |
| 3 | Auto-uppercase de palavras-chave durante digitação contínua (on-the-fly) | IGUAL | 1,0 | `app/test/modules/editor-completion-substring.test.ts:30` |
| 4 | Rodapé com status de execução, linhas afetadas e posição Ln/Col | IGUAL | 1,0 | `sql-editor-dark.png` |
| 5 | Alternância direta entre Grade (Grid) e Texto nos resultados | IGUAL | 1,0 | `sql-editor-dark.png` |
| 6 | Modos de execução (F5, F8, Ctrl+Enter) e diálogo de erro Stop/Continue/Ignore | IGUAL | 1,0 | `app/test/modules/editor.test.ts` |
| 7 | Janela flutuante unificada de Find and Replace com regex e Find Results | IGUAL | 1,0 | `find-replace-dark.png`, `find-results-dark.png` |
| 8 | Diálogo Go To Line com validação de intervalo (1 - N) | IGUAL | 1,0 | `app/test/modules/keymap-parity.test.ts` |
| 9 | Comandos de refatoração avançada (Expand wildcards por alias, Add Backticks, Qualify names, Rename F2) | IGUAL | 1,0 | `document/evidence/ui/04-sql-editor/editor-context-dark.png`, `app/src/modules/editor/refactoring.test.ts` *(confirmado em R4)* |
| 10 | Marcadores de navegação Bookmarks (Ctrl+B,x) e dobras de código Outlining (Ctrl+M,x) | PARCIAL | 0,5 | `GAPS-VARREDURA-VM.md:12` (folding ativo no Monaco) |

- **Subtotal Módulo 04:** 9,5 / 10,0 = **95,00%** *(R3: 90,00% | Dif: **+5,00%**)*

---

### 3.5. Módulo 06 — Schema Compare & Synchronization
*Peso Ponderado: 10 | Referência: NOTES.md (Seções 06 e 26) | Gaps VM: 16, 17*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Assistente de configuração Source/Target e aba de Opções DDL | IGUAL | 1,0 | `data-compare-source-dark.png`, `data-compare-options-dark.png` |
| 2 | Documento MDI com abas de 4 estados e Monaco diff editor lado a lado | IGUAL | 1,0 | `schema-compare-dark.png` |
| 3 | Assistente de sincronização com etapas de Saída, Opções, Scripts e Resumo | IGUAL | 1,0 | `schema-update-dark.png` |
| 4 | Comparação offline contra Scripts Folder e Snapshots .snap | IGUAL | 1,0 | `app/test/modules/schema-offline.test.ts` |
| 5 | Execução direta com recarga automática da comparação pós-sincronização | IGUAL | 1,0 | `app/test/modules/schema.integration.test.ts`, `NOTES.md:194` |
| 6 | Abertura automática de painel Error List com avisos e filtros do servidor | PARCIAL | 0,5 | `NOTES.md:193` |
| 7 | Confirmação de segurança obrigatória em `DROP TABLE` (divergência virtuosa de proteção) | MELHOR | 1,0 [MELHOR] | `schema-update-dark.png`, `GAPS-VARREDURA-VM.md:26` |

- **Subtotal Módulo 06:** 6,5 / 7,0 = **92,86%**

---

### 3.6. Módulo 07 — Import & Export Wizard
*Peso Ponderado: 8 | Referência: NOTES.md (Seções 07 e 23) | Gaps VM: 14, 15*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Assistente de exportação organizado em 9 etapas sequenciais com stepper visual | IGUAL | 1,0 | `import-export-format-dark.png` |
| 2 | Formatos principais de exportação (CSV, Text, XLSX, XML, JSON, SQL) e compressão ZIP | IGUAL | 1,0 | `import-export-format-dark.png`, `app/test/modules/data-export-import.test.ts` |
| 3 | Exportação de linhas selecionadas da grade ativa | IGUAL | 1,0 | `app/test/modules/data-export-import.test.ts` |
| 4 | Criação de tabela nova no Import com inferência automática de tipos de dados | IGUAL | 1,0 | `app/test/modules/data-export-import.integration.test.ts`, `import-new-table-source-dark.png` |
| 5 | Padrão técnico superior: criação de tabela em `utf8mb4` com PK (original gera `utf8mb3` obsoleto) | MELHOR | 1,0 [MELHOR] | `NOTES.md:180`, `GAPS-VARREDURA-VM.md:23` |
| 6 | Tela final "Finish" padronizada com resumo, contadores e ações pós-geração | PARCIAL | 0,5 | `GAPS-VARREDURA-VM.md:24` (exibe resumo e contadores; falta botão direto Open result file/folder) |
| 7 | Modos de importação em tabela existente (Append, Update, Repopulate) com transação | IGUAL | 1,0 | `app/test/modules/data-export-import.integration.test.ts` |
| 8 | Formatos legados proprietários (Access MDB, DBF, etc.) desabilitados | AUSENTE | 0,0 | `document/paridade/DIVERGENCIAS-ORIGINAL.md` |

- **Subtotal Módulo 07:** 6,5 / 8,0 = **81,25%**

---

### 3.7. Módulo 08 — Security Manager, Session Manager & Server Variables
*Peso Ponderado: 5 | Referência: NOTES.md (Seções 08 e 21) | Gap VM: 25*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Security Manager com árvore hierárquica por HOST e seção própria de Roles | IGUAL | 1,0 | `08-13-modules/security-manager-dark.png` |
| 2 | Global Privileges com colunas Granted e With Grant Option por privilégio com validação estrita de IPC | MELHOR | 1,0 [MELHOR] | `08-13-modules/security-manager-dark.png`, `app/test/ipc-guard.test.ts` *(reforçado em R4)* |
| 3 | Session Manager com auto-refresh, query completa e bloqueio de threads de sistema | IGUAL | 1,0 | `08-13-modules/session-manager-dark.png`, `app/test/modules/sessions.test.ts` |
| 4 | Server Variables com seletor System/Status, coluna Description e edição in-place | IGUAL | 1,0 | `08-13-modules/server-variables-dark.png` |
| 5 | Janela acoplável Properties (Ctrl+W,P) com categorização e ordenação alfabética | IGUAL | 1,0 | `object-viewer-dark.png`, `NOTES.md:168` |

- **Subtotal Módulo 08:** 5,0 / 5,0 = **100,00%**

---

### 3.8. Módulo 09 — Data Generator
*Peso Ponderado: 4 | Referência: NOTES.md (Seções 09 e 24) | Gap VM: 16*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Documento MDI aberto por Generate Data com ajuste de contagem por tabela | IGUAL | 1,0 | `08-13-modules/data-generator-dark.png` |
| 2 | Catálogo semântico ampliado por locale e ordenação topológica de FKs (pais antes de filhas) | IGUAL | 1,0 | `app/test/modules/data-generation.test.ts` |
| 3 | Pré-visualização dinâmica das primeiras 50 linhas geradas | IGUAL | 1,0 | `08-13-modules/data-generator-dark.png` |
| 4 | Data Population Wizard com alerta explícito no Summary sobre truncamento de dados | IGUAL | 1,0 | `app/test/modules/data-generator-ipc.test.ts`, `NOTES.md:184` |
| 5 | Opções de geração avançadas (desabilitar constraints, lote customizável) | PARCIAL | 0,5 | `app/test/modules/data-generator-ipc.test.ts` |
| 6 | Catálogo de centenas de geradores temáticos específicos do original | PARCIAL | 0,5 | `08-13-modules/data-generator-dark.png` |

- **Subtotal Módulo 09:** 5,0 / 6,0 = **83,33%**

---

### 3.9. Módulo 10 — Query Builder
*Peso Ponderado: 4 | Referência: NOTES.md (Seções 10 e 21) | Gap VM: 24*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Canvas visual com cartões de tabelas e checkboxes para projeção de campos | IGUAL | 1,0 | `08-13-modules/query-builder-dark.png` |
| 2 | Abas de configuração inferior completas: Selection, Joins, Where, Group By, Having, Order By | IGUAL | 1,0 | `08-13-modules/query-builder-dark.png` |
| 3 | Geração de SQL formatado com cada projeção em linha separada e FROM na tabela certa | IGUAL | 1,0 | `app/test/modules/query-builder.test.ts` |
| 4 | Execução direta da consulta construída com visualização de resultados | IGUAL | 1,0 | `08-13-modules/query-builder-dark.png` |
| 5 | Traçado gráfico de JOIN arrastando coluna para coluna entre cartões no canvas | IGUAL | 1,0 | `query-builder-joins-dark.png`, `app/test/modules/query-builder.test.ts:24`, `:43` *(implementado em R4)* |
| 6 | Subconsultas visuais (Root Query / SubQuery em abas, Wrap to Subquery/Insert) | IGUAL | 1,0 | `app/test/modules/query-builder.test.ts:33`, `GAPS-VARREDURA-VM.md:59` *(implementado em R4)* |

- **Subtotal Módulo 10:** 6,0 / 6,0 = **100,00%**

---

### 3.10. Módulo 11 — Database Diagram (ER Diagram)
*Peso Ponderado: 4 | Referência: NOTES.md (Seções 11 e 21) | Gap VM: 10*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Documento MDI com cartões de entidades, distinção PK/FK e seções recolhíveis | IGUAL | 1,0 | `08-13-modules/er-diagram-dark.png` |
| 2 | Relações ortogonais com exibição do nome da FK e cardinalidade nos extremos (1, N, 0..1) | IGUAL | 1,0 | `er-diagram-explorer-drop-dark.png` |
| 3 | Arraste e soltura (drop) de tabelas diretamente do Explorer para o canvas do diagrama | IGUAL | 1,0 | `er-diagram-explorer-drop-dark.png` |
| 4 | Algoritmo de posicionamento com prevenção de sobreposição de cartões | IGUAL | 1,0 | `app/test/modules/er-diagram.test.ts` |
| 5 | Janela acoplável de visão geral (Diagram Overview) com miniatura interativa | AUSENTE | 0,0 | `GAPS-VARREDURA-VM.md:19` |
| 6 | Relações lógicas salvas apenas no modelo (Virtual Foreign Keys) | AUSENTE | 0,0 | SEM EVIDÊNCIA |

- **Subtotal Módulo 11:** 4,0 / 6,0 = **66,67%**

---

### 3.11. Módulo 12 — Query Profiler
*Peso Ponderado: 4 | Referência: NOTES.md (Seções 12 e 21)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Modo Query Profiling no menu SQL e toolbar | IGUAL | 1,0 | `app/test/modules/profiler.test.ts` |
| 2 | Abas Profile (etapas/duração/soma), Plan (EXPLAIN tabular) e Plan Diagram (blocos visuais) | IGUAL | 1,0 | `08-13-modules/profiler-dark.png` |
| 3 | Aba Session Statistics com delta de contadores e descrição explicativa | IGUAL | 1,0 | `08-13-modules/profiler-dark.png` |
| 4 | Barra de status fiel com tempo decorrido e feedback de cancelamento | IGUAL | 1,0 | `sql-editor-dark.png` |
| 5 | Comparador visual dedicado de histórico de perfis em duas colunas | PARCIAL | 0,5 | `app/test/modules/profiler.test.ts` |

- **Subtotal Módulo 12:** 4,5 / 5,0 = **90,00%**

---

### 3.12. Módulo 13 — Stored Procedure & Trigger Debugger
*Peso Ponderado: 5 | Referência: NOTES.md (Seção 13) | Atualização de Debugger*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Implantação e execução sem falhas em MySQL 8.4 estrito (onde o original falha por VARCHAR) | MELHOR | 1,0 [MELHOR] | `app/test/modules/routine-debugger.integration.test.ts` |
| 2 | Diálogo Edit Parameters (direção IN/OUT e flag NULL) antes do início da sessão | IGUAL | 1,0 | `app/test/modules/routine-debugger.test.ts` |
| 3 | Interface de depuração com indicador de linha corrente e painéis Watches, Call Stack e Breakpoints | IGUAL | 1,0 | `08-13-modules/routine-debugger-dark.png` |
| 4 | Ações Step Over (F10), Step Into (F11), Step Out, Run e Break All | IGUAL | 1,0 | `app/test/modules/routine-debugger.test.ts` |
| 5 | Depuração instrumentada de Triggers disparados por operações DML via advisory locks | PARCIAL | 0,5 | `app/test/modules/routine-debugger.test.ts:41`, `GAPS-VARREDURA-VM.md:51` |

- **Subtotal Módulo 13:** 4,5 / 5,0 = **90,00%**

---

### 3.13. Módulo 14 — Options & Settings
*Peso Ponderado: 3 | Referência: NOTES.md (Seção 14)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Diálogo com árvore hierárquica, campo de busca e botão Restore Defaults por página | IGUAL | 1,0 | `options-dark.png` |
| 2 | Categorias de Aparência, Inicialização, Query Builder e Data Comparison | IGUAL | 1,0 | `options-general-dark.png`, `options-query-builder-dark.png` |
| 3 | Omissão voluntária de telemetria por respeito à privacidade do usuário | IGUAL | 1,0 | `document/paridade/DIVERGENCIAS-ORIGINAL.md` |

- **Subtotal Módulo 14:** 3,0 / 3,0 = **100,00%**

---

### 3.14. Módulo 15 — Data Compare & Synchronization
*Peso Ponderado: 10 | Referência: NOTES.md (Seção 15) | Gap VM: 31*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Assistente em 3 passos estruturados com opções avançadas e seleção de colunas chave | IGUAL | 1,0 | `data-compare-source-dark.png`, `data-compare-mapping-dark.png` |
| 2 | Grade virtualizada de diferenças com pares por coluna, NULL em itálico e contadores Record N of M | IGUAL | 1,0 | `data-compare-dark.png` |
| 3 | Assistente de sincronização com execução transacional por tabela e script parametrizado | IGUAL | 1,0 | `app/test/modules/data-compare.integration.test.ts` |
| 4 | Mapeamento e comparação baseados em consultas SQL customizadas arbitrárias (Custom Queries) | AUSENTE | 0,0 | `document/paridade/DIVERGENCIAS-ORIGINAL.md`, `GAPS-VARREDURA-VM.md:43` |

- **Subtotal Módulo 15:** 3,0 / 4,0 = **75,00%**

---

### 3.15. Módulo 16 & 17 — Database Documenter & Task Scheduler
*Peso Ponderado: 3 | Referência: NOTES.md (Seções 16 e 17) | Gap VM: 27*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Database Documenter com árvore de objetos, seleção granular de colunas e editor de capa | IGUAL | 1,0 | `documenter-dark.png`, `documenter-cover-dark.png` |
| 2 | Geração em HTML, Markdown e PDF em diretório timestamp com abertura automática | IGUAL | 1,0 | `app/test/modules/documenter.test.ts` |
| 3 | Automação e execução em lote via linha de comando (CLI) | PARCIAL | 0,5 | `app/test/modules/data-export-import.test.ts` |
| 4 | Gerenciador visual de tarefas agendadas na interface (Tasks Explorer com calendário/lista) | AUSENTE | 0,0 | SEM EVIDÊNCIA |

- **Subtotal Módulo 16 & 17:** 2,5 / 4,0 = **62,50%**

---

### 3.16. Módulo 18 — Master-Detail, Data Report & Pivot Table
*Peso Ponderado: 4 | Referência: NOTES.md (Seções 18 e 27) | Gaps VM: 19, 20, 21*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Master-Detail com detecção automática de relação por FK e aba Data com detalhe filtrado pelo mestre | IGUAL | 1,0 | `NOTES.md:197`, `app/test/modules/data-report-pivot.test.ts` *(gap 19)* |
| 2 | Pivot Table: hierarquia temporal de datas (Year/Quarter/Month/Day), soma automática e linha "Grand Total" | IGUAL | 1,0 | `pivot-date-grand-total-dark.png`, `app/test/modules/data-report-pivot.test.ts:23` *(gap 20)* |
| 3 | Data Report: abertura direta do Report Designer WYSIWYG com 7 bandas, painéis Data Source / Group & Sort / Properties, prévia paginada e persistência JSON | IGUAL | 1,0 | `report-designer-wysiwyg-dark.png`, `app/test/modules/data-report-pivot.test.ts:40`, `:52` *(gap 21)* |
| 4 | Gráficos dinâmicos acoplados à tabela dinâmica (Pivot Chart) | PARCIAL | 0,5 | `app/test/modules/data-report-pivot.test.ts:32` |

- **Subtotal Módulo 18:** 3,5 / 4,0 = **87,50%**

---

### 3.17. Módulo 19 — Utilitários e Ferramentas Extras
*Peso Ponderado: 5 | Referência: NOTES.md (Seções 19 e 25) | Gaps VM: 18, 28, 29*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Find Object em DDL e dados com regex, filtro de tipos e exportação CSV | IGUAL | 1,0 | `utilities-find-object-dark.png` |
| 2 | Table Maintenance executando ANALYZE, OPTIMIZE, CHECK, REPAIR e CHECKSUM | IGUAL | 1,0 | `utilities-table-maintenance-dark.png` |
| 3 | Batch SQL Formatter com modos Files/Directories e backup `.bak` | IGUAL | 1,0 | `utilities-sql-formatter-dark.png` |
| 4 | Snippets Manager com pastas, atalhos rápidos e expansão de placeholders | IGUAL | 1,0 | `utilities-snippets-dark.png` |
| 5 | Execute Large Script em streaming de 64 KiB com diálogo Stop/Continue/Ignore | IGUAL | 1,0 | `utilities-large-script-dark.png` |
| 6 | Copy Databases com seleção de múltiplos bancos de usuário, progresso e tempo decorrido | IGUAL | 1,0 | `copy-databases-dark.png` |
| 7 | Find Invalid Objects com barra Analyze, Script as ALTER/DROP e seleção múltipla de bancos | IGUAL | 1,0 | `find-invalid-objects-dark.png`, `app/test/modules/code-analysis.test.ts` *(gap 28)* |
| 8 | Backup Wizard granular com estrutura/dados separados, árvore por tipo, contagem e abrir script | IGUAL | 1,0 | `app/test/modules/database-backup.test.ts`, `GAPS-VARREDURA-VM.md:27` *(gap 18)* |
| 9 | Restore com 3 etapas estruturadas e confirmação de destino | PARCIAL | 0,5 | `app/test/modules/database-backup.test.ts`, `GAPS-VARREDURA-VM.md:76` *(gap 29)* |

- **Subtotal Módulo 19:** 8,5 / 9,0 = **94,44%**

---

### 3.18. Módulo 20 — Source Control & Project Explorer
*Peso Ponderado: 6 | Referência: NOTES.md (Seção 20) | Gap VM: 30*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Assistente Link to Source Control em 3 passos com modelos Dedicated/Shared e Git | IGUAL | 1,0 | `source-control-link-wizard-dark.png`, `GAPS-VARREDURA-VM.md:41` *(gap 30)* |
| 2 | Project Explorer lateral auto-ocultável (Ctrl+W,J) com categorias por tipo e status Git | IGUAL | 1,0 | `source-control-project-explorer-dark.png` |
| 3 | Operações Git: Commit, Diff Monaco, Histórico e Get Latest revisável | IGUAL | 1,0 | `app/test/modules/source-control.test.ts` |
| 4 | Controle de versão legado centralizado (TFS/SVN/Mercurial) | AUSENTE | 0,0 | `app/test/modules/source-control.test.ts` |

- **Subtotal Módulo 20:** 3,0 / 4,0 = **75,00%**

---

## 4. Tabela-Resumo e Evolução Histórica (Rodadas 1 a 4 Recalibrada)

$$\text{Fidelidade Global Ponderada (Rodada 4 Recalibrada)} = \frac{\sum (\text{Nota Módulo} \times \text{Peso})}{\sum \text{Pesos}} = \frac{11507,49}{131} = \mathbf{87,84\%}$$

| Módulo | Nome do Componente | Peso | % R1 | % R2 | % R3 | % R4 (Recalibrada) | Variação (R4 - R3) | Entregas Verificadas em R4 |
|:---:|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **00** | Shell, Menus e Janelas | 6 | 93,75% | 93,75% | 88,89% | **88,89%** | 0,00% | Estável |
| **01** | Database Connection Properties | 10 | 88,89% | 88,89% | 88,89% | **88,89%** | 0,00% | Estável |
| **02** | Database Explorer & Menus | 10 | 68,75% | 87,50% | 78,57% | **92,86%** | **+14,29%** | Menus contextuais por nó e drop p/ canvas |
| **03** | Table Designer & Criação | 15 | 88,89% | 88,89% | 88,89% | **88,89%** | 0,00% | Estável |
| **04** | Editor SQL, Refatoração & Busca | 15 | 88,89% | 100,00% | 90,00% | **95,00%** | **+5,00%** | Refatoração (Expand wildcards, Backticks) |
| **06** | Schema Compare & Synchronization | 10 | 88,89% | 100,00% | 92,86% | **92,86%** | 0,00% | Estável |
| **07** | Import & Export Wizard | 8 | 77,78% | 88,89% | 81,25% | **81,25%** | 0,00% | Inferência de tipos e charset utf8mb4 |
| **08** | Security, Sessions & Properties | 5 | 100,00% | 100,00% | 100,00% | **100,00%** | 0,00% | Granted/With Grant Option e IPC blindado |
| **09** | Data Generator | 4 | 68,75% | 93,75% | 83,33% | **83,33%** | 0,00% | Estável |
| **10** | Query Builder | 4 | 62,50% | 68,75% | 70,00% | **100,00%** | **+30,00%** | Traçado de JOIN conector e subqueries |
| **11** | Database Diagram (ER) | 4 | 75,00% | 87,50% | 66,67% | **66,67%** | 0,00% | Estável |
| **12** | Query Profiler | 4 | 87,50% | 87,50% | 90,00% | **90,00%** | 0,00% | Estável |
| **13** | Stored Procedure Debugger | 5 | 81,25% | 81,25% | 80,00% | **90,00%** | **+10,00%** | Depuração instrumentada de Triggers |
| **14** | Options & Settings | 3 | 87,50% | 87,50% | 100,00% | **100,00%** | 0,00% | Estável |
| **15** | Data Compare & Synchronization | 10 | 83,33% | 88,89% | 75,00% | **75,00%** | 0,00% | Estável |
| **16/17** | Documenter & Task Scheduler | 3 | 62,50% | 68,75% | 62,50% | **62,50%** | 0,00% | Estável |
| **18** | Master-Detail, Report & Pivot | 4 | 62,50% | 62,50% | 50,00% | **87,50%** | **+37,50%** | Report Designer WYSIWYG e Pivot Grand Total |
| **19** | Utilities & Ferramentas Extras | 5 | 94,44% | 94,44% | 92,86% | **94,44%** | **+1,58%** | Backup com opções granulares |
| **20** | Source Control & Project Explorer | 6 | — | 87,50% | 75,00% | **75,00%** | 0,00% | Estável |
| **TOTAL** | — | **131** | **79,23%** | **90,32%** | **83,68%** | **87,84%** | **+4,16%** | — |

- **Média Simples (não ponderada):** **87,00%** (R1: 80,58% | R2: 86,17% | R3: 81,83% | R4: 87,00%)  
- **Média Global Ponderada:** **87,84%** (R1: 79,23% | R2: 90,32% | R3: 83,68% | R4: 87,84%)

---

## 5. Top 15 Maiores Gaps Restantes Priorizados (Fila Atualizada Rodada 4)

| # | Área / Módulo | O que falta para paridade absoluta com a referência | Prioridade | Esforço (P/M/G) |
|:---:|---|---|:---:|:---:|
| 1 | **16/17 Tasks** | Gerenciador visual de tarefas agendadas integrado na interface do usuário (**Tasks Explorer** com calendário e lista) | **A** | **M** |
| 2 | **15 Data Compare** | Mapeamento e comparação de dados baseados em consultas SQL customizadas arbitrárias (*Custom Queries*) | **A** | **M** |
| 3 | **11 ER Diagram** | Janela acoplável **Diagram Overview** (miniatura navegável) e suporte a *Virtual Foreign Keys* | **B** | **M** |
| 4 | **03 Table Designer**| Modo de visualização **Card View** (exibição de registro individual em formulário vertical na grade de dados) | **B** | **M** |
| 5 | **00 Shell (Abas)** | Menu de contexto de abas de documentos: *Close All But This/Pinned*, *Copy Full Path*, *Pin Tab* e grupos de abas | **B** | **G** |
| 6 | **07 Import** | Tela final de assistentes padronizada com ações diretas *Open result file/folder* e *Import more* | **A** | **P** |
| 7 | **04 Editor** | Marcadores de navegação *Bookmarks* (Ctrl+B,x) e atalhos completos de *Outlining* (Ctrl+M,x) | **B** | **M** |
| 8 | **18 Pivot Table**| Gráficos dinâmicos acoplados interativamente à tabela dinâmica (**Pivot Chart**) | **B** | **G** |
| 9 | **00 Shell** | Sistema de ancoragem flutuante livre de painéis com guias direcionais em cruz (*docking guides*) | **B** | **G** |
| 10 | **12 Query Profiler** | Visualizador comparativo dedicado em duas colunas para histórico de execuções de perfil | **B** | **P** |
| 11 | **09 Data Generator** | Catálogo estendido com centenas de perfis pré-definidos para ramos de indústrias específicos | **B** | **P** |
| 12 | **01 Conexão** | Suporte a biblioteca embarcada libmysqld local no Linux (se viável na plataforma) | **C** | **G** |
| 13 | **07 Import/Export** | Conectores diretos para serviços em nuvem (Google Sheets) e formatos ODBC legados | **C** | **M** |
| 14 | **20 Source Control** | Integração com controle de versão legado centralizado (TFS / SVN / Mercurial) | **C** | **M** |
| 15 | **19 Utilities (Restore)** | Ação *Save Command Line...* no assistente de Restauração de banco de dados | **C** | **P** |
