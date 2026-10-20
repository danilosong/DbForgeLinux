# 02 — ADR-001: Stack da aplicação Linux
Decisão: **Electron + TypeScript + React + Monaco + mysql2 (+ssh2)**, empacotado em `.deb` (electron-builder).
Motivos: webkit2gtk ausente no host (Tauri inviável sem instalar libs); Node 26/pnpm/Docker/dpkg-deb presentes; Monaco dá editor SQL maduro; AG Grid/Glide para grid; testes com MySQL em Docker.
Camadas: `main` (conexões, execução, drivers, cofre de segredos via safeStorage/libsecret) ↔ IPC tipado ↔ `renderer` (UI). Driver de banco atrás de interface `DbDriver` (MySQL/MariaDB primeiro).
Segurança: senhas nunca em texto puro; consultas destrutivas exigem ação explícita; logs sem credenciais.
Repositório: `app/` (código), `document/` (PRDs/ADR/matriz), `openspec/` (specs/tasks), `re/` (evidências; `extracted/` ignorado), `packaging/`.
