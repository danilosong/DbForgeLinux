# UX 19 — Configurações (Options)

Reusa `01-shell.md` (tokens, Dialog, FormField, SideNavTabs) e `02`. **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Tools > Options: Environment, Text Editor, SQL Formatting, Keyboard, Fonts and Colors, Code Completion) e https://www.devart.com/dbforge/mysql/studio/. Citação da busca (resumo): Options é acessível em **Tools > Options** [C] e configura formatação de código, comportamento do ambiente, atalhos, fontes/cores, autocomplete e timeouts [C]. Detalhes por página abaixo são [I] salvo indicação. Páginas individuais não abertas.

## 1. Diálogo Options
Entrada: Tools > Options… (**Ctrl+,**) [C menu; atalho I]. Modal 860x600 (min 760x520), redimensionável. Layout: **árvore de categorias** à esquerda (220px) + busca no topo da árvore ("Buscar opções…" filtra e destaca páginas/campos; sem resultados: "Nada encontrado") + painel de página à direita; rodapé: [Restore Defaults (página)] à esquerda, [OK] [Cancel] [Apply] à direita. Alterações aplicam ao [Apply]/[OK]; **pré-visualização ao vivo** para tema, fonte e formatação (painel de amostra). Marca "•" na categoria com alterações pendentes. Cancelar com alterações → confirma. Indicador "modificado" (ponto âmbar) ao lado do campo diferente do padrão com botão ↺ por campo. Configurações em JSON em `$XDG_CONFIG_HOME/dbforgelinux/settings.json`; botões [Import…] [Export…] [Open settings file].

Árvore:
```
Environment
  General | Appearance & Theme | Language | Layout & Windows | Startup | Files & Backups
Text Editor
  General | Fonts | Code Completion | Syntax Colors
SQL
  Execution | Results Grid | History | Formatting (+ subpáginas) | Code Analysis
Connections
  General | Security (credenciais) | Timeouts
Keyboard
Tools
  AI Assistant | Debugger | Profiler | Source Control | Data Tools (export/import/generator)
Network
  Proxy | Updates
```

## 2. Páginas

### Environment > General
Confirmar ao sair; restaurar sessão (abas/rascunhos); número de arquivos recentes (10); salvar rascunhos automaticamente (intervalo 30s); mostrar toasts de sucesso; abrir Start Page; **Linux:** usar menu global (se disponível), barra de título nativa/custom, notificações do desktop para tarefas longas em segundo plano (libnotify) [I].
### Appearance & Theme [C: cores/fontes; temas I]
Tema: **Auto (segue sistema)** / Claro / Escuro / [Alto contraste]; cor de destaque (accent) da paleta (5 presets + custom com checagem de contraste AA); densidade (Compacta 24px / Confortável 28px); zoom da UI (80–200%); fonte da UI (padrão do sistema); ícones (traço fino/cheio); animações (reduzir). Troca imediata. Painel de pré-visualização (mini janela).
### Language [I]
Idioma da UI: Auto, English, Português (Brasil), Español… (carregado de catálogos); aviso "Requer reiniciar" quando aplicável (preferir hot-reload); formato de data/número do grid: Sistema/ISO/Custom; separador decimal.
### Layout & Windows
Padrão de docks, auto-ocultar, restaurar layout padrão [Reset Layout]; posição do painel de resultados (abaixo/direita); abas: posição (topo/baixo), mostrar ícones/fechar, limite de abas antes de overflow, abrir novo documento ao lado.
### Startup / Files & Backups
Abrir último workspace/Start Page/vazio; pasta padrão de scripts (`~/Documents/dbForgeLinux`); auto-save e backup de rascunhos; encoding padrão (UTF-8), fim de linha (LF); preservar BOM.
### Text Editor > General / Fonts / Syntax Colors [C fonts/colors]
General: números de linha, folding, minimap, guias de indentação, destaque da linha atual, whitespace visível (None/Selection/All), quebra de linha, tab size (4)/inserir espaços, trim trailing whitespace ao salvar, bracket matching/auto-close, multicursor Alt+clique, scroll beyond last line, colar com PRIMARY (Linux) [I].
Fonts: família monoespaçada (lista do sistema com preview e busca), tamanho (8–32), altura de linha, ligaduras (off), peso. Amostra ao vivo.
Syntax Colors: tabela de tokens (keyword, string, number, comment, function, identifier, operator, error…) com cor claro/escuro editáveis (color picker + hex), [Reset], importar/exportar esquema; mostra contraste AA e amostra SQL.
### Code Completion [C]
Autocomplete automático ao digitar (on/off), atraso (ms), após `.` / `FROM` / `JOIN`; caixa de seleção: palavras-chave, tabelas, colunas, funções, snippets, aliases, mostrar descrições; **case** das palavras-chave inseridas (Upper/Lower/Como digitado); inserir com Tab/Enter; carregar metadados (tamanho de cache, "Atualizar em segundo plano"), sugerir objetos de outros databases; sinalizar sugestão de JOIN por FK [I].
### SQL > Execution
Executar: Seleção ou tudo; comportamento ao erro (Parar/Perguntar/Continuar); timeout de comando (0 = ilimitado) [C timeouts]; limite de linhas por resultado (1000; ilimitado com aviso); confirmar DML/DDL destrutivo (DELETE/UPDATE sem WHERE, DROP/TRUNCATE) (**ligado** padrão); autocommit on/off (off exibe indicador de transação pendente na status bar + [Commit][Rollback]); alertar fechar doc com transação aberta; mostrar mensagens de warning; abrir resultados em novo painel/aba; SET inicial por sessão (modo SQL).
### SQL > Results Grid
Altura de linha; zebra; grade; alinhar números; formato de NULL (texto/cor), data/hora, BLOB, booleano; largura máx. de coluna; auto-fit na carga; fonte do grid; copiar com cabeçalhos por padrão; truncar texto longo em N chars.
### SQL > History [C: retenção]
Registrar histórico (on); **retenção 60 dias (padrão), até 365** [C]; limite de tamanho; ignorar Prod; mascarar IDENTIFIED BY; [Clear history…] (confirma); local do armazenamento (leitura).
### SQL > Formatting [C: regras de formatação]
Painel com **sub-árvore**: General (indentação, largura de linha, quebra), Case (keywords/functions/types/identificadores: Upper/Lower/Keep), Lists (SELECT/columns, uma por linha, vírgula antes/depois), Joins/FROM/WHERE (quebra e alinhamento de AND/OR, ON), Subqueries/CTEs, DML/DDL (INSERT, CREATE TABLE com colunas alinhadas), Comments, Procedures (BEGIN/END, IF/CASE). **Preview ao vivo** de amostra SQL (esq. entrada, dir. formatado), [Perfis]: Padrão, Compacto, Estilo "Expandido"; salvar/importar/exportar perfil JSON; formatar ao colar (opcional); atalho Ctrl+K Ctrl+D (01).
### SQL > Code Analysis (ver 18 §3): regras e severidade.
### Connections > General/Security/Timeouts
General: conexão padrão para novos documentos; abrir SQL ao conectar; reconectar automaticamente; SSL padrão (Preferred). Security: armazenar senhas no cofre do SO (on); se indisponível: perguntar; limpar clipboard após copiar senha (30s); bloquear exportação de senhas; mostrar fingerprint SSH. Timeouts: conexão (15s), comando, keep-alive, SSH keepalive (alinha com 02 §2.5).
### Keyboard [C: atalhos configuráveis]
Tabela: Comando | Atalho(s) | Contexto (Global/Editor/Grid/Explorer…) | Fonte (Padrão/Usuário). Busca por comando ou por tecla (campo "Pressione teclas…"). Editar: duplo clique → captura tecla (Esc cancela, Backspace limpa); detecção de **conflitos** (lista dos comandos conflitantes, opções: Reatribuir/Cancelar); [Reset] por linha e geral; esquemas predefinidos: Padrão, **DBeaver-like**, **SSMS-like**, **VS Code-like** [I]; import/export JSON. Avisos de combinações reservadas por DE/WM (ver 01 §10).
### Tools > AI Assistant / Debugger / Profiler / Source Control / Data Tools
AI: ver 17 §4 (provedor, privacidade, redação). Debugger: rollback após depurar (on), confirmar execução real. Profiler: modo padrão, usar Performance Schema, avisos DML. Source Control: nome/email Git, rebase vs merge no pull, chave SSH padrão. Data Tools: delimitador CSV padrão, encoding, pasta de export, tamanho de lote.
### Network > Proxy / Updates
Proxy: Sistema/Manual/Nenhum, host/porta/auth (senha no cofre), [Test]. Updates: verificar atualizações (off por padrão no `.deb`; via apt do repositório) [I]; canal; sem telemetria (declaração explícita: nenhuma coleta de dados).

## 3. Estados
| Estado | Comportamento |
|---|---|
| Carregando | skeleton nas páginas (breve) |
| Erro ao salvar settings (permissão/JSON inválido) | banner vermelho no topo do diálogo + [Tentar de novo] [Abrir pasta]; arquivo corrompido é movido para `.bak` e padrões carregados com aviso |
| Valor inválido | borda vermelha + mensagem inline; OK/Apply desabilitados |
| Sucesso | "Alterações aplicadas" no rodapé (3s) e diálogo mantém aberto no Apply |
| Conflito de atalho | diálogo de reatribuição |
| Reset | confirma "Restaurar padrões desta página?" |

## 4. Atalhos do diálogo
Abrir Ctrl+,; buscar opções Ctrl+F (ou digitar na árvore); Apply Alt+A; OK Enter; Cancelar Esc; Navegar árvore ↑↓; Restaurar página Alt+R [I].

## 5. Temas / acessibilidade
Tokens 01; alto contraste; ao mudar tema/zoom, o próprio diálogo reflete na hora; campos com labels e descrições (aria-describedby); toda a árvore/tabelas por teclado; captura de tecla anuncia a combinação.

## 6. Componentes
OptionsDialog (árvore + busca), SideTree, FormField, Toggle, Select, Slider, ColorPicker (com contraste AA), FontPicker, KeybindingTable (captura/conflito), LivePreview (formatação/tema/fonte), Banner, ConfirmDialog.

## 7. Critérios de aceite
- Todas as categorias acima abrem, validam e persistem em settings.json; busca localiza campos; defaults por campo/página restauráveis.
- Tema Auto/Claro/Escuro, fonte, formatação SQL e atalhos têm efeito imediato com preview; conflitos de atalho detectados.
- Estados de erro/sucesso cobertos; teclado completo.
