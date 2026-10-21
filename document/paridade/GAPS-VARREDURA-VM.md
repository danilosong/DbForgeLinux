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
| 25 | Security Manager | Árvore de usuários agrupada por host mais *Roles*; abas *General* (autenticação, senha, expiração, limites por hora, bloqueio de conta), *Roles*, *Users*, *Global Privileges* (grade Name/Granted com marcação geral e *With Grant Option*) e *Object Privileges*; barra com *Save*, *Undo*, *Script Changes* e *Create User* com menu | M | Parcial; IPC endurecido |
| 26 | Tools: skins e personalização | Cinco skins (Visual Studio Blue/Light/Dark, Office Light/Black), *Import and Export Settings*, *Customize*, *Reset Toolbar Layout*; o clone só tem claro/escuro | B | Parcial |
| 27 | Database › Tasks e Flush | Submenu *Tasks* reúne Export, Import, Backup, Restore, Data Generation, Documentation, *Create Scripts Folder*, Copy Databases e Find Invalid Objects (`Ctrl+Alt+F`); o menu Database ainda tem *Flush...* | B | Verificar |
| 28 | Find Invalid Objects | Barra *Analyze*, *Script as ALTER*, *Script as DROP*; escolha de bancos num seletor com busca, *Refresh*, *Check All* e *Uncheck All* | B | Existe no clone; comparar a barra |

| 29 | Restore | Assistente curto de 3 etapas (*Database Script File*, *Restore progress*, *Operation complete*): conexão, banco (*As in script* por padrão), arquivo SQL, codificação e botão *Save Command Line...* | B | Comparar com o clone |
| 30 | Link Database to Source Control | Assistente *Link / Progress / Finish* com conexão, banco, repositório (com botão de adicionar) e sistema detectado; modelo de desenvolvimento *Dedicated* (cada pessoa com sua cópia) ou *Shared* (um banco único) | M | Parcial |

| 31 | Data Compare: assistente | Três páginas (*Source and Target*, *Options*, *Mapping*) com botões de copiar origem/destino, trocar lados e *Save* com menu. *Options* tem busca, gravação em arquivo de argumentos de linha de comando, descrição da opção selecionada e *Save As My Defaults* / *Devart Defaults* / *My Defaults*; grupos *Auto Mapping* (ignorar maiúsculas, sublinhados e espaços nos nomes, incluir/excluir por máscara, ignorar colunas LOB, por máscara e calculadas, excluir objetos novos) e *Comparison Options* (tabelas/views, arredondar float, ignorar maiúsculas, microssegundos, espaços à esquerda e internos). *Mapping* tem *Map Objects*, *Unmap*, *Reset*, *Custom Query*, *Filter*, chave de comparação por objeto, contagem *N of M columns* (negrito quando há colunas fora) e aviso de objetos sem par | M | Parcial: comparar opções e o mapeamento |

Como medir: cada item vira linhas em `FIDELIDADE-MEDIDA.md` (rodada 3) com evidência (teste ou captura do clone).

## Atualização de segurança e execução (2026-10-21)

- **#25 Security Manager:** os campos IPC de contas, mudanças, escopos, privilégios e roles agora têm validação por discriminante, campos permitidos e limites. Isso reduz risco de entrada forjada, mas não fecha a diferença de apresentação/fluxo da grade nem substitui evidência e2e.
- **#20, #21, #23–24, #26–30:** esta rodada não alterou o escopo funcional desses itens; seus estados e pendências acima continuam válidos.
- **Debugger de triggers (fora da faixa 20–30):** o checkpoint lê comandos de estado confirmados durante a DML e usa um advisory lock para expor a linha pausada. O snapshot do trigger não contém variáveis locais e Step Out não percorre uma pilha filha; são limites do modelo, registrados na divergência do debugger.

## Rodada de implementação — gaps 20, 21 e 24

| Item | Estado verificado nesta rodada | Cobertura |
|---|---|---|
| 20 — Pivot | Implementado | Níveis temporais Year/Quarter/Month/Day selecionáveis por coluna de data, labels da hierarquia no resultado e linha Grand Total. Testes unitários cobrem níveis repetidos e agregação total. |
| 21 — Report | Implementado | Entrada abre direto o canvas WYSIWYG, sete bandas com drag-and-drop, painéis Data Source / Group and Sort / Properties, prévia paginada e abrir/salvar desenho JSON com consulta incluída. |
| 24 — Query Builder | Implementado | Confirmado que arrastar coluna entre cartões já traça joins; adicionadas abas Root Query/SubQuery, Wrap to Subquery/Insert e seleção de colunas por tabela à esquerda/direita. |

A tela de relatório preview usa as linhas retornadas pelo limite do carregamento de dados; a consulta SQL e o desenho ficam no arquivo JSON e podem ser recarregados. Wrappers do Query Builder geram SQL em modo texto para revisão, sem execução automática.

### Evidência e estado dos gaps 20–30 — rodada atual

| # | Estado verificado no clone | Evidência / pendência |
|---|---|---|
| 20 | Parcial | Nenhuma alteração nesta rodada. |
| 21 | Parcial | Nenhuma alteração nesta rodada. |
| 22 | Parcial | Nenhuma alteração nesta rodada. |
| 23 | Adaptado | Diferenças intencionais anteriores permanecem documentadas. |
| 24 | Parcial | Smoke existente exercita construção de JOIN e agora inclui navegação entre Root Query/SubQuery. |
| 25 | Implementação parcial | Global Privileges tem Granted e With Grant Option por privilégio; smoke passou pelas abas principais e cabeçalhos. Create User e Script Changes já estavam disponíveis. |
| 26 | Implementado em parte | Skin Blue/Office, Customize e Reset Toolbar Layout agora funcionam; smoke comprovou Skin Blue e ocultação de Results. Import/Export Settings continua indisponível. |
| 27 | Parcial implementado | Database > Tasks reúne os fluxos; View > Tasks mantém uma lista persistida das últimas execuções de Backup/Export/Import/Compare e permite reabrir o fluxo correspondente. Projetos de backup e templates seguem carregados nos seus assistentes; a lista não reabre parâmetros sigilosos nem caminho de arquivo. |
| 28 | Implementado | Barra de Find Invalid Objects apresenta Analyze, Script as ALTER e Script as DROP; seletor acessível oferece busca, Check All e Uncheck All. Script ALTER permanece habilitado apenas para views com definição recuperada. |
| 29 | Parcial implementado | Restore tem três etapas, confirmação de destino e Save Command Line: grava script mysql com quoting shell, modo 0700 e prompt de senha. Smoke verifica o conteúdo sem executar a restauração. |
| 30 | UI comprovada, backend adaptado para teste seguro | Smoke e2e percorre Link/Progress/Finish nos modelos Dedicated e Shared usando diretório descartável com `.git` e handlers IPC simulados; nenhum comando Git é executado conforme a regra da tarefa. O backend real continua coberto por testes de módulo existentes, não executados nesta rodada por invocarem Git. |

A trilha de startup foi adicionada como marca de renderização/pintura e observação de long tasks; isso não equivale a um perfil completo de CPU/memória. A primeira versão do Float abria uma cópia de leitura e os grupos marcavam somente orientação. O follow-up abaixo implementa sincronismo editável e painéis reais, com editor leve na divisão.

## Follow-up — Shell split e Explorer regex

| Gap | Estado | Evidência nesta rodada |
|---|---|---|
| Grupos de abas em painéis simultâneos | Implementado | Arrastar uma aba sobre outra abre um segundo painel com seletor independente. O painel é editável e compartilha o rascunho com o editor principal para o mesmo documento. Smoke verifica edição na divisão e leitura do texto na aba principal. |
| Multi-split sincronizado | Implementado com editor leve na divisão | A ação Split view abre o documento selecionado em dois painéis; o painel secundário edita o mesmo estado React controlado pelo editor principal. Grupos horizontais/verticais determinam a orientação. A divisão usa textarea para reduzir o custo de uma segunda instância Monaco. |
| Float sincronizado | Implementado | Janela flutuante carrega a mesma rota do renderer e recebe/sinaliza alterações por IPC com schema runtime e validação de origem. Smoke verifica abertura, conteúdo e propagação da edição para a janela principal. |
| Filtro avançado do Explorer | Implementado | O filtro aceita Regex e Case sensitive em conexões e nomes de objetos. Testes cobrem correspondência, sensibilidade e expressão inválida; smoke filtra a conexão descartável por regex. |

## Rodada de implementação — gaps 31–33

| Gap | Estado | Evidência nesta rodada |
|---|---|---|
| 31 — Data Compare | Implementado parcialmente, com Custom Queries executável | Map Objects lê tabelas/views das duas databases, aplica as opções de nome e informa objetos sem par; Auto Mapping alinha nomes normalizados. Opções pesquisáveis e agrupadas, defaults locais, ignorar microssegundos, filtro de mapeamento e contagem N of M. Custom Query executa SELECT de cada lado, somente leitura e limitado a 50 mil linhas. Testes unitários cobrem chaves duplicadas/ausentes, diferenças, precisão e bloqueio de escrita. Sincronização permanece indisponível para resultados arbitrários de consultas. |
| 32 — ER Diagram | Implementado | Overview existente ganhou retângulo de viewport e navegação pelo canvas; gerenciador de relações virtuais existente continua disponível. O teste smoke verifica o minimapa e abre o gerenciador sem criar relações persistentes. |
| 33 — Table Designer Card View | Implementado | A página Data alterna Grid/Card, mostra um registro por vez com navegação e apresenta valores NULL explicitamente. Teste unitário cobre a transformação e formatação do cartão; smoke abre o designer sobre tabela descartável. |

O compare por Custom Queries exige uma chave explícita e aceita apenas um SELECT/WITH de leitura por lado. Ele não gera DML de sincronização; a prévia de diferenças fica disponível para análise.

## Follow-up — Pivot Chart e Bookmarks/Outlining do editor

| Área | Estado | Verificação e comportamento atual |
|---|---|---|
| Pivot Chart | Implementado | O chart mantém a escolha de tipo (barras, linhas, pizza, área ou barras empilhadas), exporta SVG e agora reconstrói a projeção com debounce após alterações nas zonas de campos, hierarquia ou agregação. Uma resposta antiga de cálculo não substitui a configuração mais recente. Teste unitário troca o campo de linha e verifica que os rótulos mudam. |
| Bookmarks SQL | Implementado | Marcadores ficam presos ao modelo/documento Monaco, acompanham mudanças de linha por decorações e Previous/Next agora posicionam o cursor e fazem wrap-around. Toggle/Clear continuam no menu Edit e no contexto do editor; chords continuam centralizados no keymap. |
| Outlining SQL | Implementado | Toggle All alterna entre dobrar e expandir; Start Automatic Outlining e Stop Outlining aplicam os estados correspondentes ao modelo ativo. Ctrl+M,M continua alternando a dobra sob o cursor. |

## Tasks Explorer e acessibilidade dos assistentes

O Tasks Explorer é um dock em View e reabre o assistente associado à tarefa recente. A persistência grava apenas tipo, título, detalhe limitado e data; não armazena SQL, senha, caminho local ou arquivo selecionado. Os projetos de backup e templates de Import/Export continuam sendo carregados dentro dos respectivos assistentes, mas ainda não aparecem como itens separados no Tasks Explorer. A barra de Find Invalid Objects e o grupo de seleção de bancos foram reorganizados para navegação por teclado e leitores de tela.

### Gap 15 — Finish e abertura das saídas

O bloco Finish comum agora é usado por Import/Export, Backup/Restore, Documenter e Link Database to Source Control. Saídas de arquivo exibem **Open file** e **Open folder** via IPC `file:open-in-system`; o processo principal valida caminho absoluto, tipo regular, existência e ausência de symlink antes de chamar `shell.openPath` (integração do Electron com o abridor do sistema, incluindo `xdg-open` em Linux). Restore sem arquivo de saída mostra o relatório sem ações de abertura. Os demais painéis de execução imediata ainda apresentam o relatório no próprio painel e não têm uma etapa Finish própria; o gap fica parcialmente implementado até que esses fluxos ganhem uma etapa final comum.

## Auditoria de consistência para release v0.1.0

- **Resolvido:** títulos do registry agora apontam para chaves de painel presentes em en e pt-BR; a verificação automatizada percorre todos os painéis registrados e confere chamadas estáticas de tradução.
- **Resolvido nesta revisão:** mensagens de estado e erro embutidas em inglês nos painéis Code Analysis, Query Builder, Data Report/Pivot, AI Assistant e Service Control receberam entradas bilíngues. Mensagens técnicas retornadas pelo servidor continuam preservadas sem tradução para facilitar diagnóstico.
- **A validar manualmente:** truncamento depende de tamanho/escala, idioma, tema e conteúdo real. O checklist `document/RELEASE-CHECKLIST.md` registra navegação por teclado, foco, Escape, estados vazio/carregando/erro e revisão por módulo; não existe prova automatizada de truncamento de cada rótulo em todos os painéis.

## Follow-up — Data Generator e Profiler

| Gap | Estado | Evidência / limite |
|---|---|---|
| Data Generator: perfis de domínio | Implementado | Perfis People, Addresses, Companies, E-commerce, Finance, Date/Time e Text podem ser escolhidos por coluna ou substituídos por um gerador manual. Teste cobre mapeamentos semânticos e repetibilidade da prévia com seed fixa. |
| Profiler: histórico em duas colunas | Implementado | Lista de execuções selecionáveis fica ao lado dos detalhes e plano. Duas execuções podem ser marcadas para comparar duração, eventos, counters de sessão e estrutura do plano; variações de custo/estimativa não são consideradas mudança estrutural. Teste cobre deltas e mudança de plano. |

## Varredura final do Options do original (páginas já percorridas)

Observações em palavras próprias, feitas com o trial do usuário. Estado: B = baixa, M = média prioridade; "Comparar" = checar se o clone já tem.

| # | Página | Comportamento observado | Prioridade | Clone |
|---|---|---|---|---|
| O1 | Environment › General | Skin, animação de menus, abertura da última sessão ao iniciar, estatísticas anônimas (ligadas por padrão no original), verificação semanal de atualização, Start Page e splash opcionais, barra de status, tamanhos das listas de janelas e de arquivos recentes (10), descoberta de objetos não confirmados (experimental) | B | Parcial |
| O2 | Environment › Keyboard | Esquema de teclado adicional (dbForge) com *Reset*, filtro de comandos com *Show Table*, lista de comandos por nome, atalhos do comando selecionado com *Remove*, escopo do novo atalho (Global ou por contexto), *Assign* e indicação de qual comando já usa o atalho | M | Existe; comparar escopos e o aviso de conflito |
| O3 | Environment › Output | Hora nos eventos de saída, registro das consultas enviadas pelo programa em um *SQL Log*, registro de erros da aplicação e exclusão do log ao fechar | B | Comparar |
| O4 | Environment › Categories | Categorias de ambiente por servidor e banco (padrão `*`/`*` sem ambiente), com Development (quadrado verde), Production (círculo vermelho), Sandbox (triângulo azul) e Test (losango laranja); forma e cor identificam a conexão | **M** | **Falta** |
| O5 | Environment › Font and Colors | Escolha do escopo (editor de texto e outros), fonte e tamanho, lista de itens de exibição (linha atual, referências, identificador, palavra-chave, número, operador, dicas do otimizador, bloco, região…), cor de texto e fundo, negrito/itálico, amostra e *Reset Page Defaults* | M | Parcial: campos de cor do editor configuráveis; tema completo pendente |
| O6 | Environment › Tabs and Windows | Título da janela no menu, posição, layout (topo) e orientação das abas, indicador de alterado, onde inserir novas abas, tooltips ricos, negrito na aba ativa, várias linhas de abas, largura máxima, fechar com botão do meio e quando mostrar o botão fechar | B | Parcial |
| O7 | Environment › Projects / SMTP | Pasta dos projetos; servidor SMTP (remetente, servidor, porta 25, tempo limite 100 s, SSL e autenticação) usado para enviar resultados | B | Parcial: parâmetros SMTP validados/persistidos; segredo e envio ainda não integrados |
| O8 | Documents › SQL documents / Object editors | Layout dividido ou combinado, mostrar a visão de dados em todo documento, ativar o editor de dados após a consulta, mostrar parâmetros de saída após rotina, parar o script no primeiro erro | M | Parcial: preferências SQL/restauração versionadas; aplicação de layout/histórico pendente |
| O9 | Documents › Restore | Restauração de sessão a cada N minutos e quais tipos de arquivo reabrir (sql, mdet, dbd, rdb, dcomp, scomp, dgen, ddoc, txt, xml) | M | Parcial: intervalo e tipos configuráveis; reabertura automática pendente |
| O10 | Documents › Query History | Guardar histórico, local, tamanho máximo do script (1024 KB) e remoção automática de consultas com mais de 60 dias | B | Comparar |
| O11 | Documents › Execution Warnings | Tabela por categoria de ambiente (TRUNCATE/DELETE/UPDATE) com avisos ligados em Production, Sandbox e sem categoria; tamanho máximo do script analisado (5000 KB); etiquetas `-- nowarn` e `-- endnowarn` desligam o aviso num trecho | **M** | Implementado: categorias, limite de análise e diretivas SQL seguras |
| O12 | Documents › Notifications | Avisar quando a consulta passa de 10 s, avisar com transações abertas e duração do aviso (7 s) | M | Implementado: notificações temporizadas configuráveis |
| O13 | AI Assistant | Escolha do modelo padrão (só habilitada após *Sign In* na nuvem do fabricante) e anexar automaticamente o documento ativo ao chat | B | Diferença intencional (chave própria) |
| O14 | Schema Comparison › General | Ordenar colunas alfabeticamente no DDL comparado, formatar o script com o perfil ativo e mostrar diferenças ignoradas | M | Comparar |
| O15 | Text Editor › General/Tabs/Advanced | Espaço virtual, destaque de parênteses, números de linha, margem de indicadores, barra de navegação (ocultar se vazia), destaque da linha atual, envolver seleção ao digitar aspas/colchetes; recuo nenhum/bloco/inteligente, tamanho de tab e de recuo (2), manter tabs ou inserir espaços; entrar no modo de estrutura ao abrir arquivos, recolher blocos `#REGION`, destacar SELECT e sublinhar erros | M | Parcial |
| O16 | Code Completion › General/Advanced | Ativar a conclusão, listar membros, informação de parâmetros, destacar ocorrências, atraso de 200 ms; qualificar coluna com alias, sem alias (só objeto ou esquema e objeto), inverter a ordem na condição de JOIN, parênteses ao inserir funções; crases sempre, se colidir com palavra-chave ou só quando necessário | M | Parcial |
| O17 | Code Completion › Alias | Gerar alias ao confirmar, em maiúsculas, com `AS` automático; tabela de regras *Condição → Ação* (ex.: `<dual>` sem alias) com máscaras `<*>`, `<*Sales>` e `<Sales>.<tbl_*>` e reordenação | M | Falta (regras de alias) |
| O18 | Code Completion › List Members/Suggestions | Ordenar palavras-chave por relevância, movimento cíclico, filtro por correspondência e por camelCase; confirmar com Tab, espaço ou caracteres configuráveis, nova linha com Enter, selecionar mesmo esperando entrada, confirmar snippets de imediato; não carregar sugestões de certos bancos e atualizar o cache local a cada 3 min | M | Parcial |
| O19 | Text Editor › Print / Text Compare Control | Imprimir cabeçalho, números de linha e espaços; cores configuráveis de linha removida/adicionada, blocos e linha selecionada na comparação de texto, com amostra | B | Falta (impressão) |
| O20 | Text Editor › Formatting › General | Formatar ao colar, ao fechar a instrução e enquanto digita; margem direita (80); etiquetas `-- noformat` e `-- endnoformat`; erros de sintaxe na saída e janela de aviso; arquivo de dicionário e prefixos (`tbl; fn; prc`) | M | Parcial |
| O21 | Text Editor › Formatting › Profiles | Nove perfis prontos (Collapsed, Commas before, Compact, Default, Extended, Indented, MSDN SQL, Right aligned, Stack compact) com *Create New*, *Add Existing*, *Open Selected* e *Set as Active*. O editor de perfil mostra uma árvore de regras por instrução (CALL, CASE, CREATE TABLE/TRIGGER/VIEW, DECLARE, DELETE, INSERT, SELECT…) com caixas de seleção finas (quebra de linha antes de parênteses, indentar ou empilhar listas de parâmetros), opções de texto e uma amostra ao vivo com *Format Text* | **M** | Parcial: o clone tem poucos ajustes do formatador |
| O22 | Generate Scripts › General | Seletor do assistente (ex.: Database Backup Wizard) com busca e opções agrupadas em *Common*: descarregar logs, formatar, comentários, `CREATE DATABASE`, `DEFINER`, `DROP`, `IF EXISTS`/`IF NOT EXISTS`, `NO_AUTO_VALUE_ON_ZERO`, permissões, `SQL SECURITY`, largura de inteiros, `USE`, bloqueio de leitura, e mais abaixo; cada opção tem descrição | M | Parcial: o Backup do clone já tem parte |
| O23 | Data Editor › General | Ajuste automático de largura, atualizações em cache, modo paginado por padrão com página inicial de 1000, busca automática, números de linha, tipo de dado no cabeçalho, editor de LOB após 200 caracteres e abrir o editor de dados somente leitura por padrão | **M** | Preferências foram adicionadas e página/tamanho, busca, linhas, tipos, limite LOB e somente leitura são aplicados na grade. Ajuste de largura automático e atualizações em cache ainda não são aplicados. |
| O24 | Data Export › por formato | Uma página por formato com explicação; no CSV: codificação (UTF-8), delimitador (vírgula), aspas, cabeçalho e aspas forçadas | B | Parcial |
| O25 | Copy Databases › General | Desligar chaves estrangeiras, descarregar logs, `DEFINER`, `ENGINE`, `NO_AUTO_VALUE_ON_ZERO`, partições, `SQL SECURITY`, bloqueio de leitura, transação única, inserção em lote e máximo de bancos simultâneos (4); busca e descrição por opção | M | Parcial |
| O26 | Data Generation / Data Comparison › General | Pasta de cache (temporária ou personalizada); chave de comparação padrão para objetos sem índice único | B | Falta |
| O27 | Database Explorer › General | Nome detalhado da coluna, tamanho da tabela, ação padrão ao abrir tabela/view (selecionar dados, editor de objeto ou dados no editor), ação padrão de rotinas (executar ou editor) e tamanho da seleção (todas as linhas ou as N primeiras, 1000) | **M** | Preferências foram adicionadas e persistidas; duplo clique em tabela/view respeita ação padrão e seleção All/N. Tabelas têm ação object-editor ou grade de dados, mas data-editor ainda compartilha o mesmo fluxo da grade; routines escolhem editor ou geração de script. Nome detalhado e tamanho da tabela ainda não são exibidos. |
| O28 | Query Builder / Database Diagram | Sombras, grade e tamanho (8), alinhar à grade; no diagrama: escala ao soltar, preservar roteamento, escala pela roda, grade (passo 10), sombras com deslocamento | B | Parcial |
| O29 | Source Control › General | Incluir dependências ao confirmar ou atualizar, pasta de origem e pasta temporária | B | Parcial |
| O30 | Debugging › General | Tempo limite (30 s) e política de *Edit and Continue*: avisar ao alterar, reiniciar sempre ou ignorar e continuar | B | Falta |
| O31 | Master-Detail › Page / Query Profiler | Papel (A4), orientação, margens, sobreposição e cabeçalho/rodapé na impressão; no profiler: histórico máximo (10), limiar de diferença na comparação (0,001 s), mostrar a consulta e perfilar sem cache | B | Parcial |

## Grade de resultados do original (menu de contexto e barra)

| # | Área | Comportamento observado | Prioridade | Clone |
|---|---|---|---|---|
| G1 | Menu de contexto da grade | Refresh (F5), Copy, Copy With Headers, *Copy Data As* (só nomes de colunas, nomes e tipos, CSV, XML, HTML, JSON, Excel), Paste, *Paste As New Records*, *Set Value To* (NULL com Ctrl+0, texto vazio, agora, zero, identificador único), Append, End/Cancel Edit, Delete, *Quick Filter*, *Visible Columns*, *Clear Sorting*, *Data Layout* (grade ou cartões), *Auto-search mode* (Ctrl+I), *Data Viewer* (Ctrl+W, R), *Export Data*, *Generate Script As*, *Send to*, *Print* e *Options* | **M** | Parcial: cópia, formatos, Set Value, filtros, scripts, layout, viewer e ações de barra estão disponíveis. Refresh remoto reexecuta a página atual; cancelar execução, append/end edit, exportação dedicada e opções ainda não cobrem todos os estados do grid. |
| G2 | Quick Filter | A partir da célula: igual, diferente, maior, maior ou igual, menor, menor ou igual (com o valor no rótulo; igual em Ctrl+Q) e *Condition...* | M | Operadores de igualdade/comparação e remoção de filtro estão ligados ao valor da célula; diálogo de condição arbitrária e rótulos com valor permanecem pendentes. |
| G3 | Generate Script As | A partir das linhas selecionadas: INSERT, BULK INSERT, WHERE IN(), WHERE AND/OR e UPDATE, cada um com submenu de destino | M | INSERT, BULK INSERT, WHERE IN, filtros AND/OR e UPDATE geram SQL para clipboard; seleção de destino por submenu e SQL Server BULK INSERT não se aplicam ao backend MySQL. |
| G4 | Send to | Query Builder, Data Report, Chart Designer e Pivot Table a partir do resultado | M | Query Builder e Data Report/Pivot abrem por comando da grade; linhas selecionadas não são transferidas, e Chart Designer ainda não tem destino dedicado. |
| G5 | Barra e status da grade | Atualizar, cancelar, aplicar e desfazer edição, tamanho de página (1000), navegação entre páginas, alternância grade/cartões, colunas visíveis e busca; o cabeçalho mostra o tipo sob o nome; células nulas ficam em amarelo; status *Record N of M* e mensagem *Query executed successfully* com a duração | M | Parcial: paginação, alternância, colunas, busca, tipo e valores NULL aparecem; cancelar consulta, desfazer/aplicar em todos os modos e mensagem de duração ainda dependem do fluxo de execução. |
| G6 | Menu principal contextual | Com o foco na grade aparece o menu *Data* na barra de menus; com o Query Builder aparece *Query*; com o foco em SQL aparece *SQL* | M | Parcial |
| G7 | Output | Painel com abas *General*, *SQL Log* (vazia até a opção ser ligada) e *Debug*, botão *Clear All*; o log geral registra início da aplicação, tempo de abertura, conexões e, a cada consulta, o documento com tempo total dividido em execução e leitura | M | Parcial |
| G8 | Error List | Chips de contagem (erros, avisos, mensagens), filtro *In Active Document* e contagem de itens; colunas descrição, local, linha e coluna. Recebe erros do analisador enquanto se digita (ex.: `"as" expected`) e erros do servidor na execução (`1054: Unknown column...`), com sublinhado vermelho no identificador | **M** | Parcial |
| G9 | Erro em execução de lote | Diálogo *An error occurred in <documento>* com a mensagem do servidor e a pergunta se interrompe o lote ou ignora o erro, com *Stop*, *Continue* e *Ignore All* | **M** | Verificar |
| G10 | Tools › Customize | Diálogo com duas abas: *Toolbars* (lista com caixa de seleção para Comparison, Connection, Data Report, Database Diagram, Debug, Diagram, Layout, Project, Query, SQL, Standard e Text; botões New, Rename, Delete e Reset) e *Commands* (categorias e comandos com busca, arrastáveis para as barras) | M | Parcial: abas Toolbars/Commands, busca e inclusão das ações existentes |
| G11 | Menu Window | Float, Pin Tab, novo grupo de abas horizontal/vertical, Close All Documents (pergunta antes de salvar itens alterados, com lista), Reset Window Layout, lista numerada dos documentos abertos (o ativo marcado) e *Windows...* | M | Parcial: ações de janela e grupos; diálogo Windows pendente |
| G12 | Menu Help | Contents (F1), Deactivate, Getting Started, Demos and Video Tutorials, Leave Feedback, Suggest a Feature, Check for Updates, About; o clone troca o que é de licença e nuvem por Check for Updates e About | B | Diferença intencional em Deactivate/telemetria |
| G13 | Menus por contexto | A barra de menus muda com o documento ativo: aparecem *Data* (grade), *SQL* (editor), *Query* e *Layout* (Query Builder), *Project* (controle de versão), e os itens de *Tools* mudam de posição | M | Parcial: menus Data/Query/Layout/Project condicionados ao documento; Tools segue comum |
| G14 | Start Page | Cabeçalho com marca, edição e redes; coluna *Recent Files* com busca e alternância entre lista e detalhes; à direita abas por tarefa: *SQL Development* (SQL Editor, Query Builder, Execute Script, AI Assistant), *Database Design* (novo diagrama, comparação de schema, achar objeto, vincular ao controle de versão), *Database Sync* (comparação de schema, pasta de scripts), *Administration* (segurança, sessões, backup, manutenção de tabelas, objetos inválidos), *Data Pump* (exportar, importar, comparar dados, copiar bancos) e *Data Analysis*; cada cartão traz título e uma linha de descrição | M | Parcial: abas acessíveis por tarefa ligadas aos painéis disponíveis |
| G15 | Data Compare: resultado | Barra com *Edit Comparison*, atualizar, parar e *Group by*; cabeçalho com origem e destino e *N of M rows selected*; grade de objetos agrupada em *Different* e *Identical* (recolhíveis) com contagens *Only in Source*, *Different*, *Identical* e *Only in Target*, caixas de seleção por objeto e busca. Painel inferior com abas *All*, *Only in Source*, *Different*, *Only in Target* e *Identical* (com contadores), colunas origem e destino lado a lado, células diferentes realçadas, ícone de status por linha, rodapé *Changes* por coluna, *Record N of M* e botões de navegação entre diferenças | **M** | Abas de status com contadores, filtro de linhas, realce e seleção de objetos estão disponíveis; grupos recolhíveis, sincronização de linha e navegação entre diferenças ainda faltam. |
| G16 | Data Compare: avisos | Colunas que existem só de um lado entram no Error List: aviso para coluna excluída da comparação e erro quando a coluna do destino não pode ser incluída | M | Falta |
| G17 | Menu Comparison (com resultado) | Edit Comparison, Filter, Refresh (F5), Stop Execution, *Change Synchronization Direction*, *Generate Comparison Report* e *Synchronize* (F8) | M | Parcial (inverter direção e relatório) |
| G18 | Data Synchronization Wizard | Quatro páginas: *Output* (abrir o script no editor, salvar em arquivo com carimbo de tempo, ou executar direto e atualizar o resultado), *Options*, *Additional Scripts* e *Summary*. As opções incluem verificação de concorrência (WHERE com valores antigos), converter engine para InnoDB, `USE`, `COMMIT` a cada 100 instruções, inserção em lote (300 KB), desligar chaves estrangeiras, chaves primárias e índices, restrições `CHECK` e gatilhos DML, e excluir comentários, com presets *Save As My Defaults*, *Devart Defaults* e *My Defaults*. *Additional Scripts* roda um script antes e outro depois (embutido ou arquivo). | **M** | Wizard em quatro páginas com saída para editor/arquivo/execução direta, opções, scripts adicionais em texto e resumo; execução direta exige confirmação forte quando destrutiva. Não há presets de sincronização completos, carregamento de scripts de arquivo nem todas as opções de geração. |
| G19 | Data Sync: resumo | Aba *Action Plan* com a ordem das ações (desligar gatilhos, remover chaves estrangeiras, uma entrada por tabela, recriar chaves, religar gatilhos) com busca e expandir/recolher, e aba *Warnings* (ex.: uma chave estrangeira pode não se recuperar após a sincronização); botão *Synchronize* disponível em todas as páginas | **M** | Resumo tem abas Action Plan/Warnings e alerta de exclusões, custom query e scripts extras; plano não tem árvore pesquisável nem estimativas de recuperação de constraints. |
| G20 | Comparison Report | Diálogo com formatos CSV, Excel e HTML, pasta de saída, carimbo de tempo no nome, abrir o relatório ao terminar e escopo (todos os objetos, só com diferenças ou só os selecionados para sincronizar), mais *Save Command Line* | M | Exportação de relatório suporta CSV, HTML e Excel compatível (HTML com extensão XLS), escopo total/diferenças/selecionados e nome timestamped. Escolha de pasta, abrir automaticamente e Save Command Line ainda faltam. |
| G21 | Security Manager (abas restantes) | *Roles* (nome, concedido, opção de administrador e padrão), *Users*, *Global Privileges*, *Object Privileges* (árvore de objetos com *Show All*, lista de privilégios disponíveis incluindo *All Privileges* e grade com privilégio, dono e objeto) e uma aba de SSL; *Create User* com menu | M | Roles permitem concessão, padrão e ADMIN OPTION; Object Privileges lista objetos e filtra busca. A grade de owner/objeto, ação All Privileges, aba SSL dedicada e menu Create User ainda não foram concluídos. |


### Fechamento dos itens O15–O18, O20–O21 e G7–G9

- O15/O16/O18: adicionadas preferências persistidas do Monaco, lista de membros e ações de informação; sugestões aceitam ordenação, filtro configurável, seleção cíclica, confirmação por caracteres e qualificação contextual por alias.
- O17: regras de alias por máscara Condição → Ação passaram a ser editáveis e são aplicadas pelo provedor de conclusão.
- O20/O21: formatação automática opcional ao colar/digitar/finalizar instrução, diretivas `-- noformat` e `-- endnoformat`, margem visual, nove perfis, regras por instrução e amostra formatada editável.
- G7: Output tem abas General, SQL Log e Debug; General inclui tempo total/execução/leitura e startup. SQL Log só armazena SQL normalizado e é opcional.
- G8/G9: Error List mostra chips por severidade e filtro do documento ativo; análise estática atualiza marcadores enquanto se digita. Em lote, Stop/Continue/Ignore All é testado pelo helper de política. Limites: Monaco não tem espaço virtual/navegação vazia equivalente; o analisador não é um parser SQL completo e o driver estima a divisão exec/fetch em consultas bufferizadas. Ver também DIVERGENCIAS-ORIGINAL.md.
