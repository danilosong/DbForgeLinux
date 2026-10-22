# Backup Schedule: verificação ponta a ponta

Executada em 21/10/2026 contra MySQL 8.4.11 em `127.0.0.1:33067`.

- Criado um schema e uma tabela descartáveis com uma linha de teste.
- Criado um timer `systemd --user` para o próximo minuto usando uma conexão persistida e credencial cifrada pelo safeStorage com backend GNOME Keyring.
- O serviço terminou com status 0; `journalctl --user -u tuxsql-backup-<id>.service` registrou o início e a conclusão.
- O backup `.sql` foi criado com modo `0600` e restaurado em outro schema descartável; a linha de teste foi conferida após a restauração.
- `backup-schedule-runs.json` registrou apenas o UUID, resultado `success` e horário, com modo `0600`.
- Ao final foram removidos timer, unit, perfil e schemas temporários. `systemctl --user list-timers --all` e a pasta de units ficaram sem entradas `tuxsql-backup-*`.

O timer importa `DBUS_SESSION_BUS_ADDRESS` do processo TuxSQL para o user manager quando disponível, para que o processo CLI possa consultar o cofre da sessão. Se o cofre estiver bloqueado ou inacessível, o serviço falha, o estado registra `failure`, o journal recebe uma mensagem genérica e o app avisa no próximo início. O CLI é iniciado sem renderer; `--no-sandbox` atende ao pacote instalado sem exigir helper setuid/root.
