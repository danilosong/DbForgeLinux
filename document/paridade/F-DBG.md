# Paridade — F-DBG (Routine Debugger)

Fontes: inventário REA M16; `document/05-rea-debugger.md`; `document/ux/14-debugger.md`.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Instrumentar procedure e registrar checkpoints/variáveis durante execução. | ADAPTADA PARA LINUX | `app/test/modules/routine-debugger.test.ts` — parse/instrumentação e SQL de checkpoints. | Engine de apoio é schema MySQL próprio. |
| Breakpoints e passos controlam checkpoint da execução. | ADAPTADA PARA LINUX | `app/test/modules/routine-debugger.test.ts` — decisões de pausa/passos. | Integração com MySQL é separada e não executada no teste unitário padrão. |
| Impedir instalação destrutiva do engine com sessões ativas. | ADAPTADA PARA LINUX | `app/test/modules/routine-debugger.test.ts` — guarda de instalação/limpeza. | Engine limitado a procedures; ver restrições no relatório. |
| Depurar triggers disparados por DML controlada. | ADAPTADA PARA LINUX | `app/test/modules/routine-debugger.test.ts` — instrumentação, checkpoint e advisory lock de trigger. | O DML é único; triggers não têm variáveis locais no snapshot e Step Out não percorre pilha filha. |
| Depurar Event Schedulers e UDFs compiladas com stepping equivalente. | DIFERENÇA INTENCIONAL | Contrato atual aceita procedure e trigger; não há suporte a event scheduler ou UDF compilada. | Limite aceito pelo Arquiteto: Event Scheduler executa em sessão assíncrona independente e UDF compilada não expõe corpo SQL instrumentável; não é tratada como stored function SQL. |
| Debugger do original suporta os mesmos tipos de rotina/stepping. | DESCONHECIDA | `SEM EVIDÊNCIA` runtime REA para equivalência dos tipos e stepping. | `document/05-rea-debugger.md` lista limites do clone e a evidência disponível. |
