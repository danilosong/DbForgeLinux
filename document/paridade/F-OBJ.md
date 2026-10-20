# Paridade — F-OBJ (Explorer e editores de objetos)

Fontes consultadas: inventário REA M3/M7, `document/ux/03-explorer-editor.md`, `document/ux/04-editor-tabela.md`, `document/ux/05-editores-objetos.md`, `document/ux/FIDELIDADE.md` (Parte A) e catálogo interno `re/ui-strings/ui-text.txt`. O catálogo não é reproduzido.

| Comportamento esperado | Estado | Evidência da referência | Prova no clone |
|---|---|---|---|
| Database Explorer navega databases e objetos do servidor. | CONFIRMADA | Inventário M3; UX 03 §1; “Database Explorer” consta no catálogo REA. | `app/test/modules/schema.test.ts`; `app/test/modules/schema.integration.test.ts`. |
| Table Editor organiza colunas, chaves e propriedades de tabela. | CONFIRMADA | Inventário M7; UX 04 §1–3; rótulos de edição e constraints aparecem no catálogo REA. | `app/test/modules/object-editors.test.ts`; screenshots `document/evidence/ui/table-designer-light.png` e `table-designer-dark.png`. |
| Editor de procedure/view/function/trigger/event permite revisar e aplicar DDL. | CONFIRMADA | Inventário M7; UX 05 §1–8; rótulos de editor e execução conferidos no catálogo. | `app/test/modules/object-editors.test.ts`, `object-editors.integration.test.ts`; screenshots `procedure-editor-light.png` e `procedure-editor-dark.png`. |
| Apply Changes e ações destrutivas obedecem confirmações e refletem resultado no servidor. | CONFIRMADA | UX 04 §3–4 e UX 05 §2; referências de ações/diálogo presentes no catálogo REA. | `app/test/modules/object-editors.integration.test.ts`; `app/test/modules/object-editors.test.ts`. |
| F4 abre Properties e Delete remove coluna no comportamento original. | CONFIRMADA | UX 04 cabeçalho: mapa REA shortcuts. | `app/test/modules/object-editors.test.ts` prova validação e geração de DDL com coluna adicionada; o acionamento do atalho F4/Delete na interface continua DESCONHECIDO. |
| Preview DDL do clone gera CREATE/ALTER; equivalência das páginas/atalhos (Indexes, Partitions e Ctrl+Alt+D) permanece aberta. | INFERIDA | UX 04 cabeçalho e FIDELIDADE Parte A marcam nomes e atalho como inferidos. | `app/test/modules/object-editors.test.ts` valida preview CREATE/ALTER e diferença de schema. |
| Validações de tabela rejeitam coluna sem nome e tipo SQL inválido. | INFERIDA | UX 04 §4–5; FIDELIDADE Parte A registra detalhe de labels/banners como não confirmado. | `app/test/modules/object-editors.test.ts` exercita ambos os erros. |
