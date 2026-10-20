# Paridade — F-RPT (Data Report / Pivot)

Fontes: inventário REA M16; `document/ux/16-data-report-pivot.md`; `document/ux/FIDELIDADE.md` Parte D.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Agrupar linhas/colunas e calcular sum/count, totais e subtotais. | CONFIRMADA | `app/test/modules/data-report-pivot.test.ts` — agregações e totais. | Os subtotais não estão cobertos em todos os agrupamentos. |
| Aplicar filtros, agrupamento temporal e preparar série de gráfico. | CONFIRMADA | `app/test/modules/data-report-pivot.test.ts` — quarter, filtro e chart series. | Não verifica renderização do gráfico em browser. |
| Exportar resultados do pivot para CSV, HTML e PDF válido. | ADAPTADA PARA LINUX | `app/test/modules/data-report-pivot.test.ts` — escaping/formato PDF. | Não prova DOCX nem designer do produto original. |
| Toolbox, bandas e atalhos de designer correspondem ao produto. | DESCONHECIDA | `SEM EVIDÊNCIA` de equivalência REA. | UX 16/FIDELIDADE Parte D classifica controles como inferidos. |
