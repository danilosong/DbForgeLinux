AGENT: Forja (Codex)
NOTA: o Arquiteto se chama "Chefinho". Reporte: maestri ask "Chefinho" "<resumo>" (ou resumo no terminal).
IMPORTANTE: a árvore git é compartilhada com Bigorna (app/src/modules/data-export-import) e Martelo (app/src/modules/schema). Faça `git add` SOMENTE dos seus arquivos (nunca `git add -A`), não mexa em app/src/modules/*.
OBJECTIVE: Corrigir findings do I1 e entregar I2 — Database Explorer completo + Editor SQL + Grid de resultados (F-EXP, F-SQL, F-GRID).
REFERENCE: document/ux/03-explorer-editor.md, document/ux/01-shell.md, document/ux/DIVERGENCIAS.md

FINDING A (MEDIUM) app/src/main/db/SshTunnel.ts: host key desconhecido só falha; sem fluxo de confiança. EXPECTED: TOFU — ao conectar com fingerprint desconhecido, UI mostra o fingerprint SHA256 e pergunta "Confiar e salvar?"; ao aceitar, grava hostFingerprint no registro da conexão; fingerprint diferente do salvo → erro forte de possível MITM, sem opção de aceitar com um clique.
FINDING B (LOW) mesmo arquivo: handler 'error' rotula QUALQUER erro como "host key não confiável" se fingerprint foi calculado (ex.: falha de autenticação com host key correta). EXPECTED: mensagem correta por causa (auth, rede, host key). Adicionar testes.

TASK I2:
1. Explorer: nós por database → Tables, Views, Procedures, Functions, Triggers, Events (carregamento lazy, contagem, ícones), filtro/busca, refresh, menu de contexto da spec (Select top 1000, Copy name, Generate script via SHOW CREATE em nova aba, Refresh; ações destrutivas SÓ com confirmação explícita).
2. Editor SQL (Monaco): múltiplas abas de documento, abrir/salvar .sql, executar tudo / seleção / statement atual (Ctrl+Enter, F5), cancelar execução (KILL QUERY), destaque de sintaxe MySQL, histórico de execução (persistido, sem logar senhas), mensagens de erro com linha/coluna, aba de resultados múltiplos + aba Messages com tempo/linhas afetadas, seleção de database ativo, transação manual opcional (Auto-commit toggle, Commit/Rollback).
3. Grid: virtualizado (≥100k linhas), ordenação, filtro por coluna, redimensionar/reordenar colunas, copiar célula/linhas (TSV), NULL distinguível de string vazia, BLOB/JSON/data com formatação, paginação do servidor para "Select top", exportar seleção para CSV simples (o motor completo é do Bigorna).
4. Testes: unitários (execução multi-statement, cancelamento, parser de statement atual) + integração MySQL docker; typecheck/lint/vitest passam; `pnpm dist:deb` ok.
CONSTRAINTS: seguir a spec; divergência → DIVERGENCIAS.md; nada de funcionalidades fora da lista (autocomplete é I3).
