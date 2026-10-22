# UX 07 — Schema Compare e Synchronization

**Fidelidade REA & Observação VM:** especificação baseada no inventário REA M9, ui-text e **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas em `re/original-observation/06-schema-compare/` e varredura completa em `re/original-observation/p2-04-schema-compare/`).
- **[C] Menu Comparison e Assistente de 2 Etapas (`p2-04/03-12`):** Menu principal dedicado (`03-menu-comparison-1917.png`), diálogo New Schema Comparison com Source e Target (`04-new-schema-comparison-1917.png` a `08-target-sample_b-1917.png`), Options em 4 páginas com presets Devart/My Defaults (`09-options-1917.png` a `12-options-pag4-1918.png`).
- **[C] Documento `.scomp` e Grade de Diferenças (`p2-04/13-22`):** Grade de 20 objetos selecionados divididos em `Only in Source` (Create ➔*) e `Only in Target` (Drop ✕) (`13-comparando-1918.png` a `21-target-lista-d-1919.png`), filtro lateral de tipos (`15-17`), Monaco diff inferior com realce verde e hachurado "Object does not exist" (`14-comparador-max-1918.png`).
- **[C] Sync Wizard e Action Plan Topológico (`p2-04/26-35`):** 4 etapas (`26-sync-wizard-inicio-1919.png`), Output com 3 modos, Options de script (`27`), Additional Scripts (`28`), Summary com Action Plan expandido em 19 passos (`29` e `31-34`) e aba Warnings com alerta sobre DETERMINISTIC na function1 (`30-sync-warnings-1920.png`).
- **[C] Script de Sincronização e Execução (`p2-04/36-56`):** Geração de script SQL de 176 linhas (`36-script-gerado-topo-1920.png` a `46-script-pagina-6-1921.png`) com cabeçalho de metadados, `SET FOREIGN_KEY_CHECKS=0`, `USE sample_b`, DROPs ordenados e CREATEs com `DELIMITER $$`. Execução com F5 (`47-execucao-f5-1921.png`) com warning do MySQL e persistência comprovada no destino (`50-resultado-sample_b-1929.png`, `53-56`).

---

## 1. Fluxo de Entrada e Assistente "New Schema Comparison"

A funcionalidade é acionada via menu principal (`Comparison > New Schema Comparison...`), atalho da barra de ferramentas ou menu de contexto de database no Explorer (`Compare With...`).
O fluxo abre um assistente modal de configuração estruturado em 2 etapas:

```
+- New Schema Comparison ------------------------------------------ [x] -+
|  Source and Target                                                [icon] |
|  Select Source and Target connections and specify the names...           |
|--------------------------------------------------------------------------|
| [Source and Target] |  SOURCE                     TARGET                 |
| [Options]           |  Type: [Database     ▾]     Type: [Database     ▾] |
|                     |  Connection:                Connection:            |
|                     |   [mysql-teste       ▾]      [mysql-teste       ▾] |
|                     |  Server Version: 8.4.11     Server Version: 8.4.11 |
|                     |  Database:                  Database:              |
|                     |   [sample          + ▾]      [sample_b        + ▾] |
|                     |                                                    |
|                     |               [Copy ▶]  [⇄]  [◀ Copy]              |
|--------------------------------------------------------------------------|
| [💾 Save ▾]                           [< Back]  [Next >] [Compare] [Cancel]|
+--------------------------------------------------------------------------+
```

### 1.1 Etapa 1: Source and Target
- **Colunas Paralelas (Source e Target):**
  - `Type:` combo box (`Database`, `Project`, `Scripts Folder`, `Snapshot`, `Source Control`).
  - `Connection:` combo box com `<Manage...>` para abrir Connection Manager.
  - `Server Version:` exibição dinâmica da versão do servidor (ex.: `8.4.11` ou `not available`).
  - `Database:` combo box com `<Refresh...>`, botão `+` para criar novo schema e seletor rápido.
- **Botões de Interação entre Painéis:**
  - `[ Copy ▶ ]`: copia conexão e database da Origem para o Destino.
  - `[ ⇄ ]`: inverte os lados de Origem e Destino.
  - `[ ◀ Copy ]`: copia conexão e database do Destino para a Origem.
- **Validação Observada na VM:**
  Se o usuário tentar avançar para `Options` ou acionar `Compare` com o Destino inválido ou vazio, o sistema exibe um alerta modal de bloqueio:
  > *"Comparison target is invalid"* `[ OK ]`

### 1.2 Etapa 2: Options
- **Busca:** Campo de texto com placeholder `Search` e ícone vermelho `✖` para limpar o filtro.
- **Link CLI:** `Save settings to a command line arguments file...` para exportação de script de automação.
- **Grupos de Opções (Árvore/Accordion):**
  - `▾ Common`:
    - `☐ Disable dependency analysis`
    - `☐ Ignore AUTO_INCREMENT clause`
    - `☑ Ignore AUTO_INCREMENT table option` *(ativo por padrão)*
    - `☑ Ignore average row length` *(ativo por padrão)*
    - `☐ Ignore collations`
    - `☐ Ignore column data types`
    - `☐ Ignore column default values`
    - `☑ Ignore DEFINER clause` *(ativo por padrão)*
    - `☐ Ignore ENDS clause`
    - `☐ Ignore permissions`
    - `☑ Ignore SQL SECURITY clause` *(ativo por padrão)*
    - `☐ Ignore STARTS clause`
    - `☐ Ignore table engine`
  - `▾ Auto Mapping`
- **Painel de Descrição Contextual:** Exibe o nome e a explicação detalhada do item atualmente em foco.
- **Botões de Perfil (Presets):**
  - Esquerda: `[ Save As My Defaults ]`
  - Direita: `[ Devart Defaults ]`, `[ My Defaults ]`

---

## 2. Execução e Card de Progresso In-Flight

Ao clicar no botão `[ Compare ]`, o assistente inicia a análise e apresenta um card centralizado com as 5 etapas sequenciais e indicadores dinâmicos:

```
+-- Schema Comparison -----------------------------+
|                                                  |
|   ✓ Opening connections                          |
|   ↻ Describing source objects                    |
|   ↻ Describing target objects                    |
|     Functions Options: fn_discount               |
|   ○ Mapping objects                              |
|   ○ Comparing schemas                            |
|                                                  |
+--------------------------------------------------+
```
- Ícones de status:
  - `✓` Verde: etapa concluída com sucesso.
  - `↻` Azul animado: etapa em execução ativa, acompanhada do nome do objeto sendo inspecionado.
  - `○` Cinza: etapa pendente na fila.

---

## 3. Documento de Comparação (.scomp)

Ao concluir a análise, o documento MDI abre na aba `<source> vs. <target>.scomp*`.

### 3.1 Estrutura do Layout

```
+ Aba: [ sample vs. sample_b.scomp* ] ------------------------------------+
| Toolbar: [Edit Comparison...] [↻ Refresh F5] [✕ Stop] [Group by: Status ▾] [🝖] |
+------------------------+------------------------------------------------+
| [Nothing excluded   ▾] | [🔍 Search          ]  (DB) ➔ (DB)  6 of 16 sel|
| ☑ All object types  [▼]|------------------------------------------------|
|   ☑ Events             | Type | Source Object | ☑ | Operation | Target |
|   ☑ Functions          |------------------------------------------------|
|   ☑ Packages           | ▾ ●○ Only in Source (2 of 2 objects selected)  |
|   ☑ Procedures         | Table  no_pk_table    [✓]   ➔* Create  (none)  |
|   ☑ Sequences          | View   v_totals       [✓]   ➔* Create  (none)  |
|   ☑ Tables             | ▾ ●● Different (3 of 3 objects selected)       |
|   ☑ Triggers           | Table  customers      [✓]   ➔ Update   cust... |
|   ☑ Views              | ▾ ○● Only in Target (1 of 1 objects selected)  |
|                        | Table  (none)         [✓]   ✕ Drop     only_b  |
+------------------------+------------------------------------------------+
| Diff Toolbar: [abc] [123] [a-b] [01] [wrap] ➔ [●○ Object does not exist] |
| SOURCE DDL:                            | TARGET DDL:                    |
|  CREATE TABLE `no_pk_table` (          |  ////////////////////////////  |
|    `a` INT DEFAULT NULL                |  // Object does not exist ///  |
|  ) ENGINE=InnoDB;                      |  ////////////////////////////  |
+-------------------------------------------------------------------------+
```

### 3.2 Menus e Atalhos Associados
- Menu dedicado `Comparison` no menu principal da aplicação:
  - `New Schema Comparison...`
  - `New Data Comparison...`
  - `Edit Comparison...` (reabre o assistente de configuração de origem/destino)
  - `Objects Filter` (`Ctrl+L`)
  - `Refresh` (`F5`)
  - `Stop Execution`
  - `Change Synchronization Direction`
  - `View Schema Update Script` (abre painel com script do objeto selecionado)
  - `Generate Comparison Report...` (exportação CSV/HTML)
  - `Synchronize...` (`F8`)

### 3.3 Painel Esquerdo de Filtro de Objetos
- Dropdown de controle de exclusão (`Nothing excluded` / `N items excluded`).
- Árvore hierárquica com checkboxes por categoria:
  `Events`, `Functions`, `Packages`, `Procedures`, `Sequences`, `Tables`, `Triggers`, `Views`.

### 3.4 Grade de Objetos e Agrupamento
- **Colunas:** `Type`, `Source Object`, `☑` (seleção para sincronização), `Operation`, `Target Object`.
- **Agrupamentos por Status:**
  - `Only in Source`: Operação `➔* Create`.
  - `Different`: Operação `➔ Update`.
  - `Only in Target`: Operação `✕ Drop`.
- **Seleção Padrão:** No original, todos os objetos vêm selecionados por padrão, incluindo operações de `Drop`.

### 3.5 Monaco Diff Editor Lado a Lado
- Comparação visual DDL entre Origem e Destino com rolagem sincronizada.
- Quando um objeto existe apenas em um dos lados, o lado oposto exibe preenchimento hachurado diagonal acompanhado da etiqueta centralizada `Object does not exist`.

---

## 4. Assistente de Sincronização (Schema Synchronization Wizard — F8)

Acionado pela tecla de atalho `F8` ou pelo botão `Synchronize...`. É um assistente de 4 etapas:

### 4.1 Etapa 1: Output
- **Opções de Destino do Script:**
  - `(•) Open the synchronization script in the internal editor` *(padrão)*
  - `( ) Save the script to a file`:
    - Campo de caminho com botão `[...]`.
    - `☐ Open in the internal editor`
    - `☑ Append timestamp to the file name`
  - `( ) Execute the script directly against the target database`:
    - `☑ Refresh comparison results after successful synchronization`

### 4.2 Etapa 2: Options
- **Grupos:**
  - `▾ Common`:
    - `☐ Check for object existence`
    - `☑ Include USE <database_name>`
    - `☐ Use DROP and CREATE instead of ALTER for tables`
    - `☐ Use DROP and CREATE instead of ALTER for views, procedures, and functions`
  - `▾ Script Comments`:
    - `☐ Exclude comments`
- Painel de descrição da opção focada e botões de preset (`Save As My Defaults`, `Devart Defaults`, `My Defaults`).

### 4.3 Etapa 3: Additional Scripts
- **Seções Pré e Pós Sincronização:**
  - `☐ Scripts to execute before:`
    - `(•) Use embedded script:` (editor de texto SQL multilinha)
    - `( ) Use external script:` (caminho do arquivo `.sql` + `☐ Include USE`)
  - `☐ Scripts to execute after:`
    - `(•) Use embedded script:` (editor de texto SQL multilinha)
    - `( ) Use external script:` (caminho do arquivo `.sql` + `☐ Include USE`)

### 4.4 Etapa 4: Summary
- **Abas do Painel:**
  - `Action Plan (N)`: Lista sequencial em 10 passos estritos ordenados por dependência topológica:
    1. `▶ Start Transaction`
    2. `田 Drop tables`
    3. `目 Create columns`
    4. `田 Alter tables`
    5. `目 Drop columns`
    6. `目 Alter columns`
    7. `Drop indexes`
    8. `Create views`
    9. `Create tables`
    10. `✔ Commit Transaction`
  - `Warnings (M)`: Lista de avisos críticos de sincronização acompanhada do aviso:
    > *"Please view carefully the following warnings. They can affect the synchronization."*
- **Contador no cabeçalho:** `N of M objects included in synchronization`.
- **Botões do Rodapé:** `[ 💾 Save ▾ ]`, `[ < Back ]`, `[ Next > ]`, `[ Synchronize ]`, `[ Close ]`.

---

## 5. Execução Direta e Divergência Virtuosa de Segurança (TuxSQL)

> [!IMPORTANT]
> **Divergência Virtuosa de Segurança TuxSQL vs Original:**
> - No dbForge original, a execução direta (`Execute the script directly against the target database`) executa comandos destrutivos como `DROP TABLE` sem qualquer confirmação ou aviso extra ao clicar em `Synchronize`.
> - No **TuxSQL para Linux**, a execução direta com ações destrutivas (`DROP TABLE`, `DROP COLUMN`) impõe uma **confirmação forte obrigatória** com preview do DDL e checkbox explícito `riskAccepted` ("Entendo que dados serão excluídos definitivamente"). O modo padrão do assistente sempre prioriza a abertura do script gerado no editor interno para revisão humana antes da aplicação.

### Comportamento Pós-Execução
- Quando a sincronização é executada com sucesso:
  1. A comparação de esquemas é recarregada automaticamente (`runCompare()`).
  2. O status de objetos sincronizados transita para `Identical` com cor acinzentada.
  3. O painel `Error List` / `Output` é aberto automaticamente caso o servidor MySQL reporte avisos de depreciação ou notas de execução.

---

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| New Schema Comparison... / New Data Comparison... | Menu Compare | `cmp.menu.newSchema / cmp.menu.newData` |
| Compare | Botão da toolbar | `cmp.compare` |
| Generate Script | Botão da toolbar | `cmp.generateScript` |
| Data Synchronization / Synchronize | Ação de sincronização | `cmp.sync` |
| Only in Source / Only in Target | Filtros/contadores de estado | `cmp.state.onlySource / cmp.state.onlyTarget` |
| Different / Identical | Filtros/contadores de estado | `cmp.state.different / cmp.state.identical` |
| Different records / Identical records | Contadores no Data Compare | `cmp.data.different / cmp.data.identical` |
| Only in source records / Only in target records | Contadores no Data Compare | `cmp.data.onlySource / cmp.data.onlyTarget` |
| Source / Destination connection: ; Destination database: | Seleção de origem/destino | `cmp.dest.connection / cmp.dest.database` |
| Ignore case / Ignore whitespaces | Options > Comparison | `cmp.opt.ignoreCase / cmp.opt.ignoreWhitespaces` |
| Include in Synchronization | Coluna de checkbox | `cmp.include` |
| Change Synchronization Direction | Ação por linha/objeto | `cmp.direction` |
| {0} of {1} objects included in synchronization | Contador no rodapé | `cmp.summary.included` |
| No objects selected to synchronize. | Erro de validação | `cmp.err.noneSelected` |
| Comparison failed. | Banner de erro | `cmp.err.failed` |
| Cannot compare {0} with {1} on {2}. | Erro de objetos incompatíveis | `cmp.err.cannotCompare` |
| Dropping columns can lead to data loss. Do you wish to continue? | Confirmação de risco | `cmp.risk.dropColumns` |
| Possible data loss in the column "{0}" when converting from type "{1}" to "{2}". | Lista de riscos | `cmp.risk.typeConversion` |
| A foreign key might not recover after synchronization. | Aviso de risco | `cmp.risk.fk` |
| Please backup your target database before running this script | Aviso no script gerado | `cmp.warn.backupBeforeRun` |
| Backup the target database | Opção do diálogo de sync | `cmp.opt.backupTarget` |
| Synchronization complete: {0} succeeded, {1} failed | Resultado/Output | `cmp.result.summary` |
| Refresh comparison results after successful synchronization | Opção (re-compare) | `cmp.opt.refreshAfterSync` |
| Received data is outdated and cannot be synchronized. Refresh the document. | Banner de resultado obsoleto | `cmp.stale` |
| Go to next difference / Go to previous difference | Toolbar/atalhos | `cmp.nextDiff / cmp.prevDiff` |
| Comparison Key; Columns in Comparison | Mapeamento do Data Compare | `cmp.data.key / cmp.data.columns` |
| {0} rows compared | Progresso do Data Compare | `cmp.data.progress` |
| Generate script without updating database | Opção de saída | `cmp.out.scriptOnly` |
