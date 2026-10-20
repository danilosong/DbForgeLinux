# Paridade — F-CON (Conexões)

Fontes consultadas: `document/01-rea-inventario.md` (M2), `document/ux/02-conexoes.md`, `document/ux/01-shell.md`, `document/ux/FIDELIDADE.md` (Parte A) e catálogo interno `re/ui-strings/ui-text.txt`. O catálogo foi usado apenas para conferir rótulos; seus registros não são reproduzidos aqui.

| Comportamento esperado | Estado | Evidência da referência | Prova no clone |
|---|---|---|---|
| Conexões MySQL/MariaDB podem ser testadas e salvas no Connection Manager. | CONFIRMADA | Inventário M2; UX 02 §1, §2 e §6; rótulos do diálogo e do teste constam no catálogo REA. | `app/test/connections-ipc.test.ts`; smoke `app/scripts/smoke-e2e.mjs` (cria conexão MySQL descartável). |
| Uma conexão salva conecta ao servidor e executa operações SQL. | CONFIRMADA | Inventário M2 e UX 02 §4; rótulo Connect encontrado no catálogo. | `app/test/MysqlDriver.integration.test.ts`; smoke e2e, SELECT 1 em MySQL:33067. |
| Credenciais persistidas ficam fora do registro de conexão em texto puro. | ADAPTADA PARA LINUX | Inventário §Adaptações Linux; UX 02 §7 requer cofre de segredos. | `app/test/PasswordVault.test.ts`, `app/test/ConnectionsStore.test.ts`. |
| SSH e autenticação com chave privada são caminhos de conexão disponíveis. | ADAPTADA PARA LINUX | Inventário M2; UX 02 §2.3; transferência para OpenSSH/Linux explicitada no inventário. | `app/test/SshTunnel.test.ts` valida o túnel; `app/test/connectionOptions.test.ts` valida configurações do cliente. |
| Atalho original Ctrl+D, Ctrl+N está registrado; o fluxo de conexão no clone abre, conecta e executa SQL. | CONFIRMADA | UX 02 cabeçalho e `document/ux/FIDELIDADE.md`, Parte A; sequência consta no mapa de atalhos REA. | `app/test/modules/keymap-parity.test.ts` valida o binding; `app/scripts/smoke-e2e.mjs` percorre conexão MySQL pela UI e executa SELECT 1. |
| Start Page lista conexões salvas recentes e permite selecionar/reconectar. | INFERIDA | UX 01 §5 propõe Recent Connections; comportamento sem marca é inferido. | `app/scripts/smoke-e2e.mjs` valida conexão salva recente; fluxo de conexão MySQL passa pelo formulário e executa SELECT 1. |
| HTTP tunnel e opções avançadas de conexão suportam o transporte/validação esperados no clone. | ADAPTADA PARA LINUX | UX 02 §2.2–2.5; FIDELIDADE Parte A mantém campos e estados de UI como inferidos. | `app/test/modules/http-tunnel.test.ts`; `app/test/connectionOptions.test.ts`; a equivalência visual REA permanece desconhecida. |
