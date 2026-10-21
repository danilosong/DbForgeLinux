import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
const applications = join(dataHome, 'applications')
const target = join(applications, 'tuxsql-dev.desktop')
await mkdir(applications, { recursive: true })
await writeFile(target, `[Desktop Entry]\nVersion=1.0\nType=Application\nName=TuxSQL (Development)\nComment=Run the development build from this repository\nExec=${join(repoRoot, 'tools', 'tuxsql-dev')}\nIcon=${join(repoRoot, 'app', 'packaging', 'icon.png')}\nTerminal=false\nCategories=Development;Database;IDE;\nStartupNotify=true\n`, { mode: 0o644 })
await chmod(target, 0o644)
process.stdout.write(`${target}\n`)
