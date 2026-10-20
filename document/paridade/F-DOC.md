# Paridade — F-DOC (Documenter)

Fontes: inventário REA M15; `document/ux/13-documenter.md`; `document/ux/FIDELIDADE.md` Parte C.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| Gerar documentação de database com tabelas, objetos, descrições e dependências. | CONFIRMADA | `app/test/modules/documenter.test.ts` — HTML/Markdown e conteúdo escapado. | Modelo sintético; introspecção provada separadamente por testes de schema. |
| Exportar documentação HTML, Markdown, SVG e PDF. | ADAPTADA PARA LINUX | `app/test/modules/documenter.test.ts` — grava arquivos e valida bytes/estrutura. | PDF usa interface isolada de printer no teste. |
| Escapar conteúdo fornecido por objetos para impedir HTML executável. | CONFIRMADA | `app/test/modules/documenter.test.ts` — script fica escapado. | Valida HTML produzido, não renderização em browser. |
| Modelos, passos exatos, busca offline e DOCX reproduzem a referência. | DESCONHECIDA | `SEM EVIDÊNCIA` de equivalência REA. | UX 13/FIDELIDADE Parte C registram esses detalhes como desconhecidos/inferidos. |
