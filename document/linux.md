# Linux runtime

- Electron uses Chromium's automatic monitor scale factor; the application's UI zoom remains adjustable under Options. The window uses normal native file open/save dialogs.
- Ozone backend defaults to automatic selection. Set `TUXSQL_LINUX_BACKEND=x11` or `TUXSQL_LINUX_BACKEND=wayland` before launch to force a backend for diagnosis.
- The app takes a single-instance lock. A later launch focuses the running window and delivers any `.sql` path argument; the desktop file associates `text/x-sql` and `application/sql` with `tuxsql`.
- `safeStorage` uses the desktop keyring when available. If it is unavailable or selects a plaintext backend, the app stores passwords only as AES-256-GCM ciphertext in the user-data vault and displays a warning. Its random master key is private to the OS account (mode `0600`), so this fallback does not protect against other processes running as that same account; install and unlock GNOME Keyring or KWallet for system-store protection.
- SQL open/save and import/export use Electron native dialogs. SQL files opened by path retain their existing destination for Save.

For headless UI checks, clear any user display environment before starting the virtual server and keep it alive until Electron exits:

```sh
env -u DISPLAY -u WAYLAND_DISPLAY -u XDG_SESSION_TYPE xvfb-run -a pnpm start
```
