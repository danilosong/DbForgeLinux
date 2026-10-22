import { access, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createDisposableServerManager } from '../../src/modules/local-server/index.js'

describe('Disposable local server manager', () => {
  it('detects the available engine and disables the action when neither daemon responds', async () => {
    const manager = createDisposableServerManager(async () => { throw new Error('missing engine') })
    expect(await manager.inspect()).toEqual({ available: false, status: 'unavailable' })
    await expect(manager.create('mysql')).rejects.toThrow('localServer.error.engineUnavailable')
  })

  it('uses argv, a temporary secret env file, a loopback-only random port, and anonymous storage', async () => {
    const calls: Array<{ file: string; args: string[] }> = []
    let envPath = ''
    const manager = createDisposableServerManager(async (file, args) => {
      calls.push({ file, args })
      if (args[0] === 'info') return { stdout: '1.2', stderr: '' }
      if (args[0] === 'run') {
        envPath = args[args.indexOf('--env-file') + 1]!
        const envText = await readFile(envPath, 'utf8')
        expect(envText).toMatch(/^MYSQL_ROOT_PASSWORD=[A-Za-z0-9_-]{24,}\n$/)
        expect(args).toContain('127.0.0.1::3306')
        expect(args).toContain('type=volume,destination=/var/lib/mysql')
        return { stdout: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789', stderr: '' }
      }
      if (args[0] === 'ps') return { stdout: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789\ttuxsql-local-mysql-1234567890abcdef\tUp 2 seconds\t127.0.0.1:49152->3306/tcp\n', stderr: '' }
      throw new Error(`unexpected ${file} ${args[0]}`)
    }, () => 'S3cure_generated_password_0123456789', () => '12345678-90ab-cdef-1234-567890abcdef')
    const server = await manager.create('mysql')
    expect(server).toMatchObject({ host: '127.0.0.1', port: 49152, state: 'running', canCreateProfile: true })
    expect(calls.every(call => Array.isArray(call.args))).toBe(true)
    expect(calls.find(call => call.args[0] === 'run')?.args).not.toContain('S3cure_generated_password_0123456789')
    await expect(access(envPath)).rejects.toThrow()
  })

  it('requires an exact typed removal phrase and removes the attached ephemeral volume', async () => {
    const removed: string[][] = []
    const manager = createDisposableServerManager(async (file, args) => {
      if (args[0] === 'info') return { stdout: '', stderr: '' }
      if (args[0] === 'ps') return { stdout: 'abcdef012345\ttuxsql-local-mariadb-1234567890abcdef\tUp 2 seconds\t127.0.0.1:49152->3306/tcp\n', stderr: '' }
      removed.push([file, ...args]); return { stdout: '', stderr: '' }
    })
    await expect(manager.remove('abcdef012345', 'REMOVE other')).rejects.toThrow('localServer.error.confirmationMismatch')
    await manager.remove('abcdef012345', 'REMOVE tuxsql-local-mariadb-1234567890abcdef')
    expect(removed).toEqual([['docker', 'rm', '--force', '--volumes', 'abcdef012345']])
  })
})
