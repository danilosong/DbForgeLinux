# Decisões de UX — ferramentas extras

## Backup/Restore agendado

- O agendamento é local ao perfil do usuário e usa cron de cinco campos com o fuso horário local do sistema.
- O app verifica os agendamentos a cada minuto. Backups rodam enquanto o dbForgeLinux está aberto; não instalamos daemon ou serviço do sistema.
- Cada execução exporta schema e dados para SQL na pasta escolhida. Os arquivos são criados com permissão de usuário (`0600`); a retenção remove os backups mais antigos do mesmo database, limitando a quantidade configurada.
- Restore continua manual: o usuário escolhe um arquivo, revisa o preview e confirma digitando o database de destino. Nenhum backup ou script é restaurado automaticamente.
- Falhas de execução não removem arquivos existentes nem desabilitam o agendamento; a próxima ocorrência cron tenta novamente.

## Grid e dados

- Master-Detail fica disponível em resultados editáveis com tabela e chave identificadas. Cada FK referenciadora aparece como seção expansível, com no máximo 100 linhas por relação e aviso de truncamento. A consulta usa identificadores delimitados e valores de chave parametrizados.
- O Data Viewer abre por duplo clique na célula. Exibe texto, JSON indentado, XML indentado e BLOB em hexadecimal; imagens PNG/JPEG/GIF/WEBP recebem prévia quando o cabeçalho binário é reconhecido. Alterações no Viewer entram como mudanças pendentes do grid e só são gravadas por Post/Apply.
- Copy As aceita CSV, JSON, INSERT, Markdown e HTML; TSV continua disponível como ação rápida. Copy with Headers controla cabeçalhos nos formatos tabulares. Cópia limita-se a 20 mil linhas e 8 MB de texto para evitar alocar resultados sem limite.
- Ordenação remota materializa até 50 mil linhas antes de ordenar no cliente. Pivot rápido usa o mesmo limite e oferece count, sum, avg, min e max; NULL não participa de agregações numéricas e grupos sem números exibem zero. Estatísticas usam até 100 mil linhas e contam distinct excluindo NULL.
- Seletor de colunas oculta/reexibe campos; arrastar cabeçalhos reordena; ícone de congelar mantém as colunas até a escolhida visíveis durante rolagem. Filtros são aplicados ao resultado carregado no cliente.
- Categoria da conexão é mostrada no status bar e no Explorer agrupa conexões. O ambiente Dev/Test/Prod recebe rótulo e cor; operações destrutivas no ambiente Prod pedem que o usuário digite o nome do database antes da confirmação da operação.

## Navegação do shell

- **Find in Files** procura nos documentos SQL abertos porque o shell ainda não possui uma raiz de projeto indexada. O seletor também oferece busca no documento e no trecho selecionado. Os resultados agrupam por documento e levam ao offset correspondente no editor.
- A busca aceita texto literal ou expressão regular, diferenciação de maiúsculas e limite de 5.000 resultados para manter o shell responsivo. Expressões inválidas produzem lista vazia sem interromper a edição.
- **Document Outline** deriva nomes e posições dos statements SQL por varredura lexical do editor; objetos CREATE recebem o nome como rótulo. A seleção leva ao início do statement.
- **Properties (F4)** e **Object Viewer** compartilham um documento somente leitura. As propriedades e colunas vêm da seleção do Explorer e do cache do editor; o DDL vem do driver existente (`SHOW CREATE`) e contém índices/FKs. Estatísticas de tabela vêm de `information_schema.TABLES`. Dependências são inferidas de referências no DDL contra nomes do cache, então são informativas e não substituem um grafo completo do servidor.
- **Schema View** agrega objetos e rotinas do cache de metadados do database ativo com contagens por tipo; selecionar um objeto abre o Object Viewer.
