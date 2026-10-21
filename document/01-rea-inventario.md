# 01 — Inventário REA (Fase 1)

Classificação: CONFIRMADA (observada no artefato) · INFERIDA (deduzida de nomes/estrutura) · DESCONHECIDA · ADAPTADA PARA LINUX.

## Alvo
| Item | Valor | Status |
|---|---|---|
| Artefato | `~/Downloads/tuxsqlmysql.exe` (142.861.904 B, PE32 i386) | CONFIRMADA |
| Tipo | Instalador Inno Setup 5.6.0 (`innoextract`) | CONFIRMADA |
| Produto | dbForge Studio for MySQL **v2026.2.82** (FileVersion 2026.2.82.0) | CONFIRMADA |
| Edição (Express/Std/Pro/Ent) | Não determinada ainda (verificar chaves de licença/Trial em `Devart.Trial.*`) | DESCONHECIDA |
| App principal | `app/tuxsqlmysql.exe`, .NET Framework 4.7.2, WinForms + DevExpress 24.2 | CONFIRMADA |
| Ofuscação | Tipos internos renomeados (`i3.*`, `Obfuscation.Mark`), recursos com GUID; tipos/namespace públicos `Devart.DbForge.*` preservados | CONFIRMADA |
| Extração | `re/extracted/` (gitignored, 484 MB, 252 arquivos em `app/`) | CONFIRMADA |
| Evidência REA | `ev_193e4a78…` (inspect_managed_artifact exe), `ev_3a637c9d…` (members Devart.DbForge.MySql.dll), bundle `re/evidence/members-mysql.json`, `re/evidence/namespaces.txt` (1579 namespaces) | CONFIRMADA |

Método: sem contornar licenciamento/proteção; apenas inventário estático de metadados, recursos e arquivos de dados do instalador. Ghidra não é necessário (alvo gerenciado); decompilação de lógica interna é DESNECESSÁRIA para paridade comportamental e evitada — implementação própria baseada em comportamento.

## Stack da referência (CONFIRMADA)
Devart.Shell.* (shell/docking/estúdio), DevExpress 24.2 (UI/grids/charts/pivot/report), Devart.DbForge.* (domínio), Devart dotConnect MySQL (`Devart.DbForge.Data.MySQL`), CefGlue (Chromium embutido: Copilot/ajuda), Antlr3/4 (parser SQL), IronPython (scripting), LiteDB, Refit/Google Sheets/OpenXml (exportações), SSH tunnel (`tunnel.php` HTTP tunnel), Mercurial.Net/TFS/Git (controle de versão).

## Módulos (assembly → função; função INFERIDA do nome salvo indicação)
| # | Módulo | Assemblies | Prio |
|---|---|---|---|
| M1 | Shell / janelas / docking / layout / temas | Shell.*, DefaultLayout.xml (CONFIRMADA em recursos), Skin/*.vsf | P0 |
| M2 | Conexões (connection manager, SSH, HTTP tunnel, SSL, categorias) | Data.MySQL, MySql, Connectivity ns, ConnectionCategory ns | P0 |
| M3 | Database Explorer (árvore de objetos) | ObjectExplorer(.MySql), ObjectExplorerSR | P0 |
| M4 | Editor SQL (documentos, execução, múltiplos resultados, histórico, warnings, plano) | ScriptSupport, SqlDocument, ExecutionHistory, ExecutionWarnings, LanguageService | P0 |
| M5 | Autocomplete/formatter/snippets/Parser | SqlComplete(.Core), Parser, Antlr, Snippets (35+ `.snippet` CONFIRMADOS em commonappdata) | P0/P1 |
| M6 | Grid de dados / Data Editor (edição, filtro, master-detail, pivot, export) | DataEditor, MasterDetail, PivotGrid | P0 |
| M7 | Editores de objetos (tabela, view, procedure, function, trigger, event, índices, FK) + DDL gen | DbEditors(.MySql), DbObjects(.MySql), DbObjectControllers, DdlGenerate ns | P1 |
| M8 | Import/Export de dados (CSV, Excel, JSON, XML, SQL, Google Sheets…) | DataExportImport(.MySql) | P1 |
| M9 | Schema Compare / Data Compare / sync scripts | Compare(.MySql), Compare.UI | P2 |
| M10 | Query Builder visual | QueryBuilder | P2 |
| M11 | Database Diagram (ER) | DatabaseDiagram(.MySql), Diagramming | P2 |
| M12 | Security Manager (users/privileges), Session Manager | SecurityManager, SessionManager | P2 |
| M13 | Query Profiler | QueryProfiler(.MySql) | P2 |
| M14 | Data Generator | DataGeneration(.MySql) | P3 |
| M15 | Documenter | Documenter | P3 |
| M16 | Debugger de rotinas | Debugger(.MySql) | P3 |
| M17 | Source control / Projects / Version control | SourceControl, ProjectSupport, VersionControl | P3 |
| M18 | Find Invalid Objects, SQL Search, Code Analysis | FindInvalidObjects, SqlSearch, CodeAnalysis | P3 |
| M19 | Data Report / Analytics / Copilot (IA) | DataReport, Copilot.*, Analytics | P3/P4 |

## Desconhecidas / a investigar
- Layout exato (DefaultLayout.xml, 198 KB), menus/toolbars/comandos (recursos *.resources em Devart.DbForge.Resources*.dll), strings de erro.
- Formato de armazenamento de conexões/configurações (LiteDB? XML?). Confirmar sem expor credenciais.
- Edição da licença; recursos Pro/Enterprise vs Standard.
- Comportamento runtime (não executável no Linux sem Wine; Wine ausente) — validação de paridade será via ajuda/recursos/documentação pública + testes próprios.

## Adaptações Linux (ADAPTADA)
Credenciais via libsecret (keytar/safeStorage), caminhos XDG, tema claro/escuro seguindo GTK, empacotamento .deb, SSH tunnel nativo (ssh2), sem COM/Registry/TFS/Windows-auth, sem CEF (Electron já é Chromium).
