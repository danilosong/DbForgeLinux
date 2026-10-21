# Lacunas encontradas na varredura do original (rodada 2) — fila de trabalho

Fonte: observação do produto de referência numa VM (material privado, fora do repositório). Redação própria; a coluna
"Clone hoje" é uma checagem rápida do arquiteto e deve ser confirmada por quem implementar.

Prioridade: **A** = uso diário do editor; **B** = útil; **C** = acabamento.

| # | Área | O que o original tem | Prioridade | Esforço |
|---|---|---|---|---|
| 1 | Editor › Refatoração | Rename (F2) de objeto/alias, *Qualify object names*, *Expand wildcards* (`*` → colunas), adicionar/remover crases em identificadores, *Select Current Statement*. Comportamento observado: *Expand wildcards* troca `select * from t a` por uma coluna por linha, todas qualificadas pelo **alias** (inclusive colunas geradas); *Add Backticks* envolve só identificadores (palavras-chave intactas) | A | M |
| 2 | Editor › Edição | Maiúsculas/minúsculas (Ctrl+Shift+U / Ctrl+U), comentar bloco/seleção, mover linhas (Alt+↑/↓), juntar/remover linha, indentar, busca incremental (Ctrl+I), mostrar espaços, quebra de linha, números de linha | A | P |
| 3 | Editor › Marcadores e dobras | Bookmarks (alternar/anterior/próximo/limpar, `Ctrl+B,x`) e *Outlining* (dobrar/expandir, `Ctrl+M,x`) | B | M |
| 4 | Editor › Completar | *List Members*, *Parameter Info*, *Quick Info*, *Complete Word*, *Insert Snippet* (`Ctrl+K,X`), *Refresh Suggestions*, *Disable Code Completion*, *Go To Definition* (F12), *Jump Between Syntax Pairs* | A | M |
| 5 | Editor › Execução | *Execute To Cursor* (Ctrl+Shift+F10), *Run To Cursor* (Ctrl+F10, no debug), *Insert Breakpoint* | B | P |
| 6 | Editor › Formatação | Perfis de formatação ativos (*Active Format Profile*) selecionáveis no menu | B | M |
| 7 | Menu de contexto do editor | Menu completo (Insert Snippet, Cut/Copy/Paste, Execute*, Go To Definition, Refactoring ▶, Format ▶, Settings ▶) | A | P |
| 8 | Abas de documento | Menu de contexto: *Close All But This / Unmodified / Pinned*, *Copy Full Path*, *Open Containing Folder*, *Float*, *Pin Tab*, grupos de abas horizontal/vertical | B | G |
| 9 | Explorer › nós | Menus por nível: servidor (*Modify Connection*, *Create Connection Like*, *New Database*, *Close*), database (*New Object ▶*, *Open Editor*, *Generate Script As ▶*), pastas (*New <Tipo>*, *Filter...*, *Show Details*) | A | M |
| 10 | View › Other Windows | *Diagram Overview* (miniatura do diagrama), *Data Source*, *Group and Sort*, *Scripts Errors*, *Query History* (`Ctrl+Alt+H`) | B | M |
| 11 | Janelas acopláveis | *Properties* com categorias/A-Z/descrição, *Data Viewer* com botões de formato, *Schema View* com navegação ◀ ▶, *Code Snippets* com prévia | B | M |
| 12 | Edit › Find and Replace | *Find in Files* e *Replace in Files* com atalhos `Ctrl+Shift+F` / `Ctrl+Shift+H` | B | P |
| 13 | Criação como documento | *New Database*, *New Table*, *New Procedure/Function/View/Trigger/Event* abrem um documento próprio (General/SQL) com nome padrão, opções do objeto (conta *Definer*, *SQL Access*, *Deterministic*), grade de parâmetros e **DDL ao vivo**; *Apply Changes* / *Script Changes* | A | M |
| 14 | Import › tabela nova | Criar tabela a partir do arquivo com **tipos inferidos** (o clone hoje só importa em tabela existente), mapeamento editável (adicionar/editar coluna, *Fill/Clear Mapping*), *Skip Lines* e *Header Position*, delimitador autodetectado, passo *Output* (editor / arquivo / direto), tela final com *Errors / Warnings / Rows imported* e *Import more*. **O clone deve fazer melhor que o original:** usar `utf8mb4` (o original cria `utf8mb3`), `DECIMAL`/`JSON`/`TEXT` quando o conteúdo pedir e permitir escolher PK | A | M |
| 15 | Diferença intencional | IA: o original exige conta na nuvem (*Sign In*); o clone usa chave própria. Telemetria: o original vem ligada; o clone não tem | — | — |

Como medir: cada item vira linhas em `FIDELIDADE-MEDIDA.md` (rodada 3) com evidência (teste ou captura do clone).
