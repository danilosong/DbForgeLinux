AGENT: Forja (Codex)
OBJECTIVE: I0 scaffolding do app Linux em /var/www/TuxSQL/app.
REFERENCE: document/02-arquitetura-adr.md, document/04-roadmap-prds.md
TASK: Criar projeto pnpm Electron+TypeScript+React+Vite+Monaco (main/preload/renderer, IPC tipado). Interface DbDriver (mysql2): testar conexão, listar databases/tabelas, executar SQL com resultados múltiplos. Cofre de senhas com Electron safeStorage (nunca texto puro). Shell mínimo: sidebar explorer + editor Monaco + grid de resultados. Scripts: dev, build, lint, typecheck, test (vitest). Empacotamento .deb via electron-builder (pnpm dist:deb, saída dist/*.deb, config em packaging/). Testes de integração do driver contra MySQL em Docker (docker-compose em app/test/).
READ: só os dois docs acima.
CONSTRAINTS: Debian/Ubuntu x64; commits pequenos no git; não editar re/ nem document/ (exceto app/README.md); não inventar funcionalidades.
ACCEPTANCE: pnpm install/typecheck/lint/test passam; app conecta a MySQL docker; pnpm dist:deb gera .deb instalável.
EXPECTED OUTPUT: resumo curto + comandos + pendências.
Ao terminar: maestri ask "Claude Code" "<resultado>"
