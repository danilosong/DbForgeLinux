# Paridade — F-PRF (Query Profiler)

Fontes: inventário REA M13; `document/ux/11-query-profiler.md`; `document/ux/FIDELIDADE.md` Parte C.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Interpretar EXPLAIN JSON em árvore com custo, linhas e índice. | CONFIRMADA | `app/test/modules/profiler.test.ts` — plano MySQL JSON. | Sem comparar texto do plano com a UI original. |
| Interpretar EXPLAIN TREE e proteger ANALYZE para leitura confirmada. | ADAPTADA PARA LINUX | `app/test/modules/profiler.test.ts` — TREE e bloqueio de DML/sem confirmação. | Proteção e cliente são implementação própria no Linux. |
| Registrar duração/status delta e comparar consultas normalizadas. | INFERIDA | `app/test/modules/profiler.test.ts` — resultado e histórico local. | UI de barras/comparação lateral sem prova REA runtime. |
| Atalhos e gráficos de perfil correspondem aos do produto. | DESCONHECIDA | `SEM EVIDÊNCIA` de comportamento original; spec 11 marca detalhes inferidos. | Teste unitário não resolve paridade visual. |
