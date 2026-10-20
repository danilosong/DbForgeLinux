# Paridade — F-GRID (Grid de Resultados / Data Editor)

Fontes: inventário REA M6; `document/ux/03-explorer-editor.md`; `document/ux/FIDELIDADE.md` Parte A.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Consulta executada apresenta cabeçalhos e linhas em grade, inclusive páginas disk-backed. | CONFIRMADA | `app/scripts/smoke-e2e.mjs` — SELECT 1 no MySQL e célula do grid; `app/test/ResultSpool.test.ts` — leitura paginada. | E2E prova uma linha e uma coluna. |
| Grade virtual lê janelas de resultados sem materializar o conjunto inteiro. | ADAPTADA PARA LINUX | `app/test/ResultSpool.test.ts`; `app/test/performance-benchmark.test.ts` executado neste ciclo com 1.000.000 de linhas e cinco páginas. | Benchmark comprova o spool, não o layout visual da grade em grande volume. |
| Edição inline de resultado de uma tabela identificável: update, insert, delete, NULL, preview, post e rollback. | CONFIRMADA | `app/test/grid-editing.test.ts`; `app/test/grid-editing.integration.test.ts` — MySQL real; `app/scripts/qa-risk-e2e.mjs` — UPDATE/INSERT/DELETE pela UI e comparação posterior; screenshots `document/evidence/ui/table-data-grid-edit-{light,dark}.png`. | Editável apenas quando a consulta resolve para uma tabela única com chave; demais resultados exibem motivo read-only. |
| Filtro e exportação do grid têm equivalência completa com REA. | DESCONHECIDA | SEM EVIDÊNCIA. | Fora do escopo do teste de edição desta rodada. |
