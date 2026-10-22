This page applies to version 0.1.0.

# Common Troubleshooting

This page provides diagnoses and straightforward solutions for common configuration challenges on Linux.

Back to the [Main Index](00-index.md).

---

## 1. Connection Failure: Server Without TLS / SSL Handshake Error

### Symptom
Connection attempts fail with errors such as `SSL connection error`, `TLS unavailable`, `Handshake failed`, or `This server does not offer TLS`.

### Cause
TuxSQL defaults to attempting secure TLS connections. Older MySQL servers or standard local developer installations without configured SSL certificates will reject the TLS handshake.

In `preferred` mode, TuxSQL attempts TLS first and falls back to unencrypted text **only on local loopback targets** (`localhost`, `127.0.0.1`, or Unix sockets). On remote servers, `preferred` mode does not silently fall back to plain text and raises a connection error for safety.

### Solution
1. Open the connection properties in TuxSQL.
2. In the **SSL / TLS** tab, configure the **SSL Mode**:
   - For local loopback connections (`localhost` or `127.0.0.1`), keep `preferred`.
   - For remote servers on private networks that do not support TLS, explicitly select `disabled` (credentials will travel in plain text).
3. For remote production servers, the recommended fix is to enable TLS on the MySQL server by configuring certificates in `/etc/mysql/my.cnf`.

Read more about the 5 negotiation modes in [Connections and Network Security](01-conectar.md).

---

## 2. Keyring Error (Locked Keyring or Headless Session)

### Symptom
When opening or saving connections with stored credentials, the application displays a warning indicating that the system keyring is locked or unavailable (`Keyring indisponível. Senhas serão protegidas por cofre local AES-GCM...`).

### Cause
On Linux, credential storage preferentially uses the Secret Service API (GNOME Keyring or KWallet). If you logged into your desktop without automatic keyring unlocking (e.g., after changing your user password or connecting via remote SSH/VNC without full PAM unlocking), the system keyring remains locked.

### Solution
- **Automatic Fallback in TuxSQL:** When the system keyring is unavailable, TuxSQL stores the password in a local vault using AES-256-GCM encryption with a private key file (`0600`). The application displays a notice reminding users that the local vault protects against other system users, but not against other processes running under the same user account.
- **To restore system keyring protection:** Open **Passwords and Keys** (Seahorse) in GNOME or KWalletManager in KDE, and unlock the default login keyring.
- **In headless or remote sessions:** In connection properties, uncheck **Remember Password**. TuxSQL will prompt for the password when opening the session and keep it solely in volatile session memory.

---

## 3. Routine Debugger: Performance Schema Disabled

### Symptom
When launching a debug session for a stored procedure, function, or trigger, the debugger fails or cannot inspect local variables, breakpoints, or the call stack.

### Cause
The TuxSQL routine debugging engine relies on the MySQL/MariaDB `performance_schema` subsystem being enabled on the database server to track execution progress and variable state.

### Solution
Check if the Performance Schema is currently enabled by running this query in the SQL editor:

```sql
SHOW VARIABLES LIKE 'performance_schema';
```

If the value is `OFF`:
1. Open the MySQL configuration file as root (usually located at `/etc/mysql/mysql.conf.d/mysqld.cnf` or `/etc/mysql/my.cnf`).
2. Add or update the directive under the `[mysqld]` section:

```ini
[mysqld]
performance_schema = ON
```

3. Restart the database service:

```bash
sudo systemctl restart mysql
```

---

## 4. MS Access File Import (.mdb / .accdb): mdbtools Missing

### Symptom
When attempting to import tables from a Microsoft Access file (`.mdb` or `.accdb`), TuxSQL reports that the `mdbtools` utility (`mdb-tables` or `mdb-export`) was not found on the system.

### Cause
TuxSQL is native to Linux and does not rely on Windows database drivers. Access file inspection is performed via the open-source `mdbtools` suite on Linux.

### Solution
Install the `mdbtools` package using your Linux distribution's package manager:

```bash
sudo apt update
sudo apt install mdbtools
```

Once installed, read-only import of `.mdb` and `.accdb` files will function normally inside the Import Wizard.

---

## 5. AppArmor Profile Restriction on Ubuntu 24.04+ (Noble Numbat)

### Symptom
On Ubuntu 24.04 LTS or newer, launching TuxSQL from a manually extracted archive fails with terminal messages referencing `unprivileged user namespace restricted` or sandbox launch errors.

### Cause
Ubuntu 24.04 introduced default AppArmor restrictions that block the creation of unprivileged user namespaces for executables that lack an associated security profile.

### Solution
- **Recommended Solution:** Install TuxSQL using the official `.deb` package (`sudo apt install ./tuxsql_0.1.0_amd64.deb`). The Debian package automatically sets up the required AppArmor profile under `/etc/apparmor.d/tuxsql`.
- **For standalone archive runs:** Ensure an appropriate AppArmor exception or profile is registered for the binary, or use the official `.deb` installer.

---

## Next Steps

- Review our security standards in [Security and Privacy](05-seguranca.md).
- Learn about the open-source community in [About this Project](07-sobre-este-projeto.md).
