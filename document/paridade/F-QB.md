# Paridade — F-QB (Query Builder)

Fontes: inventário REA M10; `document/ux/09-query-builder.md`; `document/ux/FIDELIDADE.md` Parte B; catálogo UI REA consultado internamente, sem transcrição.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Montar SELECT com joins, condições, agrupamento, ordenação e limite. | CONFIRMADA | `app/test/modules/query-builder.test.ts` — SQL gerado com parâmetros. | Modelo e gerador; não testa interação visual de arrastar cartões. |
| Converter uma consulta simples em modelo visual e rejeitar script multi-statement. | CONFIRMADA | `app/test/modules/query-builder.test.ts` — parseQuery e erro multi-statement. | CTE/SQL complexo segue limitado. |
| Carregar colunas e foreign keys usando database como parâmetro. | CONFIRMADA | `app/test/modules/query-builder.test.ts` — inspeção de schema. | Sem conexão real no teste unitário. |
| Auto Layout, minimapa e atalhos específicos são iguais ao original. | DESCONHECIDA | `SEM EVIDÊNCIA` de equivalência visual/runtime REA. | UX 09 e FIDELIDADE Parte B os classificam como inferidos. |
