# UX 17 — AI Assistant

Reusa `01-shell.md`, `03` (CodeEditor), `02` (credenciais/cofre). **[C]** CONFIRMADO / **[I]** INFERIDO.

> [!WARNING]
> **Status de Verificação:** **NÃO VERIFICÁVEL NA VM ATUAL ALÉM DA CASCA DESLOGADA (exige login e conta em nuvem Devart; requisições de modelo e chat bloqueadas sem autenticação).**
> Toda e qualquer interação ativa de chat, envio de prompt, streaming de resposta ou completions requer login corporativo Devart Cloud e assinatura PRO. A especificação técnica deste documento cobre:
> 1. A casca visual observada deslogada na VM (`re/original-observation/11-ai-assistant/` e `re/original-observation/10-tools-options/23-ai-assistant-1804.png`) **[C]**.
> 2. O catálogo de mensagens e comandos REA ui-text extraídos dos assemblies (`re/ui-strings/ui-text.txt`) **[C]**.
> 3. O modelo arquitetural e de UX adotado pelo clone TuxSQL para integração com LLMs locais (Ollama) e provedores remotos (OpenAI, Anthropic, Gemini) sem telemetria nem dependência do serviço de nuvem proprietário da Devart **[I]**.

**Evidências Reais Observadas da Casca Deslogada (10 PNGs em `re/original-observation/11-ai-assistant/` + Options):**
1. `re/original-observation/11-ai-assistant/01-ai-assistant-click-1806.png`: Botão "AI Assistant" no topo direito da barra de título com selo "1" abre menu com 4 opções: `Sign In`, `Open Chat Window`, `Discover All Features`, `Send Feedback`.
2. `re/original-observation/11-ai-assistant/02-open-chat-window-1806.png`: Painel acoplado à direita "AI Assistant Chat" (com botões de fixar e fechar), exibindo tela de boas-vindas: logotipo `dbForge AI Assistant`, botões primários `Sign In` (azul) e `Get AI Assistant [PRO]`, além de 4 cartões tipo acordeão (chevron).
3. `re/original-observation/11-ai-assistant/03-card-1-expanded-1806.png`: Cartão 1 expandido: "Convert Natural Language to SQL" — *"Easily turn your ideas into fully functional SQL queries—no coding skills required."*
4. `re/original-observation/11-ai-assistant/04-cards-expanded-1806.png`: Cartão 4 expandido: "Error Analysis & Recommendations" — *"Get practical, step-by-step assistance to identify and fix issues across your database."*
5. `re/original-observation/11-ai-assistant/05-card-2-expanded-1806.png`: Cartão 2 expandido: "Schema-Aware Code & Explanations" — *"Get intelligent code suggestions and explanations aware of your database schema."*
6. `re/original-observation/11-ai-assistant/06-card-3-expanded-1807.png`: Cartão 3 expandido: "SQL Troubleshooting" — *"Quickly spot and fix errors with AI-powered debugging, query optimization, and performance improvements."* Link "Discover all features" no rodapé. Área inferior vazia sem caixa de entrada de chat para usuário não logado.
7. `re/original-observation/11-ai-assistant/07-editor-context-1807.png`: Menu de contexto do editor SQL exibe item de submenu `AI Assistant >`.
8. `re/original-observation/11-ai-assistant/08-ctx-ai-assistant-submenu-1807.png`: Submenu contextual do AI Assistant exibindo unicamente a ação `Sign In` (bloqueio de recursos sem login).
9. `re/original-observation/11-ai-assistant/09-ctx-settings-submenu-1807.png`: Submenu `Settings >` contendo atalho para o diálogo `Options...`.
10. `re/original-observation/11-ai-assistant/10-final-1807.png`: Área de trabalho com painel lateral acoplado em repouso.
11. `re/original-observation/10-tools-options/23-ai-assistant-1804.png`: Diálogo Tools > Options > AI Assistant > General: seletor "Default model" desabilitado com aviso explicativo *"Default model selection is not available. Sign in to AI Assistant to select a default model."* e opção `[x] Auto-Attach Active Document`.

---

## 1. Painel AI Assistant [C: re/original-observation/11-ai-assistant/02-open-chat-window-1806.png]
Dock direito (menu **AI Assistant** > **Open Chat Window** [C: `re/original-observation/11-ai-assistant/01-ai-assistant-click-1806.png`]; atalho Ctrl+\,C observado no menu View em `re/original-observation/12-start-menus-erros/14-menu-view-1809.png` [C]; Ctrl+Alt+I mantido como alternativa Linux [I]).
- Estado Deslogado Original: boas-vindas com botões `Sign In` e `Get AI Assistant PRO` e 4 cartões colapsáveis (`re/original-observation/11-ai-assistant/02-open-chat-window-1806.png` a `re/original-observation/11-ai-assistant/06-card-3-expanded-1807.png`).
- Estado Ativo Clone TuxSQL: conversas múltiplas em **All Chats** [C REA ui-text], botão **New chat** [C REA ui-text], **Chat Settings** [C REA ui-text]; lista vazia: "Você ainda não tem chats" ("You have no chats yet.") [C REA ui-text]. Excluir chat confirma "Tem certeza que deseja excluir o chat '{0}'?" [C REA ui-text].
```
+ AI Assistant -------------------------- [+ New chat] [⋯] [x] --+
| Contexto: [☑ Schema de prod-db/shop ▾] [☑ Documento atual]       |
|           [☐ Seleção] [☐ Resultado atual] [☐ Mensagem de erro]  |
+------------------------------------------------------------------+
| Conversa (rolável)                                               |
|  Você: Liste os 10 clientes com maior total de pedidos           |
|  Assistente: Texto explicativo...                                |
|   ┌ SQL ─────────────────────────────────────┐                   |
|   │ SELECT ...                               │ [Copy][Insert]    |
|   └──────────────────────────────────────────┘ [Replace][Run][Explain]
+------------------------------------------------------------------+
| [Caixa de mensagem multilinha ....................]   [Send ▶]   |
| Enter envia · Shift+Enter nova linha · / comandos · @ referências |
+------------------------------------------------------------------+
```

## 2. Capacidades [C: re/original-observation/11-ai-assistant/03-card-1-expanded-1806.png a 06-card-3-expanded-1807.png]
- **Convert Natural Language to SQL** [C: `re/original-observation/11-ai-assistant/03-card-1-expanded-1806.png`]: conversão de pedidos em linguagem natural para queries SQL executáveis.
- **Schema-Aware Code & Explanations** [C: `re/original-observation/11-ai-assistant/05-card-2-expanded-1806.png`]: sugestões e explicações conscientes do schema do banco ativo.
- **SQL Troubleshooting** [C: `re/original-observation/11-ai-assistant/06-card-3-expanded-1807.png`]: depuração assistida por IA, otimização de consultas e sugestões de índices.
- **Error Analysis & Recommendations** [C: `re/original-observation/11-ai-assistant/04-cards-expanded-1806.png`]: passo a passo para identificar e corrigir falhas em statements ou objetos.
- Comandos reais [C REA ui-text]: **Explain SQL**, **Fix SQL**, **Explain In Current Chat**, **Explain In New Chat**, **Send Selection To New Chat**, **Convert Natural Language to SQL**, "Get AI suggestions to optimize and speed up your SQL queries". Anexos: "Attach a document to provide the AI with additional context" e "Attach a {0} to provide the AI with context about the data schema" [C]. Sem schema anexado a IA avisa para anexar o database [C]. Add comments / Ask… e botão **Fix with AI** no painel de erro são extensões do clone [I].

## 3. Contexto e privacidade (crítico)
- **Contexto de schema** [C: anexar estrutura]: seletor de escopo (database ativo / tabelas escolhidas), enviado como **metadados apenas (nomes, tipos, chaves, comentários)** — nunca linhas de dados por padrão. Indicador permanente "Enviando: 24 tabelas (somente estrutura)" com [Ver o que é enviado] (modal com o payload em texto).
- Dados de resultado/seleção só quando marcados explicitamente, com aviso "Pode conter dados sensíveis".
- Primeiro uso [C]: diálogo de consentimento com checkbox "Concordo com os Devart AI Terms of Services e Devart AI Policy" (links tos/policy) e botão **Sign In** [C REA ui-text / `re/original-observation/11-ai-assistant/01-ai-assistant-click-1806.png`]; no clone: provedor, o que é enviado, link da política [I]; recusar mantém o painel desabilitado.
- Redação opcional (Options > AI): mascarar literais string/numéricos em SQL enviado; ignorar tabelas/colunas listadas (ex.: `users.password`); conexões marcadas Prod/"sensível" bloqueiam envio de schema (configurável).
- Chaves/credenciais do provedor no cofre do SO; nunca em logs. Histórico das conversas local (`$XDG_DATA_HOME/tuxsql/ai`), apagável (Clear all).

## 4. Provedores e configuração [C: re/original-observation/10-tools-options/23-ai-assistant-1804.png]
- Na referência original, a tela Tools > Options > AI Assistant > General exibe aviso bloqueante para conta não autenticada: *"Default model selection is not available. Sign in to AI Assistant to select a default model."* e checkbox `[x] Auto-Attach Active Document` [C: `re/original-observation/10-tools-options/23-ai-assistant-1804.png`].
- No TuxSQL (adaptação livre Linux [I]): opções de provedores flexíveis: Local (Ollama/endpoint HTTP local sem dependência de nuvem), OpenAI, Anthropic, Gemini. Configuração de Endpoint URL, Modelo, API Key no cofre local, temperatura, limite de tokens e timeout. Suporte a teste de conexão com feedback visual de latência.

## 5. Interações e blocos de resposta [I]
- Streaming de tokens com cursor; [Stop ■] cancela; indicador "Pensando…".
- Blocos de código SQL realçados (Monaco compacto): ações **Copy**, **Insert at cursor**, **Replace selection**, **Open in new SQL**, **Run** (executa na conexão ativa — **nunca automático**; statements que não são SELECT/SHOW/EXPLAIN exigem confirmação mostrando o SQL; Prod/read-only reforçado), **Explain plan**.
- Mensagens: copiar, regenerar, 👍/👎 (local, opcional), editar mensagem anterior e reenviar [I].
- Anexos de contexto como chips removíveis; `@tabela` autocompleta tabelas/colunas; `/explain`, `/fix`, `/optimize`, `/comment`, `/new` comandos.
- Respostas validadas: ao inserir SQL, executar parser local e marcar "sintaxe OK"/"aviso: tabela inexistente" [I].
- Aviso fixo: "Respostas de IA podem estar incorretas — revise antes de executar."

## 6. Estados
| Estado | Comportamento |
|---|---|
| Não configurado / sem login | EmptyState "Configure um provedor" + [Abrir Options] [I]; original: "Default model selection is not available. Sign in…" + **Sign In** [C: `re/original-observation/10-tools-options/23-ai-assistant-1804.png`, `re/original-observation/11-ai-assistant/02-open-chat-window-1806.png`] |
| Sem conexão | funciona sem schema; chip "Sem contexto de banco" |
| Enviando/streaming | botão vira Stop; input desabilitado opcionalmente |
| Erro (rede/limite/auth/conteúdo) | mensagem inline vermelha com causa + [Tentar de novo] [Editar configurações]. Mensagens reais [C REA ui-text]: "Não foi possível conectar ao serviço do AI Assistant; verifique internet e firewall"; cota esgotada ("You've used all available AI Assistant tokens… balance resets on {0}"); trial/assinatura expirada com link renovar; conteúdo impróprio: aviso para manter a conversa respeitosa e focada em bancos de dados |
| Arquivo de histórico | corrompido/sem permissão/em uso por outro processo/não criável: mensagens inline [C REA ui-text]; "Foi criado um novo arquivo para guardar seus chats" [C REA ui-text]; histórico perdido avisado [C REA ui-text] |
| Resposta longa | colapsável "Mostrar mais" |
| Offline | banner âmbar; fila não mantida |
| Sucesso | resposta + ações |
| Resposta longa | colapsável "Mostrar mais" |
| Offline | banner âmbar; fila não mantida |
| Sucesso | resposta + ações |

## 7. Atalhos
**REA shortcuts:** nenhum atalho do original para AI Assistant (nem Explain/Fix). Os abaixo são do clone [I]; Ctrl+Alt+E e Ctrl+Alt+I devem ser checados contra o mapa real (Ctrl+Alt+L = Show Explorer, Ctrl+Alt+Q = Properties, Ctrl+Alt+X = Toolbox, Ctrl+Alt+O = Output, Ctrl+Alt+F = Find Object) [C REA shortcuts].
Abrir painel Ctrl+Alt+I [I]; Enviar Enter; Nova linha Shift+Enter; Novo chat Ctrl+Shift+N (no painel); Parar Esc; Explicar seleção Ctrl+Shift+E [I] (no mapa REA o Explorer é Ctrl+Alt+L / Ctrl+W,L; Ctrl+Alt+E livre mas não usado pelo original); Focar caixa Ctrl+L [I].

## 8. Temas / acessibilidade
Tokens 01; bolhas bg.surfaceAlt (assistente) e bg.hover (usuário); blocos de código com theme do Monaco; leitores de tela recebem mensagens por aria-live "polite" ao concluir (não token a token); foco visível; alvo ≥24px.

## 9. Componentes
DockPanel, ChatThread, MessageBubble, CodeBlock (com ações), ContextChips, ComposerInput (@ e /), ProviderSettingsForm, ConsentDialog, PayloadPreviewDialog, ConfirmDialog, Banner.

## 10. Critérios de aceite
- Perguntar em linguagem natural gera SQL no contexto do schema, inserir/rodar com confirmação.
- Explicar, corrigir e otimizar a partir do editor e do erro.
- Privacidade: consentimento, payload visível, só metadados por padrão, redação e provedor local.
- Estados, temas, teclado cobertos.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| AI Assistant | Menu, título do painel | `ai.title` |
| AI Assistant Chat | Título do documento/painel de chat | `ai.chat.title` |
| Open Chat Window | Menu AI Assistant | `ai.menu.openChat` |
| New chat | Botão do painel | `ai.chat.new` |
| All Chats | Lista/menu de conversas | `ai.chat.all` |
| Chat Settings | Menu do painel | `ai.chat.settings` |
| You have no chats yet. | EmptyState da lista de chats | `ai.chat.empty` |
| Are you sure you want to delete the '{0}' chat? | Confirmação de exclusão | `ai.chat.deleteConfirm` |
| Explain SQL | Menu de contexto do editor | `ai.cmd.explainSql` |
| Fix SQL | Menu de contexto do editor | `ai.cmd.fixSql` |
| Explain In Current Chat | Menu de contexto | `ai.cmd.explainCurrent` |
| Explain In New Chat | Menu de contexto | `ai.cmd.explainNew` |
| Send Selection To New Chat | Menu de contexto | `ai.cmd.sendSelection` |
| Convert Natural Language to SQL | Comando/entrada NL->SQL | `ai.cmd.nl2sql` |
| Get AI suggestions to optimize and speed up your SQL queries. | Tooltip/descrição de otimizar | `ai.cmd.optimizeHint` |
| Attach a document to provide the AI with additional context. | Tooltip de anexo | `ai.attach.docHint` |
| Attach a {0} to provide the AI with context about the data schema. | Tooltip de anexo de schema | `ai.attach.schemaHint` |
| Sign In | Botão de login/consentimento | `ai.signIn` |
| Default model selection is not available. Sign in to select a default model. | Estado sem login nas opções | `ai.options.noModel` |
| AI Assistant settings. / AI Assistant options. | Descrição da página de opções | `ai.options.desc` |
| Unable to connect to the AI Assistant service. Check internet connection and firewall. | Erro de rede | `ai.err.connect` |
| You've used all available AI Assistant tokens... balance resets on {0}. | Erro de cota | `ai.err.quota` |
| Your subscription has expired. Renew your license... | Erro de licença (n/a no clone livre; manter para provedor com cota) | `ai.err.expired` |
| The chat history file was corrupted and could not be read. | Erro de histórico | `ai.err.historyCorrupt` |
| Unable to open the chat history file as it is being used by another process. | Erro de histórico | `ai.err.historyLocked` |
| Unable to access the chat history file due to insufficient read/write permissions. | Erro de histórico | `ai.err.historyPerm` |
| A new file has been created to store your chat records. | Aviso pós-recuperação | `ai.info.historyCreated` |
| Copy With Headers | Ações de copiar resultado (contexto) | `grid.copyWithHeaders` |

## Pendências [I]
- **Limite de Verificação na VM:** Toda a interação conversacional (chat, streaming, envio de mensagens, seletores de modelo em conta logada e ações ativas) é **NÃO VERIFICÁVEL NA VM ATUAL** por exigir login corporativo Devart Cloud e assinatura PRO; apenas a casca deslogada foi observada e confirmada (`re/original-observation/11-ai-assistant/` e `re/original-observation/10-tools-options/23-ai-assistant-1804.png`).
- Atalho para abrir o painel AI Assistant (Ctrl+Alt+I) e demais atalhos §7: sem evidência no mapa REA shortcuts (no original observado Ctrl+\,C no menu View em `re/original-observation/12-start-menus-erros/14-menu-view-1809.png`).
- Multi-provedor (OpenAI/Anthropic/Gemini/Ollama), endpoint, API key, temperatura, timeout: adaptação arquitetural do clone Linux sem dependência da nuvem Devart.
- Ações Copy/Insert/Replace/Run/Explain plan nos blocos de código e comandos `/` e `@`: não localizados no ui-text.
- Botão "Fix with AI" no painel de erro, validação local de sintaxe da resposta, 👍/👎 e edição de mensagem: propostas do clone.
- Textos do rating/NPS do original ("How likely are you to recommend…") existem; decidir se o clone omite (sem telemetria).
- Redação/mascaramento, bloqueio por conexão Prod e indicador "Enviando: N tabelas": requisitos de privacidade do clone, sem equivalente REA.
