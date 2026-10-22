This page applies to version 0.1.0.

# Connections and Network Security

TuxSQL allows you to configure, manage, and connect to multiple **MySQL** and **MariaDB** server instances simultaneously and securely.

Back to the [Main Index](00-index.md).

---

## Creating a New Connection

To create a connection:

1. In the main menu, navigate to **File > New Connection...** or press `Ctrl+D Ctrl+N` (or `Ctrl+Shift+N`).
2. In the connection dialog, configure:
   - **Connection Name:** A friendly label to identify the server in the sidebar (e.g., `Local Dev`, `Staging Cluster`).
   - **Host:** IP address, hostname (`localhost`, `db.internal.lan`), or Unix domain socket path (e.g., `/var/run/mysqld/mysqld.sock`).
   - **Port:** The TCP service port (default: `3306`).
   - **User and Password:** Database server credentials.
   - **Database:** The default schema to use upon opening the connection (optional).

Saved passwords are encrypted via the native Linux system keyring or by an encrypted local vault when the keyring is inaccessible. See details in [Security and Privacy](05-seguranca.md).

---

## Connection Encryption: SSL/TLS Modes

TuxSQL supports 5 distinct SSL/TLS negotiation modes to accommodate varied local and enterprise requirements:

| SSL/TLS Mode | Protection Level | Recommended Usage |
| :--- | :--- | :--- |
| `disabled` | **No encryption.** Traffic and authentication credentials pass over the wire in plain text. | Only for local loopback connections (`127.0.0.1`), Unix domain sockets, or isolated private networks. |
| `preferred` | **Opportunistic encryption without certificate validation.** Attempts TLS first without verifying the certificate authority or server identity. If the server lacks TLS support, unencrypted fallback occurs **only on local loopback targets** (`localhost`, `127.0.0.1`, or Unix sockets). On remote servers lacking TLS, the connection aborts. | Local development servers where TLS support is optional. Does not protect against active on-path attackers (MITM) on the network. |
| `required` | **Mandatory encryption without certificate validation.** Requires a TLS channel. If the server does not support TLS or the handshake fails, the connection fails. Does not verify whether the certificate was signed by a trusted CA or validate the hostname. | Protects against passive network eavesdropping where custom CA infrastructure is not present. |
| `verify-ca` | **Encryption with CA validation.** Enforces TLS and validates the server certificate chain against a user-specified Certificate Authority (`CA Certificate`) file. | Protects against passive eavesdropping and active rogue server attacks (Man-in-the-Middle) on untrusted networks. |
| `verify-identity` | **Maximum encryption with CA and hostname verification.** Enforces TLS, verifies the CA trust chain, and confirms that the server hostname or IP matches the Common Name (CN) or Subject Alternative Name (SAN) in the certificate. | Protects against server spoofing, DNS hijacking, and impersonation on open networks or cloud environments. |

To use client certificates (mutual TLS / mTLS authentication), fill in the optional **Client Certificate** and **Client Private Key** fields on the connection security tab.

---

## SSH Tunneling

When the MySQL server is not exposed directly to the public Internet, use the integrated SSH tunnel to relay connections securely through a bastion host or jump box:

1. In the connection settings, enable the **SSH Tunnel** option.
2. Enter the **SSH Host** and **Port** (default: `22`).
3. Enter the **SSH Username**.
4. Choose the authentication method:
   - **Password:** Enter the SSH user's password.
   - **Private Key:** Select your private key file (e.g., `~/.ssh/id_rsa` or `~/.ssh/id_ed25519`). If the key is protected with a passphrase, provide it in the passphrase field.

---

## Connection Environments and the Production Guard

Every connection in TuxSQL can be assigned to an environment category in its properties:

- **Development (`dev`):** Defaults to a Square (`square`) marker with green color (`#2e7d32`).
- **Test (`test`):** Defaults to a Diamond (`diamond`) marker with orange color (`#ed6c02`).
- **Production (`prod`):** Defaults to a Circle (`circle`) marker with red color (`#c62828`).
- **Sandbox (`sandbox`):** Defaults to a Triangle (`triangle`) marker with blue color (`#1565c0`).
- **Custom (`custom`):** Allows selecting a shape (Square, Circle, Triangle, Diamond), custom label, and color.
- **None (`none`):** Default connection without an environment badge.

### Visual Badges and Production Confirmation

1. The environment badge showing the configured geometric shape and color is rendered beside the connection name in the Database Explorer tree and in the Status Bar when active.
2. On connections categorized as **Production**, potentially destructive statements (`DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, or `DELETE` without `WHERE`) trigger a **blocking modal dialog** requiring you to type the exact active database name to authorize execution (`Production connection. Type [database] to confirm.`).

---

## Read-Only Mode

Selecting the **Read-Only** option in the advanced connection settings instructs TuxSQL to block data-modifying DDL and DML queries (`INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`) at the application level, protecting sensitive databases from unintended alterations.

---

## Next Steps

- Explore query writing and result manipulation in [SQL Editor and Results Grid](02-editor-e-resultados.md).
- Learn about administrative utilities in [Integrated Tools](03-ferramentas.md).
- If you run into TLS or keyring connection errors, see [Common Troubleshooting](06-problemas-comuns.md).
