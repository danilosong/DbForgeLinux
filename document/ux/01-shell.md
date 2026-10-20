# UX 01 — Shell da aplicação

Stack alvo (ADR-001): Electron + React + Monaco. Esta spec descreve comportamento/visual; sem código. Visual inspirado no dbForge (DevartBlue), apenas descrito, sem reutilizar assets protegidos (ícones/skins `.vsf` não são copiados).

Legenda: **[C]** = confirmado por evidência REA (`re/ui-strings/ui-text.txt`, mapa de atalhos `REA shortcuts`); **[I]** = inferido/decisão de design sem evidência. Itens sem marca nas seções abaixo seguem como [I] salvo indicação; os confirmados aparecem em "Textos de interface (referência)" e nas notas **[C]** inline.

## 1. Layout geral (janela principal, mín. 1024x640, padrão 1440x900)

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

## 2. Barra de menus

| Menu | Itens (atalho) |
|---|---|
| File | New > SQL Document (Ctrl+N) / Database Connection (REA shortcuts: Ctrl+D, N [C]; Ctrl+Shift+N = New Project no original, aqui mantido para conexão [I]); Open File… (Ctrl+O); Recent Files >; Save (Ctrl+S); Save As…; Save All (Ctrl+Shift+S); Close (Ctrl+W); Close All Documents [C]; Close All But This [C]; Close All Unmodified [C]; Recently Closed Documents [C]; Exit (Ctrl+Q) |
| Edit | Undo (Ctrl+Z), Redo (Ctrl+Y / Ctrl+Shift+Z), Cut/Copy/Paste, Select All (Ctrl+A), Find (Ctrl+F), Replace (Ctrl+H), Find in Files (Ctrl+Shift+F), Go To Line (Ctrl+G [C]), Comment (Ctrl+/), Uncomment, Format Document (Ctrl+K, Ctrl+D [C]) / Format Selection (Ctrl+K, Ctrl+F [C]) / Format Current Statement (Ctrl+K, Ctrl+S [C]) |
| View | Database Explorer (REA shortcuts: Ctrl+Alt+L [C]), Output (Ctrl+Alt+O [C]), Error List (REA shortcuts: Ctrl+Alt+E [C]), Properties (F4 [C]), Full Screen (F11), Theme > Auto/Light/Dark, Zoom In/Out/Reset (Ctrl+= / Ctrl+- / Ctrl+0), Reset Layout |
| Database | New Connection…, Connect, Disconnect, Edit Connection (F2 na árvore), Refresh (F5), Set as Active Database |
| SQL | New SQL (Ctrl+N), Execute (F5 / Ctrl+Enter), Execute Current Statement [C] (REA shortcuts: F8/F4/Alt+F9 conforme esquema; adotado F8), Execute Selection [C] (Ctrl+F8), Execute To Cursor [C] (Ctrl+Shift+F10), Stop/Cancel (REA shortcuts: Alt+Pause; Shift+F5 e Esc em execução [I]), Explain Plan (REA shortcuts: Ctrl+L / Alt+F9; rótulo real "Display Estimated Execution Plan" [C]), Toggle Results (Ctrl+Alt+Down) |
| Data | Export Data… (P1), Import Data… (P1), Refresh Result (F5 no grid), Copy As > CSV/JSON/SQL INSERT |
| Tools | Options… (Ctrl+,), Connection Manager… |
| Window | Next Tab (Ctrl+Tab / Ctrl+PgDn), Previous Tab (Ctrl+Shift+Tab / Ctrl+PgUp), Close Others, Windows… |
| Help | Documentation (F1 [C], "ShowContents"), Keyboard Shortcuts (Ctrl+K Ctrl+S), About |

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

- Tipos: SQL Document, Table Data, Object Editor (P1), Start Page, Connection Properties (modal, não aba).
- Aba: [ícone tipo] título [•modificado] [x fechar]. Título SQL: `SQL 1` → após salvar nome do arquivo; tooltip com caminho completo e conexão. Rótulo de cor da conexão como faixa de 2px no topo da aba.
- Alterações não salvas: bolinha "•" no lugar do x (x aparece em hover). Fechar com alterações → diálogo "Save changes to SQL 1?" [Save] [Don't Save] [Cancel].
- Interações: clique do meio fecha; arrastar reordena; arrastar para fora da barra = dividir (P2); menu de contexto da aba: Close, Close Others, Close All, Close to the Right, Copy Full Path, Reveal in File Manager (xdg-open na pasta), Pin Tab.
- Overflow: botão [v] lista todas as abas; scroll horizontal com roda do mouse.
- Estado vazio: Start Page (ações: New SQL, New Connection, Recent Connections, Recent Files, dicas).
- Sessão: ao reabrir restaura abas, conteúdo de SQL não salvos (rascunhos em `$XDG_STATE_HOME/dbforgelinux/drafts`), posição do cursor.

## 6. Painéis inferiores

Abas: **Output**, **Error List**, **Find Results** (P1).
- **Output:** log somente leitura cronológico, seletor "Show output from: All / Execution / Connections / App". Linha: `[HH:MM:SS] origem  mensagem`. Cores semânticas (info normal, warning âmbar, erro vermelho, sucesso verde). Botões: Clear, Copy, Word wrap, Auto-scroll. Nunca registra senhas.
- **Error List:** tabela (Severidade ícone | # | Mensagem | Documento | Linha | Coluna). Filtros por severidade (Errors/Warnings/Info com contadores). Duplo clique navega ao documento/posição. Vazio: "Nenhum erro ou aviso." com ícone check.
- Aba mostra badge de contagem (ex.: Error List (3)). Em novo erro de execução, o painel abre automaticamente na aba correspondente se estiver colapsado (configurável).
- Resize por splitter; atalho Ctrl+J alterna visibilidade.

## 7. Status bar

Segmentos (esq→dir), todos clicáveis quando indicado:
1. Estado: "Ready" | "Connecting…" (spinner) | "Executing… 00:03.2" | "Error".
2. Conexão ativa (nome; clique abre seletor).
3. Database ativa.
4. Ln/Col (clique → Go To Line); seleção "(12 selected)".
5. Encoding (UTF-8; clique muda), Fim de linha (LF/CRLF; padrão LF no Linux).
6. Última execução: "00:00.042 · 120 rows".
7. Indicador de tema/zoom (opcional).
Cor de fundo: neutra; durante execução azul de acento; em erro persistente (conexão perdida) âmbar/vermelho até resolver.

## 8. Estados globais

| Estado | Comportamento |
|---|---|
| Loading inicial | Splash simples (logo texto + barra) ≤2s; depois janela com skeletons no Explorer |
| Sem conexões | Explorer mostra ilustração ASCII/ícone + "Nenhuma conexão" + botão primário "New Connection" |
| Erro de operação | Toast no canto inferior direito (6s, persistente se erro) + linha no Output; erros bloqueantes viram diálogo modal |
| Sucesso | Toast verde curto (3s) para ações explícitas (connect, save); execução SQL reporta na status bar/aba Messages, sem toast |
| Operação longa | Barra de progresso fina (2px) sob a toolbar + botão Cancel |
| Desconexão inesperada | Banner amarelo no topo do documento: "Conexão perdida. [Reconectar] [Fechar]" |

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
- Barra de título: nativa do WM (padrão) ou custom frameless (opção, P2). Ícone .desktop/StartupWMClass `dbforgelinux`.
- Escala HiDPI: usar fator do sistema; zoom da UI independente (Ctrl+= ).
- Caminhos XDG: config `$XDG_CONFIG_HOME/dbforgelinux`, dados `$XDG_DATA_HOME`, estado/rascunhos `$XDG_STATE_HOME`, cache `$XDG_CACHE_HOME`.
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

- Nomes dos menus View, Tools, Window, SQL: não achados como rótulos isolados no ui-text; permanecem [I].
- Atalhos globais de design (Ctrl+J, Ctrl+Shift+P paleta de comandos, Ctrl+Enter, Ctrl+Q, Ctrl+, , F6 regiões): sem equivalente no mapa REA.
- Status bar (segmentos UTF-8/LF/tempo/linhas): só "Ln/Col/Ch" e "Elapsed Time" confirmados.
- Overflow "»", badge de contagem, Toasts, tema Auto/Light/Dark, drafts XDG: decisões de design.
- Mnemônicos específicos por menu (letras com `&`) não copiados; atribuição [I].
