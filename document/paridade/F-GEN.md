# Paridade — F-GEN (Data Generator)

Fontes: inventário REA M14; `document/ux/12-data-generator.md`; `document/ux/FIDELIDADE.md` Parte C.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Preview determinístico e geração de dados por tabela/quantidade/seed. | CONFIRMADA | `app/test/modules/data-generation.test.ts` — previews repetidos e relatórios de geração. | Prova a lógica, sem comparar a biblioteca REA de generators. |
| Gerar pais antes de filhos e manter valores de FK válidos. | CONFIRMADA | `app/test/modules/data-generation.test.ts` — dependências e valores filhos. | Não cobre todas as combinações de FK cíclicas. |
| Respeitar unicidade, faixas e porcentagem nula configuradas. | CONFIRMADA | `app/test/modules/data-generation.test.ts` — valores únicos e samples regex. | Catálogo detalhado REA de geradores permanece não confirmado. |
| Confirmação do nome do database em produção usa os mesmos valores/prompt do original. | DESCONHECIDA | `SEM EVIDÊNCIA` de equivalência REA. | UX 12 define essa confirmação como decisão do clone. |
