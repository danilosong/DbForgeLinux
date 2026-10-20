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
