# Updates

dbForgeLinux has development and release update channels. Open **Help → Check for Updates…** to check at any time. The status bar shows when a check is running or an update is ready. The update window lists the version summary, progress, and recent log messages; a download can be cancelled.

Open **Tools → Options → Updates** to choose the channel, startup behavior, and check interval. Startup checks wait briefly after the window opens and do not block database work. Network failures during the automatic check are silent; use the Help command to see the error. Automatic installation is off by default. The updater asks before replacing a build while a query or transaction is active.

## Development channel

The development channel is available in builds launched from a local Git checkout with `tools/dbforge-dev`. It checks local commits and `origin` without changing source files during the check. Applying an update requires a clean working tree and the same branch used to build the app. The updater uses `git pull --ff-only` when the remote branch is ahead, installs dependencies only when the lockfile changed, builds in a separate output directory, validates it, then swaps the app bundle atomically. If compilation or validation fails, the current bundle stays in place.

Use channel **Automatic** to select the local development channel in a checkout and GitHub releases in a packaged installation. **Release** always uses published GitHub assets. On Linux, AppImage and supported Debian packages use their package updater; if package installation is unavailable, the release page opens for a manual install.

## Build metadata

Each build writes `out/buildInfo.json`. Release builds omit the local repository path, so they cannot expose a developer checkout or select the development channel automatically.
