# Revisão de segurança

Revisão independente dos módulos AI Assistant, conexões/cofre, Database Tools, Source Control, import/export, ER Diagram, Options e fronteira Electron/IPC. Os itens marcados **corrigido** foram alterados nesta revisão e cobertos por testes quando há uma unidade testável.

## Achados corrigidos

### HIGH — Destino AI por HTTP expunha chave e contexto

- **FINDING:** credenciais e metadados do schema podiam ser enviados sem TLS; o provedor local também podia apontar para qualquer host da rede.
- **LOCATION:** `app/src/modules/ai-assistant/client.ts:3`.
- **EXPECTED:** provedores remotos usam HTTPS; o provedor explicitamente local limita-se a loopback; contexto e respostas têm limites de tamanho.
- **ACTUAL:** agora HTTP remoto e hosts não loopback no modo local são rejeitados. Mensagens têm limite de 1 MB, schema 2 MB e resposta 5 MB; o contexto serializado inclui apenas metadados permitidos, sem linhas.
- **EVIDENCE:** `app/test/modules/ai-assistant.test.ts` cobre rejeição HTTP/host remoto, ausência de valor de linha, timeout e envio por HTTPS.
- **SEVERITY:** HIGH — corrigido.

### HIGH — Operações Git podiam executar hooks/configuração do repositório

- **FINDING:** `commit`, `status` e diffs em repositório selecionado podiam acionar hooks, fsmonitor, textconv ou helpers de protocolo configurados pelo repositório.
- **LOCATION:** `app/src/modules/source-control/index.ts:14`.
- **EXPECTED:** executar Git sem shell, com argumentos separados, sem hooks ou extensões executáveis vindas do repositório.
- **ACTUAL:** permanece `execFile` com array e `shell: false`; comandos desativam hooks, fsmonitor, pager, assinatura GPG, protocolo `ext`, textconv e diff externo.
- **EVIDENCE:** teste cria `pre-commit` malicioso e confirma que seu marcador não é criado após commit.
- **SEVERITY:** HIGH — corrigido.

### HIGH — Symlinks permitiam sair da pasta de projeto

- **FINDING:** caminhos lexicamente relativos podiam atravessar symlinks ao adicionar ou gravar scripts/metadados, sobrescrevendo arquivos fora do projeto.
- **LOCATION:** `app/src/modules/source-control/index.ts:112`.
- **EXPECTED:** validar a raiz real, rejeitar symlinks em componentes e abrir o destino final sem seguir symlink.
- **ACTUAL:** a resolução verifica a raiz real e os componentes existentes, revalida após criar diretórios e usa `O_NOFOLLOW` no arquivo final.
- **EVIDENCE:** teste de symlink tenta sobrescrever arquivo externo e verifica que o conteúdo permanece intacto.
- **SEVERITY:** HIGH — corrigido.

### HIGH — Restore aceitava destino qualificado fora do database confirmado

- **FINDING:** a confirmação validava o nome do database, mas comandos `CREATE`/`INSERT` podiam qualificar outro schema; eventos criados poderiam ser agendados pelo servidor.
- **LOCATION:** `app/src/modules/database-tools/backup.ts:77`.
- **EXPECTED:** confinar comandos ao destino confirmado e impedir que restore habilite jobs agendados.
- **ACTUAL:** schemas qualificados diferentes do destino são rejeitados; `CREATE EVENT` deixou de ser permitido e eventos são listados como ignorados na geração do backup.
- **EVIDENCE:** `app/test/modules/database-backup.test.ts` testa CREATE/INSERT cross-database e rejeição/omissão de eventos.
- **SEVERITY:** HIGH — corrigido.

### HIGH — Navegação externa herdava preload e permissões IPC

- **FINDING:** a janela principal não bloqueava navegação nem criação de janelas; um documento externo poderia tentar usar a superfície de preload.
- **LOCATION:** `app/src/main/index.ts:20`, `app/src/renderer/index.html`.
- **EXPECTED:** manter `contextIsolation`, `nodeIntegration: false` e sandbox, bloquear popups/navegação externa e aplicar CSP.
- **ACTUAL:** esses três controles de janela estão ativos; navegação só permanece no mesmo renderer local/origem de desenvolvimento. CSP bloqueia scripts externos, objetos e frames; não há chamada `shell.openExternal` no código revisado.
- **EVIDENCE:** `app/test/windowPolicy.test.ts` cobre URL local, arquivo externo e esquemas `javascript:`; Electron empacotado abriu no smoke.
- **SEVERITY:** HIGH — corrigido.

### HIGH — `file:save-sql` aceitava caminho arbitrário do renderer

- **FINDING:** o handler aceitava qualquer caminho fornecido pelo renderer e gravava diretamente, sem exigir um diálogo de destino.
- **LOCATION:** `app/src/main/ipc/sql.ts`.
- **EXPECTED:** permitir sobrescrita somente em arquivo escolhido pelo usuário por Open/Save As; limitar o tamanho e manter permissão privada.
- **ACTUAL:** caminhos abertos/selecionados são mantidos por sender; um caminho novo recebido sem autorização abre Save As. SQL tem limite de 20 MB e a gravação termina com modo `0600`.
- **EVIDENCE:** `app/test/windowPolicy.test.ts` testa caminhos autorizados e rejeitados.
- **SEVERITY:** HIGH — corrigido.

### MEDIUM — IPC confiava apenas no renderer local

- **FINDING:** handlers confiavam nos tipos TypeScript e na origem da janela, sem validar os argumentos em runtime nem rejeitar explicitamente chamadas de subframes.
- **LOCATION:** `app/src/main/ipc/*.ts`, validação central em `app/src/main/ipc/guard.ts`.
- **EXPECTED:** validar origem e frame remetente, aplicar schema por canal e limitar payloads e operações perigosas.
- **ACTUAL:** o registro central envolve cada `ipcMain.handle` antes de registrar os módulos. Os 123 canais têm schemas runtime; valida tipos, enums, tamanhos, caminhos absolutos/relativos confinados e confirmação explícita. Só aceita a janela viva cujo frame principal corresponde ao arquivo do renderer ou à origem loopback de desenvolvimento configurada. Payloads estruturados têm limites de profundidade, itens e 24 MB no total. SQL, Git e operações destrutivas têm limites por remetente/canal.
- **EVIDENCE:** `app/test/ipc-guard.test.ts` compara todos os canais declarados aos schemas e testa argumentos malformados, caminhos escapados, enum inválido, confirmação ausente, payload excessivo, origem externa, subframe, janela ausente e rate limit.
- **SEVERITY:** MEDIUM — corrigido; XSS no renderer confiável ainda pode invocar operações válidas dentro desses limites.

### MEDIUM — Importação permitia consumo descontrolado de memória

- **FINDING:** JSON, XML e XLSX eram lidos integralmente; entradas XLSX comprimidas podiam expandir sem limite. Diagramas e Options também aceitavam arquivos sem limite.
- **LOCATION:** `app/src/main/ipc/import-export.ts:78`, `app/src/modules/data-export-import/xlsx.ts`, `app/src/main/ipc/er-diagram.ts`, `app/src/main/ipc/options.ts`.
- **EXPECTED:** limitar bytes de origem e expansão, e validar JSON não confiável antes de persistir/renderizar.
- **ACTUAL:** importações têm limite de 100 MB, expansão XLSX 50 MB por entrada/100 MB total, diagramas 20 MB e Options 5 MB; ER Diagram também valida quantidade, comprimento e coordenadas dos elementos.
- **EVIDENCE:** typecheck e suite completa passam; o smoke cobre abertura de painel com arquivo de build empacotado.
- **SEVERITY:** MEDIUM — corrigido.

### LOW — Campos secretos extras podiam persistir nas conexões

- **FINDING:** a remoção de segredos inline não cobria chaves chamadas `token`, `apiKey` ou `credential`; regravações do cofre também não corrigiam permissão de arquivo preexistente.
- **LOCATION:** `app/src/main/connections/ConnectionsStore.ts:47`, `app/src/main/security/PasswordVault.ts:15`.
- **EXPECTED:** remover campos sensíveis genéricos e manter arquivos do cofre em modo privado.
- **ACTUAL:** o filtro inclui token, API key e credential; o cofre rejeita backend `basic_text`/desconhecido e força modo `0600` após gravação.
- **EVIDENCE:** `app/test/ConnectionsStore.test.ts` confirma que tokens e credenciais inline não são serializados; `app/test/PasswordVault.test.ts` valida o cofre.
- **SEVERITY:** LOW — corrigido.

### LOW — Arquivos de exportação podiam herdar modo permissivo

- **FINDING:** exportação de dados e regravação de backup/diagramas/configuração usavam `mode: 0600`, que não altera o modo de um arquivo já existente.
- **LOCATION:** `app/src/main/ipc/import-export.ts`, `app/src/main/ipc/database-tools.ts`, `app/src/main/ipc/er-diagram.ts`, `app/src/main/ipc/options.ts`.
- **EXPECTED:** reforçar permissões privadas também em arquivos preexistentes escolhidos no diálogo.
- **ACTUAL:** após gravar, os handlers aplicam `chmod(0600)`; exportação de dados cria stream em `0600` e reforça o modo ao terminar.
- **EVIDENCE:** inspeção do fluxo de gravação e typecheck.
- **SEVERITY:** LOW — corrigido.

## Riscos residuais

### MEDIUM — Endpoint HTTPS de provedor compatível permanece configurável

- **FINDING:** um endpoint compatível HTTPS pode apontar para um serviço interno ou host controlado pelo usuário; requisições incluem conversa e, para provedores remotos, chave API.
- **LOCATION:** `app/src/modules/ai-assistant/client.ts:3`.
- **EXPECTED:** lista de hosts permitidos ou aviso/consentimento por endpoint antes de transmitir dados.
- **ACTUAL:** transporte remoto exige HTTPS e URLs com credenciais/query secrets são recusadas no SettingsStore, mas endpoints compatíveis permanecem arbitrários para permitir servidores self-hosted.
- **EVIDENCE:** `normalizeAiEndpoint` valida protocolo e credenciais, mas não resolve/bloqueia IPs privados para domínios HTTPS configurados.
- **SEVERITY:** MEDIUM — endpoint configurado pelo usuário.

### MEDIUM — Restore de rotinas e triggers depende da confiança no arquivo

- **FINDING:** restore de uma rotina/trigger importada pode instalar código que execute quando for chamado ou quando a tabela receber DML posteriormente.
- **LOCATION:** `app/src/modules/database-tools/backup.ts:81`.
- **EXPECTED:** avisar claramente sobre conteúdo não confiável e exigir revisão integral/consentimento antes de instalar lógica executável.
- **ACTUAL:** restore aceita CREATE de tabelas, views, procedures, functions e triggers após confirmação do database; a UI mostra apenas as primeiras 24 linhas do arquivo. Eventos agendados são recusados.
- **EVIDENCE:** o allowlist restringe o comando inicial, mas não interpreta o corpo de rotinas/triggers.
- **SEVERITY:** MEDIUM — use apenas backups confiáveis.

### LOW — XML usa parser simples, sem expansão de entidades

- **FINDING:** import XML não usa parser XML formal e aceita estrutura por expressão regular.
- **LOCATION:** `app/src/modules/data-export-import/import.ts:145`.
- **EXPECTED:** parser XML endurecido com DTD e entidades externas explicitamente desabilitados.
- **ACTUAL:** o parser atual não resolve DTD nem busca entidades externas; somente decodifica entidades XML predefinidas e numéricas, portanto não foi observado XXE. Formatos complexos/namespace podem não ser importados corretamente.
- **EVIDENCE:** `decodeXml` substitui apenas `lt`, `gt`, `quot`, `apos`, `amp` e referências numéricas.
- **SEVERITY:** LOW — limitação funcional e revisão futura.
