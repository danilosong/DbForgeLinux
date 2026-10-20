# UX 17 — AI Assistant

Reusa `01-shell.md`, `03` (CodeEditor), `02` (credenciais/cofre). **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (AI Assistant) e https://www.devart.com/dbforge/mysql/studio/ai-assistant.html. Citações por redirecionamento; páginas individuais não abertas. Original usa Copilot embutido com Chromium (CefGlue, inventário); no clone o chat é nativo (sem CEF).

## 1. Painel AI Assistant [C: painel dock]
Dock direito (View > AI Assistant, Ctrl+Alt+I [I]); abas de conversa múltiplas. 
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
Natural language → SQL [C]; explicar SQL selecionado/script [C]; encontrar/corrigir erros [C]; otimizar consultas e sugerir índices [C]; gerar comentários/documentação; converter dialeto (MySQL↔MariaDB); gerar dados de exemplo / DDL a partir de descrição [I]. Atalhos de contexto no editor: seleção → menu **AI Assistant >** Explain / Fix / Optimize / Add comments / Ask…; no painel de erro de execução: botão **Fix with AI** [I].

## 3. Contexto e privacidade (crítico)
- **Contexto de schema** [C: anexar estrutura]: seletor de escopo (database ativo / tabelas escolhidas), enviado como **metadados apenas (nomes, tipos, chaves, comentários)** — nunca linhas de dados por padrão. Indicador permanente "Enviando: 24 tabelas (somente estrutura)" com [Ver o que é enviado] (modal com o payload em texto).
- Dados de resultado/seleção só quando marcados explicitamente, com aviso "Pode conter dados sensíveis".
- Primeiro uso: diálogo de consentimento (provedor, o que é enviado, link da política); recusar mantém o painel desabilitado.
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
| Não configurado | EmptyState "Configure um provedor" + [Abrir Options] |
| Sem conexão | funciona sem schema; chip "Sem contexto de banco" |
| Enviando/streaming | botão vira Stop; input desabilitado opcionalmente |
| Erro (rede/limite/auth/conteúdo) | mensagem inline vermelha com causa + [Tentar de novo] [Editar configurações] |
| Resposta longa | colapsável "Mostrar mais" |
| Offline | banner âmbar; fila não mantida |
| Sucesso | resposta + ações |

## 7. Atalhos
Abrir painel Ctrl+Alt+I [I]; Enviar Enter; Nova linha Shift+Enter; Novo chat Ctrl+Shift+N (no painel); Parar Esc; Explicar seleção Ctrl+Alt+E? [conflita com Explorer 01 — usar Ctrl+Shift+E [I]]; Focar caixa Ctrl+L [I].

## 8. Temas / acessibilidade
Tokens 01; bolhas bg.surfaceAlt (assistente) e bg.hover (usuário); blocos de código com theme do Monaco; leitores de tela recebem mensagens por aria-live "polite" ao concluir (não token a token); foco visível; alvo ≥24px.

## 9. Componentes
DockPanel, ChatThread, MessageBubble, CodeBlock (com ações), ContextChips, ComposerInput (@ e /), ProviderSettingsForm, ConsentDialog, PayloadPreviewDialog, ConfirmDialog, Banner.

## 10. Critérios de aceite
- Perguntar em linguagem natural gera SQL no contexto do schema, inserir/rodar com confirmação.
- Explicar, corrigir e otimizar a partir do editor e do erro.
- Privacidade: consentimento, payload visível, só metadados por padrão, redação e provedor local.
- Estados, temas, teclado cobertos.
