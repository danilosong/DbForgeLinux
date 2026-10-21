# Updates

TuxSQL Song has development and release update channels. Open **Help → Check for Updates…** to check at any time. The status bar shows when a check is running or an update is ready. The update window lists the version summary, progress, and recent log messages; a download can be cancelled.

Open **Tools → Options → Updates** to choose the channel, startup behavior, and check interval. Startup checks wait briefly after the window opens and do not block database work. Network failures during the automatic check are silent; use the Help command to see the error. Automatic installation is off by default. The updater asks before replacing a build while a query or transaction is active.

## Development channel

The development channel is available in builds launched from a local Git checkout with `tools/tuxsql-dev`. It checks local commits and `origin` without changing source files during the check. Applying an update requires a clean working tree and the same branch used to build the app. The updater uses `git pull --ff-only` when the remote branch is ahead, installs dependencies only when the lockfile changed, builds in a separate output directory, validates it, then swaps the app bundle atomically. If compilation or validation fails, the current bundle stays in place.

Use channel **Automatic** to select the local development channel in a checkout and GitHub releases in a packaged installation. **Release** always uses published GitHub assets. On Linux, AppImage and supported Debian packages use their package updater; if package installation is unavailable, the release page opens for a manual install.

## Build metadata

Each build writes `out/buildInfo.json`. Release builds omit the local repository path, so they cannot expose a developer checkout or select the development channel automatically.

## Instalar o `.deb` e atualizar pelo repositório (vínculo de desenvolvimento)

O app instalado em `/opt` é somente leitura, então ele não consegue se recompilar. Para quem **desenvolve** o projeto, o pacote
tem um ponto de entrada (`bootstrap/dev-link.cjs`) que, quando existe um vínculo, executa o build do **repositório** em vez do
build embutido. Assim o botão **Atualizar** (git + rebuild + reinício) muda o que roda, sem reinstalar o `.deb`.

1. Instale o pacote normalmente (`sudo apt install --reinstall ./tuxsql_0.1.0_amd64.deb`).
2. Crie o vínculo, apontando para o seu clone:

   ```bash
   mkdir -p ~/.config/tuxsql
   echo '{"repoPath":"/caminho/para/TuxSQL"}' > ~/.config/tuxsql/dev-link.json
   ```

3. Garanta que o clone foi compilado ao menos uma vez (`cd app && pnpm install && pnpm build`).
4. Para voltar ao build embutido: apague o arquivo ou abra com `TUXSQL_NO_DEV_LINK=1`.

O vínculo é ignorado (e o build embutido é usado) se o build do repositório não existir, não for seu ou for gravável por outros usuários.

## O que cada canal exige

| Canal | Quando | Precisa de |
|---|---|---|
| **Release** (padrão para quem só instala) | `.deb` ou AppImage sem vínculo | Nada além de acesso à internet. **Não precisa de Git.** |
| **Desenvolvimento** | app vinculado a um clone | **Git** e **pnpm** (com Node) instalados, e o clone compilado |

Se o canal de desenvolvimento estiver ativo e o **Git não estiver instalado**, o app mostra um aviso claro (instale com
`sudo apt install git`) em vez de falhar. Se o `pnpm` não for encontrado, a mensagem indica como informá-lo
(`TUXSQL_PNPM`). Enquanto nenhuma release tiver sido publicada no GitHub, o canal de release apenas diz que está atualizado.

## Por que o app vinculado mostrava o canal "Versão estável"

`pnpm dist:deb` compila em modo release (sem o caminho do repositório no `buildInfo.json`) e isso sobrescrevia o `out/` do clone vinculado, então o app caía no canal de release. Agora `dist:deb` recompila em modo normal ao terminar, mantendo o canal de desenvolvimento. Se ver "Versão estável" com o vínculo ativo, rode `cd app && pnpm build`.
