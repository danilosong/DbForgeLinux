# Paridade — F-OPT (Options)

Fontes: inventário REA M1/M19; `document/ux/19-configuracoes.md`; `document/ux/FIDELIDADE.md` Parte D.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Settings versionados são carregados com defaults e migram versão antiga. | ADAPTADA PARA LINUX | `app/test/modules/options.test.ts` — defaults, migração e persistência JSON. | Persistência em userData no ambiente Electron. |
| Preferências inválidas são preservadas em backup e carregam defaults. | ADAPTADA PARA LINUX | `app/test/modules/options.test.ts` — arquivo `.bak`. | Estratégia própria de recuperação. |
| Atalhos normalizados detectam conflito no mesmo contexto. | CONFIRMADA | `app/test/modules/options.test.ts` — conflito case/space insensitive e validação. | Não demonstra que cada binding está ligado à UI. |
| Rótulos e valores default de todas as páginas Options correspondem à referência. | DESCONHECIDA | `SEM EVIDÊNCIA` de valores originais; FIDELIDADE Parte D lista defaults sem REA. | Testes provam a configuração do clone, não a referência. |
