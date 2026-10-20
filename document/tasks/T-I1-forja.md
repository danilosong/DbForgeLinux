AGENT: Forja (Codex)
OBJECTIVE: I1 — Shell + Conexões (F-CON) conforme UX Spec.
REFERENCE (ler só isto): document/ux/01-shell.md, document/ux/02-conexoes.md, document/02-arquitetura-adr.md, app/src/shared/contracts.ts
TASK:
1. Shell: layout (menu, toolbar, Database Explorer à esquerda, área de documentos em abas, painel inferior Output/Error List, status bar), tokens de design e temas claro/escuro (seguir prefers-color-scheme + toggle persistido), atalhos básicos. Componentes reutilizáveis em app/src/renderer/src/ui/components/.
2. Armazenamento de conexões: arquivo JSON em XDG config (app.getPath('userData')/connections.json, modo 0600) SEM senhas; senhas só via PasswordVault/passwordRef. CRUD + categorias/pastas simples (se a spec pedir).
3. Diálogo "Database Connection Properties": abas General / Security (SSL: CA, cert, key, verify) / SSH (tunnel via lib ssh2, senha ou chave privada, passphrase pelo cofre) / Advanced (timeout, charset, init SQL), botão Test Connection com estados loading/erro/sucesso exatamente como na spec; Connection Manager (lista, nova, editar, duplicar, excluir com confirmação).
4. Conectar a partir do Explorer (nó de conexão com estados conectando/conectado/erro), listar databases e tabelas.
5. Testes: unitários (store de conexões, serialização sem senha, builder de opções SSL/SSH) + integração MySQL docker; SSH tunnel testado com mock ou container sshd se viável.
CONSTRAINTS: seguir a spec; divergências → registrar em document/ux/DIVERGENCIAS.md, não decidir sozinho; nada de senha em logs/IPC de retorno; sem funcionalidades fora da lista (editor SQL avançado fica para I2).
ACCEPTANCE: critérios de aceite dos itens 10 de 02-conexoes.md e do 01-shell.md; typecheck/lint/vitest/integration passam; pnpm dist:deb gera .deb; commits pequenos.
EXPECTED OUTPUT: resumo curto + divergências. Ao terminar: maestri ask "Claude Code" "<resumo>" (se falhar, só termine com o resumo no terminal).
