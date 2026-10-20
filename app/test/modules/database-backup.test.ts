import { describe, expect, it } from 'vitest'
import { createBackupSql, restoreBackup, splitBackupSql } from '../../src/modules/database-tools/backup.js'
import type { DatabaseModel } from '../../src/modules/schema/model.js'

const model: DatabaseModel = {
  kind: 'database', name: 'shop',
  tables: [{ kind: 'table', name: 'customers', createSql: 'CREATE TABLE `customers` (`id` int, `name` varchar(20));', columns: [], indexes: [], foreignKeys: [], checks: [] }],
  views: [{ kind: 'view', name: 'customer_names', createSql: 'CREATE VIEW `customer_names` AS SELECT `name` FROM `customers`;' }],
  procedures: [{ kind: 'procedure', name: 'refresh', createSql: 'CREATE DEFINER=`root`@`localhost` PROCEDURE `refresh`() BEGIN SELECT 1; SELECT 2; END;' }],
  functions: [], triggers: [], events: []
}

describe('database backup and restore', () => {
  it('creates schema and data scripts with escaped values and delimiter-safe routines', async () => {
    const backup = await createBackupSql(model, true, async (_table, offset) => offset ? [] : [{ id: 1, name: "O'Hara" }, { id: 2, name: 'Second' }])
    expect(backup.rows).toBe(2); expect(backup.skipped).toEqual([])
    expect(backup.sql).toContain("'O''Hara'"); expect(backup.sql).toContain('DELIMITER $$')
    const statements = splitBackupSql(backup.sql)
    expect(statements.some((item) => item.includes('BEGIN SELECT 1; SELECT 2; END'))).toBe(true)
    expect(statements.filter((item) => item.startsWith('INSERT INTO'))).toHaveLength(2)
  })
  it('requires explicit destination confirmation and rejects destructive commands', async () => {
    const executed: string[] = []
    await expect(restoreBackup('shop', 'wrong', 'CREATE TABLE x (id int);', async (statement) => { executed.push(statement) })).rejects.toThrow('typing the destination')
    await expect(restoreBackup('shop', 'shop', 'DROP TABLE customers;', async (statement) => { executed.push(statement) })).rejects.toThrow('not allowed')
    await expect(restoreBackup('shop', 'shop', 'CREATE TABLE `production`.`users` (`id` int);', async (statement) => { executed.push(statement) })).rejects.toThrow('outside shop')
    await expect(restoreBackup('shop', 'shop', 'INSERT INTO `production`.`users` VALUES (1);', async (statement) => { executed.push(statement) })).rejects.toThrow('outside shop')
    await expect(restoreBackup('shop', 'shop', 'CREATE TABLE production/**/.users (`id` int);', async (statement) => { executed.push(statement) })).rejects.toThrow('outside shop')
    await expect(restoreBackup('shop', 'shop', 'CREATE TABLE /*!50000 production.users */ (`id` int);', async (statement) => { executed.push(statement) })).rejects.toThrow('executable SQL comments')
    await expect(restoreBackup('shop', 'shop', 'CREATE EVENT cleanup ON SCHEDULE EVERY 1 SECOND DO DROP TABLE customers;', async (statement) => { executed.push(statement) })).rejects.toThrow('not allowed')
    expect(executed).toEqual([])
  })
  it('omits scheduled events from portable backups so restoring cannot enable server jobs', async () => {
    const database = { ...model, events: [{ kind: 'event' as const, name: 'cleanup', createSql: 'CREATE EVENT cleanup ON SCHEDULE EVERY 1 DAY DO SELECT 1;' }] }
    const backup = await createBackupSql(database, false, async () => [])
    expect(backup.sql).not.toContain('CREATE EVENT')
    expect(backup.skipped).toContain('event cleanup (restore disabled for scheduled events)')
  })
  it('restores only approved statements and can continue after a statement error', async () => {
    const executed: string[] = []
    const report = await restoreBackup('shop', 'shop', 'CREATE TABLE a (id int); INSERT INTO a VALUES (1);', async (statement) => { executed.push(statement); if (statement.startsWith('CREATE')) throw new Error('already exists') }, true)
    expect(report).toEqual({ executed: 1, errors: [{ statement: 1, message: 'already exists' }] })
    expect(executed).toHaveLength(2)
  })
})
