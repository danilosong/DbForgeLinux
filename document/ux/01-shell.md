# UX 01 — Shell da aplicação

Stack alvo (ADR-001): Electron + React + Monaco. Esta spec descreve comportamento/visual; sem código. Visual inspirado no dbForge (DevartBlue), apenas descrito, sem reutilizar assets protegidos (ícones/skins `.vsf` não são copiados).

**Fidelidade REA & Observação VM:**
- **[C] Shell e Layout Inicial:** janela principal com Database Explorer à esquerda, Start Page com categorias à direita, barra de menus e toolbar superior observadas em `re/original-observation/00-shell/first-run.png` e `re/original-observation/00-shell/activated.png`.
- **[C] Barra de Menus Completa:** todos os 10 menus principais do shell observados em `re/original-observation/05-menus/file.png`, `re/original-observation/05-menus/edit.png`, `re/original-observation/05-menus/view.png`, `re/original-observation/05-menus/database.png`, `re/original-observation/05-menus/sql.png`, `re/original-observation/05-menus/comparison.png`, `re/original-observation/05-menus/debug.png`, `re/original-observation/05-menus/tools.png`, `re/original-observation/05-menus/window.png`, `re/original-observation/05-menus/help.png`; e estados com editor ativo em `re/original-observation/12-start-menus-erros/12-menu-file-1809.png`, `re/original-observation/12-start-menus-erros/13-menu-edit-1809.png`, `re/original-observation/12-start-menus-erros/14-menu-view-1809.png`, `re/original-observation/12-start-menus-erros/15-menu-window-1810.png`, `re/original-observation/12-start-menus-erros/16-menu-help-1810.png`.
- **[C] Start Page Categorizada:** abas de categoria e cartões de ação observados em `re/original-observation/12-start-menus-erros/01-start-page-1807.png` (Data Pump), `re/original-observation/12-start-menus-erros/02-start-sql-development-1808.png` (SQL Development), `re/original-observation/12-start-menus-erros/03-start-database-design-1808.png` (Database Design), `re/original-observation/12-start-menus-erros/04-start-more-menu-1808.png` e `re/original-observation/12-start-menus-erros/06-overflow-reopened-1808.png` (overflow de categorias "..."), `re/original-observation/12-start-menus-erros/05-start-database-sync-1808.png` (Database Sync), `re/original-observation/12-start-menus-erros/07-start-administration-1808.png` (Administration), `re/original-observation/12-start-menus-erros/08-start-data-analysis-1808.png` (Data Analysis).
- **[C] Painel Error List e Status Bar:** sublinhado de erro em tempo real, painel Error List aberto com contadores e colunas Description, Location, Line, Column observados em `re/original-observation/12-start-menus-erros/09-error-query-typed-1809.png`, `re/original-observation/12-start-menus-erros/10-error-result-1809.png` (erro 1146) e `re/original-observation/12-start-menus-erros/11-syntax-error-1809.png` (erro 1064). Status bar com status de execução, tempo ("00:00:00.346") e identificador do servidor/usuário/banco ("10.0.2.2 (8.4) obs sample").
- **[C] Diálogo About:** Help > About... em `re/original-observation/12-start-menus-erros/17-about-1810.png` e retorno ao shell em `re/original-observation/12-start-menus-erros/18-after-about-1810.png`.

Legenda: **[C]** = confirmado por evidência visual da VM (`re/original-observation/...`) ou REA (`re/ui-strings/ui-text.txt`, mapa de atalhos `REA shortcuts`); **[I]** = inferido/decisão de design sem evidência. Itens sem marca seguem como [I] salvo indicação.

## 1. Layout geral (janela principal, mín. 1024x640, padrão 1440x900) [C: re/original-observation/00-shell/first-run.png]

```
+--------------------------------------------------------------------------+
| Menu bar: File Edit View Database SQL Data Tools Window Help             |  24px
+--------------------------------------------------------------------------+
| Toolbar Standard | Toolbar SQL Editor (contextual)                       |  32px
+-------------------+------------------------------------------------------+
| Database Explorer | Tab bar: [Start Page][SQL 1 *][customers (data)] [v] |  30px
| (dock esquerdo,   +------------------------------------------------------+
|  largura 280,     |                                                      |
|  min 200, max 50%)|   Área de documentos (editor / editor de objeto)     |
|                   |                                                      |
| [filtro......  x] |                                                      |
| tree...           +==== splitter horizontal (arrastável) ================+
|                   | Painel inferior: [Output][Error List][Find Results]  |
|                   |  altura 200, min 80, colapsável                      |
+-------------------+------------------------------------------------------+
| Status bar: conexão | db | Ln 1, Col 1 | UTF-8 | LF | tempo | linhas | ● |  24px
+--------------------------------------------------------------------------+
```

Regiões: MenuBar, ToolBars, DockLeft (Database Explorer; também Properties/Projects como abas empilhadas), DocumentArea, DockBottom, StatusBar. Painéis podem ser: fixados (pin), auto-ocultar (borda com aba vertical), flutuantes (janela separada) — v1 exige fixado + auto-ocultar; flutuante é P2.

## 2. Barra de menus [C: re/original-observation/05-menus/ e re/original-observation/12-start-menus-erros/]

Barra de menus superior com os 10 menus canônicos do dbForge observados na VM de referência:

| Menu | Evidência VM | Itens observados / especificados |
|---|---|---|
| File | `re/original-observation/05-menus/file.png`, `re/original-observation/12-start-menus-erros/12-menu-file-1809.png` | New > SQL Document (Ctrl+N) / Database Connection (REA shortcuts: Ctrl+D, N [C]; Ctrl+Shift+N = New Project no original, aqui mantido para conexão [I]); Open File… (Ctrl+O [C]); Close (Ctrl+F4 no original [C: 12-menu-file-1809.png], Ctrl+W Linux [I]); Open Project… (Ctrl+Shift+O [C]); Close Project; Save (Ctrl+S [C]); Save As… [C]; Save All (Ctrl+Shift+S [C]); Print… (Ctrl+P [C]); Recent Files >; Recent Projects >; Exit (Ctrl+Q [I]) |
| Edit | `re/original-observation/05-menus/edit.png`, `re/original-observation/12-start-menus-erros/13-menu-edit-1809.png` | Undo (Ctrl+Z [C]), Redo (Ctrl+Y [C] / Ctrl+Shift+Z [I]), Cut (Ctrl+X [C]), Copy (Ctrl+C [C]), Paste (Ctrl+V [C]), Duplicate (Ctrl+D [C]), Delete [C], Select All (Ctrl+A [C]), Go To... (Ctrl+G [C]), Find and Replace > [C], Advanced > [C], Bookmarks > [C], Outlining > [C], Code Completion > [C], Format Document (Ctrl+K, Ctrl+D [C]) |
| View | `re/original-observation/05-menus/view.png`, `re/original-observation/12-start-menus-erros/14-menu-view-1809.png` | Query Builder [C], Text [C], Data [C], Profiler [C], Pivot Table [C], Start Page (Ctrl+W,S [C]), Database Explorer (Ctrl+W,L [C] / REA shortcuts: Ctrl+Alt+L [C]), Project Explorer (Ctrl+W,J [C]), Object Viewer [C], AI Assistant Chat (Ctrl+\,C [C]), Schema View (Ctrl+W,C [C]), Data Viewer (Ctrl+W,R [C]), Document Outline (Ctrl+W,U [C]), Code Snippets (Ctrl+W,T [C]), Output (Ctrl+W,O [C] / Ctrl+Alt+O [C]), Error List (Ctrl+W,E [C] / Ctrl+Alt+E [C]), Properties (Ctrl+W,P [C] / F4 [C]), Other Windows > [C], Toolbars > [C] |
| Database | `re/original-observation/05-menus/database.png` | New Connection…, Connect, Disconnect, Edit Connection (F2 na árvore), Refresh (F5), Set as Active Database |
| SQL | `re/original-observation/05-menus/sql.png` | New SQL (Ctrl+N), Execute (F5 / Ctrl+Enter), Execute Current Statement [C] (REA shortcuts: F8 [C]), Execute Selection [C] (Ctrl+F8), Execute To Cursor [C] (Ctrl+Shift+F10 [C]), Run To Cursor (Ctrl+F10 [C]), Stop/Cancel (REA shortcuts: Alt+Pause [C]; Shift+F5 [I]), Display Estimated Execution Plan (Ctrl+L [C]), Toggle Results (Ctrl+Alt+Down) |
| Comparison | `re/original-observation/05-menus/comparison.png`, `re/original-observation/p2-04-schema-compare/03-menu-comparison-1917.png` | New Schema Comparison… [C], New Data Comparison… [C], Edit Comparison… [C], Objects Filter (Ctrl+L [C: p2-04/22]), Refresh (F5 [C]), Stop Execution [C], View Schema Update Script [C], Generate Comparison Report… [C], Synchronize… (F8 [C]) |
| Debug | `re/original-observation/05-menus/debug.png` | Start Debugging, Step Into, Step Over, Step Out, Toggle Breakpoint |
| Tools | `re/original-observation/05-menus/tools.png` | Options… (Ctrl+, [I]), Connection Manager… [C], Data Pump >, Generate Data… |
| Window | `re/original-observation/05-menus/window.png`, `re/original-observation/12-start-menus-erros/15-menu-window-1810.png` | Float [C], Pin Tab [C], New Horizontal Tab Group [C], New Vertical Tab Group [C], Close All Documents [C], Reset Window Layout [C], lista numerada de abas abertas [C: 15-menu-window-1810.png], Windows… [C] |
| Help | `re/original-observation/05-menus/help.png`, `re/original-observation/12-start-menus-erros/16-menu-help-1810.png` | Contents… (F1 [C]), Deactivate…, Getting Started, Demos and Video Tutorials, Leave Feedback…, Suggest a Feature…, Check for Updates…, About… [C: 17-about-1810.png] |

Itens indisponíveis ficam **desabilitados** (nunca ocultos) com tooltip do motivo ("Requer conexão ativa"). Itens futuros (Schema Compare, Diagram…) aparecem desabilitados com marca "Em breve" apenas se a matriz de paridade os listar; caso contrário omitidos.

Adaptação Linux: mnemônicos via `&` (Alt+F abre File). Em GNOME/KDE com global menu o menu é exportado ao desktop quando suportado; senão menu próprio na janela. `Ctrl+Q` encerra (convenção Linux); `Alt+F4` entregue ao WM.

## 3. Toolbars

Altura 32px, botões 28x28 (ícone 16px), separadores 1px, tooltip após 500ms com nome + atalho. Ícones: conjunto próprio/open source (ex.: Lucide/Codicons), traço 1.5px, monocromático (colorido só para Execute=verde, Stop=vermelho).

**Standard:** New SQL | Open | Save | Save All | sep | New Connection | Connect/Disconnect | Refresh | sep | Undo | Redo.
**SQL Editor (aparece quando documento SQL ativo):** [Seletor de conexão ▾] [Seletor de database ▾] | Execute ▶ | Execute Selection | Stop ■ (desabilitado fora de execução) | sep | Explain | Format | Comment | Uncomment | sep | Toggle Results.

Seletores de conexão/database: combo com pesquisa; mostra bolinha de status (cinza=desconectado, verde=conectado, âmbar=conectando, vermelho=erro) e cor da conexão (rótulo de ambiente, ver 02). Overflow: botões que não cabem vão para menu "»".

## 4. Database Explorer (dock esquerdo)

Resumo (detalhe em 03): cabeçalho "Database Explorer" + botões (New Connection, Refresh, Collapse All, Filtro) ; campo de busca; árvore. Largura persistida. Duplo clique no cabeçalho alterna auto-ocultar.

## 5. Documentos em abas

- Tipos: SQL Document, Table Data, Object Editor (P1), Start Page [C: `re/original-observation/12-start-menus-erros/01-start-page-1807.png`], Connection Properties (modal, não aba).
- Aba: [ícone tipo] título [•modificado] [x fechar]. Título SQL: `SQL 1` → após salvar nome do arquivo; tooltip com caminho completo e conexão. Rótulo de cor da conexão como faixa de 2px no topo da aba.
- Alterações não salvas: asterisco `*` no título (ex.: `SQL8.sql*` em `re/original-observation/12-start-menus-erros/15-menu-window-1810.png`); diálogo ao fechar sem salvar: "Document '{0}' was modified. Do you want to save changes?" [Save] [Discard] [Cancel].
- Interações: clique do meio fecha; arrastar reordena; arrastar para fora da barra = dividir (P2); menu de contexto da aba: Close, Close Others, Close All, Close to the Right, Copy Full Path, Reveal in File Manager (xdg-open na pasta), Pin Tab.
- Overflow: botão [v] lista todas as abas; scroll horizontal com roda do mouse.
- Estado inicial / Start Page categorizada [C: `re/original-observation/12-start-menus-erros/01-start-page-1807.png` a `re/original-observation/12-start-menus-erros/08-start-data-analysis-1808.png`]:
  - Cabeçalho: logo TuxSQL, edição, ícones sociais, aba fixável.
  - Painel esquerdo: "Recent Files" com busca e alternância lista/detalhes.
  - Painel direito: abas de categoria com overflow `...` (`re/original-observation/12-start-menus-erros/04-start-more-menu-1808.png`, `re/original-observation/12-start-menus-erros/06-overflow-reopened-1808.png`):
    - **SQL Development** (`re/original-observation/12-start-menus-erros/02-start-sql-development-1808.png`): SQL Editor, Query Builder, Execute Script..., AI Assistant.
    - **Database Design** (`re/original-observation/12-start-menus-erros/03-start-database-design-1808.png`): New Database Diagram, New Schema Comparison..., Find Database Object..., Link Database to Source Control...
    - **Database Sync** (`re/original-observation/12-start-menus-erros/05-start-database-sync-1808.png`): New Schema Comparison..., Create Scripts Folder...
    - **Administration** (`re/original-observation/12-start-menus-erros/07-start-administration-1808.png`): Manage Server Security, Monitor Sessions, Backup Database..., Perform Table Maintenance..., Find Invalid Objects...
    - **Data Pump** (`re/original-observation/12-start-menus-erros/01-start-page-1807.png`): Export Data..., Import External Data..., New Data Comparison..., Copy Databases.
    - **Data Analysis** (`re/original-observation/12-start-menus-erros/08-start-data-analysis-1808.png`): Master-Detail Browser, Design New Report..., Export Data...
- Sessão: ao reabrir restaura abas, conteúdo de SQL não salvos (rascunhos em `$XDG_STATE_HOME/tuxsql/drafts`), posição do cursor.

## 6. Painéis inferiores

Abas: **Output**, **Error List**, **Find Results** (P1).
- **Output:** log somente leitura cronológico, seletor "Show output from: All / Execution / Connections / App". Linha: `[HH:MM:SS] origem  mensagem`. Cores semânticas (info normal, warning âmbar, erro vermelho, sucesso verde). Botões: Clear, Copy, Word wrap, Auto-scroll. Nunca registra senhas.
- **Error List** [C: `re/original-observation/12-start-menus-erros/09-error-query-typed-1809.png`, `re/original-observation/12-start-menus-erros/10-error-result-1809.png`, `re/original-observation/12-start-menus-erros/11-syntax-error-1809.png`]:
  - Abertura automática ao executar consulta com erro de execução (ex.: erro MySQL 1146 "Table 'sample.tabela_inexistente' doesn't exist" em `re/original-observation/12-start-menus-erros/10-error-result-1809.png`) ou erro de sintaxe (ex.: erro MySQL 1064 em `re/original-observation/12-start-menus-erros/11-syntax-error-1809.png`).
  - Identificador com erro no editor SQL recebe sublinhado ondulado vermelho em tempo real (`re/original-observation/12-start-menus-erros/09-error-query-typed-1809.png`, `re/original-observation/12-start-menus-erros/10-error-result-1809.png`).
  - Barra de contagem no topo da grade: `{n} Errors | {n} Warnings | {n} Messages | {n} In Active Document` e `{n} of {m} items displayed` (`re/original-observation/12-start-menus-erros/10-error-result-1809.png`).
  - Colunas da grade: `Description` | `Location` | `Line` | `Column`.
  - Duplo clique na linha navega diretamente ao documento e posição do cursor.
  - Vazio: "Nenhum erro ou aviso." com ícone check.
- Resize por splitter; atalho Ctrl+W,E [C] / Ctrl+Alt+E [C] alterna Error List.

## 7. Status bar [C: re/original-observation/12-start-menus-erros/10-error-result-1809.png]

Segmentos (esq→dir), todos clicáveis quando indicado:
1. Estado de execução: "Ready" | "Executing…" | "Query completed with errors." (com ícone vermelho de erro, `re/original-observation/12-start-menus-erros/10-error-result-1809.png`) | "Query executed successfully.".
2. Tempo de execução: "00:00:00.346" [C: `re/original-observation/12-start-menus-erros/10-error-result-1809.png`].
3. Conexão / Servidor / Banco: "10.0.2.2 (8.4)" servidor, "obs" usuário, "sample" database ativa [C: `re/original-observation/12-start-menus-erros/10-error-result-1809.png`].
4. Posição no editor: `Ln 1    Col 15    Ch 15` [C REA ui-text / `re/original-observation/12-start-menus-erros/10-error-result-1809.png`].
5. Encoding (UTF-8; clique muda), Fim de linha (LF/CRLF; padrão LF no Linux).
6. Linhas afetadas / linhas retornadas no grid ("120 rows") [I].
Cor de fundo: neutra; durante execução azul de acento; em erro ícone vermelho na status bar.

## 8. Estados globais e Diálogo About

| Estado | Comportamento |
|---|---|
| Loading inicial | Splash simples (logo texto + barra) ≤2s; depois janela com skeletons no Explorer |
| Sem conexões | Explorer mostra ilustração ASCII/ícone + "Nenhuma conexão" + botão primário "New Connection" [C: `re/original-observation/00-shell/first-run.png`] |
| Erro de operação | Toast no canto inferior direito (6s, persistente se erro) + linha no Output / Error List aberto automaticamente [C: `re/original-observation/12-start-menus-erros/10-error-result-1809.png`] |
| Sucesso | Toast verde curto (3s) para ações explícitas (connect, save); execução SQL reporta na status bar/aba Messages, sem toast |
| Operação longa | Barra de progresso fina (2px) sob a toolbar + botão Cancel |
| Desconexão inesperada | Banner amarelo no topo do documento: "Conexão perdida. [Reconectar] [Fechar]" |
| Diálogo About [C] | Acionado via Help > About... (`re/original-observation/12-start-menus-erros/17-about-1810.png`): modal centralizado exibindo nome da aplicação, versão ("Version 2026.2.82"), edição ("Enterprise Edition"), contagem regressiva de licença/trial, links Devart e botões `View System Info` e `Close`. Retorno limpo ao shell em `re/original-observation/12-start-menus-erros/18-after-about-1810.png`. |

Toasts: máx. 3 empilhados, largura 360, ação opcional ("Ver detalhes" abre Output).

## 9. Design tokens

Tipografia: UI = fonte do sistema (`system-ui`/Cantarell/Noto Sans/Ubuntu), 13px, line-height 18px; código = JetBrains Mono / DejaVu Sans Mono / Monospace, 13px, ligaduras desligadas por padrão. Escala: 11 (meta), 12 (secundário), 13 (base), 14 (títulos de diálogo), 16 (Start Page).

Espaçamento (grid 4px): 4, 8, 12, 16, 24. Raio: 3px controles, 6px diálogos/toasts. Altura de controle: 24px (compacto, padrão), 28px (formulários). Bordas 1px.

Cores (hex) — Claro / Escuro:

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| bg.app | #F3F4F6 | #1E1F22 | fundo da janela/docks |
| bg.surface | #FFFFFF | #2B2D30 | editor, grid, diálogos |
| bg.surfaceAlt | #F9FAFB | #26282B | cabeçalhos, linhas zebra |
| bg.hover | #E8EEF7 | #35383D | hover |
| bg.selected | #CFE0F7 | #2F4A73 | seleção ativa |
| bg.selectedInactive | #E1E5EA | #3A3D41 | seleção sem foco |
| border.default | #D1D5DB | #3F4247 | divisórias |
| border.focus | #2F6FDE | #5B9BFF | anel de foco 2px |
| text.primary | #1F2328 | #DFE1E5 | texto |
| text.secondary | #5B6370 | #9DA3AE | meta |
| text.disabled | #A0A6B0 | #6B7078 | desabilitado |
| accent.primary | #2F6FDE | #4C8DFF | botão primário, links |
| accent.onPrimary | #FFFFFF | #0B1220 | texto sobre accent |
| status.success | #1E8E3E | #4CC26A | |
| status.warning | #B26A00 | #E5A33A | |
| status.error | #C62828 | #FF6B6B | |
| status.info | #1565C0 | #6CB2FF | |
| grid.null | #8A909A | #7C828C | texto NULL em itálico |
| syntax.keyword | #0033B3 | #6AA2FF | |
| syntax.string | #067D17 | #8BC672 | |
| syntax.number | #1750EB | #D7A35F | |
| syntax.comment | #8C8C8C | #7A7E85 | |
| syntax.function | #7A3E9D | #C792EA | |
| syntax.identifier | #1F2328 | #DFE1E5 | |

Contraste mínimo WCAG AA (4.5:1 texto, 3:1 componentes). Sombras: diálogo 0 8px 24px rgba(0,0,0,.25) claro / .5 escuro. Animações 120–180ms ease-out; respeitar `prefers-reduced-motion`.

## 10. Temas e adaptações Linux

- Opções: **Auto** (segue `prefers-color-scheme`, derivado do GTK/portal `org.freedesktop.appearance`), Claro, Escuro. Troca instantânea sem reiniciar. Tema do Monaco acompanha (vs / vs-dark customizados com tokens acima).
- Barra de título: nativa do WM (padrão) ou custom frameless (opção, P2). Ícone .desktop/StartupWMClass `tuxsql`.
- Escala HiDPI: usar fator do sistema; zoom da UI independente (Ctrl+= ).
- Caminhos XDG: config `$XDG_CONFIG_HOME/tuxsql`, dados `$XDG_DATA_HOME`, estado/rascunhos `$XDG_STATE_HOME`, cache `$XDG_CACHE_HOME`.
- Segredos via libsecret/safeStorage; se indisponível, aviso e opção "não salvar senha".
- Diálogos de arquivo: GTK portal (xdg-desktop-portal). "Reveal in File Manager": `xdg-open` da pasta.
- Teclado: Ctrl no lugar de Cmd; evitar conflitos comuns de WM (Ctrl+Alt+setas = workspaces em alguns DEs; por isso Toggle Results padrão alternativo Ctrl+Shift+R, configurável). Atalhos editáveis em Tools > Options > Keyboard.
- Sem Windows-auth, sem Registry; "Open with default app" via xdg-open.

## 11. Atalhos globais (resumo)

| Ação | Atalho |
|---|---|
| Novo SQL | Ctrl+N |
| Nova conexão | Ctrl+D, N [C]; Ctrl+Shift+N [I] |
| Abrir / Salvar / Salvar tudo | Ctrl+O / Ctrl+S / Ctrl+Shift+S |
| Executar | F5 ou Ctrl+Enter |
| Executar seleção / atual | Ctrl+F8 [C] / F8 [C] (Ctrl+Shift+Enter [I] alternativo) |
| Parar | Alt+Pause [C]; Shift+F5 [I] alternativo |
| Alternar Explorer / Painel inferior | Ctrl+Alt+L [C REA shortcuts] / Ctrl+J [I] |
| Paleta de comandos | Ctrl+Shift+P |
| Fechar aba / próxima / anterior | Ctrl+W / Ctrl+Tab / Ctrl+Shift+Tab |
| Opções | Ctrl+, |
| Tela cheia | F11 |
| Ajuda | F1 |

## 12. Acessibilidade

Navegação total por teclado (F6 alterna regiões: Explorer → Documento → Painel inferior → Status), foco visível 2px, roles ARIA (menubar, tree, tablist, grid, status), leitores de tela (Orca) anunciam estado de execução (aria-live polite), alvo de clique ≥24px.

## 13. Componentes reutilizáveis (catálogo do shell)

Button (primary/secondary/ghost/danger; estados default/hover/active/focus/disabled/loading), IconButton, Toolbar, ToolbarCombo, MenuItem (com atalho e submenu), ContextMenu, Tabs (documento e painel), Splitter, DockPanel (header + ações + pin), TreeView (virtualizado), SearchInput (com limpar), Toast, Banner, Dialog (modal, com cabeçalho/rodapé de ações; Enter=primário, Esc=cancelar), ProgressBar/Spinner, Badge, StatusSegment, Tooltip, EmptyState (ícone + título + descrição + CTA), Skeleton.

## 14. Critérios de aceite do shell

- Layout redimensiona sem sobreposição até 1024x640.
- Layout (larguras, painéis, abas abertas, tema) persiste entre sessões; "Reset Layout" restaura padrão.
- Todos os itens de menu têm estado habilitado/desabilitado definido pelo contexto (conexão ativa, documento ativo, execução em curso).
- Troca de tema não exige reinício e atinge editor, grid e diálogos.


## Textos de interface (referência)

Fonte: REA ui-text [C]. Sem `&`; frases longas parafraseadas; `{0}` mantido.

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| File / Edit / Data / Debug / Help | Menu bar | menu.file / menu.edit / menu.data / menu.debug / menu.help |
| New SQL; New Query; New SQL document | File > New, toolbar | cmd.newSql |
| Open File... | File > Open | cmd.openFile |
| Save; Save As...; Save All | File | cmd.save / cmd.saveAs / cmd.saveAll |
| Exit | File | cmd.exit |
| Recent Files; Recently Closed Documents | File, Start Page | menu.recentFiles / menu.recentClosed |
| Close All Documents; Close All But This; Close All Unmodified | Menu de contexto da aba | tab.closeAll / tab.closeOthers / tab.closeUnmodified |
| Pin Document | Menu da aba | tab.pin |
| Copy Full Path; Open File Location | Menu da aba | tab.copyPath / tab.revealInFm |
| Database Explorer | Dock esquerdo, View | panel.explorer.title |
| Error List; Find Results; Output; Document Outline | Painéis | panel.errorList / panel.findResults / panel.output / panel.outline |
| Reset Window Layout; Reset Toolbar Layout | View | cmd.resetLayout / cmd.resetToolbars |
| Execute; Execute Current Statement; Execute Selection; Execute To Cursor | SQL / toolbar | cmd.execute / cmd.executeCurrent / cmd.executeSelection / cmd.executeToCursor |
| Display Estimated Execution Plan | Explain | cmd.explain |
| Format Document; Format Selection; Format Current Statement | Edit / toolbar | cmd.formatDoc / cmd.formatSel / cmd.formatStmt |
| Find; Find Next; Find Previous; Find in Files; Go To Line | Edit | cmd.find / cmd.findNext / cmd.findPrev / cmd.findInFiles / cmd.gotoLine |
| Document '{0}' was modified. Do you want to save changes? | Fechar aba suja | dlg.saveChanges.msg |
| Save Changes; Discard; Cancel | Botões do diálogo | dlg.save / dlg.discard / dlg.cancel |
| Executing query... ; Executing script... | Status bar / Output | status.executingQuery / status.executingScript |
| Execution Completed Successfully. | Output | output.exec.success |
| Execution was canceled by user. ; Query canceled. | Output | output.exec.canceled |
| Query completed with errors. ; Query completed with warnings. | Output | output.exec.errors / output.exec.warnings |
| Do you want to stop executing? | Confirmar parar | dlg.stopExec.msg |
| Ln {0}    Col {1}    Ch {2} | Status bar posição | status.position |
| Elapsed Time; Execution Time | Status bar | status.elapsed |
| Check for Updates... | Help | cmd.checkUpdates |
| Customize...; Options... | Tools/Toolbar | cmd.customize / cmd.options |
| Connection Manager... | Tools/Database | cmd.connManager |

## Pendências [I]

- Menus e estrutura geral: 10 menus canônicos, Start Page categorizada, Error List e Status Bar confirmados pelas capturas em `re/original-observation/00-shell/`, `re/original-observation/05-menus/` e `re/original-observation/12-start-menus-erros/`.
- Atalhos globais de design (Ctrl+J, Ctrl+Shift+P paleta de comandos, Ctrl+Enter, Ctrl+Q, Ctrl+, , F6 regiões): decisões de design do clone Linux sem equivalente direto no mapa REA shortcuts.
- Status bar completa (segmentos UTF-8/LF/linhas): "Ln/Col/Ch", tempo e servidor confirmados [C]; chaveamento manual de codificação é proposta do clone [I].
- Overflow "»", badge de contagem de toasts, tema Auto/Light/Dark, drafts XDG: decisões de design do clone Linux.
- Mnemônicos específicos por menu (letras com `&`) não copiados; atribuição [I].
