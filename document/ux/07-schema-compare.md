# UX 07 — Schema Compare e Synchronization

**Fidelidade REA & Observação VM:** especificação baseada no inventário REA M9, ui-text e **observação direta da VM de referência `dbforge-ref`** (dbForge Studio for MySQL v2026.2.82, capturas em `re/original-observation/06-schema-compare/` e varredura completa em `re/original-observation/p2-04-schema-compare/`).
- **[C] Menu Comparison e Assistente de 2 Etapas:**
  - Menu dedicado: `re/original-observation/06-schema-compare/menu-comparison-ativo.png`, `re/original-observation/p2-04-schema-compare/03-menu-comparison-1917.png`.
  - Diálogo New Schema Comparison (Source e Target): `re/original-observation/06-schema-compare/wizard-1.png`, `re/original-observation/06-schema-compare/tipo-origem.png`, `re/original-observation/06-schema-compare/target-conexao.png`, `re/original-observation/06-schema-compare/target-db-lista.png`, `re/original-observation/p2-04-schema-compare/04-new-schema-comparison-1917.png`, `re/original-observation/p2-04-schema-compare/05-target-conexao-1917.png`, `re/original-observation/p2-04-schema-compare/06-target-db-1917.png`, `re/original-observation/p2-04-schema-compare/07-target-digita-1917.png`, `re/original-observation/p2-04-schema-compare/08-target-sample_b-1917.png`.
  - Options em 4 páginas com presets Devart/My Defaults: `re/original-observation/06-schema-compare/wizard-options.png`, `re/original-observation/p2-04-schema-compare/09-options-1917.png`, `re/original-observation/p2-04-schema-compare/10-options-pag2-1918.png`, `re/original-observation/p2-04-schema-compare/11-options-pag3-1918.png`, `re/original-observation/p2-04-schema-compare/12-options-pag4-1918.png`.
- **[C] Documento `.scomp` e Grade de Diferenças:**
  - Card de progresso de comparação: `re/original-observation/p2-04-schema-compare/13-comparando-1918.png`.
  - Grade de 20 objetos e Monaco diff: `re/original-observation/06-schema-compare/resultado.png`, `re/original-observation/p2-04-schema-compare/14-comparador-max-1918.png`, `re/original-observation/p2-04-schema-compare/18-janela-arrastada-1918.png`, `re/original-observation/p2-04-schema-compare/19-target-lista-b-1919.png`, `re/original-observation/p2-04-schema-compare/20-target-lista-c-1919.png`, `re/original-observation/p2-04-schema-compare/21-target-lista-d-1919.png`.
  - Filtro lateral de tipos: `re/original-observation/p2-04-schema-compare/15-recolhe-source-1918.png`, `re/original-observation/p2-04-schema-compare/16-reativa-packages-1918.png`, `re/original-observation/p2-04-schema-compare/17-recolhe-source-ok-1918.png`.
  - Menu Comparison com comparador ativo: `re/original-observation/p2-04-schema-compare/22-menu-comparison-ativo-1919.png`.
  - Painel View Update Script: `re/original-observation/p2-04-schema-compare/23-view-update-script-1919.png`, `re/original-observation/p2-04-schema-compare/24-update-script-espera-1919.png`, `re/original-observation/p2-04-schema-compare/25-update-script-topo-1919.png`.
- **[C] Sync Wizard e Action Plan Topológico:**
  - 4 etapas do assistente de sincronização: `re/original-observation/06-schema-compare/sync-1.png`, `re/original-observation/06-schema-compare/sync-wizard-1.png`, `re/original-observation/p2-04-schema-compare/26-sync-wizard-inicio-1919.png` (Passo 1 Output), `re/original-observation/06-schema-compare/sync-wizard-2.png`, `re/original-observation/p2-04-schema-compare/27-sync-options-1919.png` (Passo 2 Options), `re/original-observation/06-schema-compare/sync-wizard-3.png`, `re/original-observation/p2-04-schema-compare/28-sync-additional-scripts-1919.png` (Passo 3 Additional Scripts), `re/original-observation/06-schema-compare/sync-wizard-4.png`, `re/original-observation/p2-04-schema-compare/29-sync-summary-1920.png` (Passo 4 Summary).
  - Warnings e Action Plan: `re/original-observation/p2-04-schema-compare/30-sync-warnings-1920.png` (alerta DETERMINISTIC na function1), `re/original-observation/p2-04-schema-compare/31-action-plan-expandido-1920.png`, `re/original-observation/p2-04-schema-compare/32-action-plan-pag2-1920.png`, `re/original-observation/p2-04-schema-compare/33-action-plan-pag3-1920.png`, `re/original-observation/p2-04-schema-compare/34-action-plan-pag4-1920.png`, `re/original-observation/p2-04-schema-compare/35-sync-clique-synchronize-1920.png`.
- **[C] Script de Sincronização e Execução:**
  - Script SQL de 176 linhas gerado: `re/original-observation/p2-04-schema-compare/36-script-gerado-topo-1920.png`, `re/original-observation/p2-04-schema-compare/37-script-gerado-fim-1920.png`, `re/original-observation/p2-04-schema-compare/38-script-editor-grande-topo-1921.png`, `re/original-observation/p2-04-schema-compare/39-script-topo-editor-grande-1921.png`, `re/original-observation/p2-04-schema-compare/41-script-pagina-1-1921.png`, `re/original-observation/p2-04-schema-compare/42-script-pagina-2-1921.png`, `re/original-observation/p2-04-schema-compare/43-script-pagina-3-1921.png`, `re/original-observation/p2-04-schema-compare/44-script-pagina-4-1921.png`, `re/original-observation/p2-04-schema-compare/45-script-pagina-5-1921.png`, `re/original-observation/p2-04-schema-compare/46-script-pagina-6-1921.png`.
  - Execução com F5 no SQL Editor: `re/original-observation/p2-04-schema-compare/47-execucao-f5-1921.png`.
  - Persistência e verificação pós-execução no destino (`sample_b`): `re/original-observation/p2-04-schema-compare/50-resultado-sample_b-1929.png`, `re/original-observation/p2-04-schema-compare/52-explorer-procura-sample_b-1932.png`, `re/original-observation/p2-04-schema-compare/53-sample_b-expandido-1932.png`, `re/original-observation/p2-04-schema-compare/54-sample_b-pastas-expandidas-1932.png`, `re/original-observation/p2-04-schema-compare/55-sample_b-rolado-1933.png`, `re/original-observation/p2-04-schema-compare/56-sample_b-events-1933.png`, `re/original-observation/p2-04-schema-compare/57-fecha-sql10-1934.png`, `re/original-observation/p2-04-schema-compare/58-sql10-fechada-1934.png`.

---

## 1. Fluxo de Entrada e Assistente "New Schema Comparison" [C: re/original-observation/06-schema-compare/wizard-1.png, re/original-observation/p2-04-schema-compare/04-new-schema-comparison-1917.png]

A funcionalidade é acionada via menu principal (`Comparison > New Schema Comparison...` em `re/original-observation/p2-04-schema-compare/03-menu-comparison-1917.png`), atalho da barra de ferramentas ou menu de contexto de database no Explorer (`Compare With...`).
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

### 1.1 Etapa 1: Source and Target [C: re/original-observation/06-schema-compare/wizard-1.png, re/original-observation/p2-04-schema-compare/04-new-schema-comparison-1917.png]
- **Colunas Paralelas (Source e Target):**
  - `Type:` combo box (`Database`, `Project`, `Scripts Folder`, `Snapshot`, `Source Control`) [C: `re/original-observation/06-schema-compare/tipo-origem.png`].
  - `Connection:` combo box com `<Manage...>` para abrir Connection Manager [C: `re/original-observation/06-schema-compare/target-conexao.png`, `re/original-observation/p2-04-schema-compare/05-target-conexao-1917.png`].
  - `Server Version:` exibição dinâmica da versão do servidor (ex.: `8.4.11` ou `not available`) [C: `re/original-observation/p2-04-schema-compare/04-new-schema-comparison-1917.png`].
  - `Database:` combo box com `<Refresh...>`, botão `+` para criar novo schema e seletor rápido com digitação e autocomplete (`re/original-observation/06-schema-compare/target-db-lista.png`, `re/original-observation/p2-04-schema-compare/06-target-db-1917.png`, `re/original-observation/p2-04-schema-compare/07-target-digita-1917.png`, `re/original-observation/p2-04-schema-compare/08-target-sample_b-1917.png`).
- **Botões de Interação entre Painéis:**
  - `[ Copy ▶ ]`: copia conexão e database da Origem para o Destino.
  - `[ ⇄ ]`: inverte os lados de Origem e Destino.
  - `[ ◀ Copy ]`: copia conexão e database do Destino para a Origem.
- **Validação Observada na VM:**
  Se o usuário tentar avançar para `Options` ou acionar `Compare` com o Destino inválido ou vazio, o sistema exibe um alerta modal de bloqueio:
  > *"Comparison target is invalid"* `[ OK ]`

### 1.2 Etapa 2: Options [C: re/original-observation/06-schema-compare/wizard-options.png, re/original-observation/p2-04-schema-compare/09-options-1917.png a 12-options-pag4-1918.png]
- **Busca:** Campo de texto com placeholder `Search` e ícone vermelho `✖` para limpar o filtro (`re/original-observation/p2-04-schema-compare/09-options-1917.png`).
- **Link CLI:** `Save settings to a command line arguments file...` para exportação de script de automação.
- **Grupos de Opções (Árvore/Accordion) observados em 4 páginas (`re/original-observation/p2-04-schema-compare/09-options-1917.png` a `re/original-observation/p2-04-schema-compare/12-options-pag4-1918.png`):**
  - `▾ Common`:
    - `☐ Disable dependency analysis`
    - `☐ Ignore AUTO_INCREMENT clause`
    - `☑ Ignore AUTO_INCREMENT table option` *(ativo por padrão [C])*
    - `☑ Ignore average row length` *(ativo por padrão [C])*
    - `☐ Ignore collations`
    - `☐ Ignore column data types`
    - `☐ Ignore column default values`
    - `☑ Ignore DEFINER clause` *(ativo por padrão [C])*
    - `☐ Ignore ENDS clause`
    - `☐ Ignore permissions`
    - `☑ Ignore SQL SECURITY clause` *(ativo por padrão [C])*
    - `☐ Ignore STARTS clause`
    - `☐ Ignore table engine`
  - `▾ Auto Mapping` (`Associate column names having similar name options, 80%`, `Ignore case in object names`, `Ignore spaces in object names` [C: `re/original-observation/p2-04-schema-compare/10-options-pag2-1918.png`])
  - `▾ Tables` (`Force column order`, `Ignore NOT NULL constraints`, `Ignore partitions`, `Ignore row format table option` [C: `re/original-observation/p2-04-schema-compare/11-options-pag3-1918.png`])
  - `▾ Indexes and constraints` e `Script Objects` (`re/original-observation/p2-04-schema-compare/12-options-pag4-1918.png`)
- **Painel de Descrição Contextual:** Exibe o nome e a explicação detalhada do item atualmente em foco.
- **Botões de Perfil (Presets):**
  - Esquerda: `[ Save As My Defaults ]`
  - Direita: `[ Devart Defaults ]`, `[ My Defaults ]`

---

## 2. Execução e Card de Progresso In-Flight [C: re/original-observation/p2-04-schema-compare/13-comparando-1918.png]

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

## 3. Documento de Comparação (.scomp) [C: re/original-observation/06-schema-compare/resultado.png, re/original-observation/p2-04-schema-compare/14-comparador-max-1918.png]

Ao concluir a análise, o documento MDI abre na aba `<source> vs. <target>.scomp*` (`re/original-observation/p2-04-schema-compare/14-comparador-max-1918.png`).

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

### 3.2 Menus e Atalhos Associados [C: re/original-observation/p2-04-schema-compare/22-menu-comparison-ativo-1919.png]
- Menu dedicado `Comparison` no menu principal da aplicação:
  - `New Schema Comparison...`
  - `New Data Comparison...`
  - `Edit Comparison...` (reabre o assistente de configuração de origem/destino)
  - `Objects Filter` (`Ctrl+L`)
  - `Refresh` (`F5`)
  - `Stop Execution`
  - `Change Synchronization Direction`
  - `View Schema Update Script` (abre painel inferior `Schema Update Script` em `re/original-observation/p2-04-schema-compare/23-view-update-script-1919.png`, `re/original-observation/p2-04-schema-compare/24-update-script-espera-1919.png`, `re/original-observation/p2-04-schema-compare/25-update-script-topo-1919.png`)
  - `Generate Comparison Report...` (exportação CSV/HTML)
  - `Synchronize...` (`F8`)

### 3.3 Painel Esquerdo de Filtro de Objetos [C: re/original-observation/p2-04-schema-compare/15-recolhe-source-1918.png a 17-recolhe-source-ok-1918.png]
- Dropdown de controle de exclusão (`Nothing excluded` / `N items excluded`).
- Árvore hierárquica com checkboxes por categoria:
  `Events`, `Functions`, `Packages`, `Procedures`, `Sequences`, `Tables`, `Triggers`, `Views`.

### 3.4 Grade de Objetos e Agrupamento [C: re/original-observation/p2-04-schema-compare/18-janela-arrastada-1918.png a 21-target-lista-d-1919.png]
- **Colunas:** `Type`, `Source Object`, `☑` (seleção para sincronização), `Operation`, `Target Object`.
- **Agrupamentos por Status:**
  - `Only in Source`: Operação `➔* Create` (`re/original-observation/p2-04-schema-compare/14-comparador-max-1918.png`).
  - `Different`: Operação `➔ Update`.
  - `Only in Target`: Operação `✕ Drop` (`re/original-observation/p2-04-schema-compare/19-target-lista-b-1919.png`, `re/original-observation/p2-04-schema-compare/21-target-lista-d-1919.png`).
- **Seleção Padrão:** No original, todos os objetos vêm selecionados por padrão, incluindo operações de `Drop` ("20 of 20 objects selected").

### 3.5 Monaco Diff Editor Lado a Lado [C: re/original-observation/p2-04-schema-compare/14-comparador-max-1918.png]
- Comparação visual DDL entre Origem e Destino com rolagem sincronizada.
- Quando um objeto existe apenas em um dos lados, o lado oposto exibe preenchimento hachurado diagonal acompanhado da etiqueta centralizada `Object does not exist`.

---

## 4. Assistente de Sincronização (Schema Synchronization Wizard — F8) [C: re/original-observation/06-schema-compare/sync-wizard-1.png a sync-wizard-4.png, re/original-observation/p2-04-schema-compare/26-sync-wizard-inicio-1919.png a 35-sync-clique-synchronize-1920.png]

Acionado pela tecla de atalho `F8` ou pelo botão `Synchronize...` (`re/original-observation/06-schema-compare/sync-1.png`). É um assistente de 4 etapas:

### 4.1 Etapa 1: Output [C: re/original-observation/06-schema-compare/sync-wizard-1.png, re/original-observation/p2-04-schema-compare/26-sync-wizard-inicio-1919.png]
- **Opções de Destino do Script:**
  - `(•) Open the synchronization script in the internal editor` *(padrão)*
  - `( ) Save the script to a file`:
    - Campo de caminho com botão `[...]`.
    - `☐ Open in the internal editor`
    - `☑ Append timestamp to the file name`
  - `( ) Execute the script directly against the target database`:
    - `☑ Refresh comparison results after successful synchronization`

### 4.2 Etapa 2: Options [C: re/original-observation/06-schema-compare/sync-wizard-2.png, re/original-observation/p2-04-schema-compare/27-sync-options-1919.png]
- **Grupos:**
  - `▾ Common`:
    - `☐ Check for object existence`
    - `☑ Include USE <database_name>`
    - `☐ Use DROP and CREATE instead of ALTER for tables`
    - `☐ Use DROP and CREATE instead of ALTER for views, procedures, and functions`
  - `▾ Script Comments`:
    - `☐ Exclude comments`
- Painel de descrição da opção focada e botões de preset (`Save As My Defaults`, `Devart Defaults`, `My Defaults`).

### 4.3 Etapa 3: Additional Scripts [C: re/original-observation/06-schema-compare/sync-wizard-3.png, re/original-observation/p2-04-schema-compare/28-sync-additional-scripts-1919.png]
- **Seções Pré e Pós Sincronização:**
  - `☐ Scripts to execute before:`
    - `(•) Use embedded script:` (editor de texto SQL multilinha)
    - `( ) Use external script:` (caminho do arquivo `.sql` + `☐ Include USE`)
  - `☐ Scripts to execute after:`
    - `(•) Use embedded script:` (editor de texto SQL multilinha)
    - `( ) Use external script:` (caminho do arquivo `.sql` + `☐ Include USE`)

### 4.4 Etapa 4: Summary [C: re/original-observation/06-schema-compare/sync-wizard-4.png, re/original-observation/p2-04-schema-compare/29-sync-summary-1920.png]
- **Abas do Painel:**
  - `Action Plan (N)` [C: `re/original-observation/p2-04-schema-compare/31-action-plan-expandido-1920.png` a `re/original-observation/p2-04-schema-compare/34-action-plan-pag4-1920.png`]: Lista sequencial de passos ordenados por dependência topológica (Start Transaction, Drop functions/tables/events/triggers/procedures, Create tables/triggers/views/procedures/functions/events, Commit Transaction).
  - `Warnings (M)` [C: `re/original-observation/p2-04-schema-compare/30-sync-warnings-1920.png`]: Lista de avisos críticos de sincronização acompanhada do aviso:
    > *"Please view carefully the following warnings. They can affect the synchronization."*
    Exemplo real observado: alerta sobre `function1` exigindo `DETERMINISTIC, NO SQL or READS SQL DATA` para evitar erro de criação no MySQL.
- **Contador no cabeçalho:** `N of M objects included in synchronization` ("20 of 20 objects included in synchronization").
- **Botões do Rodapé:** `[ 💾 Save ▾ ]`, `[ < Back ]`, `[ Next > ]`, `[ Synchronize ]` (`re/original-observation/p2-04-schema-compare/35-sync-clique-synchronize-1920.png`), `[ Close ]`.

---

## 5. Execução Direta e Divergência Virtuosa de Segurança (TuxSQL)

> [!IMPORTANT]
> **Divergência Virtuosa de Segurança TuxSQL vs Original:**
> - No dbForge original, a execução direta (`Execute the script directly against the target database`) executa comandos destrutivos como `DROP TABLE` sem qualquer confirmação ou aviso extra ao clicar em `Synchronize`.
> - No **TuxSQL para Linux**, a execução direta com ações destrutivas (`DROP TABLE`, `DROP COLUMN`) impõe uma **confirmação forte obrigatória** com preview do DDL e checkbox explícito `riskAccepted` ("Entendo que dados serão excluídos definitivamente"). O modo padrão do assistente sempre prioriza a abertura do script gerado no editor interno para revisão humana antes da aplicação.

### Script Gerado e Comportamento Pós-Execução [C: re/original-observation/p2-04-schema-compare/36-script-gerado-topo-1920.png a 58-sql10-fechada-1934.png]
- O assistente gera script SQL de 176 linhas (`re/original-observation/p2-04-schema-compare/36-script-gerado-topo-1920.png` a `re/original-observation/p2-04-schema-compare/46-script-pagina-6-1921.png`) contendo cabeçalho metadados, desativação de foreign keys (`SET FOREIGN_KEY_CHECKS=0`), `SET NAMES 'utf8'`, `USE sample_b`, DROPs em lote, CREATEs estruturados e restauração de foreign keys.
- Execução com F5 no SQL Editor (`re/original-observation/p2-04-schema-compare/47-execucao-f5-1921.png`): "Query completed with warnings. 00:00:03.424".
- Verificação no destino (`re/original-observation/p2-04-schema-compare/50-resultado-sample_b-1929.png` e árvore em `re/original-observation/p2-04-schema-compare/53-sample_b-expandido-1932.png` a `re/original-observation/p2-04-schema-compare/56-sample_b-events-1933.png`): objetos sincronizados com sucesso no banco alvo.
- Fechamento da consulta de verificação: `re/original-observation/p2-04-schema-compare/57-fecha-sql10-1934.png`, `re/original-observation/p2-04-schema-compare/58-sql10-fechada-1934.png`.

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
