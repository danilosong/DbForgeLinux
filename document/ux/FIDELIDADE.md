# Fidelidade das UX Specs vs. evidência REA

Itens que continuam **[I]** (inferidos) por falta de evidência em `re/ui-strings/ui-text.txt` / REA shortcuts. Rótulos [C] estão na seção 'Textos de interface (referência)' de cada spec.

## Pendências globais
- Atalhos: New Connection no original é Ctrl+D Ctrl+N (spec 02 usa Ctrl+Shift+N [I]); atalhos de 06–13 sem evidência no mapa REA shortcuts.
- AI Assistant (17): multi-provedor/API key é adaptação do clone; original é serviço cloud Devart.
- Specs 01, 14, 17: ver notas 'Fidelidade REA' no topo de cada uma.

## Parte A
### Fidelidade REA — parte A (specs 02–05)

Itens que continuam **[I]** (sem evidência em `re/ui-strings/ui-text.txt`).

## 02-conexoes.md
- Abas/páginas General, Security, SSH, HTTP (nomes exatos; só "SSH Login", "Proxy Login" e "Advanced connection properties" confirmados).
- Modos SSL (Disabled/Preferred/Required/Verify CA/Verify Identity), TLS min. version, Cipher na UI.
- Connection color/environment (None/Dev/Test/Prod), Category/folder, "Edit as URL…", ssh-agent, Local bind port.
- Diálogo de fingerprint "Confiar?" e botões Aceitar e salvar/uma vez; validações de arquivo.
- Atalho Ctrl+Shift+N (original: Ctrl+D Ctrl+N), Ctrl+T para teste.

## 03-explorer-editor.md
- Rótulos pt-BR dos estados (grid vazio, cancelado, "parcial", Load more).
- Atalhos Ctrl+Shift+Enter, Shift+F5, Ctrl+Shift+R, Ctrl+Alt+PgDn, Alt+↑↓, Ctrl+Shift+D, Shift+Enter (Viewer).
- Copy As (CSV/JSON/INSERT/Markdown), Set NULL, Filter by this value, Open in Viewer, "Reordenar no servidor".
- Nomes de Insert Row/Delete Row/Post na toolbar de Table Data e mensagem "sem chave primária".

## 04-editor-tabela.md
- Nomes de páginas Indexes, Partitions, DDL, Data e painel Preview DDL (Ctrl+Alt+D).
- Rótulos Unsigned/Zerofill, Generated (VIRTUAL/STORED), Method (BTREE/HASH), Visible, Enforced.
- Textos de banner "Requer MySQL 8.0.16+…", "Nenhum trigger" e resumos de validação.
- Atalhos Ctrl+Insert, Alt+↑/↓ para colunas.

## 05-editores-objetos.md
- Algorithm (UNDEFINED/MERGE/TEMPTABLE), SQL Security, Data access, Returns, Starts/Ends, Schedule AT/EVERY.
- Aba Columns/Dependencies da view, Preview Data, Validate, "Output parameters", [Rollback after execute].
- Diálogo "Execute Procedure" (título exato) e banner "Event Scheduler desligado".
- Atalho Ctrl+Shift+R para abas inferiores.

## Parte B
### Fidelidade REA — parte B (specs 06–09): itens que continuam [I]

Critério: sem string correspondente em `re/ui-strings/ui-text.txt`. Specs 06–08 não usam tags [C]/[I]; os itens abaixo são decisões de UX sem evidência REA.

## 06-import-export
- Stepper de 7/8 passos e seus nomes em português (o REA só tem títulos de wizard, não a lista de passos).
- Formatos Markdown e TSV como formatos próprios; Excel com divisão em abas (limite 1.048.576).
- Opções Quote: Needed/All/Strings, Line ending LF/CRLF, Date format, base64 binário, batch 500 de INSERT.
- Run in background, copiar para a área de transferência, abrir pasta via xdg-open (REA só tem "Open folder").
- Padrão de nome `{table}_{date}.{ext}`; "Save template" no rodapé (REA tem "Load Template..." e arquivos .det/.dit).

## 07-schema-compare
- Diálogo de confirmação em 3 blocos (Resumo/Riscos/Opções) e checkbox "Entendo que dados podem ser perdidos".
- Digitar o nome do database em conexão Prod; perfis `.dbcmp` (REA usa `.dcomp` só para data compare).
- Opções Script: Don't drop objects, Wrap in transaction, Add comments (rótulos exatos não achados).
- Atalhos Ctrl+Shift+G/Y/W, F7 (não conferidos em REA shortcuts).
- Limite de 1M linhas e compare por hash no Data Compare.

## 08-seguranca-sessoes
- Presets de privilégio (Read only, Read/Write, DBA) e gerador de senha de 24 chars.
- Tri-state de herança de privilégios e banners de perigo.
- Abas Preview SQL e Limits como nomes; MAX_*_PER_HOUR literais.
- Bloqueio do próprio usuário/root e checkbox "Encerrar sessões ativas".
- Layout de Session Manager (Query/Locks) e escopo Session|Global em Server Variables (só "Session statistics" e "Server Variables" confirmados).

## 09-query-builder
- Auto Layout, minimapa, relações virtuais, modo lista para leitores de tela.
- Grupos de condições com parênteses/árvore avançada; CTE.
- Aba Order By e FULL OUTER via UNION.
- Atalhos Ctrl+Alt+Q, Ctrl+1/2/3, Ctrl+T, Ctrl+0.
- Menu SQL > New Query Builder (REA só confirma "Query Builder" e "Design Query").

## Parte C
### Fidelidade REA — Parte C (specs 10–13): itens que continuam [I]

Fonte conferida: REA ui-text (rótulos) e REA shortcuts. Itens abaixo sem evidência.

## 10-diagrama-er
- Atalhos do clone (V, H, Ctrl+L, Ctrl+D, Ctrl+0, F4): sem mapa REA (só bookmarks Ctrl+1..9 e Diagram Overview Ctrl+W,V existem).
- "Add Related", Auto Layout hierárquico/orgânico/ortogonal, snap-to-grid, ícones/cores do cartão.
- Edição de esquema pelo cartão (Add Column/Edit Table) e Apply to database.
- Exportar SVG/PDF (REA só tem Export to Image); formato JSON próprio no lugar de `*.dbd`.

## 11-query-profiler
- Atalhos Ctrl+Alt+P, Ctrl+Shift+H, Ctrl+Alt+T, Ctrl+Shift+C.
- Tabela SHOW PROFILE (colunas Status/Duration/%), barras, destaque âmbar, comparação lateral de execuções.
- Diálogo de aviso de DML / ROLLBACK, "Não registrar consultas Prod", máscara de literais, Pin, "Profile this query".
- Tree/Diagram do plano (colunas Tipo de acesso/Key/Custo).

## 12-data-generator
- Atalho Ctrl+Enter, "mesmo valor p/ todas", "Skip (server)", Null %, coluna Exemplo, mapeamento automático por nome + Reset to auto.
- Catálogo detalhado de generators por categoria (nomes reais só parcialmente no ui-text).
- Confirmação por digitar nome do database em Prod.

## 13-documenter
- Passos exatos do wizard (Origem/Conteúdo/Modelo/Saída), templates (Claro/Escuro/Minimal/Impressão), logo/cores/fonte.
- Saída DOCX, ZIP, busca offline, multi-database; Users como objeto.
- Atalhos: sem evidência.

## Parte D
### Fidelidade REA — Parte D (specs 15, 16, 18, 19): o que continua [I]

Sem evidência em REA ui-text / shortcuts:

## 15 Source Control e Projects
- Atalhos (Ctrl+Alt+G, Ctrl+Enter, Ctrl+Shift+L/K, Ctrl+Shift+J) e formato `.dbproj.json`.
- Grafo de History, Cherry-pick, Rebase, editor de 3 vias com Accept Ours/Theirs (original só tem Merge/Conflict Records).
- Nomes das abas Changes/History/Branches/Conflicts; credencial via libsecret/PAT.

## 16 Data Viewer, Pivot, Report
- Abas XML/HTML do Data Viewer; Alt+1..4, "% do total", Ctrl+Alt+V / Ctrl+Shift+H.
- Tipo Pivot no wizard de report, Barcode, DOCX, formato `.dbrep` (original usa `.rdb`/`.mdet`).
- Nomes dos controles do Toolbox do designer, bandas e atalhos do designer.
- Detalhes aninhados no Master-Detail.

## 18 Ferramentas extras
- Atalhos: Code Analysis, Toolbox, Start Page, Insert Snippet (só DocOutline confirmado).
- Mecânica de checagem de objetos inválidos, regras do Code Analysis, systemd/polkit no Service Control (adaptação Linux).
- `-- #region` no Outline, feed de novidades, formato `.snippet`-like.

## 19 Configurações
- Ctrl+, e atalhos do diálogo (Alt+A/Alt+R); busca de opções "Buscar opções…".
- Páginas Appearance & Theme (temas), Network > Proxy/Updates, Connections > Timeouts, Tools > AI/Debugger/Profiler (nomes não localizados).
- Valores padrão (tab 4, delay, 30s de rascunho, 10 recentes).
