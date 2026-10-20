# 03 — Matriz de paridade (inicial; nada implementado)
| ID | Funcionalidade dbForge | Evidência | Comportamento esperado | Estado | Testes | Diferenças |
|---|---|---|---|---|---|---|
| F-CON | Gerenciador de conexões MySQL (host/porta/user/senha/schema, SSL, SSH, HTTP tunnel) | Data.MySQL, tunnel.php | Criar/editar/testar/conectar | I0: driver+cofre ok; I1 em andamento | unit 6 + integ 1 (I0) | HTTP tunnel no I14 |
| F-EXP | Database Explorer | ObjectExplorer.MySql | Árvore dbs>tabelas/views/rotinas/triggers/events | planejado | — | — |
| F-SQL | Editor SQL + execução + resultados múltiplos | ScriptSupport, ExecutionHistory | Executar seleção/script, abas de resultado, histórico | planejado | — | — |
| F-AC | Autocomplete/formatter/snippets | SqlComplete, 35 snippets | Sugestões contextuais | planejado | — | — |
| F-GRID | Grid de dados editável | DataEditor | Paginar, ordenar, filtrar, editar, commit | planejado | — | — |
| F-OBJ | Editores de objetos + DDL | DbEditors.MySql | Criar/alterar tabela etc. com preview DDL | planejado | — | — |
| F-IMEX | Import/Export | DataExportImport | CSV/JSON/XML/HTML/XLSX/SQL | motor backend aprovado (c7cbc43), UI pendente | unit+integ docker (100k linhas) | sem UI; Google Sheets/Access/ODBC pendentes |
| F-CMP | Schema/Data Compare | Compare.MySql | Diff + script de sync | motor de schema/DDL/diff aprovado (858067a); Data Compare e UI pendentes | integ docker (A==B) | — |
| F-QB / F-ER / F-SEC / F-PRF / F-GEN / F-DOC / F-DBG / F-VCS | demais módulos M10–M19 | ver 01 | — | planejado | — | — |

## Nível de evidência das UX Specs
Specs 01–08 (Antigravity): layouts e comportamentos **INFERIDOS** de convenções MySQL/dbForge e do inventário REA; docs.devart.com não foi consultada. Pendência: validar contra a documentação pública e contra os recursos do binário (strings de menus/diálogos nas DLLs *Resources*) antes de declarar paridade.
