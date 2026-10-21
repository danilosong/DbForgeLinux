import { cpSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Config directories used before the project was renamed to TuxSQL Song, newest first.
const legacyDirectoryNames = ['dbforge-linux', 'dbForgeLinux', 'dbforgelinux']
// Portable user data. The password vault is deliberately not copied: system-keyring entries are bound to the old
// application name and cannot be decrypted after the rename, so saved passwords are asked for again.
const portableEntries = ['connections.json', 'settings.json', 'sql-execution-history.json', 'recent-tasks.json', 'er-diagram', 'dev-link.json', 'updater-last-check']
const markerName = '.legacy-migrated'

export function migrateLegacyUserData(configHome: string, target: string): string[] {
  const marker = join(target, markerName)
  if (existsSync(marker)) return []
  const copied: string[] = []
  for (const directory of legacyDirectoryNames) {
    const source = join(configHome, directory)
    if (!existsSync(source)) continue
    for (const entry of portableEntries) {
      const from = join(source, entry)
      const to = join(target, entry)
      if (!existsSync(from) || existsSync(to)) continue
      cpSync(from, to, { recursive: true, errorOnExist: false, force: false })
      copied.push(entry)
    }
  }
  if (existsSync(target)) writeFileSync(marker, new Date().toISOString())
  return copied
}
