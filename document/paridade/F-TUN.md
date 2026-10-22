# Paridade — F-TUN (HTTP Tunnel, Service Control, Code Analysis)

Fontes: inventário REA M2/M18; `document/ux/02-conexoes.md`; `document/ux/18-ferramentas-extras.md`; `document/ux/FIDELIDADE.md` Partes A/D.

> **Status de Verificação:** não verificável na VM atual (precisa servidor SSH de teste / conta na nuvem).

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| HTTP tunnel transporta pacotes MySQL via operações HTTP binárias. | NÃO VERIFICÁVEL NA VM ATUAL (precisa servidor SSH de teste / conta na nuvem) | `app/test/modules/http-tunnel.test.ts` — fake endpoint e payload binário. | Protocolo/tunnel.php vem de referência; requer endpoint HTTP/SSH externo não disponível na VM de teste. |
| SSH Tunneling com autenticação por senha ou chave privada RSA/Ed25519. | NÃO VERIFICÁVEL NA VM ATUAL (precisa servidor SSH de teste / conta na nuvem) | `app/test/SshTunnel.test.ts` e `ConnectionPropertiesDialog.tsx`. | Requer servidor SSH remoto com túnel ativo para teste fim a fim de transporte de pacotes. |
| Service Control lista e opera serviços MySQL locais com confirmação. | ADAPTADA PARA LINUX | `app/test/modules/service-control.test.ts` — comandos e guarda de ação. | Adaptação Linux usa systemd/serviços locais via polkit. |
| Code Analysis encontra regras de correção/performance com posição. | INFERIDA | `app/test/modules/code-analysis.test.ts` — regras e linha/coluna. | Inventário confirma módulo; regras específicas são próprias do linter interno. |
| Regras de análise e gerenciamento de serviços têm igualdade funcional com o original. | DESCONHECIDA | `SEM EVIDÊNCIA` de equivalência REA; UX 18 classifica regras e mecanismo como inferidos. | São implementações próprias e dependentes do ecossistema Linux. |
