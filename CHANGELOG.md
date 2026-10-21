# Changelog

Mudanças notáveis do dbForgeLinux. O projeto ainda está em desenvolvimento; esta lista registra o estado inicial documentado.

## 0.1.0 — Primeira versão pública

Cliente desktop independente para MySQL e MariaDB no Linux (Electron, React, TypeScript, Monaco). Implementação própria; sem código nem assets do dbForge.

**Editor e dados**
- Editor SQL com autocomplete contextual, snippets, formatter, histórico, auto-maiúsculas, execução por seleção/statement e diálogo de erro (Stop/Continue/Ignore All).
- Grid com paginação em disco para milhões de linhas, edição inline com conflito otimista, Master-Detail, Data Viewer, Card View e cópia em vários formatos.
- Table Designer e editores de View, Procedure, Function, Trigger e Event com preview de DDL.

**Ferramentas**
- Schema Compare e Data Compare (banco, pasta de scripts e snapshots) com sincronização em transação e confirmação.
- Import/Export (CSV, JSON, XML, Excel, SQL, HTML) em assistentes, com ZIP protegido por senha (WinZip AES-256).
- Backup/Restore, Copy Databases, Find Object, Find Invalid Objects, Table Maintenance, SQL Formatter em lote, Execute Large Script.
- Query Builder com joins por arraste, Diagrama ER, Data Generator, Documenter, Report e Pivot (bandas e gráfico), Profiler, Debugger de procedures.
- Security Manager, Session Manager, Server Variables, Service Control, Code Analysis, Source Control (Git) e Projects, AI Assistant com chave própria e streaming.

**Plataforma**
- Atualização automática em dois canais (git local para desenvolvimento, GitHub Releases para instalações).
- Interface em inglês e português do Brasil, temas claro e escuro, atalhos remapeáveis, acessibilidade básica.
- Cofre de senhas (libsecret, com fallback cifrado), guard de IPC com schemas, revisão de segurança independente em duas rodadas.
- Compatível com MySQL 5.7/8.0/8.4 e MariaDB 10.11/11.x. Pacotes `.deb` (Debian/Ubuntu) e AppImage.

**Limitações conhecidas**
- Debugger apenas para procedures; sem funções, triggers ou eventos.
- Sem paridade validada contra todos os recursos do produto original (ver `document/paridade/FIDELIDADE-MEDIDA.md`).
- Google Sheets, Access, ODBC e Mercurial/TFS fora do escopo.
