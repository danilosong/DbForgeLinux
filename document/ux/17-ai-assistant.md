# UX 17 — AI Assistant

Reusa `01-shell.md`, `03` (CodeEditor), `02` (credenciais/cofre). **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (AI Assistant) e https://www.devart.com/dbforge/mysql/studio/ai-assistant.html. Citações por redirecionamento; páginas individuais não abertas. Original usa Copilot embutido com Chromium (CefGlue, inventário); no clone o chat é nativo (sem CEF).

**Fidelidade REA (ui-text):** no original o AI Assistant é um **serviço em nuvem Devart** com Sign In, termos ("Devart AI Terms of Services" / "Devart AI Policy"), cota de tokens por licença/trial e histórico de chats em arquivo local. **Não há** seletor de provedor/endpoint/API key na evidência REA; a configuração multi-provedor (§4) é adaptação do clone **[I]**. Fonte dos rótulos: **REA ui-text**; atalhos: **REA shortcuts** (não existe comando de atalho para AI Assistant).

## 1. Painel AI Assistant [C: painel dock; título "AI Assistant" / "AI Assistant Chat" — REA ui-text]
Dock direito (menu **AI Assistant** > **Open Chat Window** [C REA ui-text]; sem atalho no mapa REA shortcuts → Ctrl+Alt+I é proposta do clone [I]); conversas múltiplas listadas em **All Chats** [C], botão **New chat** [C], **Chat Settings** [C]; lista vazia: "Você ainda não tem chats" ("You have no chats yet.") [C]. Excluir chat confirma "Tem certeza que deseja excluir o chat '{0}'?" [C]. 
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

## 2. Capacidades [C]
Natural language → SQL [C]; explicar SQL selecionado/script [C]; encontrar/corrigir erros [C]; otimizar consultas e sugerir índices [C]; gerar comentários/documentação; converter dialeto (MySQL↔MariaDB); gerar dados de exemplo / DDL a partir de descrição [I]. Comandos reais [C REA ui-text]: **Explain SQL**, **Fix SQL**, **Explain In Current Chat**, **Explain In New Chat**, **Send Selection To New Chat**, **Convert Natural Language to SQL**, "Get AI suggestions to optimize and speed up your SQL queries" (otimizar). Anexos: "Attach a document to provide the AI with additional context" e "Attach a {0} to provide the AI with context about the data schema" [C]. Sem schema anexado a IA avisa para anexar o database [C]. Add comments / Ask… e botão **Fix with AI** no painel de erro são extensões do clone [I].

## 3. Contexto e privacidade (crítico)
- **Contexto de schema** [C: anexar estrutura]: seletor de escopo (database ativo / tabelas escolhidas), enviado como **metadados apenas (nomes, tipos, chaves, comentários)** — nunca linhas de dados por padrão. Indicador permanente "Enviando: 24 tabelas (somente estrutura)" com [Ver o que é enviado] (modal com o payload em texto).
- Dados de resultado/seleção só quando marcados explicitamente, com aviso "Pode conter dados sensíveis".
- Primeiro uso [C]: diálogo de consentimento com checkbox "Concordo com os Devart AI Terms of Services e Devart AI Policy" (links tos/policy) e botão **Sign In** [C REA ui-text]; no clone: provedor, o que é enviado, link da política [I]; recusar mantém o painel desabilitado.
- Redação opcional (Options > AI): mascarar literais string/numéricos em SQL enviado; ignorar tabelas/colunas listadas (ex.: `users.password`); conexões marcadas Prod/"sensível" bloqueiam envio de schema (configurável).
- Chaves/credenciais do provedor no cofre do SO; nunca em logs. Histórico das conversas local (`$XDG_DATA_HOME/dbforgelinux/ai`), apagável (Clear all).

## 4. Provedores e configuração
Options > AI Assistant: Provedor (OpenAI-compatível / Anthropic / Gemini / **Local (Ollama/endpoint HTTP)** [I]), Endpoint URL, Modelo (campo + lista), API key (PasswordInput; [Test] mostra OK/erro), temperatura, limite de contexto/tokens, timeout, proxy do sistema. Local sem rede é recomendado para dados sensíveis. [Test] estados: loading/ sucesso verde com latência / erro vermelho com causa (401, rede, modelo inexistente).

## 5. Interações e blocos de resposta
- Streaming de tokens com cursor; [Stop ■] cancela; indicador "Pensando…".
- Blocos de código SQL realçados (Monaco compacto): ações **Copy**, **Insert at cursor**, **Replace selection**, **Open in new SQL**, **Run** (executa na conexão ativa — **nunca automático**; statements que não são SELECT/SHOW/EXPLAIN exigem confirmação mostrando o SQL; Prod/read-only reforçado), **Explain plan**.
- Mensagens: copiar, regenerar, 👍/👎 (local, opcional), editar mensagem anterior e reenviar [I].
- Anexos de contexto como chips removíveis; `@tabela` autocompleta tabelas/colunas; `/explain`, `/fix`, `/optimize`, `/comment`, `/new` comandos.
- Respostas validadas: ao inserir SQL, executar parser local e marcar "sintaxe OK"/"aviso: tabela inexistente" [I].
- Aviso fixo: "Respostas de IA podem estar incorretas — revise antes de executar."

## 6. Estados
| Estado | Comportamento |
|---|---|
| Não configurado / sem login | EmptyState "Configure um provedor" + [Abrir Options] [I]; original: "Default model selection is not available. Sign in…" + **Sign In** [C] |
| Sem conexão | funciona sem schema; chip "Sem contexto de banco" |
| Enviando/streaming | botão vira Stop; input desabilitado opcionalmente |
| Erro (rede/limite/auth/conteúdo) | mensagem inline vermelha com causa + [Tentar de novo] [Editar configurações]. Mensagens reais [C]: "Não foi possível conectar ao serviço do AI Assistant; verifique internet e firewall"; cota esgotada ("You've used all available AI Assistant tokens… balance resets on {0}"); trial/assinatura expirada com link renovar; conteúdo impróprio: aviso para manter a conversa respeitosa e focada em bancos de dados |
| Arquivo de histórico | corrompido/sem permissão/em uso por outro processo/não criável: mensagens inline [C]; "Foi criado um novo arquivo para guardar seus chats" [C]; histórico perdido avisado [C] |
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
| I agree to Devart AI Terms of Services and Devart AI Policy | Checkbox de consentimento (adaptar nome do provedor) | `ai.consent.agree` |
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
- Atalho para abrir o painel AI Assistant (Ctrl+Alt+I) e demais atalhos §7: sem evidência no mapa REA shortcuts.
- Multi-provedor (OpenAI/Anthropic/Gemini/Ollama), endpoint, API key, temperatura, timeout: sem evidência; original é serviço Devart com Sign In.
- Ações Copy/Insert/Replace/Run/Explain plan nos blocos de código e comandos `/` e `@`: não localizados no ui-text.
- Botão "Fix with AI" no painel de erro, validação local de sintaxe da resposta, 👍/👎 e edição de mensagem: propostas do clone.
- Textos do rating/NPS do original ("How likely are you to recommend…") existem; decidir se o clone omite (sem telemetria).
- Redação/mascaramento, bloqueio por conexão Prod e indicador "Enviando: N tabelas": requisitos de privacidade do clone, sem equivalente REA.
