import { describe, expect, it, vi } from 'vitest'
import { applyReviewedSourceScripts, reviewSourceScripts } from '../../src/modules/source-control/applyScripts.js'

describe('reviewed Source Control script application', () => {
  it('counts destructive statement kinds after masking comments and literals', () => {
    expect(reviewSourceScripts([{ path: 'changes.sql', contents: "DROP TABLE old; DELETE FROM users -- WHERE id=1\n; UPDATE users SET note='where'; TRUNCATE TABLE logs;" }])).toEqual({ drop: 1, truncate: 1, delete: 1, update: 1 })
  })

  it('applies legitimate CREATE and ALTER scripts outside production without a second confirmation', async () => {
    const driver = { setDatabase: vi.fn().mockResolvedValue(undefined), executeSql: vi.fn().mockResolvedValue([]) }
    const scripts = [{ path: 'tables/users.sql', contents: 'CREATE TABLE users (id INT); ALTER TABLE users ADD COLUMN name VARCHAR(30);' }]
    await expect(applyReviewedSourceScripts({ driver, connectionId: 'c1', database: 'appdb', scripts, production: false, confirmed: true, reviewedCounts: reviewSourceScripts(scripts) })).resolves.toBeUndefined()
    expect(driver.setDatabase).toHaveBeenCalledWith('c1', 'appdb')
    expect(driver.executeSql.mock.calls.map(([, sql]) => sql)).toEqual(['CREATE TABLE users (id INT)', 'ALTER TABLE users ADD COLUMN name VARCHAR(30)'])
  })

  it('requires exact typed confirmation for production and stops at the first failed statement with file context', async () => {
    const scripts = [{ path: 'tables/users.sql', contents: 'CREATE TABLE users (id INT); DROP TABLE old_users; ALTER TABLE users ADD COLUMN name TEXT;' }]
    const reviewedCounts = reviewSourceScripts(scripts)
    const driver = { setDatabase: vi.fn().mockResolvedValue(undefined), executeSql: vi.fn().mockRejectedValueOnce(new Error('server rejected statement')) }
    await expect(applyReviewedSourceScripts({ driver, connectionId: 'c1', database: 'production', scripts, production: true, confirmed: true, reviewedCounts })).rejects.toThrow('Type the exact database name')
    await expect(applyReviewedSourceScripts({ driver, connectionId: 'c1', database: 'production', scripts, production: true, confirmed: true, typedDatabase: 'production', reviewedCounts })).rejects.toThrow('tables/users.sql, statement 1 failed')
    expect(driver.executeSql).toHaveBeenCalledTimes(1)
  })

  it('rejects scripts changed after their destructive review', async () => {
    const driver = { setDatabase: vi.fn(), executeSql: vi.fn() }
    await expect(applyReviewedSourceScripts({ driver, connectionId: 'c1', database: 'appdb', scripts: [{ path: 'x.sql', contents: 'DROP TABLE x' }], production: false, confirmed: true, reviewedCounts: { drop: 0, truncate: 0, delete: 0, update: 0 } })).rejects.toThrow('changed after review')
    expect(driver.executeSql).not.toHaveBeenCalled()
  })

  it('keeps stored routine bodies as one server statement', async () => {
    const driver = { setDatabase: vi.fn().mockResolvedValue(undefined), executeSql: vi.fn().mockResolvedValue([]) }
    const scripts = [{ path: 'procedures/p.sql', contents: 'CREATE PROCEDURE p() BEGIN INSERT INTO t VALUES (1); UPDATE t SET id = 2; END;' }]
    await applyReviewedSourceScripts({ driver, connectionId: 'c1', database: 'appdb', scripts, production: false, confirmed: true, reviewedCounts: reviewSourceScripts(scripts) })
    expect(driver.executeSql).toHaveBeenCalledTimes(1)
    expect(driver.executeSql.mock.calls[0]?.[1]).toContain('UPDATE t')
  })
})
