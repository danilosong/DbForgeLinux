This page applies to version 0.1.0.

# Security and Privacy

TuxSQL is designed to provide operational transparency, user privacy, and careful integration with Linux security mechanisms.

Back to the [Main Index](00-index.md).

---

## 1. Secure Credential Storage (Keyring and Local Vault)

Password and secret handling in TuxSQL is managed by the vault subsystem (`PasswordVault`):

- **Integration with System Keyring (GNOME Keyring / KWallet):** In graphical Linux desktop environments supporting the Secret Service API (via `safeStorage`/`libsecret`), TuxSQL checks whether system encryption is available and explicitly rejects insecure backends (`basic_text` and `unknown`). When available, stored passwords are encrypted and protected by the operating system keyring.
- **Local Encrypted Vault (AES-256-GCM):** If the system keyring is unavailable, locked, or running in an environment without desktop keyring services, TuxSQL falls back to a local vault using AES-256-GCM symmetric encryption. The local master key (`local-master.key`) is generated and saved with strict `0600` permissions in the private user directory (`~/.config/tuxsql/vault/`). In this scenario, the application displays a warning noting that the local vault protects credentials against other system users, but not against other processes running under the same user account, recommending unlocking GNOME Keyring or KWallet for full system-level protection.
- **Session-Only Memory Mode:** When the **Remember Password** option is unchecked in the connection properties, no credential is written to disk (neither to the keyring nor to the local vault). The password remains solely in volatile memory during the active session and is discarded when the application exits.

---

## 2. Environment Categories and the Production Guard

To prevent accidental queries against critical databases, TuxSQL provides environment categories and confirmation workflows:

- **Environment Categories:** Each connection can be assigned to an environment in its properties:
  - `Development` (`dev`): defaults to a Square (`square`) marker with green color (`#2e7d32`).
  - `Test` (`test`): defaults to a Diamond (`diamond`) marker with orange color (`#ed6c02`).
  - `Production` (`prod`): defaults to a Circle (`circle`) marker with red color (`#c62828`).
  - `Sandbox` (`sandbox`): defaults to a Triangle (`triangle`) marker with blue color (`#1565c0`).
  - `Custom` (`custom`): uses a Triangle marker with customizable label and color.
  - `None` (`none`): no environment marker.
  - Connections also include an optional Category text field for custom grouping.
- **Visual Indicators in Explorer and Status Bar:** An environment badge showing the assigned geometric shape and color is rendered beside the connection name in the Database Explorer tree and in the Status Bar when that connection is active.
- **Execution Warnings by Category:** Under **Tools > Options > Execution**, users can enable or disable individual confirmation warnings for `TRUNCATE`, `DELETE`, and `UPDATE` statements for each environment category (enabled by default for Production, Test, Sandbox, Custom, and None; disabled by default for Development).
- **Mandatory Typed Confirmation in Production:** When a potentially destructive statement (such as dangerous DDL or DML) is executed on a connection categorized as `Production`, TuxSQL displays a blocking modal dialog requiring the user to type the exact active database name to authorize execution (`Production connection. Type [database] to confirm.`). If the typed text does not match the database name, execution is aborted.

---

## 3. Network Activity and Zero Telemetry

TuxSQL does not send telemetry. The network connections initiated by the application are limited to:

1. **Database Servers:** Direct connections to the database hosts and ports you configure, including any intermediate SSH tunnels or HTTP tunnels.
2. **AI Provider:** Calls to your configured AI endpoint or service, occurring only after you review and approve the exact payload to be sent.
3. **GitHub Update Checking:** By default on startup, TuxSQL queries the public GitHub Releases API to check if a newer version of the application is available (`updater.checkOnStartup: true`). This behavior can be disabled by unchecking the option in **Tools > Options > Updates**.
4. **System Web Browser:** Clicking external links (such as repository, documentation, or license links) opens the target URL in your operating system's default web browser.

---

## 4. User-Controlled AI Assistant

- **No Compulsory Cloud Service:** There is no mandatory third-party cloud service required for the core application.
- **Local Model or Personal API Key:** You can use your own API key or connect directly to a self-hosted local model runner (such as Ollama or vLLM) on your machine or local network.
- **Prior Payload Approval:** No queries, schema definitions, or prompts are sent to an AI service without the user reviewing the content and clicking to confirm transmission.

---

## 5. Linux File Permissions and Minimal Privilege Escalation

- **Directory and File Permissions:** Configuration and data folders under `~/.config/tuxsql` and `~/.local/share/tuxsql` are created with `0700` (`rwx------`) permissions, and credential vault files are written with `0600` (`rw-------`) permissions.
- **Minimal Privilege Escalation via pkexec:** Local system service management actions (such as `systemctl restart mysql`) invoke Linux's native `pkexec` (Polkit) utility for targeted authentication, avoiding the need to run the main user interface with administrative privileges.

---

## Next Steps

- Learn how to diagnose TLS and keyring issues in [Common Troubleshooting](06-problemas-comuns.md).
- View open-source software licenses in [About this Project](07-sobre-este-projeto.md).
