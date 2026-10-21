# Contribuindo

1. Abra uma issue ou descreva o problema e o escopo antes de mudanças grandes.
2. Implemente em módulos pequenos e mantenha a arquitetura descrita em `document/02-arquitetura-adr.md`.
3. Não inclua credenciais, dados pessoais, binários proprietários, strings ou assets extraídos de outros produtos. `re/ui-strings/` e `re/extracted/` são ignorados pelo Git.
4. Rode na pasta `app/` os checks afetados; para mudanças gerais, execute `pnpm typecheck`, `pnpm lint` e `pnpm test`. Integrações precisam de banco descartável.
5. Atualize documentação e evidências quando o comportamento de uso mudar. Seja explícito sobre limites: consulte `document/03-matriz-paridade.md`.

Use mensagens de commit curtas e descritivas quando abrir uma contribuição. Não inclua senhas ou arquivos de ambiente.

## Barra de progresso do README

O bloco "Progresso do projeto" no topo do `README.md` é gerado a partir de `document/progress.json`.
**Antes de cada commit**: atualize os valores em `document/progress.json` (data e porcentagens; a fidelidade vem de
`document/paridade/FIDELIDADE-MEDIDA.md`) e rode `node tools/update-progress.mjs`. Nunca edite o bloco à mão.
