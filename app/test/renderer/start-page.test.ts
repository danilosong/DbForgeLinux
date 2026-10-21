import { describe, expect, it } from 'vitest'
import { startTaskGroups } from '../../src/renderer/src/ui/components/startPageTasks.js'

describe('Start Page task areas', () => {
  it('exposes each task area and routes to registered modules', () => {
    expect(startTaskGroups.map(({ id }) => id)).toEqual(['development', 'design', 'sync', 'administration', 'dataPump', 'analysis'])
    expect(startTaskGroups.find(({ id }) => id === 'sync')?.tasks).toContain('schema-compare')
    expect(startTaskGroups.find(({ id }) => id === 'dataPump')?.tasks).toContain('import-export')
  })
})
