# Paridade — F-SEC (Security e Sessions)

Fontes consultadas: inventário REA M12, `document/ux/08-seguranca-sessoes.md`, `document/ux/FIDELIDADE.md` (Parte B) e catálogo interno `re/ui-strings/ui-text.txt`. O catálogo de strings foi consultado sem reproduzir seu conteúdo.

| Comportamento esperado | Estado | Evidência da referência | Prova no clone |
|---|---|---|---|
| Security Manager exibe usuários e detalhes de grants/privilégios. | CONFIRMADA | Inventário M12; UX 08 §1; rótulos do Security Manager conferidos no catálogo REA. | `app/test/modules/security.test.ts`; `app/test/modules/security-sessions-ipc.test.ts`; screenshot `security-light.png`. |
| Alterações de privilégio geram SQL de preview antes de aplicar. | INFERIDA | UX 08 §1.4–1.5; FIDELIDADE Parte B marca abas/tri-state e detalhes de preview como inferidos. | `app/test/modules/security.test.ts` (geração, máscara e confirmação); screenshot `security-dark.png`. |
| Operações destrutivas em contas exigem confirmação e protegem conta root/ativa. | ADAPTADA PARA LINUX | UX 08 §1.5 e §6 define operações; salvaguardas reforçam aplicação segura no clone. | `app/test/modules/security.test.ts`. |
| Session Manager lista sessões/processos e pode encerrar uma sessão. | CONFIRMADA | Inventário M12; UX 08 §2; título do Session Manager presente no catálogo REA. | `app/test/modules/sessions.test.ts`; `app/test/modules/security-sessions-profiler.integration.test.ts`; screenshot `sessions-light.png`. |
| Server Variables permite ler e aplicar valores de sessão/global no clone. | CONFIRMADA | Inventário M12; UX 08 §3; nome do recurso foi conferido no catálogo REA. | `app/test/modules/security-sessions-ipc.test.ts` valida roteamento IPC das variáveis; o teste cobre o contrato, não a renderização. |
| Privilégios com escopo e limites de conta geram SQL; nomes/valores dos presets REA não são afirmados. | INFERIDA | UX 08 §1.3–1.4; FIDELIDADE Parte B não confirma presets e tri-state. | `app/test/modules/security.test.ts` exercita escopos, limites e SQL de plano; presets/tri-state de equivalência REA permanecem desconhecidos. |
| Layout Query/Locks, escopo Session/Global e rótulos exatos das abas batem com a referência. | INFERIDA | UX 08 §§2–3; FIDELIDADE Parte B observa que esses detalhes não foram localizados. | `app/test/modules/sessions.test.ts` cobre dados/ações do clone; sem prova de equivalência visual completa. |
