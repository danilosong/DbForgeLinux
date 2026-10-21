# Paridade — F-VCS (Source Control / Projects)

Fontes: inventário REA M17; `document/ux/15-source-control-projects.md`; `document/ux/FIDELIDADE.md` Parte D.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Git mostra branch/status/diff e executa commit selecionado, log e branches. | CONFIRMADA | `app/test/modules/source-control.test.ts` — repositório Git temporário. | Mercurial e TFS fora do escopo Linux. |
| Assistente vincula um banco ao projeto nos modelos Dedicated e Shared. | CONFIRMADA | `app/test/modules/source-control.test.ts` — grava e relê ambos os modelos no projeto; metadados não incluem senha. | Testa persistência do vínculo, não uso concorrente do mesmo banco por múltiplos usuários. |
| Projeto guarda scripts SQL e exporta schema por objeto para pasta. | CONFIRMADA | `app/test/modules/source-control.test.ts` — criar projeto e arquivos de tabela/view. | Testa escrita/estrutura, não invoca scripts. |
| Paths externos, symlinks e hooks do repositório não permitem escrita/execução indireta. | ADAPTADA PARA LINUX | `app/test/modules/source-control.test.ts` — traversal/link bloqueado e hook não executado. | Política de segurança do clone. |
| Rebase/cherry-pick, grafo de histórico e editor 3 vias reproduzem o original. | DESCONHECIDA | `SEM EVIDÊNCIA` de implementação/paridade. | FIDELIDADE Parte D lista essas diferenças como não confirmadas. |
