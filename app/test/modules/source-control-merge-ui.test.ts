import { describe, expect, it } from 'vitest'
import { composeConflictResult, layoutCommitGraph, parseConflictSegments } from '../../src/modules/source-control/merge-ui.js'
import type { RepositoryGraphCommit } from '../../src/modules/source-control/types.js'

describe('source control merge UI helpers', () => {
  it('parses conflict blocks and composes choices while preserving surrounding text', () => {
    const segments = parseConflictSegments('before\n<<<<<<< ours\nours line\n||||||| base\nbase line\n=======\ntheirs line\n>>>>>>> theirs\nafter\n')
    expect(segments).toHaveLength(3)
    const block = segments[1]
    expect(block).toMatchObject({ kind: 'block', ours: 'ours line\n', base: 'base line\n', theirs: 'theirs line\n', output: null })
    if (block?.kind === 'block') block.output = 'resolved line\n'
    expect(composeConflictResult(segments)).toBe('before\nresolved line\nafter\n')
  })

  it('lays out parent and merge edges for branch history', () => {
    const commits: RepositoryGraphCommit[] = [
      { hash: 'merge', parents: ['feature', 'main'], author: 'A', email: 'a@local', date: '2026-01-03', message: 'Merge', refs: ['HEAD -> main'] },
      { hash: 'feature', parents: ['base'], author: 'A', email: 'a@local', date: '2026-01-02', message: 'Feature', refs: ['feature'] },
      { hash: 'main', parents: ['base'], author: 'A', email: 'a@local', date: '2026-01-02', message: 'Main', refs: [] },
      { hash: 'base', parents: [], author: 'A', email: 'a@local', date: '2026-01-01', message: 'Base', refs: [] }
    ]
    const points = layoutCommitGraph(commits)
    expect(points).toHaveLength(4)
    expect(points[0]?.parents).toEqual(['feature', 'main'])
    expect(new Set(points.map((point) => point.y)).size).toBe(4)
    expect(points.find((point) => point.hash === 'feature')?.x).not.toBe(points.find((point) => point.hash === 'main')?.x)
  })
})
