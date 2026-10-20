# Paridade — F-TOOLS (Ferramentas Extras)

Fontes: inventário REA M18; `document/ux/18-ferramentas-extras.md`; `document/ux/FIDELIDADE.md` Parte D.

| Comportamento esperado | Estado | Prova automatizada | Limite da prova |
|---|---|---|---|
| SQL Search encontra objetos/trechos com filtros de tipo e máscara. | CONFIRMADA | `app/test/modules/database-tools.test.ts` — busca e validação do filtro. | Não testa o diálogo visual. |
| Backup e restore aceitam diretório seguro e reportam sucesso/falha. | CONFIRMADA | `app/test/modules/database-backup.test.ts` — processo simulado e paths. | Não executa utilitários mysqldump reais no teste unitário. |
| Copy Databases copia estrutura/dados entre databases sem executar scripts exportados. | INFERIDA | `app/test/modules/database-tools.test.ts` e `database-backup.test.ts` — execução parametrizada simulada. | Sem MySQL integration específico de cópia neste conjunto. |
| Find Invalid Objects cobre todos os tipos e corresponde ao original. | DESCONHECIDA | `SEM EVIDÊNCIA` de igualdade de regras; inventário apenas confirma módulo. | Regras de validação detalhadas não são conhecidas. |
