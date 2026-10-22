import { describe, expect, it, vi } from 'vitest'
import { LegacyReadOnlyRepository, type LegacyVcs } from '../../src/modules/source-control/legacy-readonly.js'

describe('read-only Subversion and Mercurial adapters', () => {
  it.each([
    ['Mercurial', 'hg', 'M schema.sql\n? new.sql\n', 'default'],
    ['Subversion', 'svn', '<status><target><entry path="schema.sql"><wc-status item="modified"/></entry><entry path="new.sql"><wc-status item="unversioned"/></entry></target></status>', 'working copy']
  ] as Array<[LegacyVcs, string, string, string]>)('%s reads status through execFile-compatible arguments', async (system, binary, status, branch) => {
    const runner = vi.fn(async (_command: string, args: string[]) => args.includes('branch') ? 'default' : status)
    const repository = new LegacyReadOnlyRepository(system, '/repo', runner)
    const result = await repository.status()
    expect(runner.mock.calls[0]?.[0]).toBe(binary)
    expect(result).toMatchObject({ root: '/repo', branch, changes: [{ path: 'schema.sql', state: 'modified' }, { path: 'new.sql', state: 'untracked' }] })
  })

  it('reads log and diff without exposing write operations', async () => {
    const runner = vi.fn(async (_command: string, args: string[]) => args.includes('log')
      ? 'abc123\x1fDev\x1fdev@example.test\x1f2026-10-22\x1fUpdate schema\n'
      : 'diff --git a/schema.sql b/schema.sql\n')
    const repository = new LegacyReadOnlyRepository('Mercurial', '/repo', runner)
    expect(await repository.log()).toMatchObject([{ hash: 'abc123', author: 'Dev', message: 'Update schema' }])
    expect(await repository.diff('schema.sql')).toContain('diff --git')
    expect(runner.mock.calls.every(([, args]) => !['commit', 'push', 'pull', 'update', 'merge'].includes(args[1] ?? ''))).toBe(true)
  })

  it('rejects traversal paths before invoking the client', async () => {
    const runner = vi.fn()
    const repository = new LegacyReadOnlyRepository('Subversion', '/repo', runner)
    await expect(repository.diff('../outside.sql')).rejects.toThrow('inside the repository')
    expect(runner).not.toHaveBeenCalled()
  })
})
