'use strict'
// Entry point of the packaged app.
//
// When the installation is linked to a development checkout (a dev-link.json under the user's config directory),
// the app runs that checkout's build, so "Update" (git pull + rebuild) changes what runs without reinstalling the
// package. Without a link it runs the bundled build, exactly as before.
//
//   ~/.config/tuxsql/dev-link.json  ->  { "repoPath": "/path/to/TuxSQL" }
//
// Set TUXSQL_NO_DEV_LINK=1 to ignore the link for one run.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { app } = require('electron')

function ownedAndNotWorldWritable(file) {
  const stat = fs.statSync(file)
  const ownerOk = typeof process.getuid !== 'function' || stat.uid === process.getuid()
  return ownerOk && (stat.mode & 0o002) === 0
}

function linkedCheckout() {
  if (process.env.TUXSQL_NO_DEV_LINK === '1') return undefined
  try {
    const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
    const config = JSON.parse(fs.readFileSync(path.join(configHome, 'tuxsql', 'dev-link.json'), 'utf8'))
    if (typeof config.repoPath !== 'string' || !path.isAbsolute(config.repoPath)) return undefined
    const appRoot = path.join(config.repoPath, 'app')
    const entry = path.join(appRoot, 'out', 'main', 'index.js')
    if (!fs.statSync(entry).isFile() || !fs.statSync(path.join(appRoot, 'package.json')).isFile()) return undefined
    if (!ownedAndNotWorldWritable(entry)) {
      process.stderr.write('[dev-link] ignored: the linked build is not owned by you or is world-writable\n')
      return undefined
    }
    return { appRoot, entry }
  } catch {
    return undefined
  }
}

const linked = linkedCheckout()
if (linked) {
  process.stderr.write(`[dev-link] running the linked checkout build: ${linked.entry}\n`)
  app.setAppPath(linked.appRoot)
  require(linked.entry)
} else {
  require('../out/main/index.js')
}
