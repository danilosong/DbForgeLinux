AGENT: Forja (Codex)
OBJECTIVE: Corrigir findings da revisão do I0 (commit 1b66fc9). Typecheck/lint/integration OK; .deb OK.
PRIMEIRO: rode `maestri list` — você deve ver "Claude Code" (Arquiteto) e "Prisma" (UX). Se aparecer, use `maestri ask "Claude Code" "<resultado>"` ao terminar.

FINDING 1 (MEDIUM, segurança)
LOCATION: app/src/main/security/PasswordVault.ts
EXPECTED: no Linux, safeStorage pode cair no backend "basic_text" (chave fixa) e isEncryptionAvailable() ainda retorna true. Recusar salvar quando safeStorage.getSelectedStorageBackend() === 'basic_text' (ou 'unknown'), com erro claro orientando instalar gnome-keyring/kwallet.
ACTUAL: salva com qualquer backend.
EVIDENCE: leitura do código.

FINDING 2 (MEDIUM, segurança)
LOCATION: IPC 'vault:get' em main/index.ts + preload
EXPECTED: renderer nunca recebe a senha em texto. Trocar por: connect/test aceitam um `passwordRef` (chave do cofre) e o main resolve a senha. Remover vault:get do preload.
ACTUAL: renderer pode ler qualquer senha.

FINDING 3 (LOW)
LOCATION: app/packaging/electron-builder.yml
EXPECTED: License definida (MIT, salvo ordem contrária), Maintainer/Vendor coerentes; categoria Development/Database no .desktop; ícone placeholder.
ACTUAL: "License: unknown", "Section: default".

FINDING 4 (LOW, testes)
EXPECTED: testes unitários do PasswordVault (mock de safeStorage) e do mapeamento de resultados de executeSql (múltiplos statements, INSERT/UPDATE, erro de sintaxe); manter integration test.

ACCEPTANCE: typecheck, lint, vitest (unit) e MYSQL_INTEGRATION=1 passam; pnpm dist:deb gera .deb; commit pequeno por finding.
Não alterar arquitetura. Ao terminar: maestri ask "Claude Code" "<resumo>".
