/* global process, setTimeout */
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const executable = process.env.TUXSQL_RELEASE_BINARY
if (!executable || !executable.startsWith('/')) throw new Error('Set TUXSQL_RELEASE_BINARY to the absolute path of the packaged release executable.')

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'tuxsql-release-fuse-smoke-'))
const markerPath = join(temporaryDirectory, 'node-options-ran')
const probePath = join(temporaryDirectory, 'probe.cjs')
const probeSource = `require('node:fs').writeFileSync(${JSON.stringify(markerPath)}, 'NODE_OPTIONS executed')\n`
await writeFile(probePath, probeSource, { mode: 0o600 })
const isolatedHome = join(temporaryDirectory, 'home')
const xdgDirectories = ['config', 'cache', 'data', 'state'].map((name) => [
  `XDG_${name.toUpperCase()}_HOME`, join(temporaryDirectory, name)
])
await mkdir(isolatedHome, { recursive: true, mode: 0o700 })
await mkdir(join(temporaryDirectory, 'runtime'), { recursive: true, mode: 0o700 })

let child
let output = ''
try {
  child = spawn(resolve(executable), ['--inspect=0'], {
    env: {
      ...process.env,
      HOME: isolatedHome,
      NODE_OPTIONS: `--require ${probePath}`,
      TUXSQL_FUSE_PROBE_MARKER: markerPath,
      TUXSQL_NO_DEV_LINK: '1',
      XDG_RUNTIME_DIR: join(temporaryDirectory, 'runtime'),
      ...Object.fromEntries(xdgDirectories)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  child.stdout.setEncoding('utf8').on('data', (chunk) => { output = (output + chunk).slice(-20_000) })
  child.stderr.setEncoding('utf8').on('data', (chunk) => { output = (output + chunk).slice(-20_000) })
  const exitPromise = new Promise((resolveExit) => child.once('exit', (code, signal) => resolveExit({ code, signal })))
  await new Promise((resolveStart) => setTimeout(resolveStart, 3_000))
  if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Release executable exited before the smoke checks (code=${child.exitCode}, signal=${child.signalCode}).\n${output}`)
  child.kill('SIGTERM')
  await Promise.race([exitPromise, new Promise((resolveExit) => setTimeout(resolveExit, 4_000))])
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await exitPromise
  }
  let markerExists = false
  try { await readFile(markerPath); markerExists = true } catch { /* expected when the fuse blocks NODE_OPTIONS */ }
  if (markerExists) throw new Error('NODE_OPTIONS probe ran; EnableNodeOptionsEnvironmentVariable is not disabled.')
  if (/Debugger listening|Debugger attached|ws:\/\/127\.0\.0\.1:\d+/i.test(output)) throw new Error(`Electron opened a debugging endpoint despite the release fuses.\n${output}`)
  process.stdout.write('PASS: release executable stayed running; NODE_OPTIONS probe marker absent; --inspect=0 announced no debugging endpoint.\n')
} finally {
  if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  await rm(temporaryDirectory, { recursive: true, force: true })
}
