# dbForgeLinux

dbForgeLinux é um cliente desktop Linux em desenvolvimento para trabalhar com MySQL e MariaDB. Ele reúne editor SQL, resultados paginados, comparação de dados e schemas, designers e ferramentas auxiliares em uma aplicação Electron.

## Estado do projeto

O projeto tem paridade **parcial e em evolução**. A matriz descreve o que está coberto por testes e registra lacunas e limites conhecidos: [document/03-matriz-paridade.md](document/03-matriz-paridade.md). Não afirmamos compatibilidade funcional completa com outros produtos.

## Linux

- Linux x86_64 com ambiente gráfico X11 ou Wayland; para sessões sem monitor, use Xvfb.
- O pacote Debian depende de `libsecret-1-0`. Se o keyring não estiver disponível, o app avisa e usa o cofre local cifrado.
- Para desenvolvimento: Node.js 22, pnpm 10 e dependências nativas necessárias ao Electron.
- Para integração local: Docker com Compose e a porta 33067 livre para MySQL 8.4. A CI testa MariaDB 11 em um serviço isolado.

## Desenvolvimento

```sh
cd app
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Em uma máquina sem sessão gráfica, inicie o app com Xvfb:

```sh
cd app
env -u DISPLAY -u WAYLAND_DISPLAY -u XDG_SESSION_TYPE xvfb-run -a pnpm dev
```

## Verificação e empacotamento

Execute de `app/`:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dist:deb
```

O `.deb` fica em `app/dist/`. O smoke de desktop usa um MySQL descartável na porta 33067 e inicia sob `xvfb-run`:

```sh
cd app
docker compose -f test/docker-compose.yml up -d --wait
pnpm dist:deb
pnpm smoke:e2e
docker compose -f test/docker-compose.yml down -v
```

Os testes de integração podem ser executados com `MYSQL_INTEGRATION=1 pnpm test` enquanto o serviço descartável estiver ativo. A CI executa a matriz MySQL 8.4/MariaDB 11, smoke e build Debian; veja [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Guias

Os [guias de uso por módulo](document/user-guide/README.md) mostram fluxos básicos e capturas existentes em `document/evidence/ui/`.

## Aviso legal

dbForgeLinux é uma implementação independente, sem afiliação ou endosso de terceiros. O código e os recursos visuais deste repositório foram produzidos para este projeto; não foram copiados código-fonte proprietário nem assets do dbForge Studio. Nomes de produtos e marcas pertencem aos respectivos titulares.
