AGENT: Bigorna (Codex)
NOTA: Arquiteto = "Chefinho". Se `maestri ask "Chefinho"` falhar, finalize com resumo no terminal. `git add` SÓ dos seus arquivos.
OBJECTIVE: Backend dos módulos Data Generator (M14), Data Compare (parte de M9) e Documenter (M15). Sem UI.
REFERENCE: app/src/modules/schema (modelo/introspecção), app/src/modules/data-export-import, document/01-rea-inventario.md
TASK:
1. app/src/modules/data-generation/: geradores por tipo de coluna e por semântica (nomes, e-mails, endereços, datas, números, lorem, listas, regex, sequência, FK existente, valores de outra tabela, NULL %, unique garantido), seed reproduzível, respeitar constraints (NOT NULL, UNIQUE, FK e ordem de dependência entre tabelas, CHECK simples), inserção em lotes com transação e cancelamento (AbortSignal), preview, relatório. Locale pt-BR e en-US.
2. app/src/modules/data-compare/: comparar dados de tabelas de dois databases/conexões por chave (PK/colunas escolhidas), streaming ordenado (merge por chave, sem carregar tudo), classificar iguais/diferentes/só-origem/só-destino, gerar script de sincronização (INSERT/UPDATE/DELETE) parametrizado e seguro, DELETE desabilitado por padrão.
3. app/src/modules/documenter/: a partir do modelo de schema gerar documentação em HTML, Markdown e PDF (HTML→PDF via Electron printToPDF isolado em interface, testável com stub) com índice, tabelas/colunas/índices/FK, views, rotinas, triggers, eventos, dependências, descrição editável, e opcional diagrama simples (SVG).
CONSTRAINTS: só app/src/modules/ e app/test/modules/; não tocar renderer/main/index.ts; identificadores escapados, valores parametrizados; nunca logar dados.
ACCEPTANCE: unit + integração docker (gerar 100k linhas respeitando FKs; data-compare produz script que torna A==B; documenter gera arquivos válidos); typecheck/lint/vitest passam; commits pequenos.
