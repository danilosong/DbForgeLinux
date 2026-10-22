# Auditoria visual — revisão 3 (base `39c1830`)

## Resultado desta revisão

- **Largura:** 72 medições em 24 combinações de superfície/tema e três viewports (1024×700, 1440×900, 1920×1080). `documentElement.scrollWidth - innerWidth`: máximo **0 px**; `.workbench`: máximo **0 px**; `.document-content` (editor): máximo **−333 px**; `.grid-result`: máximo **−343 px**. O grid mantém seu próprio scroller horizontal para colunas que excedam a área disponível.
- **Checkboxes do Explorer:** 216 rótulos medidos; gap caixa–texto mínimo/máximo **8 px**; coluna de Regex e Show system databases alinhada com diferença máxima **0 px**. O desenho visual permanece em 16 px e a área clicável é maior.
- **Menus:** os dois casos testados passaram: abrir submenu irmão fecha o anterior; abrir outro menu raiz fecha a árvore anterior.
- **Foco no menu contextual:** `:focus-visible` ativo com anel de 2 px inset (`outline-offset: -2px`).
- **Capturas incluídas:** 25 PNGs: oito telas em claro/escuro a 1440×900; SQL Editor em claro/escuro a 1024×700 e 1920×1080; grade escura a 1024×700 para mostrar o scroller interno; recortes do menu Window em claro/escuro; Export Finish em claro/escuro.

## Regressão reportada no Export Finish

Reexecutei duas vezes o smoke atualizado de `/var/www/TuxSQL/app/scripts/smoke-e2e.mjs` (espera do Martelo) contra o binário empacotado desta revisão, via `TUXSQL_ELECTRON_PATH`. **2/2 passaram**; a falha no passo “Write an error log” não se reproduziu. No fluxo concluído, a 1440×900, `.assistant-finish` ficou visível dentro do wizard: bounding box 910×166 px em `(265, 398.6)`, `display:flex`, `visibility:visible`, `opacity:1`, `pointer-events:auto`; `.io-footer` mediu 910×39 px em `y=642.6`; `.io-wizard` mediu 958×511 px com `overflow:auto`, `scrollHeight=clientHeight=511`. Não houve clipping nem sobreposição. Os screenshots `export-finish-log-light.png` e `export-finish-log-dark.png` mostram essa tela nos dois temas. As métricas detalhadas estão em `/tmp/tuxsql-export-finish-visible.json`.

## Ajustes

O editor e o workbench agora podem encolher dentro da janela; o resultado da consulta fica contido no painel, com rolagem horizontal no grid. Os controles do Explorer alinham checkboxes/radios na mesma coluna e separam a caixa do rótulo por 8 px. A largura do menu contextual da grade é limitada ao viewport e sua posição é recalculada ao redimensionar.

## Verificação

As medições e o comportamento de menus foram escritos fora do patch em `/tmp/claude-1000/Bigorna/audit-global-39c1830-raw/`. O runner foi executado contra o Electron empacotado, com `prefers-reduced-motion: reduce`, fontes locais prontas e screenshots com animações desativadas. As 22 imagens aqui são a evidência visual enxuta; o JSON bruto não acompanha o patch.
