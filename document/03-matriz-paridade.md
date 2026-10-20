# 03 — Matriz de paridade funcional

Estado em 2026-10-20. **Nenhuma funcionalidade tem "paridade validada"** (DoD §13): o dbForge original não foi executado lado a lado; a comparação é feita contra a evidência REA (strings/UI text/atalhos/mecanismo) e contra as UX specs. Legenda: `implementado` = código + testes + screenshot; `parcial` = lacunas listadas; `em andamento`; `planejado`.

| ID | Funcionalidade dbForge | Evidência | Estado | Testes | Diferenças / lacunas conhecidas |
|---|---|---|---|---|---|
| F-CON | Gerenciador de conexões (SSH, SSL, cofre) | Data.MySQL, ui-text | implementado | unit + integ | HTTP tunnel em andamento (I14) |
| F-EXP | Database Explorer | ObjectExplorer.MySql | implementado | unit | ações Design/Edit via I4 |
| F-SQL | Editor SQL (Monaco) + execução + resultados | ScriptSupport | implementado | unit + integ | Execute To Cursor / explain a validar |
| F-AC | Autocomplete / snippets / formatter / Query History | SqlComplete (35 snippets) | implementado | unit | 37 snippets próprios; formatter não comparado com o original |
| F-GRID | Grid virtual com filtro/export de seleção | DataEditor | parcial | unit | edição inline/commit a validar |
| F-OBJ | Table Designer + editores View/Proc/Func/Trigger/Event | DbEditors.MySql | implementado | unit + integ | partições básicas; preview DDL por diff |
| F-IMEX | Import/Export (CSV/JSON/XML/XLSX/SQL/HTML) | DataExportImport | implementado | unit + integ | Google Sheets/Access/ODBC pendentes |
| F-CMP | Schema Compare + Data Compare | Compare.MySql | implementado | unit + integ | sync destrutivo exige confirmação |
| F-QB | Query Builder | spec 09 | implementado | unit | parser SQL→modelo só para consultas simples |
| F-ER | Diagrama ER | spec 10 | implementado | unit | relações virtuais persistidas por conexão/database |
| F-SEC | Security Manager + Session Manager + Server Variables | spec 08 | implementado | unit + integ | — |
| F-PRF | Query Profiler | spec 11 | implementado | unit + integ | — |
| F-GEN | Data Generator | spec 12 | implementado | unit + integ | — |
| F-DOC | Documenter | spec 13 | implementado | unit | export HTML/PDF/Markdown |
| F-VCS | Source Control / Projects (Git) | spec 15 | implementado | unit (repo temp) | Hg/TFS fora do escopo |
| F-RPT | Data Report / Pivot | spec 16 | implementado | unit | export CSV/HTML/PDF |
| F-AI | AI Assistant | spec 17 | implementado | unit (servidor falso) | **ADAPTADA PARA LINUX:** multi-provedor, chave do usuário no cofre; original é serviço cloud Devart |
| F-OPT | Options / atalhos | spec 19 | implementado | unit | remapeamento com detecção de conflito |
| F-TOOLS | SQL Search, Find Invalid Objects, Backup/Restore, Copy Database | spec 18 | implementado | unit | — |
| F-DBG | Debugger de rotinas | 05-rea-debugger | em andamento | — | triggers/funções limitados por versão (a documentar) |
| F-TUN | HTTP tunnel, Service Control, Code Analysis | inventário | em andamento | — | — |
| F-PKG | Empacotamento .deb + smoke e2e | — | em andamento | — | — |

## Nível de evidência das UX Specs
Specs 01–19 verificadas contra `ui-text` (REA) em `document/ux/FIDELIDADE.md`; o que segue inferido [I] está listado ali. Screenshots claro/escuro em `document/evidence/ui/`.

## Revisões
- Commits e263392/59daf88 revisados: HIGH data-compare (ordenação por collation), MEDIUM security (ordem de opções CREATE/ALTER USER) e LOW sessions corrigidos em eb2bf6d; integração MySQL 65/65.
- Revisão de segurança independente: em andamento (`document/security-review.md`).
