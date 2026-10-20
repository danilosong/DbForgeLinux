# UX 05 — Editores de objetos: View, Procedure, Function, Trigger, Event

**Fidelidade REA:** rótulos conferidos contra REA ui-text. **[C]** (REA ui-text): Definer, Deterministic, Check Option, Parameters, Event, Status:, ON COMPLETION, Order, Expression, Table:, Add Parameter, Edit Parameters, Alter event, Create/Drop procedure {0}, Drop Trigger, "Do you want to drop procedure '{0}'?". Atalhos **[C] (REA shortcuts)**: Execute F5/F9, Format Document Ctrl+K Ctrl+D, Properties F4. Demais rótulos (Algorithm, SQL Security, Data access, Returns, Starts/Ends, Preview Data) permanecem **[I]** (ver `fidelidade-parts/A.md`).


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

## 3. View

Template: `CREATE OR REPLACE VIEW name AS SELECT ...`.
Properties: Name, Algorithm (UNDEFINED/MERGE/TEMPTABLE), Definer (current_user ou usuário), SQL SECURITY (DEFINER/INVOKER), Check option (None/LOCAL/CASCADED), Comment (somente informativo, MySQL não guarda).
Abas inferiores: Messages, **Columns** (preview das colunas resultantes — roda `SELECT ... LIMIT 0` ao clicar [Validate]), Dependencies (tabelas usadas), DDL. Botão extra **Preview Data** abre os primeiros 1000 registros em aba de resultado inline (aba "Preview"). Estado do Validate: loading/ok verde/erro vermelho.

## 4. Stored Procedure

Template:
```
CREATE PROCEDURE name(IN p1 INT)
BEGIN
  -- ...
END
```
Properties: Name, Definer, SQL Security, Deterministic (None/Yes/No), Data access (CONTAINS SQL/NO SQL/READS SQL DATA/MODIFIES SQL DATA), Comment.
Aba **Parameters**: grid (Direction IN/OUT/INOUT | Name | Type | Length) editável; sincroniza com o cabeçalho do script.
**Execute/Test** (F9): se há parâmetros abre diálogo "Execute Procedure" (campo por parâmetro, checkbox NULL, valores lembrados) e roda `CALL`; resultado em abas de resultado (03 §3) + Messages (OUT via variáveis de sessão exibidas num bloco "Output parameters"). Execução usa transação com opção [Rollback after execute] (padrão marcado em Prod).
Debugger: fora do escopo (P3).

## 5. Function

Template: `CREATE FUNCTION name(p1 INT) RETURNS INT DETERMINISTIC BEGIN RETURN ...; END`.
Properties: iguais à procedure + **Returns** (tipo/tamanho). Parâmetros só IN (coluna Direction oculta). Execute abre diálogo com parâmetros e mostra o valor retornado num painel (aba **Result**) com tipo.

## 6. Trigger

Template: `CREATE TRIGGER name BEFORE INSERT ON table FOR EACH ROW BEGIN ... END`.
Properties: Name, Table (combo, obrigatório; bloqueado após criação — alterar tabela exige recriar, aviso), Timing (BEFORE/AFTER), Event (INSERT/UPDATE/DELETE), Order (FOLLOWS/PRECEDES + trigger), Definer. Editor: autocomplete de `NEW.`/`OLD.` com colunas da tabela. Validação: combinação timing/evento duplicada gera aviso com opção FOLLOWS/PRECEDES. Aba extra **Table**: link "Abrir tabela". Sem Execute.
Habilitar/desabilitar: não suportado pelo MySQL; item oculto.

## 7. Event

Template: `CREATE EVENT name ON SCHEDULE EVERY 1 DAY DO BEGIN ... END`.
Properties: Name, Status (ENABLE/DISABLE/DISABLE ON SLAVE), On completion (PRESERVE/NOT PRESERVE), Definer, Comment, **Schedule**: tipo (AT / EVERY), para AT: date-time picker; para EVERY: número + unidade (YEAR, QUARTER, MONTH, DAY, HOUR, MINUTE, WEEK, SECOND), Starts (opcional), Ends (opcional). Preview textual: "Executa a cada 1 dia a partir de 2026-10-21 00:00" . Aviso quando `event_scheduler` está OFF: banner âmbar "Event Scheduler desligado no servidor" com link para Server Variables (08). Botão **Enable/Disable** rápido na toolbar (ALTER EVENT).

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
