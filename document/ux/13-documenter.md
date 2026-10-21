# UX 13 — Documenter

Reusa `01-shell.md`, `06` (WizardDialog, ProgressList, ReportView), `10` (diagrama). **[C]** CONFIRMADO / **[I]** INFERIDO.

**Fontes consultadas:** https://docs.devart.com/studio-for-mysql/ (Database Documenter) e https://www.devart.com/tuxsql/mysql/documenter/. Citações por redirecionamento; páginas individuais não abertas. Fidelidade REA: rótulos conferidos contra REA ui-text.

## 1. Entrada
Explorer > database > **Generate Documentation…**; comandos Generate Documentation / New Documentation... / Open Documentation..., projeto `*.ddoc` [C: REA ui-text]. Wizard modal (padrão 06) ou documento "Documentation 1" com árvore de objetos; v1: **wizard**.

## 2. Passos do wizard
**1 Origem → 2 Objetos → 3 Conteúdo → 4 Modelo/Estilo → 5 Saída → 6 Execução → 7 Relatório**.

1. **Origem:** conexão + database(s) (multi-seleção) [I].
2. **Objetos:** árvore com checkboxes (Tables, Views, Procedures, Functions, Triggers, Events, Users? [I]) com busca, Select all/none; contadores.
3. **Conteúdo** [C: controla seções/propriedades/relações]: checklist de seções: Descrição geral, Lista de objetos, **Propriedades** por tipo (colunas, índices, FKs, constraints, triggers, DDL/CREATE script, dependências "Depends on/Used by", estatísticas de tamanho/linhas), **Relações** (FK + virtuais do 10 [C parcial]), **Diagrama ER** embutido (imagem gerada do 10, [I]), descrições/comentários do usuário (campo editável por objeto: grid objeto → "Description" salvo em arquivo local `.dbdoc` ou como COMMENT do servidor, escolha do usuário [I]), data/hora e versão do servidor, paginação.
4. **Modelo/Estilo** [C: templates e estilos]: lista de modelos (Padrão claro, Escuro, Minimal, Impressão) com preview miniatura; opções: título, logo (arquivo próprio do usuário), cores de destaque, fonte, idioma, índice/navegação (sidebar), tema do HTML segue claro/escuro do SO (`prefers-color-scheme`) [I]. Modelos próprios: pasta de templates do usuário (`$XDG_CONFIG_HOME/tuxsql/doc-templates`) [I].
5. **Saída** [C: HTML, PDF, Markdown; DOC]: formato **HTML** (site estático navegável com busca, pasta ou ZIP), **PDF**, **Markdown** (um arquivo por objeto + índice, ideal p/ repositórios), **DOCX** [I]. Pasta de destino (padrão `~/Documents`), nome, sobrescrever (perguntar/substituir), abrir ao terminar (xdg-open).
6. **Execução:** ProgressList (por fase: Lendo metadados, Gerando seções, Renderizando, Escrevendo arquivos), [Cancel].
7. **Relatório:** sucesso verde com caminho; avisos (objetos inacessíveis, imagem do diagrama não gerada); [Open] [Open folder] [Copy path] [Generate again].

## 3. Saída gerada (descrição)
- **HTML:** `index.html` com navegação lateral (árvore por tipo), busca client-side, página por objeto, tabelas ordenáveis, links entre objetos (FK, dependências), âncoras estáveis; sem dependências de rede (CSS/JS embutidos); responsivo; imprimível.
- **Markdown:** `README.md` (índice), `tables/<nome>.md` etc., tabelas GFM; diagrama como SVG/PNG relativo.
- **PDF:** capa, sumário, seções paginadas, cabeçalho/rodapé com título e página.
Conteúdo por tabela: nome, comentário, engine, collation, linhas aprox., tabela de colunas (Nome, Tipo, Null, Default, Extra, Chave, Comentário), índices, FKs (entrada/saída), triggers, DDL.

## 4. Estados
| Estado | Comportamento |
|---|---|
| Loading árvore | skeleton + spinner |
| Erro de metadado | aviso por objeto, wizard continua; erro bloqueante → InlineErrorPanel |
| Sem seleção | Next desabilitado "Selecione ao menos um objeto" |
| Pasta sem permissão | erro inline no passo 5 |
| Sucesso | relatório verde |
| Cancelado | arquivos parciais removidos (confirma) |
Templates de tarefa salvos (reuso 06 §6).

## 5. Atalhos
Padrão do WizardDialog (06 §7): Next/Back Ctrl+→/←, Esc, Ctrl+Enter no último passo.

## 6. Temas / acessibilidade
Tokens 01 no wizard; HTML gerado com contraste AA, landmarks (nav/main), tabelas com `<th scope>`, dark mode automático.

## 7. Componentes
WizardDialog, CheckTree, TemplateGallery (cartões com miniatura), OptionsForm, FolderPicker, ProgressList, ReportView, DescriptionGrid (edição de descrições).

## 8. Critérios de aceite
- Gera documentação HTML, PDF e Markdown de um database com tabelas, views, rotinas e relações (incluindo virtuais), escolhendo seções e modelo.
- HTML navegável offline com busca; abrir ao final; relatório com avisos.
- Estados, temas e teclado cobertos.

## Textos de interface (referência)
Fonte: REA ui-text (sem aceleradores; placeholders mantidos; frases longas parafraseadas).

| Rótulo/mensagem real | Onde usa | Chave i18n sugerida |
|---|---|---|
| Generate Documentation | Comando/ação principal | `doc.cmd.generate` |
| New Documentation... / Open Documentation... | Comandos de projeto (`*.ddoc`) | `doc.cmd.new` / `doc.cmd.open` |
| Generate database documentation in HTML, PDF or Markdown file format | Descrição do comando | `doc.cmd.hint` |
| Choose objects for documentation | Passo Objetos | `doc.step.objects` |
| Documentation Generation | Título do assistente | `doc.wizard.title` |
| Generating documentation... | Progresso | `doc.progress` |
| Open documentation after generation | Checkbox final | `doc.opt.openAfter` |
| Documentation has not been saved. The path is invalid. | Erro de caminho | `doc.err.path` |
| Documentation is not available. | Estado vazio | `doc.empty` |
| Documenter Project Properties | Propriedades do projeto | `doc.project.props` |
