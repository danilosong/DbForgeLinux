# Paridade — F-AI (AI Assistant)

Fontes: inventário REA M19; `document/ux/17-ai-assistant.md`; `document/ux/FIDELIDADE.md` (Parte D registra a adaptação de provedor) e `re/original-observation/10-tools-options/23-ai-assistant-1804.png`.

> **Status de Verificação:** não verificável na VM atual (precisa servidor SSH de teste / conta na nuvem).

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Clientes de provedor enviam requisições e consomem resposta do assistente. | NÃO VERIFICÁVEL NA VM ATUAL (precisa servidor SSH de teste / conta na nuvem) | `app/test/modules/ai-assistant.test.ts` — servidor HTTP falso por provedor. | O original dbForge exige login em nuvem Devart ("Sign in to AI Assistant to select a default model", capturado em `re/original-observation/10-tools-options/23-ai-assistant-1804.png`); impossível conectar sem conta de nuvem na VM. |
| Timeout, respostas inválidas e erros não vazam credenciais nas mensagens/logs. | ADAPTADA PARA LINUX | `app/test/modules/ai-assistant.test.ts` — mensagens seguras e timeout. | Não envia dados a serviço Devart; proteção de chave de API local. |
| Contexto de schema/query é limitado e somente transmitido após ação explícita do usuário. | NÃO VERIFICÁVEL NA VM ATUAL (precisa servidor SSH de teste / conta na nuvem) | `app/test/modules/ai-assistant.test.ts` — montagem de contexto e sanitização. | Depende de endpoint ativo de modelo de IA externo. |
| Multi-provedor, armazenamento seguro da chave e interface equivalem ao assistente original. | NÃO VERIFICÁVEL NA VM ATUAL (precisa servidor SSH de teste / conta na nuvem) | `document/evidence/ui/ai-assistant-light.png`. | Sem credencial de nuvem no ambiente de isolamento da VM de teste. |
