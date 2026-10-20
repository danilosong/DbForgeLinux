# dbForgeLinux

Scaffold I0 do cliente desktop para MySQL/MariaDB: Electron, TypeScript, React, Monaco e `mysql2`.

## Desenvolvimento

```sh
pnpm install
pnpm dev
```

Em Linux sem display gráfico, inicie o shell com Xvfb:

```sh
xvfb-run -a env -u WAYLAND_DISPLAY -u XDG_SESSION_TYPE pnpm dev
```

Preencha host, porta, usuário e senha na barra lateral, conecte e execute SQL no editor. O driver disponibiliza listagem de databases/tabelas e resultados para cada instrução. As senhas persistidas passam por `safeStorage` do Electron.

## Qualidade e pacote Debian

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm dist:deb
```

O pacote `.deb` é criado em `dist/` e depende de `libsecret-1-0` para o cofre seguro no Linux.

Inspecione o conteúdo do pacote sem instalá-lo no sistema:

```sh
dpkg-deb -c dist/dbForgeLinux_0.1.0_amd64.deb
```

Smoke e2e com o Electron empacotado, Playwright e MySQL descartável na porta `33067`:

```sh
docker compose -f test/docker-compose.yml up -d --wait
pnpm dist:deb
pnpm smoke:e2e
docker compose -f test/docker-compose.yml down -v
```

O script abre a conexão temporária `dbforge_smoke`, executa `SELECT 1`, abre Database Tools, ER Diagram e Options, encerra o Electron com SIGTERM e aguarda sua saída antes de liberar o Xvfb. O usuário temporário e os dados locais do teste são removidos ao final.

## Integração MySQL

```sh
docker compose -f test/docker-compose.yml up -d --wait
MYSQL_INTEGRATION=1 pnpm test
docker compose -f test/docker-compose.yml down -v
```

O serviço de teste fica em `127.0.0.1:33067`; a senha `integration-only` é exclusiva do container local.

Capturas dos painéis de ferramentas extras em tema claro e escuro:

```sh
pnpm dist:deb
pnpm screenshots:extras
```

O script usa `xvfb-run`, testa a criação de snippet e sua presença no Toolbox, e fecha o Electron com SIGTERM antes de liberar o Xvfb.
