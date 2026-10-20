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

## Integração MySQL

```sh
docker compose -f test/docker-compose.yml up -d --wait
MYSQL_INTEGRATION=1 pnpm test
docker compose -f test/docker-compose.yml down -v
```

O serviço de teste fica em `127.0.0.1:33067`; a senha `integration-only` é exclusiva do container local.
