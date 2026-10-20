# UX 07 — Schema Compare e Data Compare

Reusa `01-shell.md`, `03` (CodeEditor, TreeView, DataGrid) e `06` (WizardDialog, ProgressList). Entrada: menu Tools > New Schema Comparison / New Data Comparison; Explorer > database > Compare With…. Abre documento em aba ("Schema Comparison 1").

## 1. Documento Schema Compare

```
+ Aba: [Schema Compare 1] ----------------------------------------------+
| Toolbar: [Compare F5] [Stop] | [Generate Script] [Synchronize] |     |
|  [Options] [Filters] [Refresh] [Swap ⇄] | [Save .dbcmp] [Open]       |
+---------------------------------------------------------------------+
| Origem (Source)         ⇄        Destino (Target)                   |
| [conexão ▾][database ▾]       [conexão ▾][database ▾]               |
+---------------------------------------------------------------------+
| Árvore de diferenças (topo)  [Filtro: All|Different|Only Source|...]|
|  ☐ Objeto          | Tipo | Estado        | Ação    |               |
+---------------------------------------------------------------------+
| Painel de detalhe (base): [DDL lado a lado] [Propriedades] [Sync SQL]|
+---------------------------------------------------------------------+
```
Origem/Destino: combos de conexão e database (com status, cor de ambiente), também "Snapshot/arquivo `.sql`" (P2, desabilitado v1). Botão Swap troca os lados (com confirmação se já comparado). **Aviso visual forte**: o destino é o que será alterado — cabeçalho do destino com rótulo "TARGET (será modificado)" e faixa vermelha se conexão Prod.

## 2. Comparar (estados)

| Estado | Aparência |
|---|---|
| Inicial | EmptyState "Selecione origem e destino e clique Compare" |
| Loading | Painel de progresso por fase: "Lendo origem… (12/80 objetos)", "Lendo destino…", "Calculando diferenças…"; [Stop]; árvore vazia com skeleton |
| Sucesso com diferenças | Árvore preenchida; resumo na barra: "34 diferenças: 10 novos, 12 alterados, 12 removidos" |
| Sucesso sem diferenças | Banner verde "Os esquemas são idênticos" |
| Erro | InlineErrorPanel (qual lado falhou + mensagem + [Tentar de novo] [Editar conexão]); erros parciais por objeto (ex.: sem privilégio) listados em aviso âmbar expansível |
| Resultado obsoleto | Banner âmbar quando edita origem/destino/opções: "Resultados desatualizados [Compare]" |

## 3. Árvore de diferenças

Agrupada por tipo: Tables, Views, Procedures, Functions, Triggers, Events (e sub-itens de tabela: Columns, Indexes, FKs, Constraints, Options). Colunas:
| Coluna | Conteúdo |
|---|---|
| ☐ | checkbox (tri-state no grupo); controla o que entra no script |
| Objeto | nome + ícone |
| Estado | ícone+texto: **Only in Source** (verde +, será criado), **Only in Target** (vermelho −, será removido), **Different** (âmbar ≠), **Equal** (cinza =, oculto por padrão) |
| Ação | texto: Create / Drop / Alter / (none) — derivado da direção e opções |
Filtro por estado (chips com contadores), busca por nome, expandir/recolher tudo, "Marcar todos / só diferentes / nenhum". Padrão: todos marcados exceto drops quando a opção "Don't drop" está ativa (padrão **ativa**: objetos só no destino vêm desmarcados). Dependências: marcar objeto que depende de outro sugere marcar a dependência (banner "A tabela x também será necessária. [Incluir]"); desmarcar objeto exigido mostra aviso.
Menu de contexto: Check/Uncheck, Check with dependencies, Copy name, Open in Table Editor (target), Ignore this object (adiciona a filtro), Show only this type.
Teclado: setas, Espaço alterna checkbox, Enter abre detalhe, Ctrl+A marcar todos, Ctrl+F busca.

## 4. Painel de detalhe (aba por seleção)
- **Diff DDL:** dois painéis Monaco read-only lado a lado (Source | Target) com destaque de linhas diferentes (verde/vermelho 15%, caractere a caractere), scroll sincronizado, navegação [↑ prev diff][↓ next diff] (F7/Shift+F7), alternância inline.
- **Propriedades:** para tabelas, grade comparando itens (Coluna: nome, tipo, null, default) com marca por diferença.
- **Script do objeto:** SQL de sincronização só deste objeto.

## 5. Opções (diálogo Options, também botão na toolbar)
Grupos: **Comparação** (ignorar: comentários, collation, charset, AUTO_INCREMENT, DEFINER, partições, whitespace/case em nomes), **Objetos** (quais tipos comparar), **Script** (Don't drop objects [padrão on], Include IF EXISTS, Disable FK checks, Include USE, Wrap in transaction (aviso DDL), Add comments, Order por dependência [fixo]), **Mapeamento** (renomes: "tabelas com nomes diferentes" tabela de pares de-para, manual). Perfis salvos (`.dbcmp`: configuração, sem segredos).
Filtros (diálogo): incluir/excluir por padrão de nome (glob/regex) por tipo.

## 6. Gerar e executar script (sync)

1. **Generate Script** (Ctrl+Shift+G): gera SQL para destino = origem com objetos marcados. Abre em nova aba SQL "Sync Script" (conexão = destino, ainda não executado) **ou** painel "Sync SQL". Cabeçalho do script com comentário de data, origem, destino, versão do servidor. Ordem por dependência; DROP agrupados no fim.
2. **Synchronize** (Ctrl+Shift+Y) abre diálogo de confirmação em 3 blocos:
   - **Resumo:** contagem por ação (Create 10 · Alter 12 · Drop 0) e destino em destaque (conexão, database, ambiente).
   - **Riscos** (lista com ícones): perda de dados (DROP TABLE/COLUMN, redução de tipo, NOT NULL em coluna com NULLs — quando detectável), bloqueios longos (ALTER em tabelas > 1M linhas estimadas), mudanças de FK. Itens críticos em vermelho exigem checkbox "Entendo que dados podem ser perdidos".
   - **Opções:** [✓] Fazer backup do esquema do destino em arquivo `.sql` antes (padrão on; caminho editável), [ ] Executar em uma transação (aviso: DDL com commit implícito), "Em caso de erro: Parar / Continuar".
   Botões: [Synchronize] (primário, habilitado só após marcar riscos críticos), [Show Script], [Cancel]. Conexão Prod: digitar o nome do database de destino.
3. **Execução:** ProgressList (um item por statement: ⏳/✓/✕, tempo), [Cancel] (para após o statement corrente). 
4. **Resultado:** verde "Sincronização concluída (22 statements em 3,4 s)"; âmbar parcial (quais falharam, onde parou, estado atual do destino, [Copy remaining script] [Open in editor]); vermelho falha total/erro SQL com mensagem e statement. Em qualquer caso: [Re-compare] (padrão destaque no sucesso, para provar paridade), [Close], [Open backup file]. Output registra tudo.

Nunca executa sem a confirmação acima; "Synchronize" desabilitado quando destino é read-only (banner explicativo).

## 7. Data Compare

Mesmo layout de documento, com diferenças:
- Seleção: origem/destino (conexão+database) → passo de **mapeamento de tabelas**: grade (Tabela origem | Tabela destino | Chave de comparação | Colunas) com auto-map por nome; tabelas sem PK/unique ficam desabilitadas com aviso (ou escolha manual de colunas-chave).
- Comparar: progresso por tabela com contagem de linhas; resultado em lista de tabelas com contadores: Only in Source, Only in Target, Different, Equal.
- Seleção de tabela abre grade de dados lado a lado: linhas com chave, colunas origem|destino, células diferentes destacadas (âmbar), linhas só-origem (verde), só-destino (vermelho). Checkbox por linha (inserir/atualizar/excluir), filtros por estado, paginação virtual; limite configurável (padrão 1M linhas por tabela, aviso ao exceder).
- Opções: colunas ignoradas, case/whitespace, tratar NULL=vazio, compare por hash para tabelas grandes, "Don't delete rows" (padrão on).
- **Generate Data Script / Synchronize:** mesmas regras de confirmação (§6) com resumo "INSERT 120 · UPDATE 45 · DELETE 0", backup opcional dos registros afetados (arquivo `.sql` de undo), execução em transação única (padrão on para DML) com rollback total em erro.

## 8. Atalhos

| Ação | Atalho |
|---|---|
| Compare / Stop | F5 / Shift+F5 |
| Generate script | Ctrl+Shift+G |
| Synchronize | Ctrl+Shift+Y |
| Próxima / anterior diferença | F7 / Shift+F7 |
| Marcar todos | Ctrl+A |
| Alternar checkbox | Espaço |
| Swap | Ctrl+Shift+W |
| Options | Ctrl+, no documento (ou botão) |

## 9. Temas e acessibilidade
Tokens de 01; cores de diff apenas com opacidade 15% + marcadores texto (+, −, ≠, =) para não depender de cor; árvore com role tree e checkbox acessíveis; progresso anunciado.

## 10. Componentes
ConnectionDbPicker, DiffTree (checkbox tri-state, filtros por chip), SideBySideDiff (Monaco diff), PropertyDiffGrid, OptionsDialog (grupos), SyncConfirmDialog (resumo/riscos/opções), RiskList, ProgressList, ReportView, EmptyState, Banner.

## 11. Critérios de aceite
- Compara dois databases, lista diferenças por tipo/estado, mostra DDL lado a lado, e gera script ordenado por dependências apenas com objetos marcados.
- Synchronize só executa após confirmação com resumo e riscos; backup padrão; falha parcial é reportada com o estado exato.
- Data Compare exige chave, mostra diferenças por linha e sincroniza em transação.
- Estados loading/erro/sucesso/obsoleto cobertos; claro/escuro; teclado completo.
