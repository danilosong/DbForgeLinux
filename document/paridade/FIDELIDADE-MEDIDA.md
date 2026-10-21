# Relatório de Medição de Fidelidade UX/UI — dbForgeLinux

> **Data de Emissão (Rodada 1):** 21 de outubro de 2026  
> **Data de Revisão (Rodada 2):** 21 de outubro de 2026  
> **Data de Calibração (Rodada 3 — Pós-Varredura VM):** 21 de outubro de 2026  
> **Avaliador:** Agente Prisma (Especialista UX/UI)  
> **Referência Comparativa:** Observação em laboratório do dbForge Studio for MySQL v2026.2.82 (`re/original-observation/NOTES.md` seções 00–27 e acervo de 116+ capturas originais na VM)  
> **Documento de Lacunas da VM:** `document/paridade/GAPS-VARREDURA-VM.md`  
> **Alvo Avaliado:** dbForgeLinux v0.1.0 (evidências em `document/evidence/ui/` e suítes de testes em `app/test/`)  
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

## 2. Checagem por Amostra Lado a Lado (Rodada 3 — Pós-Varredura VM)

Para validar empiricamente as notas de alta fidelidade e evitar viés de otimismo, foram selecionados **12 itens de 12 módulos distintos**, comparando diretamente a captura real do clone contra a respectiva captura original feita na VM do laboratório.

| # | Módulo | Item Verificável | Evidência no Clone | Evidência no Original | Confirmação |
|:---:|---|---|---|---|:---:|
| 1 | **00 Shell** | Janela acoplável Document Outline estruturada | `document/evidence/ui/document-outline-dark.png` | `re/original-observation/21-sweep/` (`win-outline`) | **CONFIRMADO (1,0)** |
| 2 | **01 Conexão** | Teste de conexão com diálogo de versão do servidor e ações | `document/evidence/ui/01-connection/connection-general-dark.png` | `re/original-observation/01-conexao/teste-ok.png` | **CONFIRMADO (1,0)** |
| 3 | **02 Explorer** | Menu contextual "Generate Script As" com os 8 tipos x 3 destinos | `document/evidence/ui/explorer-table-menu-dark.png` | `re/original-observation/02-explorer/menu-generate-script-as.png` | **CONFIRMADO (1,0)** |
| 4 | **03 Table Designer**| Fluxo New Procedure com parâmetros e opções Definer/Deterministic | `document/evidence/ui/procedure-editor-dark.png` | `re/original-observation/22-create/` (`new-procedure`) | **CONFIRMADO (1,0)** |
| 5 | **04 SQL Editor** | Janela flutuante unificada Find and Replace com suporte a regex | `document/evidence/ui/find-replace-dark.png` | `re/original-observation/23-deep/replace.png` | **CONFIRMADO (1,0)** |
| 6 | **06 Schema Compare**| Salvaguarda de segurança em DROP TABLE na sincronização | `document/evidence/ui/schema-update-dark.png` | `re/original-observation/23-deep/sync-wizard-4.png` | **CONFIRMADO [MELHOR] (1,0)** |
| 7 | **07 Import/Export** | Inferência automática de tipos na importação com padrão utf8mb4 | `app/test/modules/data-export-import.integration.test.ts` | `re/original-observation/23-deep/` (`import-mapping-types`) | **CONFIRMADO [MELHOR] (1,0)** |
| 8 | **08 Security** | Árvore agrupada por HOST e pasta de Roles no Security Manager | `document/evidence/ui/08-13-modules/security-manager-dark.png` | `re/original-observation/08-security/security-manager-1.png` | **CONFIRMADO (1,0)** |
| 9 | **09 Data Generator** | Geração respeitando integridade de FKs (pais antes de filhas) | `app/test/modules/data-generation.test.ts` | `re/original-observation/23-deep/gen-preview.png` | **CONFIRMADO (1,0)** |
| 10 | **12 Profiler** | Aba Session Statistics com delta e descrição de contadores | `document/evidence/ui/08-13-modules/profiler-dark.png` | `re/original-observation/12-profiler/session-stats.png` | **CONFIRMADO (1,0)** |
| 11 | **13 Debugger** | Depuração estável em MySQL 8.4 estrito sem erro de VARCHAR | `app/test/modules/routine-debugger.integration.test.ts` | `re/original-observation/13-debugger/deploy-progresso.png` | **CONFIRMADO [MELHOR] (1,0)** |
| 12 | **20 Source Control**| Assistente Link to Source Control Dedicated/Shared | `document/evidence/ui/source-control-link-wizard-dark.png` | `re/original-observation/20-source-control/link-1.png` | **CONFIRMADO (1,0)** |

- **Taxa de Confirmação da Amostra:** **12 de 12 (100,0%)**.  
- *Calibração:* A taxa situa-se acima da linha de corte de 90%. As notas atribuídas aos itens individuais foram estritamente validadas.

---

## 3. Avaliação Detalhada por Módulo (Rodada 3 — Pós-Varredura VM)

Nesta rodada, a matriz foi aprofundada para confrontar o clone com as constatações detalhadas das seções 21 a 27 de `NOTES.md` e os itens mapeados em `GAPS-VARREDURA-VM.md`.

### 3.0. Módulo 00 — Shell, Menus e Janelas Acopláveis
*Peso Ponderado: 6 | Referência: NOTES.md (Seções 00, 05 e 21)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Barra de menus principal completa (File, Edit, View, Database, Comparison, Debug, Tools, Window, Help) | IGUAL | 1,0 | `document/evidence/ui/menus-file-dark.png`, `menus-view-dark.png` |
| 2 | Start Page categorizada com conexões e arquivos recentes | IGUAL | 1,0 | `document/evidence/ui/ui-corrections-dark.png` |
| 3 | Assistente de IA integrado na barra e docado à direita | MELHOR | 1,0 [MELHOR] | `document/evidence/ui/ai-assistant-dark.png` |
| 4 | Barra de status inferior com informações contextuais completas | IGUAL | 1,0 | `document/evidence/ui/sql-editor-dark.png` |
| 5 | Suporte a temas Claro e Escuro consistentes | IGUAL | 1,0 | `document/evidence/ui/shell-light.png`, `shell-dark.png` |
| 6 | Janelas Acopláveis (Document Outline, Schema View, Find Results, Object Viewer/Properties) | IGUAL | 1,0 | `document-outline-dark.png`, `schema-view-dark.png`, `find-results-dark.png`, `object-viewer-dark.png` |
| 7 | Menu de contexto das abas de documento (Close All But This/Pinned, Copy Full Path, Pin Tab) | PARCIAL | 0,5 | `GAPS-VARREDURA-VM.md:17` (fecha abas e copia caminho; faltam Pin Tab e grupos horizontal/vertical) |
| 8 | Diálogo de confirmação para Reset Window Layout | IGUAL | 1,0 | `menus-window-dark.png` |
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
*Peso Ponderado: 10 | Referência: NOTES.md (Seções 02 e 21)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Árvore de conexões com agrupamento estruturado por tipo de objeto | IGUAL | 1,0 | `document/evidence/ui/ui-corrections-dark.png` |
| 2 | Menus contextuais diferenciados por nível de nó (Servidor, Database, Pastas de objetos) | PARCIAL | 0,5 | `NOTES.md:165-167`, `GAPS-VARREDURA-VM.md:18` (menu de tabela é completo; servidor e database simplificados) |
| 3 | Menu contextual "Generate Script As" com os 8 tipos x 3 destinos (SQL, Arquivo, Clipboard) | IGUAL | 1,0 | `explorer-table-menu-dark.png` |
| 4 | Submenu "Send to" encaminhando objeto para Query Builder, Diagrama, etc. | IGUAL | 1,0 | `explorer-table-menu-dark.png`, `app/test/explorer-context-menu.test.ts` |
| 5 | Menu de manutenção de tabela (Analyze, Optimize, Check, Repair, Flush) | IGUAL | 1,0 | `utilities-table-maintenance-dark.png` |
| 6 | Filtro rápido de busca na árvore do Explorer | PARCIAL | 0,5 | `document/evidence/ui/ui-corrections-dark.png` (busca textual sem filtro avançado por máscara) |
| 7 | Interação de nós da árvore com canvas de documentos (drop de objetos) | PARCIAL | 0,5 | `er-diagram-explorer-drop-dark.png` (drop funciona no Diagrama; ainda manual no Query Builder) |

- **Subtotal Módulo 02:** 5,5 / 7,0 = **78,57%**

---

### 3.3. Módulo 03 — Table Designer & Fluxos de Criação de Objetos
*Peso Ponderado: 15 | Referência: NOTES.md (Seções 03 e 22)*

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
*Peso Ponderado: 15 | Referência: NOTES.md (Seções 04 e 21)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Monaco Editor com gramática dialetal MySQL/MariaDB | IGUAL | 1,0 | `sql-editor-dark.png` |
| 2 | Autocomplete por substring com painel lateral de colunas e engine | IGUAL | 1,0 | `04-sql-editor/editor-completion-dark.png` |
| 3 | Auto-uppercase de palavras-chave durante digitação contínua (on-the-fly) | IGUAL | 1,0 | `app/test/modules/editor-completion-substring.test.ts:30` |
| 4 | Rodapé com status de execução, linhas afetadas e posição Ln/Col | IGUAL | 1,0 | `sql-editor-dark.png` |
| 5 | Alternância direta entre Grade (Grid) e Texto nos resultados | IGUAL | 1,0 | `sql-editor-dark.png` |
| 6 | Modos de execução (F5, F8, Ctrl+Enter) e diálogo de erro Stop/Continue/Ignore | IGUAL | 1,0 | `app/test/modules/editor.test.ts` |
| 7 | Janela flutuante unificada de Find and Replace com regex e escopo | IGUAL | 1,0 | `find-replace-dark.png` |
| 8 | Diálogo Go To Line com validação de intervalo (1 - N) | IGUAL | 1,0 | `app/test/modules/keymap-parity.test.ts` |
| 9 | Comandos de refatoração avançada (Expand wildcards `*` qualificado por alias, Add Backticks, Rename F2) | PARCIAL | 0,5 | `GAPS-VARREDURA-VM.md:10` (formatador existe; Expand wildcards por alias e Add Backticks específicos estão na fila) |
| 10 | Marcadores de navegação Bookmarks (Ctrl+B,x) e dobras de código Outlining (Ctrl+M,x) | PARCIAL | 0,5 | `GAPS-VARREDURA-VM.md:12` (folding básico ativo no Monaco; faltam comandos de Bookmark dedicados) |

- **Subtotal Módulo 04:** 9,0 / 10,0 = **90,00%**

---

### 3.5. Módulo 06 — Schema Compare & Synchronization
*Peso Ponderado: 10 | Referência: NOTES.md (Seções 06 e 26)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Assistente de configuração Source/Target e aba de Opções DDL | IGUAL | 1,0 | `data-compare-source-dark.png`, `data-compare-options-dark.png` |
| 2 | Documento MDI com abas de 4 estados e Monaco diff editor lado a lado | IGUAL | 1,0 | `schema-compare-dark.png` |
| 3 | Assistente de sincronização com etapas de Saída, Opções, Scripts e Resumo | IGUAL | 1,0 | `schema-update-dark.png` |
| 4 | Comparação offline contra Scripts Folder e Snapshots .snap | IGUAL | 1,0 | `app/test/modules/schema-offline.test.ts` |
| 5 | Execução direta com recarga automática da comparação pós-sincronização | IGUAL | 1,0 | `app/test/modules/schema.integration.test.ts`, `NOTES.md:194` |
| 6 | Abertura automática de painel Error List com avisos e filtros do servidor | PARCIAL | 0,5 | `NOTES.md:193` (clone exibe log e resumo, sem dock automático do Error List) |
| 7 | Confirmação de segurança obrigatória em `DROP TABLE` (divergência virtuosa de proteção) | MELHOR | 1,0 [MELHOR] | `schema-update-dark.png`, `GAPS-VARREDURA-VM.md:26` |

- **Subtotal Módulo 06:** 6,5 / 7,0 = **92,86%**

---

### 3.6. Módulo 07 — Import & Export Wizard
*Peso Ponderado: 8 | Referência: NOTES.md (Seções 07 e 23)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Assistente de exportação organizado em 9 etapas sequenciais com stepper visual | IGUAL | 1,0 | `import-export-format-dark.png` |
| 2 | Formatos principais de exportação (CSV, Text, XLSX, XML, JSON, SQL) e compressão ZIP | IGUAL | 1,0 | `import-export-format-dark.png`, `app/test/modules/data-export-import.test.ts` |
| 3 | Exportação de linhas selecionadas da grade ativa | IGUAL | 1,0 | `app/test/modules/data-export-import.test.ts` |
| 4 | Criação de tabela nova no Import com inferência automática de tipos de dados | IGUAL | 1,0 | `app/test/modules/data-export-import.integration.test.ts` |
| 5 | Padrão técnico superior: criação de tabela em `utf8mb4` com PK (original gera `utf8mb3` obsoleto) | MELHOR | 1,0 [MELHOR] | `NOTES.md:180`, `GAPS-VARREDURA-VM.md:23` |
| 6 | Tela final "Finish" padronizada com resumo, contadores e ações pós-geração | PARCIAL | 0,5 | `GAPS-VARREDURA-VM.md:24` (exibe resumo e log; falta botão direto Open result file/folder) |
| 7 | Modos de importação em tabela existente (Append, Update, Repopulate) com transação | IGUAL | 1,0 | `app/test/modules/data-export-import.integration.test.ts` |
| 8 | Formatos legados proprietários (Access MDB, DBF, etc.) desabilitados | AUSENTE | 0,0 | `document/paridade/DIVERGENCIAS-ORIGINAL.md` |

- **Subtotal Módulo 07:** 6,5 / 8,0 = **81,25%**

---

### 3.7. Módulo 08 — Security Manager, Session Manager & Server Variables
*Peso Ponderado: 5 | Referência: NOTES.md (Seções 08 e 21)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Security Manager com árvore hierárquica por HOST e seção própria de Roles | IGUAL | 1,0 | `08-13-modules/security-manager-dark.png` |
| 2 | Abas completas de privilégios com preview de DDL mascarando hashes de senha | MELHOR | 1,0 [MELHOR] | `08-13-modules/security-manager-dark.png` |
| 3 | Session Manager com auto-refresh, query completa e bloqueio de encerramento de threads de sistema | IGUAL | 1,0 | `08-13-modules/session-manager-dark.png`, `app/test/modules/sessions.test.ts` |
| 4 | Server Variables com seletor System/Status, coluna Description e edição in-place | IGUAL | 1,0 | `08-13-modules/server-variables-dark.png` |
| 5 | Janela acoplável Properties (Ctrl+W,P) com categorização e ordenação alfabética | IGUAL | 1,0 | `object-viewer-dark.png`, `NOTES.md:168` |

- **Subtotal Módulo 08:** 5,0 / 5,0 = **100,00%**

---

### 3.8. Módulo 09 — Data Generator
*Peso Ponderado: 4 | Referência: NOTES.md (Seções 09 e 24)*

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
*Peso Ponderado: 4 | Referência: NOTES.md (Seções 10 e 21)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Canvas visual com cartões de tabelas e checkboxes para projeção de campos | IGUAL | 1,0 | `08-13-modules/query-builder-dark.png` |
| 2 | Abas de configuração inferior completas: Selection, Joins, Where, Group By, Having, Order By | IGUAL | 1,0 | `08-13-modules/query-builder-dark.png` |
| 3 | Geração de SQL formatado com cada projeção em linha separada e FROM na tabela filha | IGUAL | 1,0 | `app/test/modules/query-builder.test.ts` |
| 4 | Execução direta da consulta construída com visualização de resultados | IGUAL | 1,0 | `08-13-modules/query-builder-dark.png` |
| 5 | Traçado gráfico interativo livre de linhas de JOIN arrastando entre colunas no canvas | PARCIAL | 0,5 | `query-builder-joins-dark.png` (JOINs operam via aba Joins e diálogo estruturado, sem linha contínua arrastada no canvas) |

- **Subtotal Módulo 10:** 3,5 / 5,0 = **70,00%**

---

### 3.10. Módulo 11 — Database Diagram (ER Diagram)
*Peso Ponderado: 4 | Referência: NOTES.md (Seções 11 e 21)*

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

### 3.12. Módulo 13 — Stored Procedure Debugger
*Peso Ponderado: 5 | Referência: NOTES.md (Seção 13)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Implantação e execução sem falhas em MySQL 8.4 estrito (onde o original falha por VARCHAR) | MELHOR | 1,0 [MELHOR] | `app/test/modules/routine-debugger.integration.test.ts` |
| 2 | Diálogo Edit Parameters (direção IN/OUT e flag NULL) antes do início da sessão | IGUAL | 1,0 | `app/test/modules/routine-debugger.test.ts` |
| 3 | Interface de depuração com indicador de linha corrente e painéis Watches, Call Stack e Breakpoints | IGUAL | 1,0 | `08-13-modules/routine-debugger-dark.png` |
| 4 | Ações Step Over (F10), Step Into (F11), Step Out, Run e Break All | IGUAL | 1,0 | `app/test/modules/routine-debugger.test.ts` |
| 5 | Depuração interativa de Triggers disparados por operações DML | AUSENTE | 0,0 | `document/paridade/DIVERGENCIAS-ORIGINAL.md` |

- **Subtotal Módulo 13:** 4,0 / 5,0 = **80,00%**

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
*Peso Ponderado: 10 | Referência: NOTES.md (Seção 15)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Assistente em 3 passos estruturados com seleção de colunas chave e filtros de dados | IGUAL | 1,0 | `data-compare-source-dark.png`, `data-compare-mapping-dark.png` |
| 2 | Grade virtualizada de diferenças com pares por coluna, NULL em itálico e contadores Record N of M | IGUAL | 1,0 | `data-compare-dark.png` |
| 3 | Assistente de sincronização com execução transacional por tabela e script parametrizado | IGUAL | 1,0 | `app/test/modules/data-compare.integration.test.ts` |
| 4 | Mapeamento e comparação baseados em consultas SELECT customizadas arbitrárias | AUSENTE | 0,0 | `document/paridade/DIVERGENCIAS-ORIGINAL.md` |

- **Subtotal Módulo 15:** 3,0 / 4,0 = **75,00%**

---

### 3.15. Módulo 16 & 17 — Database Documenter & Task Scheduler
*Peso Ponderado: 3 | Referência: NOTES.md (Seções 16 e 17)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Database Documenter com árvore de objetos, seleção granular de colunas e editor de capa | IGUAL | 1,0 | `documenter-dark.png`, `documenter-cover-dark.png` |
| 2 | Geração em HTML, Markdown e PDF em diretório timestamp com abertura automática | IGUAL | 1,0 | `app/test/modules/documenter.test.ts` |
| 3 | Automação e execução em lote via linha de comando (CLI) | PARCIAL | 0,5 | `app/test/modules/data-export-import.test.ts` |
| 4 | Gerenciador visual de tarefas agendadas na interface (Tasks Explorer com calendário/lista) | AUSENTE | 0,0 | SEM EVIDÊNCIA |

- **Subtotal Módulo 16 & 17:** 2,5 / 4,0 = **62,50%**

---

### 3.16. Módulo 18 — Master-Detail, Data Report & Pivot Table
*Peso Ponderado: 4 | Referência: NOTES.md (Seções 18 e 27)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Master-Detail com detecção automática de relação por FK e aba Data com detalhe filtrado pela linha mestre | IGUAL | 1,0 | `NOTES.md:197`, `app/test/modules/data-report-pivot.test.ts` |
| 2 | Pivot Table com campos expansíveis, agregação SUM automática e linha "Grand Total" | IGUAL | 1,0 | `NOTES.md:198`, `report-pivot-dnd-dark.png` |
| 3 | Data Report: abertura direta de designer com bandas (ReportHeader, Detail) e janelas Data Source, Properties e Group & Sort | DIFERENTE | 0,0 | `NOTES.md:199`, `GAPS-VARREDURA-VM.md:30` (o original abre direto o designer com bandas .rdb; o clone utiliza o assistente Data Report Wizard) |
| 4 | Gráficos dinâmicos acoplados à tabela dinâmica (Pivot Chart integrado) | AUSENTE | 0,0 | SEM EVIDÊNCIA |

- **Subtotal Módulo 18:** 2,0 / 4,0 = **50,00%**

---

### 3.17. Módulo 19 — Utilitários e Ferramentas Extras
*Peso Ponderado: 5 | Referência: NOTES.md (Seções 19 e 25)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Find Object em DDL e dados com regex, filtro de tipos e exportação CSV | IGUAL | 1,0 | `utilities-find-object-dark.png` |
| 2 | Table Maintenance executando ANALYZE, OPTIMIZE, CHECK, REPAIR e CHECKSUM | IGUAL | 1,0 | `utilities-table-maintenance-dark.png` |
| 3 | Batch SQL Formatter com modos Files/Directories e backup `.bak` | IGUAL | 1,0 | `utilities-sql-formatter-dark.png` |
| 4 | Snippets Manager com pastas, atalhos rápidos e expansão de placeholders | IGUAL | 1,0 | `utilities-snippets-dark.png` |
| 5 | Execute Large Script em streaming de blocos de 64 KiB com diálogo Stop/Continue/Ignore | IGUAL | 1,0 | `utilities-large-script-dark.png` |
| 6 | Copy Databases com seleção de múltiplos bancos de usuário, progresso e tempo decorrido | IGUAL | 1,0 | `copy-databases-dark.png`, `NOTES.md:189` |
| 7 | Backup & Restore Wizard com opções de dump granulares (separação Structure/Data, checkboxes de sintaxe) | PARCIAL | 0,5 | `GAPS-VARREDURA-VM.md:27` (backup/restore funcionais, sem a árvore formal de opções granulares da referência) |

- **Subtotal Módulo 19:** 6,5 / 7,0 = **92,86%**

---

### 3.18. Módulo 20 — Source Control & Project Explorer
*Peso Ponderado: 6 | Referência: NOTES.md (Seção 20)*

| # | Item Verificável | Avaliação | Nota | Evidência no Clone |
|---|---|---|:---:|---|
| 1 | Assistente Link to Source Control em 3 passos com modelos Dedicated/Shared e Git | IGUAL | 1,0 | `source-control-link-wizard-dark.png` |
| 2 | Project Explorer lateral auto-ocultável (Ctrl+W,J) com categorias por tipo e status Git | IGUAL | 1,0 | `source-control-project-explorer-dark.png` |
| 3 | Operações Git: Commit, Diff Monaco, Histórico e Get Latest revisável | IGUAL | 1,0 | `app/test/modules/source-control.test.ts` |
| 4 | Controle legado (TFS/SVN/Mercurial) | AUSENTE | 0,0 | `app/test/modules/source-control.test.ts` |

- **Subtotal Módulo 20:** 3,0 / 4,0 = **75,00%**

---

## 4. Tabela-Resumo e Comparativo das Três Rodadas

$$\text{Fidelidade Global Ponderada (Rodada 3)} = \frac{\sum (\text{Nota Módulo} \times \text{Peso})}{\sum \text{Pesos}} = \frac{10961,69}{131} = \mathbf{83,68\%}$$

| Módulo | Nome do Componente | Peso | % R1 | % R2 | % R3 (Calibrada) | Variação (R3 - R2) | Motivo da Calibração R3 |
|:---:|---|:---:|:---:|:---:|:---:|:---:|---|
| **00** | Shell, Menus e Janelas | 6 | 93,75% | 93,75% | **88,89%** | -4,86% | Varredura de menus de abas e docking |
| **01** | Database Connection Properties | 10 | 88,89% | 88,89% | **88,89%** | 0,00% | Estável |
| **02** | Database Explorer & Menus | 10 | 68,75% | 87,50% | **78,57%** | -8,93% | Varredura de menus por nível de nó (servidor/db/pasta) |
| **03** | Table Designer & Criação | 15 | 88,89% | 88,89% | **88,89%** | 0,00% | Novos fluxos de criação New DB/Table/Proc validados |
| **04** | Editor SQL, Refatoração & Busca | 15 | 88,89% | 100,00% | **90,00%** | -10,00% | Exposição dos comandos de refatoração avançada na fila |
| **06** | Schema Compare & Synchronization | 10 | 88,89% | 100,00% | **92,86%** | -7,14% | Falta acoplamento automático da dock Error List |
| **07** | Import & Export Wizard | 8 | 77,78% | 88,89% | **81,25%** | -7,64% | Detalhes da tela Finish padronizada com ações de arquivo |
| **08** | Security, Sessions & Properties | 5 | 100,00% | 100,00% | **100,00%** | 0,00% | Paridade plena confirmada |
| **09** | Data Generator | 4 | 68,75% | 93,75% | **83,33%** | -10,42% | Alinhamento com opções avançadas do Population Wizard |
| **10** | Query Builder | 4 | 62,50% | 68,75% | **70,00%** | +1,25% | Rigor no traçado de JOIN por formulário vs canvas livre |
| **11** | Database Diagram (ER) | 4 | 75,00% | 87,50% | **66,67%** | -20,83% | Ausência de Diagram Overview e Virtual FKs constatada |
| **12** | Query Profiler | 4 | 87,50% | 87,50% | **90,00%** | +2,50% | Plan Diagram e Session Statistics validados |
| **13** | Stored Procedure Debugger | 5 | 81,25% | 81,25% | **80,00%** | -1,25% | Estável (superioridade técnica em MySQL 8.4 mantida) |
| **14** | Options & Settings | 3 | 87,50% | 87,50% | **100,00%** | +12,50% | Categorias e Restore Defaults plenamente alinhados |
| **15** | Data Compare & Synchronization | 10 | 83,33% | 88,89% | **75,00%** | -13,89% | Ausência de comparação por Custom Queries arbitrárias |
| **16/17** | Documenter & Task Scheduler | 3 | 62,50% | 68,75% | **62,50%** | -6,25% | Ausência de Tasks Explorer visual integrado |
| **18** | Master-Detail, Report & Pivot | 4 | 62,50% | 62,50% | **50,00%** | -12,50% | Descoberta da abertura direta do Report Designer com bandas |
| **19** | Utilities & Ferramentas Extras | 5 | 94,44% | 94,44% | **92,86%** | -1,58% | Estável |
| **20** | Source Control & Project Explorer | 6 | — | 87,50% | **75,00%** | -12,50% | Calibração de escopo Git moderno vs sistemas legados |
| **TOTAL** | — | **131** | — | — | — | — | — |

- **Média Simples (não ponderada):** **81,83%** (R1: 80,58% | R2: 86,17%)  
- **Média Global Ponderada:** **83,68%** (R1: 79,23% | R2: 90,32%)

> [!NOTE]
> A calibração na Rodada 3 (**83,68%**) reflete a postura mais rigorosa solicitada pela liderança arquitetural após a varredura aprofundada na VM (seções 21 a 27 do NOTES.md). As lacunas descobertas em refatoração no editor, menus de nós no Explorer e no designer de relatórios com bandas foram contabilizadas com estrita honestidade técnica.

---

## 5. Top 15 Maiores Gaps Priorizados (Fila de Trabalho Atualizada)

| # | Área / Módulo | O que o original possui e deve ser implementado no clone | Prioridade | Esforço (P/M/G) |
|:---:|---|---|:---:|:---:|
| 1 | **18 Report** | Abertura direta do **Report Designer com bandas** (ReportHeader, Detail) em vez de assistente simples, com Data Source e Properties | **A** | **G** |
| 2 | **04 Editor** | Comandos de refatoração: **Expand wildcards** (`*` → colunas qualificadas por alias), **Add Backticks** a identificadores e **Select Current Statement** | **A** | **M** |
| 3 | **02 Explorer** | Menus contextuais por nível de nó: Servidor (*Create Connection Like*), Database e Pastas (*Filter...*, *Show Details*) | **A** | **M** |
| 4 | **10 Query Builder**| Traçado gráfico livre de linhas de junção JOIN conectando coluna a coluna no canvas e subconsultas visuais em abas | **A** | **G** |
| 5 | **16/17 Tasks** | Gerenciador visual de tarefas agendadas integrado na interface do usuário (**Tasks Explorer** com calendário e lista) | **B** | **M** |
| 6 | **15 Data Compare** | Mapeamento e comparação de dados baseados em consultas SQL customizadas arbitrárias (*Custom Queries*) | **B** | **M** |
| 7 | **07 Import** | Tela final de assistentes padronizada com ações *Open result file*, *Open result folder* e *Import more* | **A** | **P** |
| 8 | **11 ER Diagram** | Janela acoplável **Diagram Overview** (miniatura navegável) e suporte a *Virtual Foreign Keys* | **B** | **M** |
| 9 | **19 Utilities (Backup)**| Opções de dump granulares (*Structure* e *Data* separados, árvore por tipo de objeto e checkboxes de sintaxe de dump) | **B** | **M** |
| 10 | **03 Table Designer**| Modo de visualização **Card View** (exibição de registro individual em formulário vertical na grade de dados) | **B** | **M** |
| 11 | **00 Shell (Abas)** | Menu de contexto de abas de documentos: *Close All But This/Pinned*, *Copy Full Path*, *Pin Tab* e grupos de abas | **B** | **G** |
| 12 | **13 Debugger** | Depuração interativa de Triggers disparados por operações DML e avaliação de expressões dinâmicas em Watches | **B** | **G** |
| 13 | **04 Editor** | Marcadores de navegação *Bookmarks* (Ctrl+B,x) e atalhos completos de *Outlining* (Ctrl+M,x) | **B** | **M** |
| 14 | **18 Pivot Table**| Gráficos dinâmicos integrados vinculados à tabela dinâmica (**Pivot Chart** com barras, pizza e linhas) | **B** | **G** |
| 15 | **00 Shell** | Sistema de ancoragem flutuante livre de painéis com guias direcionais em cruz (*docking guides*) | **B** | **G** |
