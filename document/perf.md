# Performance baseline

Medido em 2026-10-20 com `pnpm perf:benchmark` (`vitest run test/performance-benchmark.test.ts`), Node v26.2.0, Ubuntu 26.04.1, Ryzen 7 5700G, 16 CPUs visíveis, 30 GiB RAM. Os dados são sintéticos para separar custos do app e do servidor MySQL.

| Cenário | Medição | Memória/armazenamento |
| --- | ---: | ---: |
| Parse de script com 10 mil `UPDATE` (468 KB) | 5 ms | 10.000 statements |
| Spool de 1 milhão de linhas | 962 ms | JSONL temporário de 48 MiB; índice esparso com 3.907 offsets; RSS aumentou 19 MiB |
| Leitura de cinco páginas de 100 linhas, em posições distribuídas | 6 ms | 500 linhas materializadas no total |
| Exportação CSV de 1 milhão de linhas | 1.343 ms | arquivo de 25 MiB; RSS aumentou 43 MiB durante o benchmark |

O SQL Editor mantém resultados SELECT sem `LIMIT` ou com limite acima de 1.000 no processo principal, em arquivo temporário por blocos de 256 linhas. O renderer pede páginas de 100 linhas e retém apenas a página visível. O cancelamento aborta diretamente o stream do mysql2; o arquivo parcial é removido. Os spools são removidos ao substituir resultados por outra execução ou fechar o renderer. As medições de exportação usam um gerador de linhas e medem o pipeline CSV do app, não a latência da rede/servidor.

Scripts com pelo menos 100 statements sem SELECT são enviados em uma chamada IPC quando `multipleStatements` está habilitado na conexão. O parser continua medindo 5 ms para 10 mil statements; o benchmark não inclui tempo de execução SQL do servidor.

Reexecute `pnpm perf:benchmark` após alterações no grid, parser ou exportadores para atualizar esta tabela. Os números variam conforme o armazenamento temporário e a máquina.

## Metadados em escala

Em 2026-10-21 a suíte completa voltou a medir os fluxos sintéticos de spool e exportação: 1 milhão de linhas foi gravado no spool em 2.239 ms (RSS +19 MiB), cinco páginas aleatórias foram lidas em 6 ms, e o CSV de 1 milhão de linhas (25 MiB) foi exportado em 1.521 ms (RSS +85 MiB). Esses cenários não medem carregamento de catálogo de schema.

| Meta | Evidência nesta rodada | Estado |
| --- | --- | --- |
| Explorer abre com ~3.000 tabelas em menos de 1 s | Fixture de 3.000 tabelas/200 views/300 rotinas/50 databases não foi criada nesta rodada. | SEM MEDIÇÃO |
| Autocomplete com cache quente responde em menos de 100 ms | O benchmark atual não mede sugestões contra catálogo grande. | SEM MEDIÇÃO |
| Nenhum bloqueio perceptível da UI acima de 200 ms | Não foi coletada trace de renderização com catálogo em escala. | SEM MEDIÇÃO |

O pipeline de resultados continua paginado pelo spool; isso não comprova o comportamento do Explorer, Find Object, Schema Compare ou Documenter com milhares de objetos. As metas acima ficam pendentes de uma fixture de metadados descartável e de trace de UI. Não foram usados nem alterados `sample` ou `sample_b`.
