# Paridade — F-ER (Diagrama ER)

Fontes: inventário REA M11; `document/ux/10-diagrama-er.md`; `document/ux/FIDELIDADE.md` Parte C; catálogo REA consultado internamente, sem cópia.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Extrair tabelas, colunas e chaves estrangeiras físicas para o modelo do diagrama. | CONFIRMADA | `app/test/modules/er-diagram.test.ts` — schema e relações. | Usa modelo de schema construído pelo teste. |
| Posicionar tabelas automaticamente e tolerar dependências cíclicas. | CONFIRMADA | `app/test/modules/er-diagram.test.ts` — layout pai/filho e ciclo. | Algoritmo verificado, sem avaliação humana de legibilidade. |
| Criar relações virtuais e persistir posições/relacionamentos por conexão/database. | CONFIRMADA | `app/test/modules/er-diagram.test.ts` — store em diretório temporário e serialização. | Não mede equivalência do formato ao `.dbd` do produto. |
| Exportar imagem PNG/SVG com o mesmo resultado do original. | INFERIDA | `app/test/modules/er-diagram.test.ts` verifica modelo/SVG quando aplicável. | PDF e atalhos do clone são adaptações; equivalência visual REA não foi observada. |
