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
| 15 | Execução: tela final padronizada | Todos os assistentes terminam numa tela *Finish* com resultado (*Errors count / Warnings / Rows imported* ou *Total objects*), *Show log file...*, *Import more / Export more* e (quando há arquivo) *Open result file / Open result folder* | A | P |
| 16 | Execução: padrões e avisos | Geração de dados: **avisa no Summary** que vai truncar a tabela (opção ligada por padrão); sincronização recarrega a comparação sozinha e abre o *Error List* com os avisos do servidor (colunas Description/Location/Line/Column, filtros Errors/Warnings/Messages); Copy Databases mostra *Progress ✓ Complete* e *Elapsed* por banco | A | M |
| 17 | Execução: **o clone deve ser mais seguro** | No original, a sincronização executou `DROP TABLE` sem confirmação extra e o Import/Generate executam direto por padrão. O clone mantém confirmação forte, preview obrigatório e padrão *script no editor* — registrar como diferença INTENCIONAL | — | — |
| 18 | Backup | Opções de dump granulares (*Structure*/*Data* separados, árvore por tipo de objeto, *Include DEFINER/DROP/IF EXISTS/USE*, *NO_AUTO_VALUE_ON_ZERO*, *Lock all tables for read*, *Flush logs*) e projeto salvo — **implementado nesta rodada**, com contagem de objetos e opção de abrir o script ao concluir | B | M |
| 19 | Master-Detail | Soltar uma 2ª tabela detecta a FK sozinha (mestre roxo, detalhe cinza, seta), aba Data com o detalhe **filtrado pela linha mestre** e *Fetch Limit*/*Where* | B | M |
| 20 | Pivot | Hierarquia de datas expansível no campo `ordered_at`, soma automática com *Grand Total*, chip de campo com função de agregação e campos em uso destacados | B | M |
| 21 | Report | *Send to › Data Report* abre direto o **designer com bandas** (ReportHeader/Detail, Group and Sort, Data Source, Properties, Preview) e não um assistente | B | G |
| 22 | Localizar | Janela *Find and Replace* única (modos Find/Replace, escopo *Look in*, *Search hidden text*, regex) e *Go To Line* com intervalo válido | B | P |
| | 23 | Diferença intencional | IA: o original exige conta na nuvem (*Sign In*); o clone usa chave própria. Telemetria: o original vem ligada; o clone não tem | — | — |

| 24 | Query Builder: menu Query e subquery | Ao soltar `customers` e `orders` a junção por FK nasce sozinha (losango no canvas). O menu *Query* oferece *Change Type*, *Parent Query*, *Create Subquery*, *Wrap to Subquery*, *Wrap to Insert*, *Group By*, ordenação, selecionar/limpar colunas, *Select All rows from [left/right table]*, *Show Tabbed Editor* e *Send Query to Report*. *Create Subquery* abre uma aba aninhada (*Root Query* / *SubQuery*) com canvas e grade próprios | M | Parcial |
| 25 | Security Manager | Árvore de usuários agrupada por host mais *Roles*; abas *General* (autenticação, senha, expiração, limites por hora, bloqueio de conta), *Roles*, *Users*, *Global Privileges* (grade Name/Granted com marcação geral e *With Grant Option*) e *Object Privileges*; barra com *Save*, *Undo*, *Script Changes* e *Create User* com menu | M | Parcial |
| 26 | Tools: skins e personalização | Cinco skins (Visual Studio Blue/Light/Dark, Office Light/Black), *Import and Export Settings*, *Customize*, *Reset Toolbar Layout*; o clone só tem claro/escuro | B | Parcial |
| 27 | Database › Tasks e Flush | Submenu *Tasks* reúne Export, Import, Backup, Restore, Data Generation, Documentation, *Create Scripts Folder*, Copy Databases e Find Invalid Objects (`Ctrl+Alt+F`); o menu Database ainda tem *Flush...* | B | Verificar |
| 28 | Find Invalid Objects | Barra *Analyze*, *Script as ALTER*, *Script as DROP*; escolha de bancos num seletor com busca, *Refresh*, *Check All* e *Uncheck All* | B | Existe no clone; comparar a barra |

| 29 | Restore | Assistente curto de 3 etapas (*Database Script File*, *Restore progress*, *Operation complete*): conexão, banco (*As in script* por padrão), arquivo SQL, codificação e botão *Save Command Line...* | B | Comparar com o clone |
| 30 | Link Database to Source Control | Assistente *Link / Progress / Finish* com conexão, banco, repositório (com botão de adicionar) e sistema detectado; modelo de desenvolvimento *Dedicated* (cada pessoa com sua cópia) ou *Shared* (um banco único) | M | Parcial |

Como medir: cada item vira linhas em `FIDELIDADE-MEDIDA.md` (rodada 3) com evidência (teste ou captura do clone).
