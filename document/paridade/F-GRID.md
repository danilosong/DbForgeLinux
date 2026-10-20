# Paridade — F-GRID (Grid de Resultados / Data Editor)

Fontes: inventário REA M6; `document/ux/03-explorer-editor.md`; `document/ux/FIDELIDADE.md` Parte A.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Consulta executada apresenta cabeçalhos e linhas em grade, inclusive páginas disk-backed. | CONFIRMADA | `app/scripts/smoke-e2e.mjs` — SELECT 1 no MySQL e célula do grid; `app/test/ResultSpool.test.ts` — leitura paginada. | E2E prova uma linha e uma coluna. |
| Grade virtual lê janelas de resultados sem materializar o conjunto inteiro. | ADAPTADA PARA LINUX | `app/test/ResultSpool.test.ts`; `app/test/performance-benchmark.test.ts` executado neste ciclo com 1.000.000 de linhas e cinco páginas. | Benchmark comprova o spool, não o layout visual da grade em grande volume. |
| Filtro/exportação do grid e edição de linhas têm a semântica do produto. | DESCONHECIDA | `SEM EVIDÊNCIA` automatizada para edição inline e equivalência REA. | UX 03 §4 marca edição como P1 e vários rótulos como inferidos. |
