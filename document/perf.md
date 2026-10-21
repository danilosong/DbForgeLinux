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

## Inicialização

Medição em 2026-10-21 no mesmo ambiente Linux, com o executável empacotado, `xvfb-run` e o benchmark `pnpm perf:startup`. O início frio usa diretórios de usuário temporários; o aquecido repete o fluxo no mesmo processo de teste. Cada número é uma execução, portanto diferenças pequenas podem refletir variação do host.

| Estado | Marco | Antes | Depois |
| --- | --- | ---: | ---: |
| Frio | Janela visível | 1,202 ms | 1,223 ms |
| Frio | Explorer pronto | 1,264 ms | 1,227 ms |
| Frio | Editor interativo | 1,806 ms | 1,730 ms |
| Aquecido | Janela visível | 841 ms | 818 ms |
| Aquecido | Explorer pronto | 979 ms | 1.099 ms |
| Aquecido | Editor interativo | 1.336 ms | 1.373 ms |

As metas observadas nesta máquina foram atingidas: janela visível abaixo de 1,5 s e editor interativo abaixo de 3 s, em ambas as rodadas. Não atribuí as variações inferiores a algumas centenas de milissegundos a uma melhoria consistente.

O renderer agora monta editores de SQL e objetos sob demanda; o registro de painéis usa imports dinâmicos e o painel do explorador de projetos só é montado quando aberto. O Monaco configura workers ESM para editor e JSON sob demanda e importa apenas as contribuições SQL, JSON e Markdown usadas pelo app. O IPC não essencial (histórico, ferramentas extras e atualização) é carregado após a primeira pintura, por um evento de renderer validado pelo guard. A janela não abre o diálogo do atualizador automaticamente.

| Artefato | Antes observado | Depois |
| --- | ---: | ---: |
| Chunk de entrada do renderer, gzip | ~8,4 MB (estimativa de partida da tarefa) | 256 KB (1.266.230 bytes sem gzip) |
| Diretório `out/renderer` | 463 MB com chunks antigos acumulados | 12 MB após build limpa |

O JS agregado do Monaco ainda gera chunks de linguagens adicionais por causa das dependências internas do pacote; não entram no chunk inicial e as contribuições registradas pelo app permanecem SQL/JSON/Markdown. A correção `emptyOutDir` evita manter chunks de builds anteriores no diretório. O benchmark de inicialização mede marcos visuais/funcionais do processo empacotado, não uma distribuição estatística; repita em hardware de referência antes de usar esses valores como SLA.

Repetição após reconstruir o pacote para o smoke, também em 2026-10-21: frio 1.257 ms (janela), 1.261 ms (Explorer), 1.752 ms (editor); aquecido 808 ms, 1.083 ms e 1.349 ms, respectivamente. A diferença em relação à linha “Depois” está dentro da variação observada e preserva as metas.
