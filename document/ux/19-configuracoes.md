# UX 19 — Configurações (Options)

> Fidelidade REA & Observação VM: rótulos conferidos contra REA ui-text e **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas completas em `re/original-observation/10-tools-options/`).
- **[C] Diálogo e Árvore (`10-tools-options/02-options-dialog-1802.png`):** Campo `Search`, árvore com 17 categorias de 1º nível, breadcrumb e botão `Reset Page Defaults`.
- **[C] Padrões de Environment (`03` a `09`):** General (`03`), Keyboard (`04`), Output (`05`), Categories (`06`), Font and Colors (`07`), Tabs and Windows (`08`), SMTP (`09`).
- **[C] Padrões de Text Editor (`10` a `19`):** General (`10`), Tabs (`11`), Advanced (`12`), Code Completion (`13-17`), Formatting (`18-19`).
- **[C] Padrões Especializados (`20` a `24`):** Data Editor (`20`), Query Builder (`21`), Debugging (`22`), AI Assistant (`23`), Database Explorer (`24`), Query Profiler (`02`).
- **[C] Utilitários em Tools:** Snippets Manager (`26-snippets-manager-1804.png`), SQL Formatter Wizard (`27-sql-formatter-1805.png`, `28-formatter-cancel-1805.png`).

## 1. Diálogo Options
Entrada: Tools > Options… (**Ctrl+,** no Linux / Ctrl+E para busca interna) [C]. Modal 860x600 (min 760x520), redimensionável.
Layout:
- **Topo**: Campo de busca rápida "Search (Ctrl+E)" que filtra nós da árvore e opções [C].
- **Esquerda**: Árvore hierárquica de categorias de configurações (240px) [C].
- **Direita**: Painel de configurações da categoria selecionada, encimado por breadcrumb de navegação (`Categoria > Subcategoria`) [C].
- **Rodapé**:
  - Esquerda: Botão `Reset Page Defaults` (restaura padrões apenas da página ativa com confirmação) [C].
  - Direita: Botões `OK` (salva e fecha) e `Cancel` (descarta alterações e fecha) [C], além de botão opcional `Apply` [I].

Árvore de categorias observada na referência [C]:
```
Environment [C]
  General [C]
  Keyboard [C]
  Output [C]
  Categories [C]
  Font and Colors [C]
  Documents [C]
  Tabs and Windows [C]
  Projects [C]
  SMTP Mail Profiles [C]
AI Assistant [C]
Schema Comparison [C]
Text Editor [C]
  General | Fonts and Colors | Code Completion | Syntax Colors
Data Comparison [C]
Generate Scripts [C]
Data Editor [C]
Data Export [C]
Copy Databases [C]
Data Generation [C]
Database Explorer [C]
Query Builder [C]
Database Diagram [C]
Source Control [C]
Debugging [C]
Master-Detail [C]
Query Profiler [C]
```

Configurações no TuxSQL são persistidas em JSON limpo e auditável em `$XDG_CONFIG_HOME/tuxsql/settings.json` [ADAPTADA PARA LINUX]. Se o arquivo for corrompido, é movido para `.bak` e defaults são recarregados com segurança.

## 2. Páginas e Especificações de Campos

### Environment > General [C] (`re/original-observation/10-tools-options/03-environment-expanded-1802.png`)
- **Visual Settings**:
  - `Skin`: Dropdown com temas visuais [C] (padrão original: `Visual Studio Light`). No TuxSQL: adaptado para **Auto (segue sistema)** / Claro / Escuro / Alto Contraste via CSS tokens.
  - `Enable forms skin`: `[x]` (ON por padrão) [C].
  - `Enable menu animation`: `[ ]` (OFF por padrão) [C].
- **Environment Settings**:
  - `On startup, open`: Dropdown (padrão: `Latest session`; opções: Empty environment, Start Page) [C].
  - `Allow sending anonymous usage statistics`: Checkbox [C]. **Divergência Virtuosa Linux:** na referência vem marcada; no TuxSQL esta opção é **desativada permanentemente e ausente de telemetria** (zero dados enviados externamente).
  - `Check for updates on startup once a week`: `[x]` (ON por padrão) [C].
  - `Show Start Page on startup`: `[x]` (ON por padrão) [C].
  - `Show splash screen on startup`: `[x]` (ON por padrão) [C].
  - `Show status bar`: `[x]` (ON por padrão) [C].
  - `Display items in window menu`: `10` [C].
  - `Display items in recently used list`: `10` [C].
- **Objects Discovery**:
  - `Allow uncommitted objects discovery (experimental)`: `[ ]` (OFF por padrão) [C].

### Environment > Keyboard [C] (`re/original-observation/10-tools-options/04-env-keyboard-1802.png`)
- Esquema de mapeamento adicional: `dbForge` (combo) com botão `Reset` [C].
- Campo de filtro: `Show commands containing:` e botão `Show Table` [C].
- Atribuição: escopo `Use new shortcut in: Global` + campo `Press shortcut keys:` + botão `Assign` e indicador `Shortcut currently used by:` [C].

### Environment > Categories [C] (`re/original-observation/10-tools-options/06-env-categories-1803.png`)
- Grade de mapeamento: `Server | Database | Environment` (linha padrão: `* | * | None`) [C].
- Configurações semânticas de categorias (Name | Shape | Color):
  - `Development`: Quadrado, cor `LimeGreen` [C].
  - `Production`: Círculo, cor `Tomato` [C].
  - `Sandbox`: Triângulo, cor `DodgerBlue` [C].
  - `Test`: Losango, cor `Orange` [C].

### Environment > Tabs and Windows [C] (`re/original-observation/10-tools-options/08-env-tabs-windows-1803.png`)
- **Document Tabs**:
  - `Tab layout`: `Top` [C].
  - `Tab orientation`: `Horizontal` [C].
  - `Dirty indicator`: `Default (*)` [C].
  - `Insert new tabs`: `First in the active group` [C].
  - `[x] Display rich tooltips for documents`: ON [C].
  - `[x] Bold text on selected tabs`: ON [C].
  - `[ ] Show tabs in multiple rows`: OFF [C].
  - `Maximum tab width`: `200` px [C].
  - `[x] Close tabs with middle-click`: ON [C].
  - `Show the 'Close' button`: `On the selected and hot-tracked document tabs` [C].

### Text Editor > General, Tabs, Advanced e Code Completion [C] (`re/original-observation/10-tools-options/10-text-editor-expanded-1803.png` a `17-cc-suggestions-1803.png`)
- **General (`10`)**:
  - `[x] Bracket matching`: ON.
  - `[ ] Line numbers`: **OFF por padrão** na referência original (no TuxSQL habilitado por padrão para usabilidade dev).
  - `[x] Indicator margin`: ON.
  - `[x] Highlight current line`: ON.
  - `[x] Automatically surround selections when typing quotes or brackets`: ON.
- **Tabs (`11`)**:
  - `Indenting`: `Block` [C].
  - `Tab size`: `2`, `Indent size`: `2` [C].
  - `(•) Insert spaces`: ON [C].
- **Advanced (`12`)**:
  - `[x] Enter outlining mode when files open`: ON [C].
  - `[x] Collapse #REGION blocks when files open`: ON [C].
  - `[x] Highlight SELECT statements`: ON [C].
  - `[x] Underline errors in the editor`: ON [C].
- **Code Completion (`13-17`)**:
  - `[x] Enable Code Completion`: ON, trigger delay `200 ms` [C].
  - `[x] Auto List Members`, `[x] Auto Parameter Info`, `[x] Highlight Occurrences`: ON [C].
  - `Enclose identifiers in backticks`: `If backticking is required` [C].
  - `[x] Generate alias on commit` [C].
  - `Commit Selection`: `Tab` (Enter insere nova linha) [C].

### Text Editor > Formatting [C] (`re/original-observation/10-tools-options/18-te-formatting-1804.png`, `19-te-formatting-profiles-1804.png`)
- `[x] Automatically format words while typing`: ON [C].
- `Right Margin`: `80` [C].
- Tags para desabilitar formatação em bloco de código: `-- noformat ... -- endnoformat` [C].
- Notificações de erro: `[x] Put syntax errors to Output window`, `[x] Show syntax error notification window` [C].
- Dicionário: arquivo `Dictionary.txt`, prefixos disponíveis: `tbl; fn; prc` [C].
- Perfis de Formatação: `Default` (ativo por padrão), `Collapsed`, `Commas before`, `Compact`, `Extended`, `Indented`, `MSDN SQL`, `Right aligned`, `Stack compact` [C].

### Data Editor > General [C] (`re/original-observation/10-tools-options/20-data-editor-1804.png`)
- `[x] Automatically adjust column width`: ON [C].
- `[ ] Use cached updates mode by default`: OFF [C].
- `[x] Use paginal mode by default`: ON, com `Initial page size: 1000` [C].
- `[ ] Show row numbers`: OFF [C].
- `[x] Show datatype in data editor column header`: ON [C].
- `Show dropdown LOB editor after`: `200` chars [C].
- `Data Editing`: `(•) Open Data Editor in the read-only mode` (leitura por padrão) [C].

### Query Builder > General [C] (`re/original-observation/10-tools-options/21-query-builder-1804.png`)
- `[x] Enable shadows`: ON [C].
- `[x] Enable grid`: ON [C].
- `Grid size`: `8` px [C].
- `[x] Snap to grid`: ON [C].

### Database Explorer > General [C] (`re/original-observation/10-tools-options/24-database-explorer-1804.png`)
- `[x] Show detailed column name in Database Explorer`: ON [C].
- `[ ] Show table size in Database Explorer`: OFF [C].
- `Table and View Default Action`: `Open Object Editor` [C].
- `Procedure and Function Default Action`: `Open Object Editor` [C].
- `Preferred Selection Size`: `All Rows` [C].

### Query Profiler > General [C] (`re/original-observation/10-tools-options/02-options-dialog-1802.png`)
- `Maximum history size`: `10` [C].
- `Do not highlight differences less than`: `0,001000 s.` [C].
- `[x] Display SQL query while printing profiling results`: ON [C].
- `[x] Profile a query without caching (use SQL_NO_CACHE option)`: ON [C].

### Debugging > General [C] (`re/original-observation/10-tools-options/22-debugging-1804.png`)
- `Timeout`: `30 sec` [C].
- `Edit and Continue`: `(•) Warn me if I make changes` [C].

## 3. Estados
| Estado | Comportamento |
|---|---|
| Carregando | Skeleton nas páginas ao alternar categoria (breve) |
| Erro ao salvar settings (permissão/disco cheio) | Banner de erro no topo do diálogo com botão de retry; arquivo corrompido é isolado em `.bak` |
| Valor inválido em campo numérico/path | Borda vermelha + mensagem explicativa inline; botões OK/Apply desabilitados |
| Sucesso ao aplicar | Feedback visual sutil ("Alterações salvas"); diálogo permanece aberto se usado Apply |
| Conflito de atalho | Modal de resolução: Reatribuir comando ou Cancelar |
| Reset de página | Diálogo de confirmação antes de resetar para os defaults da página ativa |

## 4. Atalhos do diálogo
- Abrir diálogo: `Ctrl+,` (menu Tools > Options...) [C].
- Busca rápida interna: `Ctrl+E` ou `Ctrl+F` [C].
- Restaurar padrões da página ativa: `Alt+R` [I].
- Confirmar/Salvar: `Enter` ou botão OK [C].
- Cancelar/Fechar: `Esc` ou botão Cancel [C].

## 5. Temas / acessibilidade
- Cores de alto contraste e tokens CSS padronizados.
- Navegação completa por teclado na árvore de categorias (`↑`, `↓`, `Enter`, `Tab`).
- Todos os campos com atributos `aria-label` e `aria-describedby` para leitores de tela.

## 6. Componentes
- `OptionsDialog` (modal principal com splitter redimensionável).
- `OptionsSearchBox` (campo de busca com destaque).
- `OptionsCategoryTree` (árvore com expansão/recolhimento).
- `BreadcrumbHeader` (caminho atual).
- `OptionsPageRenderer` (renderizador dinâmico com base no schema da página).
- `KeybindingTable` (editor e capturador de atalhos com detector de conflitos).
- `ConfirmResetModal` (confirmação de reset de configurações).

## 7. Critérios de aceite
- Todas as categorias e páginas abrem, exibem seus campos com defaults corretos e persistem em `settings.json`.
- Busca no topo com atalho `Ctrl+E` filtra nós da árvore e campos da página ativa.
- Restauração de página (`Reset Page Defaults`) restaura apenas a categoria selecionada após confirmação.
- Detecção e prevenção de atalhos duplicados por contexto.
- Testes automatizados cobrem persistência, validação de limites, migração e recuperação de arquivos corrompidos.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Options... / Tools/Options | Menu e diálogo | `opt.title` |
| Environment Settings / Environment Categories | Página/árvore | `opt.env` |
| Environment startup settings and active keyboard mapping scheme. | Descrição da página Environment | `opt.env.desc` |
| Text editor General settings, Tabs settings and Font Color settings. | Descrição Text Editor | `opt.editor.desc` |
| Data Editor | Categoria | `opt.dataEditor` |
| Activate Data editor after query execution | Checkbox | `opt.dataEditor.activate` |
| Show datatype in data editor column header | Checkbox | `opt.dataEditor.showType` |
| Check for updates on startup once a week | Checkbox (clone: off por padrão) | `opt.updates.weekly` |
| Font Name / Font Size / Font Scale | Campos de fonte | `opt.font.name / .size / .scale` |
| Large Font | Opção de acessibilidade | `opt.font.large` |
| Keyboard Interactive Mode | Opção de teclado | `opt.kbd.interactive` |
| Apply the following additional keyboard mapping scheme: | Esquema adicional | `opt.kbd.scheme` |
| Keyboard mappings will reset to their default values. Continue? | Confirmação de reset | `opt.kbd.resetConfirm` |
| Reset Mapping / Reset to Default / Restore Defaults | Botões | `opt.reset` |
| Reset all settings | Ação | `opt.resetAll` |
| Import and Export Settings... / Wizard | Menu e wizard | `opt.importExport` |
| Formatting Profiles / Formatting mode / General formatting settings. | Página de formatação | `opt.fmt.*` |
| Formatter has found some syntax errors in the text. The statements that contain errors are not formatted. | Aviso do formatador | `opt.fmt.syntaxErr` |
| Formatting canceled. | Estado | `opt.fmt.canceled` |
| Keep modified files open after formatting | Checkbox (formatação em lote) | `opt.fmt.keepOpen` |
| Language | Página | `opt.language` |
| items in recently used list | Campo de recentes | `opt.recent.count` |
| Move the mouse cursor to the option to obtain its detailed description. | Dica do rodapé | `opt.hoverHint` |
| Restore Documents / Restore Last Closed Document | Restauração de sessão | `opt.restore.*` |
| Settings for restore open documents functionality. | Descrição | `opt.restore.desc` |
