# Spec — Atualização automática (dois canais)

Objetivo: o usuário não precisa reinstalar a cada alteração. O app verifica atualização ao abrir e oferece (ou aplica) a atualização por um botão.

## Canais
| Canal | Quando | Fonte | Como atualiza |
|---|---|---|---|
| **dev** (git local) | app rodando a partir do repositório (`buildInfo.json` presente com `repoPath`) | commits do repositório local (e, opcionalmente, do `origin`) | recompila e reinicia |
| **release** (GitHub) | app instalado por `.deb`/AppImage | GitHub Releases (`electron-updater`) | baixa o instalador novo e aplica |

O canal é detectado sozinho: existe `buildInfo.json` ao lado do bundle com `{commit, branch, repoPath, builtAt}` → dev; senão → release. Em Options > Atualizações o usuário pode forçar o canal e desativar a checagem.

## Fluxo comum
1. Ao abrir (≈3 s após a janela, sem bloquear a UI; timeout 10 s; offline = silêncio) e em **Help > Check for Updates...**, o main process consulta o canal.
2. Se houver novidade: indicador discreto na barra de status ("Atualização disponível") e item no menu Help; diálogo com **resumo das mudanças** (lista de commits, ou notas da release), botões **Atualizar agora** / **Depois** / **Ignorar esta versão**.
3. Opção "Atualizar automaticamente ao abrir" (padrão: desligada; só pergunta).
4. Nunca atualiza com consulta SQL em execução ou transação aberta: avisa e espera confirmação.

## Canal dev
- Verificação: `git -C <repoPath> rev-parse HEAD` vs `buildInfo.commit`; se o repositório tiver remoto, `git fetch` (sem pull automático) e compara `origin/<branch>`. Mostra `git log --oneline <build>..<alvo>`.
- Aplicar: (a) se `origin/<branch>` está à frente e a árvore está limpa → `git pull --ff-only` (nunca merge/reset/checkout; árvore suja = só avisa); (b) se `pnpm-lock.yaml` mudou → `pnpm install --frozen-lockfile`; (c) `pnpm build` em diretório temporário (`out.next`), valida o resultado (arquivos principais existem) e só então troca `out` por `out.next` (atômico); (d) `app.relaunch()`.
- Falha em qualquer etapa: mantém o build atual, mostra o log, não deixa o app quebrado.
- Todos os comandos por `execFile` com argumentos em array; `repoPath` vem do `buildInfo.json`/Options (nunca de input livre do renderer); canais de IPC só aceitam ações nomeadas (`check`, `apply`, `cancel`).
- Script gerador do `buildInfo.json` no `pnpm build` (commit, branch, `git status --porcelain` limpo ou não, data) e launcher `tools/dbforge-dev` + `.desktop` de desenvolvimento que abre o app direto do build do repositório.

## Canal release
- `electron-updater` com provider GitHub (`danilosong/DbForgeLinux`); `publish` no `electron-builder.yml`; alvos Linux: **AppImage** (auto-update completo) e **.deb** (instalação inicial; atualização via `DebUpdater` quando disponível, com elevação por polkit — se indisponível, abre a página da release e informa).
- CI (`.github/workflows/release.yml`): em tag `v*` roda typecheck/lint/test/build, gera AppImage + .deb + `latest-linux.yml` e publica a release (changelog de `CHANGELOG.md`).
- Verificação de integridade: hashes sha512 do `latest-linux.yml`; sem HTTP (somente HTTPS); repositório privado exige token em variável de ambiente/cofre, nunca em texto puro.
- Versão semântica em `package.json`; `CHANGELOG.md` alimenta as notas.

## UI
- Barra de status: `Atualização disponível` (clicável) / `Verificando...` / `Atualizado`.
- Diálogo (PanelDialog): versão atual → nova, canal, resumo, progresso (download/build), log expansível, cancelar.
- Options > Atualizações: checar ao abrir (on), atualizar automaticamente (off), canal (auto/dev/release), intervalo (a cada abertura / diário), versão ignorada, botão "Verificar agora".
- i18n en/pt-BR; guard de IPC com schemas; erros sem vazar tokens.

## Critérios de aceite
- Simulado: repositório temporário com commit novo → app detecta, lista commits, atualiza (build falso) e reinicia; build quebrado → app continua no build antigo.
- Árvore suja ou `origin` divergente: só avisa, nunca altera o repositório.
- Servidor de release falso (HTTPS local) → detecta versão nova, baixa, valida hash, recusa hash inválido.
- Offline/timeout: nenhuma mensagem de erro intrusiva na abertura.
- Testes unitários + e2e (xvfb-run); screenshots claro/escuro; documentação em `document/user-guide/updates.md`.
