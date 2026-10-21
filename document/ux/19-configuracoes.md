# UX 19 — Configurações (Options)

Reusa `01-shell.md` (tokens, Dialog, FormField, SideNavTabs) e `02`. **[I]** INFERIDO (sessão anterior / REA).

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Tools > Options: Environment, Text Editor, SQL Formatting, Keyboard, Fonts and Colors, Code Completion) e notas de sessão anterior na VM `dbforge-ref` (`re/original-observation/NOTES.md` #14).
Auditoria de origem de evidência: **(b) Sessão anterior / (c) Inferência/REA**. Nenhuma captura foi feita na sessão corrente; pendente de confirmação por novas capturas da Lupa.
Citação e evidência: Diálogo acessível em **Tools > Options...** [I]. O diálogo possui campo de busca no topo com placeholder "Search (Ctrl+E)" [I], árvore de categorias à esquerda [I], cabeçalho com Breadcrumb (ex: `Environment > General`) [I], botão inferior esquerdo `Reset Page Defaults` [I], e botões inferiores direitos `OK` e `Cancel` [I].

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

### Environment > General [C]
- **Visual Settings**:
  - `Skin`: Dropdown com temas visuais [C]. No TuxSQL: adaptado para **Auto (segue sistema)** / Claro / Escuro / Alto Contraste via CSS tokens (na referência original: "Visual Studio Light", skins WinForms).
  - `Enable forms skin`: Checkbox [C]. No TuxSQL: emulação de bordas e janelas consistentes com o tema.
  - `Enable menu animation`: Checkbox [C]. No TuxSQL: respeita configuração de sistema (`prefers-reduced-motion`).
- **Environment Settings**:
  - `On startup, open`: Dropdown ("Latest session", "Empty environment", "Start Page") [C].
  - `Allow sending anonymous usage statistics`: Checkbox [C]. **Divergência de privacidade Linux:** na referência vem marcada; no TuxSQL esta opção é **desativada permanentemente e ausente de telemetria** (zero dados enviados externamente).
  - `Check for updates`: Checkbox [C]. No Linux: gerenciado por padrão via gerenciador de pacotes (`.deb` / repositório APT), verificação manual via menu Help.
  - `Show Start Page`: Checkbox [C] (default ativo).
  - `Show splash screen`: Checkbox [C] (default ativo).
  - `Show status bar`: Checkbox [C] (default ativo).
  - `Display [10] items in window/recent list`: Input numérico (padrão 10 itens) [C].

### Environment > Keyboard [C]
- Tabela de comandos com mapeamento de teclas: Command | Shortcut | Context (Global, Editor, Results Grid, Database Explorer) [C].
- Botões: `Reset Mapping` / `Restore Defaults` [C].
- Detecção de conflitos de atalho no mesmo contexto (ex: alerta inline ou modal de substituição) [C].
- Esquemas de mapeamento adicionais (Default, VS Code-like, DBeaver-like, SSMS-like) [I].

### Environment > Font and Colors [C]
- Configuração de fontes para UI e Editor SQL [C].
- Campos: `Font Name`, `Font Size`, `Font Scale` [C].
- Amostra e preview ao vivo de legibilidade com suporte a fontes monoespaçadas do Linux (Fira Code, JetBrains Mono, DejaVu Sans Mono).

### Environment > Documents / Tabs and Windows [C]
- Intervalo de restauração de documentos abertos (`Restore Documents / Restore Last Closed Document`) [C].
- Layout de abas: posição (topo/baixo), fechamento com botão do meio, limite de abas antes de agrupamento.

### Environment > Output [C]
- Configurações de logging da janela de saída: timestamps, log de consultas SQL executadas, retenção de mensagens.

### Environment > SMTP Mail Profiles [C]
- Configuração de servidores SMTP para envio de relatórios e notificações [C].
- Host, porta, TLS/SSL, autenticação, credenciais salvas de forma segura no cofre do sistema (Secret Service / libsecret).

### Text Editor > General / Code Completion [C]
- Exibição de números de linha, word wrap, minimapa, guias de indentação, realce de delimitadores.
- `Code Completion`: ativação automática, atraso em ms, case de palavras-chave inseridas (Upper/Lower/Preserve), snippets.

### Data Editor [C]
- `Activate Data editor after query execution`: Checkbox [C].
- `Show datatype in data editor column header`: Checkbox [C].
- Tamanho de página padrão (pageSize), formatação de NULL, datas e números.

### Data Comparison & Schema Comparison [C]
- Pastas de cache temporário (caminhos absolutos em `$XDG_CACHE_HOME/tuxsql`), estratégias de chave primária, timeouts e opções de sincronização.

### Query Builder [C]
- Opções visuais do canvas: `Show grid`, `Grid size` (8–64px), `Snap to grid`, `Shadows` nos cartões de tabela [C].

### Source Control [C]
- Perfil Git (autor, email), modo de vinculação padrão (Dedicated / Shared), pasta padrão de repositórios locais.

### Debugging [C]
- Confirmações de execução real, timeout de depuração de rotinas, comportamento de rollback transacional pós-sessão de depuração.

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
