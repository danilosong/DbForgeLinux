# Paridade — F-AI (AI Assistant)

Fontes: inventário REA M19; `document/ux/17-ai-assistant.md`; `document/ux/FIDELIDADE.md` (Parte D registra a adaptação de provedor).

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Clientes de provedor enviam requisições e consomem resposta do assistente. | ADAPTADA PARA LINUX | `app/test/modules/ai-assistant.test.ts` — servidor HTTP falso por provedor. | Os provedores são selecionados pelo usuário no clone. |
| Timeout, respostas inválidas e erros não vazam credenciais nas mensagens/logs. | ADAPTADA PARA LINUX | `app/test/modules/ai-assistant.test.ts` — mensagens seguras e timeout. | Não envia dados a serviço Devart. |
| Contexto de schema/query é limitado e somente transmitido após ação do usuário. | INFERIDA | `app/test/modules/ai-assistant.test.ts` — montagem de contexto e sanitização. | Experiência original é cloud Devart, sem paridade de API. |
| Multi-provedor, armazenamento da chave e UI equivalem ao Copilot Devart original. | DESCONHECIDA | `SEM EVIDÊNCIA` de equivalência; a diferença funcional é deliberada. | FIDELIDADE Parte D descreve essa adaptação. |
