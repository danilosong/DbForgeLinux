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

## Rodada 2

Revisão dos módulos updater, archive, grid, snippets/toolbox, SQL Formatter, Execute Large Script, Find Object, Documenter, Data Report/Pivot, Schema Compare e contratos IPC. Nenhum achado BLOCKER foi confirmado. Dois achados HIGH foram corrigidos nesta rodada; os riscos restantes estão listados abaixo.

### HIGH — Data Report/Pivot permitia gravação de arquivo no servidor via SELECT

- **FINDING:** a validação aceitava qualquer statement que começasse por `SELECT`, inclusive `SELECT ... INTO OUTFILE`/`DUMPFILE`; com privilégios correspondentes, a consulta podia criar arquivos no host MySQL pelo caminho de uma função de relatório.
- **LOCATION:** `app/src/main/ipc/data-report-pivot.ts`; validação em `app/src/modules/data-report-pivot/query-validation.ts`.
- **EXPECTED:** consultas do relatório devem ser um único SELECT sem saída para arquivos do servidor ou locks de linha.
- **ACTUAL:** a validação agora mascara strings e comentários SQL antes de detectar `INTO OUTFILE`, `INTO DUMPFILE`, `FOR UPDATE` e `LOCK IN SHARE MODE`; a checagem ocorre antes de `streamRows`.
- **EVIDENCE:** teste de regressão em `app/test/modules/data-report-pivot.test.ts` cobre OUTFILE, DUMPFILE com comentário entre palavras-chave, lock de linha e literal contendo o texto bloqueado. `pnpm exec vitest run test/modules/data-report-pivot.test.ts test/ipc-guard.test.ts` passou (11 testes); `pnpm typecheck` e ESLint dos arquivos alterados passaram.
- **SEVERITY:** HIGH — corrigido.

### HIGH — Snapshot de Schema Compare podia inserir statements executáveis no plano

- **FINDING:** campos `createSql` de objetos em snapshots eram aceitos como texto e copiados para o script de comparação. Um snapshot preparado podia anexar DML ou comandos administrativos depois de um `CREATE`, embora a análise offline devesse tratar o arquivo como DDL de entrada.
- **LOCATION:** `app/src/modules/schema/offline.ts` (validação de modelo), `app/src/modules/schema/ddl.ts` (`createObject`) e `app/src/main/ipc/schema-compare.ts` (`synchronize`).
- **EXPECTED:** conteúdo importado pode gerar apenas DDL de objetos suportado; outros statements são recusados no processo principal antes de qualquer execução. Procedures/functions/triggers/events devem continuar sendo tratados como um statement delimitado.
- **ACTUAL:** o handler agora usa `assertSchemaUpdateScript`, que divide directives `DELIMITER` e aceita somente `CREATE`, `ALTER` e `DROP` de TABLE/VIEW/PROCEDURE/FUNCTION/TRIGGER/EVENT. O gerador envolve o corpo de objetos executáveis com delimiter de sincronização. DML, privilégios, troca de database e comandos fora da allowlist são recusados. A confirmação forte existente para `DROP` permanece aplicada.
- **EVIDENCE:** teste de regressão em `app/test/modules/schema.test.ts` confirma sincronização de procedure com delimiter e rejeita `DELETE` anexado ao `createSql` de uma view. `pnpm exec vitest run test/modules/schema.test.ts test/modules/schema-offline.test.ts test/modules/data-report-pivot.test.ts test/ipc-guard.test.ts` passou (20 testes); `pnpm typecheck` e ESLint dos arquivos alterados passaram.
- **SEVERITY:** HIGH — corrigido.

### MEDIUM — Caminho de repositório do updater é validado apenas como absoluto

- **FINDING:** `buildInfo.repoPath` é aceito se for uma string absoluta. No canal dev, esse valor define o `cwd` de `git fetch/pull`, `pnpm install` e `pnpm build`; o updater não confirma que o caminho corresponde à raiz do checkout que gerou o app.
- **LOCATION:** `app/src/modules/updater/UpdateService.ts:31,128,199`.
- **EXPECTED:** limitar o caminho à raiz de repositório esperada para a instalação de desenvolvimento e validar a raiz real antes de qualquer comando que altere checkout ou execute scripts de build.
- **ACTUAL:** `execFile` usa argumentos separados, timeout e cancelamento, e o build vai para `out.next` com validação/rollback; contudo, a validação de `repoPath` só exige caminho absoluto. A confirmação de build não contém referência independente à raiz original.
- **EVIDENCE:** `validBuildInfo` verifica `isAbsolute(info.repoPath)`; `applyDev` resolve o valor e executa `git pull`/`pnpm install` sob o diretório derivado dele.
- **SEVERITY:** MEDIUM — pendente; restrito ao canal dev e a buildInfo adulterado ou checkout local inesperado.

### MEDIUM — CSV exportado pelo Find Object pode executar fórmulas

- **FINDING:** valores iniciados por `=`, `+`, `-` ou `@` são apenas colocados entre aspas CSV. Planilhas comuns ainda podem interpretá-los como fórmula ao abrir o arquivo.
- **LOCATION:** `app/src/renderer/src/ui/panels/database-tools/Panel.tsx` (exportação de Find Object e Find Invalid Objects); mesmo risco nos CSV de `app/src/modules/grid-viewer/index.ts` e `app/src/modules/data-report-pivot/export.ts`.
- **EXPECTED:** escapar campos formulares antes de gravar CSV, preservando os dados sem execução ao abrir em planilha.
- **ACTUAL:** aspas CSV são duplicadas corretamente, mas não há neutralização de prefixos formulares. Dados pesquisados e nomes/definições podem vir do servidor.
- **EVIDENCE:** os formatadores envolvem texto entre aspas e duplicam `"`; não adicionam prefixo seguro para os quatro caracteres nem tratam tabulação/CR como iniciadores.
- **SEVERITY:** MEDIUM — pendente.

### MEDIUM — Descompressão ZIP confia no tamanho declarado da entrada

- **FINDING:** a abertura de backup limita o arquivo comprimido a 50 MiB e verifica `uncompressedSize` antes de descomprimir, mas `entry.getData(new TextWriter())` acumula a saída sem um limite aplicado aos bytes realmente emitidos. Um ZIP malicioso pode declarar tamanho menor que o conteúdo descomprimido e consumir memória acima do limite.
- **LOCATION:** `app/src/modules/archive/index.ts:13`; seleção e leitura em `app/src/main/ipc/database-tools.ts`.
- **EXPECTED:** interromper extração ao exceder limite real de bytes, além de validar o tamanho informado pelo ZIP.
- **ACTUAL:** a validação atual rejeita metadado acima de 50 MiB, porém não limita a saída durante `getData`; a fonte pode ter até 50 MiB comprimidos.
- **EVIDENCE:** `decodeZipEntry` verifica apenas `entry.uncompressedSize` e entrega um `TextWriter` sem contador/limite; o IPC lê o arquivo inteiro após validar apenas o tamanho comprimido.
- **SEVERITY:** MEDIUM — pendente.

### MEDIUM — Importação de snippets lê o arquivo inteiro antes do limite

- **FINDING:** o limite de 5 MiB é verificado em `UserSnippetStore.import`, depois que o IPC já executou `readFile` sem `stat` ou limite de leitura.
- **LOCATION:** `app/src/main/ipc/extra-tools.ts` (`snippets:import`) e `app/src/modules/editor/snippetStore.ts`.
- **EXPECTED:** verificar o tamanho do arquivo escolhido antes de alocá-lo integralmente e manter validação JSON/schema após a leitura.
- **ACTUAL:** o parser valida 5 MiB, 5.000 entradas e cada snippet; a camada IPC carrega primeiro qualquer tamanho em memória.
- **EVIDENCE:** fluxo de importação chama `snippets.import(await readFile(path, 'utf8'))`; o limite de bytes está apenas dentro de `import(json)`.
- **SEVERITY:** MEDIUM — pendente.

### MEDIUM — SQL Formatter pode seguir symlink no diretório selecionado

- **FINDING:** a coleta usa `stat`, que segue symlink, no caminho raiz aprovado pelo diálogo. Se o usuário selecionar um diretório symlink, a recursão pode ler e substituir arquivos SQL na pasta de destino real.
- **LOCATION:** `app/src/modules/editor/batchFormatter.ts:10`; aprovação de caminhos em `app/src/main/ipc/database-tools.ts`.
- **EXPECTED:** canonicalizar/revalidar raízes aprovadas e rejeitar symlink em componentes antes da leitura e da substituição atômica.
- **ACTUAL:** symlinks encontrados dentro da recursão não são seguidos por `Dirent`, mas um symlink passado como raiz é seguido por `stat`; `resolve()` usado pela aprovação preserva o caminho lexical.
- **EVIDENCE:** a função `collect` chama `stat(path)` antes de decidir se o caminho é arquivo ou diretório e, para diretórios, chama `readdir(path)`.
- **SEVERITY:** MEDIUM — pendente.

### MEDIUM — Padrões regex de Find Object não têm limite de execução

- **FINDING:** a busca aceita uma expressão regular de até 256 caracteres e a executa de forma síncrona em cada nome/linha de definição. Uma expressão com backtracking catastrófico combinada com texto longo pode bloquear o processo principal.
- **LOCATION:** `app/src/modules/database-tools/index.ts:8`; chamada em `app/src/main/ipc/database-tools.ts`.
- **EXPECTED:** limitar custo de regex ou usar mecanismo com timeout/garantia de tempo linear para conteúdo de banco não confiável.
- **ACTUAL:** o tamanho da máscara é limitado, mas `RegExp.exec` não tem timeout; linhas de definição não têm limite próprio antes da busca.
- **EVIDENCE:** a opção `regex` cria `new RegExp(needle, ... 'g')` e percorre todas as linhas de cada definição, na thread principal.
- **SEVERITY:** MEDIUM — pendente.

### MEDIUM — Limite de snapshot é aplicado após leitura integral

- **FINDING:** snapshots têm limite de 32 MiB no parser, mas o IPC primeiro usa `readFile` sem conferir o tamanho. A leitura de Scripts Folder também carrega cada SQL completo antes de somar e comparar o limite total de 64 MiB.
- **LOCATION:** `app/src/main/ipc/schema-compare.ts` (`load-offline`) e `app/src/modules/schema/offline.ts` (`parseSchemaSnapshot`, `readScriptsFolder`).
- **EXPECTED:** validar tamanho de arquivo/pasta antes da alocação integral e impor limite de bytes durante a leitura.
- **ACTUAL:** os limites interrompem o parse depois que cada string já está na memória; diretório selecionado é percorrido com `readdir` sem validar `realpath`/`lstat` da raiz, então uma raiz symlink pode fazer a leitura percorrer outro diretório.
- **EVIDENCE:** `readFile(selection.filePaths[0], 'utf8')` precede `parseSchemaSnapshot`; `readScriptsFolder` faz `readFile(entry)` antes de atualizar `totalBytes`; `collectSqlFiles` inicia em `readdir(directory)` sem rejeitar symlink na raiz.
- **SEVERITY:** MEDIUM — pendente.

### MEDIUM — Execute Large Script não interpreta DELIMITER

- **FINDING:** o executor divide no `;` sem processar diretivas `DELIMITER`. Scripts com procedures/functions podem ser enviados em fragmentos; comandos do corpo que deveriam estar dentro do objeto podem acabar enviados separadamente.
- **LOCATION:** `app/src/modules/database-tools/largeScript.ts:30`.
- **EXPECTED:** respeitar as diretivas MySQL de delimiter ou rejeitar o arquivo antes de executar qualquer fragmento quando encontrar uma diretiva não suportada.
- **ACTUAL:** o parser reconhece aspas e comentários, mas não `DELIMITER`; os backups do próprio app usam essa diretiva para rotinas e têm parser separado no restore.
- **EVIDENCE:** `consumeLine` só separa em `;`; os testes atuais cobrem aspas, comentários, encoding, cancelamento e decisões de erro, mas não diretivas `DELIMITER`.
- **SEVERITY:** MEDIUM — pendente.

### MEDIUM — Schemas IPC validam forma básica, não o contrato interno de vários objetos

- **FINDING:** o guard cobre todos os canais `ipcMain.handle` e valida tipos básicos, profundidade e tamanho, mas vários canais recebem payloads inteiros como `object`/`array-object` sem schema recursivo específico (por exemplo, grid-editing, report-pivot, schema-compare e import/export). A integridade dos campos fica dependente de verificações ad hoc dos handlers.
- **LOCATION:** `app/src/main/ipc/guard.ts`.
- **EXPECTED:** esquema completo por canal, com campos obrigatórios/permitidos, tipos, limites e rejeição de propriedades desconhecidas para estruturas críticas.
- **ACTUAL:** existe esquema para cada handler e o teste compara o inventário de handlers com o mapa; porém `object` só exige objeto plano/clonável e limites globais. A cobertura central não equivale a validação completa do contrato de cada payload.
- **EVIDENCE:** `assertSpec` para `object` verifica apenas que o valor é um objeto não-array; `assertStructured` limita bytes/nós/profundidade, sem validar campos do domínio. `app/test/ipc-guard.test.ts` confirma cobertura de canais e também aceita exemplos `{}` em `grid-editing:apply`.
- **SEVERITY:** MEDIUM — pendente; defesa adicional contra renderer comprometido.


### Superfícies conferidas sem achado adicional confirmado

Resumo da Rodada 2: BLOCKER 0; HIGH 2 corrigidos; MEDIUM 9 pendentes; LOW 0 novos.

- **Updater de release:** usa `electron-updater` com provider GitHub definido no builder; fallback de metadata usa HTTPS, `redirect: 'error'`, timeout e envia token somente ao endpoint fixo da API GitHub. Erros são sanitizados. `verifySha512` compara o SHA-512 no helper; a instalação real delega a verificação do artefato ao `electron-updater`.
- **Archive e retenção:** novo ZIP usa WinZip AES-256 da biblioteca `@zip.js/zip.js`; senha não é incluída no log, o teste exercita leitura por 7-Zip e retenção confere propriedade, caminho real, arquivo regular e symlink antes de remover.
- **Grid viewer/editing:** valores de INSERT/UPDATE/DELETE são parâmetros; identificadores são escapados. Apply confere `affectedRows === 1` para operações sobre linhas existentes e mantém o conflito como erro.
- **Documenter e report designer:** valores dinâmicos do HTML são escapados; PDF do Documenter é renderizado em BrowserWindow sandboxed. O JSON do designer tem limite de 1 MiB, valida versão, bandas e campos; HTML/PDF escapam dados exportados.
- **Schema parser:** snapshot não é avaliado como código e DDL folder usa parser estático; limites de comprimento/quantidade existem. As falhas confirmadas desta família foram o plano executável via `createSql` e os limites aplicados após leitura, registrados acima.
- **IPC:** teste verifica igualdade entre handlers declarados e canais do mapa de schemas; todos passam pelo wrapper instalado antes dos registros. A validação de campos internos ainda é genérica em payloads `object`, conforme achado MEDIUM.
