AGENT: Prisma (Antigravity)
OBJECTIVE: UX Spec do shell e dos 3 primeiros módulos do clone Linux do dbForge Studio for MySQL.
REFERENCE: document/01-rea-inventario.md; re/extracted/app/Skin/, re/extracted/app/Html/; documentação pública docs.devart.com do dbForge Studio for MySQL.
TASK: Escrever em document/ux/: 01-shell.md (menu, toolbars, Database Explorer à esquerda, documentos em abas, painéis inferiores Output/Error List, status bar, atalhos), 02-conexoes.md (Database Connection Properties: General/Security(SSL)/SSH/HTTP/Advanced, test connection, lista de conexões), 03-explorer-editor.md (árvore de objetos, menu de contexto, editor SQL, abas de resultado, grid). Incluir temas claro/escuro, estados loading/erro/sucesso, componentes reutilizáveis, design tokens, adaptações Linux.
CONSTRAINTS: só Markdown/ASCII; sem código; não copiar assets protegidos, apenas descrever.
ACCEPTANCE: um dev implementa a tela só com a spec.
EXPECTED OUTPUT: caminhos + resumo curto.
Ao terminar: maestri ask "Claude Code" "<resultado>"
