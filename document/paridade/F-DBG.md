# Paridade — F-DBG (Routine Debugger)

Fontes: inventário REA M16; `document/05-rea-debugger.md`; `document/ux/14-debugger.md`.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Instrumentar procedure e registrar checkpoints/variáveis durante execução. | ADAPTADA PARA LINUX | `app/test/modules/routine-debugger.test.ts` — parse/instrumentação e SQL de checkpoints. | Engine de apoio é schema MySQL próprio. |
| Breakpoints e passos controlam checkpoint da execução. | ADAPTADA PARA LINUX | `app/test/modules/routine-debugger.test.ts` — decisões de pausa/passos. | Integração com MySQL é separada e não executada no teste unitário padrão. |
| Impedir instalação destrutiva do engine com sessões ativas. | ADAPTADA PARA LINUX | `app/test/modules/routine-debugger.test.ts` — guarda de instalação/limpeza. | Engine limitado a procedures; ver restrições no relatório. |
| Debugger do original suporta os mesmos tipos de rotina/stepping. | DESCONHECIDA | `SEM EVIDÊNCIA` runtime REA; suporte clone está restrito a procedures instrumentadas. | `document/05-rea-debugger.md` lista limites. |
