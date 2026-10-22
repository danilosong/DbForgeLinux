# Auditoria de estados e espacamentos

- Base do worktree: `90e9f15`.
- Execucao: app Electron empacotado, sem `TUXSQL_RELEASE_BUILD`; tela real conectada a MySQL descartavel.
- Capturas de telas: 1440x900, claro e escuro.
- Janela: hover, pressionado e aberto, claro e escuro.
- Regua: 4/8/12/16/24 px; menu 32 px, toolbar 40 px, abas 36 px, status 24 px, botoes 28/32 px, campos 32 px; raios de controle 6/8 px.

## Resultado medido

O CSS de base permitia que o summary do menu usasse 100% da altura de 32 px e somasse margens verticais de 3 px. A estimativa geométrica do estado anterior cruza a borda inferior em 3 px nos dois temas: 2 ocorrencias. No Electron apos a correcao, o retangulo medido e `top=0, bottom=26` dentro da barra `top=0, bottom=32`, nos dois temas: 0 sobreposicoes no menu. O summary usa 26 px e margens horizontais de 2 px. Os recortes finais estao em `janela-light-{hover,active,open}.png` e `janela-dark-{hover,active,open}.png`; os menus abertos contem os itens do app real.

## Cobertura e pendencias

O fluxo `screenshots:readme` capturou 9 pares claro/escuro (Connection Properties, Query Builder, SQL Editor, grade editavel, ER Diagram, Schema Compare, Routine Debugger, Table Designer e AI Assistant). Validacao final: typecheck/lint passaram, Vitest 906 passaram + 71 ignorados (maxWorkers=2), smoke:e2e passou e contraste 58/58 passou. A cobertura de screenshot nao equivale ao passeio automatizado de estados de todos os controles. A auditoria automatizada ficou restrita ao menu Janela e sua geometria. Nao rodei o traversal de cada submenu, controle, popover, scrollbar e dialogo; tampouco medi os tres tamanhos de janela. Os recortes anteriores do menu aberto foram derivados das capturas de base `document/evidence/ui/menus-window-{light,dark}.png` do HEAD 90e9f15; os estados hover/ativo anteriores nao foram capturados. Portanto, os 0 reportados aplicam-se somente a sobreposicao do menu Janela; a auditoria global solicitada permanece incompleta.

O JSON acompanha as medidas, arquivos e categorias nao percorridas.
