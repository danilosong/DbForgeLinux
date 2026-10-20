# Divergências de UX implementadas

## HTTP tunneling

- A tela expõe os campos HTTP descritos em `02-conexoes.md`, mas o driver MySQL ainda não implementa o protocolo do script `tunnel.php`.
- Testar ou conectar com HTTP habilitado retorna uma mensagem explícita de funcionalidade indisponível. O protocolo foi marcado como inferido na especificação, portanto não foi inventado um formato de requisição ou autenticação.
- SSH e HTTP permanecem mutuamente exclusivos.

## Estado da sessão de documentos

- Abas, seleção, layout e rascunhos SQL são persistidos no `localStorage` da janela Electron para restaurar a sessão. A especificação indica diretório XDG de estado para rascunhos; este protótipo ainda não grava rascunhos em disco pelo processo principal.

## I2 — Editor e grade

- A seleção de statement entende `;` fora de strings e comentários. O comando MySQL `DELIMITER` para rotinas ainda não é interpretado.
- A grade virtualiza linhas, permite ordenar/filtrar localmente, copiar TSV e exportar CSV. Editar células, seleção de intervalos e reordenação por servidor não fazem parte do modo atual.
- “Select top 1000” oferece carga por páginas de 1000 com `LIMIT/OFFSET`; o grid de consultas arbitrárias recebe o resultado completo do driver antes da virtualização.
