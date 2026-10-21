# Roteiro de observação do dbForge original (trial)

Objetivo: transformar `DESCONHECIDA`/`INFERIDA` em `CONFIRMADA` com evidência, **dentro do período do trial**, sem contornar licenciamento.

## Regras
- O relógio do trial começa na primeira execução. Instalar só quando o roteiro estiver pronto; trabalhar em sessões longas e focadas.
- **Não** reinstalar, restaurar snapshot nem mexer no relógio para estender o trial. Se o trial acabar, a observação termina ali.
- Capturas e anotações do original ficam em `re/original-observation/` (ignorado pelo git; uso interno, como `re/ui-strings/`). Só o que for descrição própria entra no repositório (matriz, `document/paridade/F-*.md`).
- Cada achado: módulo, fluxo, comportamento observado, mensagem exata (parafraseada no repo), arquivo da captura, status CONFIRMADA e diferença para o clone.
- Servidor de teste: MySQL em `10.0.2.2:33067` (root / `integration-only`), com um schema `sample` populado (tabelas com PK, FK, índices, views, procedures, triggers, events, dados volumosos).

## Ordem de prioridade (maior valor primeiro)
1. **Conexão** (F-CON): diálogo, abas/campos, SSL/SSH/HTTP, teste de conexão, mensagens de erro (senha errada, host inexistente, timeout).
2. **Shell**: layout padrão, menus completos, toolbars, atalhos (mapa real), Start Page, painéis padrão, temas.
3. **Editor SQL** (F-SQL/F-AC): execução (F5, seleção, atual, até o cursor), resultados múltiplos, abas Messages/Result, histórico, formatter (antes/depois), autocomplete (o que sugere em cada contexto), snippets (lista), plano de execução.
4. **Grid** (F-GRID): edição inline, regras de editabilidade, Post/Cancel, filtros, ordenação, copy as, Master-Detail, Data Viewer, export.
5. **Database Explorer** (F-EXP): árvore, menu de contexto por tipo de objeto, propriedades, busca.
6. **Editores de objetos** (F-OBJ): Table Designer (páginas e campos), View/Procedure/Function/Trigger/Event, preview DDL, erros de validação, Apply.
7. **Import/Export** (F-IMEX): wizards (formatos, passos, opções, mapeamento, templates), mensagens de progresso e erro.
8. **Schema Compare / Data Compare** (F-CMP): assistente, opções, árvore de diferenças, script de sync, execução.
9. **Security/Session Manager** (F-SEC): usuários, privilégios, sessões, kill, variáveis do servidor.
10. **Query Profiler, Data Generator, Documenter, Query Builder, Diagrama ER, Debugger, Source Control, Data Report** — um passe rápido em cada: telas, passos e mensagens principais.
11. **Options**: categorias e valores padrão; atalhos (keymap).
12. **About/Help**: textos de ajuda relevantes.

## Método por módulo (≈15–25 min)
Abrir o módulo → capturar a tela inicial → percorrer 3–6 fluxos felizes → provocar 2–3 erros → anotar menus/atalhos → capturar. Depois, abrir o mesmo fluxo no clone e anotar diferença. Atualizar `document/paridade/F-*.md` ao fim de cada módulo (não deixar para o fim).
