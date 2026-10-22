This page applies to version 0.1.0.

# TuxSQL — User Guide

**TuxSQL** is an independent graphical client and integrated development environment (IDE) for **MySQL** and **MariaDB** databases, built specifically for the **Linux** operating system and the Debian family (Debian GNU/Linux, Ubuntu, Pop!_OS, Linux Mint, and compatible distributions).

The application runs natively on Linux (x86_64 / amd64 architecture) without requiring emulators, foreign runtime compatibility layers, or proprietary background services.

---

## Installing the .deb Package

TuxSQL is distributed as a standard `.deb` package. To install it on your system:

1. Download the `tuxsql_0.1.0_amd64.deb` installation package.
2. Open a terminal in the folder containing the file and run:

```bash
sudo apt update
sudo apt install ./tuxsql_0.1.0_amd64.deb
```

If you prefer using `dpkg`, resolve any missing dependencies with `apt`:

```bash
sudo dpkg -i tuxsql_0.1.0_amd64.deb
sudo apt install -f
```

---

## How to Launch TuxSQL

After installation, you can start TuxSQL in two ways:

- **From the Application Menu:** Open your desktop application launcher (GNOME, COSMIC, KDE, Cinnamon) and search for **TuxSQL**.
- **From the Terminal:** Type `tuxsql` and press Enter.

---

## Getting Started in 3 Minutes

1. **Create a Connection:**
   On the Start Page, click **New Connection** or press the shortcut `Ctrl+D Ctrl+N` (or `Ctrl+Shift+N`). Enter the Host (`localhost` or IP address), the Port (`3306`), the Username, and the Password. For secure connections using certificates or SSH tunnels, see the [Connections and Network Security](01-conectar.md) guide.

2. **Open the SQL Editor:**
   With your active connection selected in the Database Explorer on the left, open a new SQL document by pressing `Ctrl+N` or via the menu **File > New SQL Document**.

3. **Run a Query:**
   Type a SQL query in the editor, for example:

```sql
SELECT VERSION(), CURRENT_TIMESTAMP;
```

   Press `F5` (or `F8` to execute the statement under the cursor). The results will appear immediately in the bottom results grid. Learn more about editing and results in [SQL Editor and Results Grid](02-editor-e-resultados.md).

4. **Explore Integrated Tools:**
   Access tools like schema and data comparators, the synthetic test data generator, ER diagrams, and the chart designer. See the complete overview in [Integrated Tools](03-ferramentas.md).

---

## Documentation Contents

- [Connections and Network Security](01-conectar.md): Connection setup, SSL/TLS modes, SSH tunneling, environments, and production guard.
- [SQL Editor and Results Grid](02-editor-e-resultados.md): F5/F8 execution, query history, inline editing with Post/Apply, row limits, and Copy As.
- [Integrated Tools](03-ferramentas.md): Overview of schema/data comparators, data generator, ER diagram, backup/restore, documenter, and routine debugger.
- [Keyboard Shortcuts](04-atalhos.md): Reference table of confirmed application commands and key bindings.
- [Security and Privacy](05-seguranca.md): System keyring storage, typed confirmation in production, absence of telemetry, and file permissions.
- [Common Troubleshooting](06-problemas-comuns.md): Diagnosing TLS handshake issues, locked keyrings, mdbtools, and AppArmor on Ubuntu 24+.
- [About this Project](07-sobre-este-projeto.md): MIT license, Debian Linux scope, and open-source components.
