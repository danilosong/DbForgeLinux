# Paridade — F-TUN (HTTP Tunnel, Service Control, Code Analysis)

Fontes: inventário REA M2/M18; `document/ux/02-conexoes.md`; `document/ux/18-ferramentas-extras.md`; `document/ux/FIDELIDADE.md` Partes A/D.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| HTTP tunnel transporta pacotes MySQL via operações HTTP binárias. | ADAPTADA PARA LINUX | `app/test/modules/http-tunnel.test.ts` — fake endpoint e payload binário. | Protocolo/tunnel.php vem de referência; teste não roda servidor Devart. |
| Service Control lista e opera serviços MySQL locais com confirmação. | ADAPTADA PARA LINUX | `app/test/modules/service-control.test.ts` — comandos e guarda de ação. | Adaptação Linux usa systemd/serviços locais. |
| Code Analysis encontra regras de correção/performance com posição. | INFERIDA | `app/test/modules/code-analysis.test.ts` — regras e linha/coluna. | Inventário confirma módulo; regras específicas são próprias. |
| Regras de análise e gerenciamento de serviços têm igualdade funcional com o original. | DESCONHECIDA | `SEM EVIDÊNCIA` de equivalência REA; UX 18 classifica regras e mecanismo como inferidos. | São implementações próprias e dependentes do Linux. |
