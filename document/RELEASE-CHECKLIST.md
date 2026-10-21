# Checklist manual de release — v0.1.0

Faça a verificação em `en` e `pt-BR`, com tema claro e escuro, antes de publicar. Confirme que títulos, rótulos e mensagens não ficam cortados na escala padrão e em 150%; percorra tudo por teclado, verifique foco visível e Escape nos diálogos. Para cada fluxo, confira estado inicial/vazio, carregamento e erro; valide também uma operação bem-sucedida quando aplicável.

## Conexões e navegação

- [ ] **Database Explorer / Connections** — criar, testar, editar e remover uma conexão descartável; filtrar árvore e abrir menu de contexto de servidor, database e pasta.
- [ ] **Object Viewer / Schema View / Document Outline** — abrir objeto, conferir DDL/propriedades, navegar pelo esquema e saltar entre seções do editor.
- [ ] **Find Object / Find Results** — pesquisar, filtrar resultados, abrir uma ocorrência e verificar o estado sem resultados.

## Editor e resultados

- [ ] **SQL Editor / Result Grid** — abrir e salvar `.sql`, executar `SELECT`, alternar Text/Grid, paginar resultados e conferir mensagens, duração e posição do cursor.
- [ ] **Grid Editing / Master-Detail** — editar, inserir, definir NULL, excluir, confirmar e cancelar alterações; conferir motivo de read-only e detalhe da linha selecionada.
- [ ] **Query Builder** — adicionar tabelas relacionadas, conferir JOIN gerado, alternar Diagram/Text/Data e executar uma consulta de leitura.
- [ ] **Code Analysis** — executar análise com e sem achados; abrir resultado e confirmar idioma das mensagens.
- [ ] **Code Snippets / Toolbox** — criar, editar, importar/exportar snippet e inserir snippet/objeto no editor.

## Schema e dados

- [ ] **Table Designer / Schema Update Script** — alterar uma coluna, revisar DDL, aplicar ou gerar script; conferir páginas e prévia.
- [ ] **Schema Compare** — comparar databases e fontes offline, filtrar diferenças, selecionar objetos, revisar script e testar confirmação destrutiva sem executar na publicação.
- [ ] **Data Compare** — comparar tabelas com chave, conferir contagens e grid paginado; revisar SQL de sincronização antes da execução.
- [ ] **ER Diagram** — carregar relações e cardinalidades, mover/zoom/pan e exportar PNG e SVG.
- [ ] **Data Generator** — conferir geradores semânticos, contagem, seed, dependências FK e prévia antes de executar.
- [ ] **Import / Export** — completar cada assistente até Finish, revisar mapeamento, resumo e destinos antes de executar.
- [ ] **Copy Databases** — conferir origem/destino, aviso de substituição, progresso e erros por database.
- [ ] **Backup / Restore** — revisar opções e resumo, gerar linha de comando e testar restauração apenas em database descartável.

## Administração e diagnóstico

- [ ] **Security Manager** — listar usuários/roles, criar e alterar usuário, revisar privilégios e script antes de salvar.
- [ ] **Session Manager / Server Variables** — atualizar sessões, inspecionar consulta, alternar variáveis System/Status e confirmar ações de encerramento.
- [ ] **Service Control** — carregar serviços, atualizar estado e verificar apresentação de permissão negada sem escalada automática.
- [ ] **Query Profiler** — conferir Profile, Plan, Plan Diagram e Session Statistics após uma consulta.
- [ ] **Routine Debugger** — implantar engine em schema temporário, configurar parâmetros e usar breakpoints, watches e step controls.
- [ ] **Find Invalid Objects / Database Tools** — analisar objetos, revisar erro/aviso por item e validar preview dos scripts.
- [ ] **Data Report / Pivot / Documenter** — carregar consulta, montar pivô/relatório e exportar documentação nos formatos disponíveis.
- [ ] **AI Assistant** — testar configuração inválida, streaming/cancelamento e contexto de esquema opt-in; confirmar que chave não aparece na tela/log.
- [ ] **Source Control** — abrir projeto descartável, revisar diff, criar commit/branch e testar Link Database em repositório temporário.
- [ ] **Options** — alterar preferência e confirmar aplicação imediata; importar JSON inválido e verificar mensagem recuperável.
- [ ] **Tasks / Recent Tasks** — reabrir uma tarefa recente e remover uma entrada.

## Casca da aplicação

- [ ] **Abas, grupos, Float e splits** — arrastar abas, formar dois grupos/painéis, editar o mesmo documento em ambos, flutuar e fechar/reintegrar a janela.
- [ ] **Menus e atalhos** — conferir comandos principais e chords documentados; usar Tab/Shift+Tab, Enter/Espaço e Escape nos menus, diálogos e assistentes.
- [ ] **Acessibilidade e renderização** — executar `pnpm a11y:smoke`; inspecionar foco, nomes acessíveis, contraste, redução de movimento e escala HiDPI.
