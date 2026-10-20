# Paridade — F-SQL (Editor SQL)

Fontes consultadas: inventário REA M4–M6, `document/ux/03-explorer-editor.md`, `document/ux/01-shell.md`, `document/ux/FIDELIDADE.md` (Parte A) e catálogo interno `re/ui-strings/ui-text.txt`. O catálogo serviu somente para validar nomes e atalhos; não foi copiado.

| Comportamento esperado | Estado | Evidência da referência | Prova no clone |
|---|---|---|---|
| Editor SQL em documento com execução de consulta e exibição de resultados. | CONFIRMADA | Inventário M4; UX 03 §2–3; nomes de editor/resultado constam no catálogo REA. | `app/test/MysqlDriver.integration.test.ts`; smoke e2e executa SELECT 1. |
| Novo SQL, Execute e Format Document têm bindings registrados; o clone cria documentos e executa consulta pelo editor. | CONFIRMADA | UX 03 cabeçalho e §5; atalhos REA consultados. | `app/test/modules/keymap-parity.test.ts` valida Ctrl+N, F5 e Ctrl+K Ctrl+D no registry; `app/scripts/smoke-e2e.mjs` cria SQL e executa arquivo aberto pela toolbar; `app/test/modules/editor.test.ts` exercita formatter. |
| Autocomplete contextual e metadados do database orientam edição. | INFERIDA | Inventário M5 (autocomplete/parser) e UX 03 §2; a fidelidade do detalhe interno é inferida. | `app/test/modules/editor.test.ts`; `app/test/modules/schema.integration.test.ts`. |
| Arquivo SQL aberto pode ser retomado em Recent Files na Start Page. | INFERIDA | UX 01 §5 sugere Recent Files, sem validação do produto de referência. | `app/scripts/smoke-e2e.mjs` abre fixture via seletor simulado, executa-a, reabre pela lista recente. |
| Histórico registra consulta, conexão, duração, resultado e falha. | INFERIDA | Inventário M4 cita ExecutionHistory e UX 03 §2–3. | `app/test/history.test.ts` (quando presente); integração no smoke valida execução, não persistência do histórico. |
| Resultado SQL abre em grid paginado; equivalência de edição, pivot e Master-Detail não é afirmada. | DESCONHECIDA | Inventário M6 identifica assemblies, sem especificação/runtime suficiente para confirmar toda a semântica REA. | `app/scripts/smoke-e2e.mjs` valida o grid/célula de SELECT; `app/test/ResultSpool.test.ts` verifica paginação local. Sem prova de edição/pivot/Master-Detail. |
| Navegação por teclado e caminho de estado seguem diretórios XDG no Linux. | ADAPTADA PARA LINUX | UX 01 §10 e inventário §Adaptações Linux definem XDG e convenções Ctrl. | `app/test/windowPolicy.test.ts`; `app/scripts/smoke-e2e.mjs` usa diretórios XDG temporários. |
