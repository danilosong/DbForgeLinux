# Divergências de UX implementadas

## HTTP tunneling

- A tela expõe os campos HTTP descritos em `02-conexoes.md`, mas o driver MySQL ainda não implementa o protocolo do script `tunnel.php`.
- Testar ou conectar com HTTP habilitado retorna uma mensagem explícita de funcionalidade indisponível. O protocolo foi marcado como inferido na especificação, portanto não foi inventado um formato de requisição ou autenticação.
- SSH e HTTP permanecem mutuamente exclusivos.

## Estado da sessão de documentos

- Abas, seleção, layout e rascunhos SQL são persistidos no `localStorage` da janela Electron para restaurar a sessão. A especificação indica diretório XDG de estado para rascunhos; este protótipo ainda não grava rascunhos em disco pelo processo principal.
