# Paridade — F-AC (Autocomplete, Snippets, Formatter, Query History)

Fontes: inventário REA M5; `document/ux/03-explorer-editor.md`; `document/ux/01-shell.md`; `document/ux/FIDELIDADE.md` Parte A; catálogo REA consultado internamente, sem cópia.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| SQL recebe sugestões contextuais de schema e completa nomes em contexto. | INFERIDA | `app/test/modules/editor.test.ts` — construção e ranking de sugestões. | Sem teste de evento de teclado em Monaco. |
| Formatter reconhece cláusulas e preserva literais/comentários. | CONFIRMADA | `app/test/modules/editor.test.ts` — formatação de documento e seleção. | Clone não comparado lado a lado com formato REA. |
| Query History persiste consultas/resultado e filtra registros. | INFERIDA | `app/test/history.test.ts` — store, busca e limites. | Sem equivalência de apresentação/atalhos. |
| Snippets do clone inserem placeholders e suportam catálogo original completo. | DESCONHECIDA | `SEM EVIDÊNCIA` de catálogo equivalente; spec 03/inventário M5 confirmam snippets como área. | Strings/arquivos de snippet REA não foram copiados. |
