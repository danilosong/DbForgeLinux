# UX 05 — Editores de objetos: View, Procedure, Function, Trigger, Event

**Fidelidade REA & Observação VM:** rótulos conferidos contra REA ui-text e **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas completas em `re/original-observation/p2-02-table-designer/`).
- **[C] Sub-abas reais por tipo de objeto:**
  - View: `General | Query Design | Data | SQL` (`re/original-observation/p2-02-table-designer/38-new-view-1823.png` a `43-view-query-design-1824.png`).
  - Procedure: `General | Data | SQL` (`re/original-observation/p2-02-table-designer/44-new-procedure-1824.png`).
  - Function: `General | Data | SQL` (`re/original-observation/p2-02-table-designer/49-new-function-1826.png`).
  - Trigger: `General | SQL` (sem aba Data) (`re/original-observation/p2-02-table-designer/55-new-trigger-1827.png`).
  - Event: `General | SQL` (`re/original-observation/p2-02-table-designer/59-new-event-1828.png`).
- **[C] Validações e Modais Reais:**
  - View vazia: modal de erro *"View query cannot be empty."* (`re/original-observation/p2-02-table-designer/39-view-apply-empty-1823.png`).
  - Procedure com erro sintático: sublinhado vermelho no editor, erros no painel Error List com link *"Show errors"* (`re/original-observation/p2-02-table-designer/45-proc-bad-body-1825.png`), e no Apply modal nativo com erro MySQL 1064 (`46-proc-apply-error-1825.png`).
  - Function original com Erro 1418: template do dbForge omite `DETERMINISTIC` e falha sob binary logging com modal *"Object has been created with error(s): This function has none of DETERMINISTIC, NO SQL, or READS SQL DATA..."* (`50-function-applied-or-error-1826.png`, `51-function-after-error-1826.png`).
  - Trigger: validação imediata no DDL sem tabela selecionada (`55-new-trigger-1827.png`); combo de tabela popula e viabiliza Apply (`57-trigger-table-chosen-1827.png`, `58-trigger-applied-1827.png`).
  - Event: painéis Start/End/Recurrence (`60-event-panels-1828.png`); Apply converte Start Immediately para At time (`61-event-applied-1828.png`).
- Atalhos **[C] (REA shortcuts)**: Execute F5/F9, Format Document Ctrl+K Ctrl+D, Properties F4.


Reusa `01-shell.md` e o CodeEditor de `03`. Abertos em aba (ícone do tipo). Entradas: Explorer > objeto > "Edit"/Enter, ou Create > <tipo> (modo novo).

## 1. Padrão comum

```
+ Aba: [sp_calc_total] ------------------------------------------+
| Toolbar: [Apply Ctrl+S] [Discard] [Refresh F5] | [Format]       |
|   [Execute/Test] (proc/func) | [Properties ▾ painel]            |
| Banner estado                                                   |
+---------------------------------+-------------------------------+
| Corpo: Monaco (definição SQL)   | Painel Properties (dir. 280px)|
|                                 |  campos por tipo (abaixo)     |
+---------------------------------+-------------------------------+
| Abas inferiores: [Messages] [Parameters*] [Dependencies] [DDL]  |
+-----------------------------------------------------------------+
```
- O editor mostra o **script completo** (`CREATE ... `). Em objeto existente o Apply gera `DROP + CREATE` (ou `ALTER` quando suportado: view, event, rotina só características) dentro de transação lógica: se o CREATE falhar, o objeto original é recriado automaticamente a partir do backup em memória, com aviso vermelho/âmbar claro ("Alteração falhou; objeto original restaurado" ou, se restauração falhar, diálogo com o DDL original para copiar).
- Painel Properties mantém o formulário sincronizado com o script (edição bidirecional por regras simples; se o texto não é reconhecido, painel desabilita com "Edite diretamente no script").
- Autocomplete, squiggles de sintaxe (para `DELIMITER` tratado automaticamente) e Format iguais ao editor SQL (03 §2).
- Nome em modo novo: campo no painel (obrigatório, ≤64), ao salvar o script atualiza o nome. Template inicial por tipo (abaixo).
- Alterações externas (Refresh detecta diferença): banner âmbar "Definição mudou no servidor [Recarregar] [Manter]".
- Fechar com pendências: Save/Discard/Cancel.

## 2. Estados comuns

| Estado | Comportamento |
|---|---|
| Loading | Skeleton no editor + spinner na aba |
| Erro de carga | InlineErrorPanel + [Tentar de novo] |
| Sem privilégio | Somente leitura + banner |
| Apply em andamento | Botão "Applying…" + barra 2px |
| Sucesso | Toast "Procedure `x` atualizada"; Explorer atualizado; limpa "•" |
| Erro de Apply | Aba Messages foca: `Error 1064…` linha/coluna clicáveis; Error List recebe entrada; estado original preservado/restaurado |
Conexão Prod: Apply pede confirmação digitando o nome do objeto.

## 3. View [C: observado na VM]

- **Sub-abas:** `General | Query Design | Data | SQL` (`re/original-observation/p2-02-table-designer/38-new-view-1823.png` a `43-view-query-design-1824.png`).
- **Campos General:** Name (texto), Database (combo), "Query Text:" (editor Monaco de SQL), Options (checkbox "With check option" + Cascaded/Local), Security (rádio Invoker / Definer + combo de usuário, ex.: `obs@%`).
- **Validação de Query Vazia (`39-view-apply-empty-1823.png`):** Tentar Apply com query em branco aciona caixa modal com ícone vermelho e texto exato: *"View query cannot be empty."*
- **Sub-aba Query Design (`43-view-query-design-1824.png`):** Reusa o motor visual do Query Builder com canvas para tabelas e checkboxes de colunas, abas de junção e condições (`Selection | Joins | Where | Group By | Having | Order By`).
- **Sub-aba SQL (`41-view-sql-tab-1824.png`):** Exibe o DDL dinâmico formatado. Após o Apply (`42-view-applied-1824.png`), o script é recarregado e normalizado pelo servidor MySQL com backticks explícitos e aliases em colunas.

## 4. Stored Procedure [C: observado na VM]

- **Sub-abas:** `General | Data | SQL` (`re/original-observation/p2-02-table-designer/44-new-procedure-1824.png`).
- **Campos General:** Name, Database, Comment, grade Parameters (colunas Name \| Type \| Direction; botões Add, Remove, Move Up, Move Down), Options (Definer combo).
- **Template inicial:**
```sql
CREATE
DEFINER = 'obs'@'%'
PROCEDURE obs_p2.procedure1()
BEGIN

END
```
- **Validação Sintática Local e Error List (`45-proc-bad-body-1825.png`):**
  - Ao digitar instruções inválidas no corpo (ex.: `selec 1;`), o editor Monaco exibe sublinhado ondulado vermelho no trecho e popula o painel `Error List` com contagem e mensagens descritivas (ex.: `":" expected`, Location `Procedure:obs_p2.procedure1(mysql-teste)`), acompanhado do link *"Show errors"*.
- **Apply com Erro no Servidor (`46-proc-apply-error-1825.png`):**
  - Caso o usuário force o Apply com sintaxe inválida, a solicitação é enviada ao servidor e gera caixa modal com erro nativo do MySQL:
    *"You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '...' at line N"* e registro `1064: You have an error in your SQL syntax...` na Error List.
- **Sucesso no Apply (`47-proc-fixed-1825.png`, `48-proc-applied-1825.png`):**
  - DDL normalizado relido do MySQL com delimitadores e status bar limpa.

## 5. Function [C: observado na VM / Divergência Virtuosa do TuxSQL]

- **Sub-abas:** `General | Data | SQL` (`re/original-observation/p2-02-table-designer/49-new-function-1826.png`).
- **Comportamento Falho do Original (dbForge Studio):**
  - O template gerado pelo dbForge original é:
    ```sql
    CREATE
    DEFINER = 'obs'@'%'
    FUNCTION obs_p2.function1()
    RETURNS INT
    BEGIN

      RETURN 1;
    END
    ```
  - Em instâncias modernas com binary logging ativo (`log_bin=ON`), a execução desse template padrão FALHA com erro 1418 do MySQL (`re/original-observation/p2-02-table-designer/50-function-applied-or-error-1826.png`):
    *"Object has been created with error(s): This function has none of DETERMINISTIC, NO SQL, or READS SQL DATA in its declaration and binary logging is enabled (you \*might\* want to use the less safe log_bin_trust_function_creators variable)"*, seguido de *"Object 'obs_p2.function1' does not exist."* (`51-function-after-error-1826.png`).
  - Para funcionar no dbForge original, o usuário precisa manualmente inserir a cláusula `DETERMINISTIC` no script (`53-function-deterministic-1826.png`, `54-function-applied-1827.png`).
- **Solução TuxSQL (Divergência Virtuosa):**
  - O TuxSQL **inclui obrigatoriamente `DETERMINISTIC`** no template padrão de criação de Function:
    ```sql
    CREATE DEFINER = CURRENT_USER
    FUNCTION `function1`()
    RETURNS INT
    DETERMINISTIC
    BEGIN
      RETURN 1;
    END
    ```
  - Isso garante que qualquer função criada a partir do assistente compile com sucesso imediato sem exigir configuração de variáveis globais inseguras no servidor.

## 6. Trigger [C: observado na VM]

- **Sub-abas:** Apenas `General | SQL` (sem sub-aba Data) (`re/original-observation/p2-02-table-designer/55-new-trigger-1827.png`).
- **Campos General:** Name, Database, Table (combo com validação obrigatória), Definer, Timing (rádio After / Before), Order (combos `Follows trigger:` e `Precedes trigger:`).
- **Validação de Tabela Obrigatória (`55-new-trigger-1827.png`):** Enquanto a tabela não for selecionada no combo ("Choose a table"), o DDL permanece inválido gerando 2 erros na Error List (`Unexpected symbol 'FOR'`, `Unexpected symbol 'END'`). Ao selecionar a tabela (`57-trigger-table-chosen-1827.png`), o DDL se completa automaticamente (`AFTER INSERT ON db.table`) e os erros são zerados.
- **Sucesso no Apply (`58-trigger-applied-1827.png`):** Aplicação cria o trigger mesmo com corpo vazio `BEGIN END`.

## 7. Event [C: observado na VM]

- **Sub-abas:** `General | SQL` (`re/original-observation/p2-02-table-designer/59-new-event-1828.png`).
- **Campos General:** Name, Database, Comment, Status (`ENABLE` combo), `[x] Recurrent`, Definer, `[x] Drop on completion`.
- **Painéis de Agendamento (`60-event-panels-1828.png`):**
  - **Start:** rádio `(•) Immediately` / `( ) After interval` / `( ) At time` (com campo de data/hora).
  - **End:** rádio `(•) No end time` / `( ) After interval` / `( ) At time`.
  - **Recurrence:** combo (padrão `Daily`, campo `Every: 1 days`).
- **DDL Padrão:**
  ```sql
  CREATE DEFINER = 'obs'@'%' EVENT obs_p2.event1 ON SCHEDULE EVERY '1' DAY DO BEGIN END;
  ```
- **Apply e Persistência (`61-event-applied-1828.png`):**
  - Ao aplicar, o MySQL converte o agendamento `Immediately` para `STARTS 'YYYY-MM-DD HH:MM:SS'` e o formulário atualiza o rádio Start para `At time`.

## 8. Aba Dependencies e DDL

Dependencies: duas listas (Depends on / Used by) quando disponíveis via information_schema; clique abre o objeto. DDL: Monaco somente leitura com o script que será aplicado (diferença destacada versus original opcional "Show diff").

## 9. Atalhos

| Ação | Atalho |
|---|---|
| Apply | Ctrl+S |
| Execute/Test | F9 |
| Format | Ctrl+K Ctrl+D |
| Refresh | F5 |
| Painel Properties | F4 |
| Alternar abas inferiores | Ctrl+Shift+R |
| Comentar | Ctrl+/ |

## 10. Temas e acessibilidade
Tokens de 01 §9; syntax.* no Monaco; formulários com FormField (02); datas com picker acessível por teclado; mensagens com aria-live.

## 11. Componentes
CodeEditor, PropertiesPanel (FormField set), ParametersGrid, ExecuteDialog (campos dinâmicos), DateTimePicker, SchedulePreview, Banner, InlineErrorPanel, ConfirmDestructiveDialog, DiffView (leve), ResultTabs.

## 12. Critérios de aceite
- Cada tipo cria e altera objetos pelo script e pelo painel de propriedades sincronizados.
- Apply de objeto existente nunca deixa o banco sem o objeto original em caso de erro (restauração ou DDL exposto).
- Execute/Test de procedure/function pede parâmetros e exibe resultados/OUT/retorno.
- Estados loading/erro/sucesso, claro/escuro e teclado completos.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Definer | Propriedade (todos os tipos) | `obj.prop.definer` |
| Deterministic | Propriedade de procedure/function | `obj.prop.deterministic` |
| Check Option | Propriedade de view | `obj.view.checkOption` |
| Parameters | Aba de procedure/function | `obj.params.title` |
| Add Parameter | Ação na grade de parâmetros | `obj.params.add` |
| Edit Parameters | Ação/menu | `obj.params.edit` |
| Event | Tipo de objeto / propriedade de trigger | `obj.event.title` |
| Status: | Propriedade de event | `obj.event.status` |
| ON COMPLETION | Propriedade de event | `obj.event.onCompletion` |
| Order | Propriedade de trigger | `obj.trigger.order` |
| Table: | Propriedade de trigger | `obj.trigger.table` |
| Expression | Coluna/campo | `obj.field.expression` |
| Create procedure {0} / Alter procedure {0} | Título/DDL gerado | `obj.proc.createAlter` |
| Alter event | Ação/título | `obj.event.alter` |
| CREATE/ALTER VIEW | Template de script | `obj.view.template` |
| CREATE TRIGGER | Template de script | `obj.trigger.template` |
| CREATE PROCEDURE/FUNCTION | Template de script | `obj.routine.template` |
| CREATE/ALTER EVENT | Template de script | `obj.event.template` |
| Debug Stored Procedure... | Menu (fora de escopo nesta fase) | `obj.proc.debug` |
| Do you want to drop procedure '{0}'? | Confirmação de exclusão | `obj.confirm.dropProc` |
| Do you want to drop function '{0}'? | Confirmação de exclusão | `obj.confirm.dropFunc` |
| Drop Trigger | Menu/ação | `obj.trigger.drop` |
| Cannot execute procedure because of internal server error | Erro de execução | `obj.exec.error` |
| Another procedure is being executed. | Execução concorrente | `obj.exec.busy` |
| {0} '{1}' has been compiled with warnings. | Resultado de Apply com avisos | `obj.apply.warnings` |
| Component was modified. Do you want to reload the editor? | Banner definição mudou | `obj.confirm.reload` |
| The '{0}' document has been modified. Apply changes to '{1}' query? | Fechar com pendências | `obj.confirm.applyChanges` |
