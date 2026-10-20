# Relatório de Revisão de Fidelidade UX/UI das Telas Implementadas

**Projeto:** dbForgeLinux (Alternativa Linux ao dbForge Studio for MySQL)  
**Autor:** Prisma (UX/UI Designer)  
**Data:** 20/10/2026 (Atualizado após correções de UI da Bigorna)  
**Status:** Não commitado (working tree)  
**Escopo:** Reavaliação heurística e auditoria de fidelidade com base nas evidências visuais `document/evidence/ui/ui-corrections-{light,dark}.png`, 51 screenshots em `document/evidence/ui/*.png`, código do renderer (`App.tsx`, `PanelDialog.tsx`, `ObjectEditor.tsx`, `styles.css`) contra as especificações UX (`document/ux/01-shell.md` a `19-configuracoes.md`).

---

## 1. Resumo Executivo da Reconferência

Após o pacote de correções estruturais aplicado pela Bigorna:
- **MDI Document Tabs Efetivado:** As principais ferramentas analíticas e de modelagem (Query Builder, Diagrama ER, Schema Compare, Data Compare, Data Report/Pivot, Routine Debugger, Profiler e Data Generator) deixaram de ser modais bloqueantes e agora abrem como abas de documento MDI na workbench com redimensionamento total e ciclo de vida independente.
- **AI Assistant Acoplado (Dock Lateral):** Foi convertido em um painel dock lateral direito (`.right-dock`), liberando a visualização e edição concomitante do SQL Editor e do Database Explorer.
- **Correção Cromática do Monaco:** Em tema claro (`LIGHT`), o editor de procedimentos agora renderiza com fundo branco nativo (`'vs'`), eliminando o contraste violento com o restante do ambiente.
- **Acessibilidade e Foco em Diálogos:** O foco inicial de modais agora prioriza o primeiro controle de entrada de dados, cessando o fechamento acidental ao teclar `Enter`/`Espaço`.
- **Internacionalização Unificada:** Start Page, Database Explorer, menus, cabeçalhos e status bar foram integrados ao catálogo dinâmico `useI18n()`, operando de forma consistente em en e pt-BR.

---

## 2. Status dos 10 Problemas Críticos Auditados

Abaixo está o veredito para cada finding da auditoria anterior, classificado como **RESOLVIDO**, **PARCIAL** ou **ABERTO**, com a evidência técnica correspondente:

### [RESOLVIDO] 1. Módulos MDI implementados como Modais Flutuantes Bloqueantes
- **CLASSIFICAÇÃO:** **RESOLVIDO**
- **LOCATION:** `app/src/renderer/src/ui/panels/registry.ts`, `App.tsx`, `styles.css`
- **EXPECTED:** Ferramentas essenciais (`.query`, `.dbd`, `.scomp`, `.dcomp`, `.piv`, `.dgen`, debugger) devem abrir como abas MDI completas.
- **ACTUAL:** Os 8 submódulos foram registrados com `presentation: 'document'`. Ao serem acionados, abrem como abas de documento no topo da workbench (`.tool-document`), coexistindo com a Start Page e documentos SQL, sem backdrop escuro e sem perda de contexto ao teclar ESC.
- **EVIDENCE:** `document/evidence/ui/ui-corrections-light.png` e `ui-corrections-dark.png` (aba `Query Builder 1 ×` integrada à workbench); `registry.ts` e `App.tsx`.

---

### [RESOLVIDO] 2. AI Assistant como Modal Central Bloqueante
- **CLASSIFICAÇÃO:** **RESOLVIDO**
- **LOCATION:** `app/src/renderer/src/ui/panels/ai-assistant/Panel.tsx`, `App.tsx`, `styles.css`
- **EXPECTED:** Dock lateral direito acoplável (`17-ai-assistant.md` §1) para permitir consulta de IA paralela ao código.
- **ACTUAL:** Implementado como `<aside className="right-dock">` fixado à direita (`top: 74px; right: 0; bottom: 28px; width: min(420px, 42vw)`), aplicando margem dinâmica à workbench (`.app-shell:has(.right-dock) .workbench { margin-right: ... }`).
- **EVIDENCE:** `document/evidence/ui/ui-corrections-light.png` e `ui-corrections-dark.png` exibindo o painel AI Assistant acoplado à direita lado a lado com o Query Builder.

---

### [RESOLVIDO] 3. Inversão de Tema e Quebra de Contraste no Editor de Stored Procedures
- **CLASSIFICAÇÃO:** **RESOLVIDO**
- **LOCATION:** `app/src/renderer/src/ui/components/ObjectEditor.tsx`
- **EXPECTED:** Fundo branco (`--bg-surface: #ffffff`) e syntax highlighting claro quando o tema for `LIGHT` (`01-shell.md` §9, `05-editores-objetos.md` §7).
- **ACTUAL:** O componente agora avalia explicitamente `['dark', 'high-contrast'].includes(document.documentElement.dataset.theme ?? '') ? 'vs-dark' : 'vs'`. Em tema claro, o Monaco carrega a paleta clara `'vs'`.
- **EVIDENCE:** `app/src/renderer/src/ui/components/ObjectEditor.tsx`.

---

### [RESOLVIDO] 4. Colisão Física e Sobreposição do Botão Fechar `[×]` sobre Ações do Cabeçalho
- **CLASSIFICAÇÃO:** **RESOLVIDO**
- **LOCATION:** `app/src/renderer/src/ui/styles.css` (`.panel-dialog > .tool-panel`)
- **EXPECTED:** Margem de segurança no canto superior direito para o botão `[×]`, sem cobrir botões de ação (`01-shell.md`).
- **ACTUAL:** Adicionado `.panel-dialog > .tool-panel { padding-top: 48px; }`, rebaixando o conteúdo dos diálogos modais remanescentes e prevenindo sobreposição com botões como `Export...` e `Analyze Code`. Ferramentas complexas com colisões críticas migraram para MDI/Dock.
- **EVIDENCE:** `app/src/renderer/src/ui/styles.css`.

---

### [RESOLVIDO] 5. Acessibilidade: Trap de Foco Inicial Compulsório no Botão Fechar (`×`)
- **CLASSIFICAÇÃO:** **RESOLVIDO**
- **LOCATION:** `app/src/renderer/src/ui/components/PanelDialog.tsx`
- **EXPECTED:** Foco inicial direcionado ao primeiro elemento interativo de entrada (WAI-ARIA Dialog).
- **ACTUAL:** O hook `useEffect` agora consulta `dialogRef.current?.querySelector('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)...')` e foca no controle antes de recorrer ao botão de fechamento.
- **EVIDENCE:** `app/src/renderer/src/ui/components/PanelDialog.tsx`.

---

### [PARCIAL] 6. Duplicação Vertical Excessiva de Painéis Inferiores no SQL Editor
- **CLASSIFICAÇÃO:** **PARCIAL**
- **LOCATION:** `app/src/renderer/src/ui/App.tsx`, `ResultGrid.tsx`
- **EXPECTED:** Rodapé inferior unificado ou colapso inteligente de docks para maximizar a área de código (`01-shell.md` §2, `03-explorer-editor.md` §2).
- **ACTUAL:** Os novos documentos MDI utilizam 100% da altura útil sem painel de resultados do editor. Entretanto, ao editar um arquivo `.sql` comum, caso o dock global de Output/Errors esteja expandido, continuam existindo dois conjuntos de abas verticais empilhadas (`Result 1` vs `Output`).
- **EVIDENCE:** `App.tsx` (coexistência da seção do documento e do dock inferior em abas SQL).

---

### [RESOLVIDO] 7. Inconsistência Linguística e Mistura de Idiomas (pt-BR / en)
- **CLASSIFICAÇÃO:** **RESOLVIDO** (Na camada de UI) / **PARCIAL** (Em mensagens de regras de backend)
- **LOCATION:** `StartPage.tsx`, `App.tsx`, `ptBrGenerated.ts`, `specMessages.ts`, `panelMessages.ts`
- **EXPECTED:** Todos os textos da tela correspondendo estritamente ao idioma selecionado (`19-configuracoes.md` §4).
- **ACTUAL:** A interface shell, Start Page, Database Explorer, menus, toolbars e status bar agora utilizam `useI18n()`. Conforme visível em `ui-corrections-light.png`, no modo inglês a interface é totalmente limpa ("No connections", "Add a connection to get started.", "No active connection", etc.). Restam apenas mensagens diagnósticas pré-definidas no motor do Code Analysis (`SQL001` a `SQL007`) que possuem strings literais em português no módulo principal.
- **EVIDENCE:** `document/evidence/ui/ui-corrections-light.png`, `ui-corrections-dark.png`, `StartPage.tsx`.

---

### [RESOLVIDO] 8. Telas em Estado "Esqueleto Vazio" (Data Generator e Query Profiler)
- **CLASSIFICAÇÃO:** **RESOLVIDO**
- **LOCATION:** `data-generator/Panel.tsx`, `profiler/Panel.tsx`
- **EXPECTED:** Estados vazios informativos com instruções contextuais e navegação guiada (`11-query-profiler.md` §5, `12-data-generator.md` §5).
- **ACTUAL:** Implementados blocos `<div className="tool-empty-state">` estilizados com títulos, orientações e atalhos i18n (`t('dg.empty')`, `t('prof.empty')`, `t('prof.history.empty')`), além de controles completos de configuração de geração e abas analíticas (Profile, Plan, Session Statistics).
- **EVIDENCE:** `app/src/renderer/src/ui/panels/data-generator/Panel.tsx`, `app/src/renderer/src/ui/panels/profiler/Panel.tsx`.

---

### [ABERTO] 9. Query Builder sem Canvas Gráfico de Relacionamentos e Joins Visuais
- **CLASSIFICAÇÃO:** **ABERTO**
- **LOCATION:** `app/src/renderer/src/ui/panels/query-builder/Panel.tsx`
- **EXPECTED:** Diagrama interativo desenhando linhas SVG conectando colunas das tabelas com indicação de cardinalidade e edição por duplo clique na linha (`09-query-builder.md` §3).
- **ACTUAL:** As tabelas continuam sendo caixas absolutas sem linhas visuais de interligação entre colunas. A definição de joins permanece confinada a selects e tags de texto horizontais na barra inferior.
- **EVIDENCE:** `app/src/renderer/src/ui/panels/query-builder/Panel.tsx`; ausência de renderizador SVG de arestas entre tabelas.

---

### [RESOLVIDO] 10. Duplicação de Formatos e Falta de Títulos em Modais
- **CLASSIFICAÇÃO:** **RESOLVIDO**
- **LOCATION:** `import-export/formats.ts`, `service-control/Panel.tsx`, `code-analysis/Panel.tsx`
- **EXPECTED:** Lista de formatos unívocos no assistente de dados (`06-import-export.md` §2) e cabeçalhos semânticos em todos os diálogos.
- **ACTUAL:** `formats.ts` padronizou os formatos sem duplicatas de XML; os painéis receberam títulos de seção semânticos com internacionalização.
- **EVIDENCE:** `app/src/renderer/src/ui/panels/import-export/formats.ts`, `service-control/Panel.tsx`, `code-analysis/Panel.tsx`.

---

## 3. O Que Sobrou (Pendências Priorizadas)

Com a resolução dos 2 BLOCKERs de arquitetura (MDI e AI Dock) e da maioria das falhas de contraste, foco e i18n, restam as seguintes pendências de fidelidade UX, organizadas por prioridade decrescente:

### [PRIORIDADE 1 - HIGH] Query Builder: Traçado Gráfico de Joins no Canvas
- **MÓDULO:** UX 09 — Query Builder (`09-query-builder.md` §3)
- **PROBLEMA:** O canvas posiciona cartões de tabela, mas não renderiza arestas gráficas (linhas SVG ortogonais ou Bezier) conectando a coluna de origem à de destino. A criação de joins por arrastar coluna para coluna e a inspeção visual imediata das relações não funcionam graficamente.
- **AÇÃO NECESSÁRIA:** Implementar camada `<svg className="qb-links">` entre os cartões com cálculo de coordenadas das portas de saída/entrada das colunas e renderização de pontas de seta / cardinalidade.

### [PRIORIDADE 2 - HIGH] Diagrama ER: Roteamento Ortogonal com Crow's Foot
- **MÓDULO:** UX 10 — Diagrama ER (`10-diagrama-er.md` §3)
- **PROBLEMA:** Os relacionamentos de chave estrangeira são traçados como linhas retas horizontais que cortam o centro das caixas das tabelas, sem conectores ortogonais nem marcadores de cardinalidade pé-de-galinha (1:1, 1:N).
- **AÇÃO NECESSÁRIA:** Adicionar algoritmo simples de rotas manhattan (ângulos retos) contornando os cartões de tabela e marcadores SVG `marker-end="url(#crowsfoot)"`.

### [PRIORIDADE 3 - MEDIUM] Data Compare: Grade de Dados Comparativa Tabular
- **MÓDULO:** UX 07 — Schema/Data Compare (`07-schema-compare.md` §3)
- **PROBLEMA:** O Data Compare agora abre como aba MDI, mas exibe apenas contadores sumários em texto puro, sem a grade de dados comparando células lado a lado com destaques de cores para registros divergentes, exclusivos da origem e exclusivos do destino.
- **AÇÃO NECESSÁRIA:** Reutilizar o componente `ResultGrid` com suporte a colorização de células divergentes e abas de filtro de diferenças.

### [PRIORIDADE 4 - MEDIUM] SQL Editor: Otimização de Espaço do Rodapé Duplo
- **MÓDULO:** UX 03 — Explorer e Editor (`03-explorer-editor.md` §2)
- **PROBLEMA:** Quando o usuário executa consultas, as abas de resultado do documento e o dock de Output da aplicação continuam consumindo espaço vertical cumulativo.
- **AÇÃO NECESSÁRIA:** Recolher automaticamente o dock de Output quando os resultados da consulta forem exibidos com sucesso, ou unificar os logs de execução na aba "Messages" do próprio documento SQL.

### [PRIORIDADE 5 - LOW] Code Analysis: Internacionalização das Regras no Backend
- **MÓDULO:** UX 18 — Ferramentas Extras (`18-ferramentas-extras.md` §1)
- **PROBLEMA:** As mensagens de recomendação das regras de análise estática (`SQL001` a `SQL007`) estão fixas em português no arquivo `app/src/modules/code-analysis/index.ts`.
- **AÇÃO NECESSÁRIA:** Mapear chaves de tradução no objeto de retorno ou injetar o locale nas mensagens de diagnóstico.

### [PRIORIDADE 6 - LOW] Table Designer: Estilização Compacta de Células
- **MÓDULO:** UX 04 — Table Designer (`04-editor-tabela.md` §2)
- **PROBLEMA:** A edição de colunas ainda utiliza inputs com bordas pesadas em cada célula, diferenciando-se da experiência desktop nativa de grade de dados.
- **AÇÃO NECESSÁRIA:** Aplicar classe de célula editável limpa (sem borda visível até que o foco/edição seja ativado).

---

## 4. Conclusão da Reavaliação

O esforço de correção da Bigorna eliminou com êxito os impedimentos arquiteturais mais graves apontados na primeira revisão. O dbForgeLinux agora opera sob o paradigma MDI genuíno, com assistente de IA acoplado lateralmente, foco acessível, tema Monaco coerente e suporte consistente a internacionalização. As pendências remanescentes concentram-se no enriquecimento gráfico vetorial (linhas de join no Query Builder e ER Diagram) e na inclusão da grade de dados no Data Compare.
