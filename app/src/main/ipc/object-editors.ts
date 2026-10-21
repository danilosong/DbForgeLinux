import { ipcMain } from 'electron'
import { app } from 'electron'
import { chmod, open, lstat, mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { inspectDatabase, quoteIdentifier, dropObject, diffTables, createTable, type SchemaObject, type SchemaObjectKind, type TableModel } from '../../modules/schema/index.js'
import { normalizeObjectDefinition, objectRestoreFailureMessage, validateTableDraft } from '../../modules/object-editors/index.js'
import type { ObjectEditorTarget } from '../../shared/contracts/object-editors.js'
import { editorMetadataCache } from './editor.js'
import type { MysqlDriver } from '../db/MysqlDriver.js'

type EditorAction = 'drop' | 'rename' | 'truncate'
const kinds: SchemaObjectKind[] = ['table', 'view', 'procedure', 'function', 'trigger', 'event']
const keyFor = (kind: SchemaObjectKind): keyof ReturnType<typeof objectLists> => kind === 'table' ? 'tables' : kind === 'view' ? 'views' : kind === 'procedure' ? 'procedures' : kind === 'function' ? 'functions' : kind === 'trigger' ? 'triggers' : 'events'
function objectLists(database: import('../../modules/schema/model.js').DatabaseModel) {
  return { tables: database.tables, views: database.views, procedures: database.procedures, functions: database.functions, triggers: database.triggers, events: database.events }
}

export function registerObjectEditorsIpc({ driver }: { driver: MysqlDriver }): void {
  ipcMain.handle('object-editor:load', async (_event, target: ObjectEditorTarget): Promise<SchemaObject> => {
    validateTarget(target)
    const schema = await inspectDatabase((sql, values) => driver.queryRows(target.connectionId, sql, values), target.database)
    const item = objectLists(schema)[keyFor(target.kind)].find((candidate) => candidate.kind === target.kind && candidate.name === target.name)
    if (!item) throw new Error(`${target.kind} ${target.name} não encontrado em ${target.database}.`)
    return item
  })

  ipcMain.handle('object-editor:apply-table', async (_event, connectionId: string, database: string, original: TableModel | null, target: TableModel): Promise<string[]> => {
    if (!connectionId || !database || target.kind !== 'table') throw new Error('Dados inválidos para o Table Designer.')
    validateTableDraft(target)
    const statements = original ? diffTables(original, target, database, true) : [createTable(target, database)]
    if (!statements.length) return []
    for (const statement of statements) await driver.executeSql(connectionId, statement)
    editorMetadataCache.invalidate(connectionId, database)
    return statements
  })

  ipcMain.handle('object-editor:apply', async (_event, target: ObjectEditorTarget, sql: string): Promise<void> => {
    validateTarget(target)
    if (target.kind === 'table') throw new Error('Use o Table Designer para alterar tabelas.')
    const statement = normalizeObjectDefinition(sql, target)
    const schema = await inspectDatabase((text, values) => driver.queryRows(target.connectionId, text, values), target.database)
    const prior = objectLists(schema)[keyFor(target.kind)].find((item) => item.name === target.name)
    if (target.kind === 'view') {
      await driver.executeSql(target.connectionId, ensureReplace(statement))
    } else if (prior) {
      const originalSql = prior.createSql
      if (!originalSql) throw new Error(`Não foi possível guardar o DDL original de ${target.name}; alteração cancelada.`)
      const recoveryFile = await writeRecoveryDdl(originalSql)
      try { await driver.executeSql(target.connectionId, dropObject(prior, target.database)) }
      catch (error) { await unlink(recoveryFile).catch(() => undefined); throw error }
      let keepRecoveryFile = false
      try { await driver.executeSql(target.connectionId, statement) }
      catch {
        try { await driver.executeSql(target.connectionId, originalSql) }
        catch { keepRecoveryFile = true; throw new Error(objectRestoreFailureMessage(target.name, recoveryFile)) }
        throw new Error('Alteração falhou; o objeto original foi restaurado.')
      } finally { if (!keepRecoveryFile) await unlink(recoveryFile).catch(() => undefined) }
    } else await driver.executeSql(target.connectionId, statement)
    editorMetadataCache.invalidate(target.connectionId, target.database)
  })

  ipcMain.handle('object-editor:mutate', async (_event, target: ObjectEditorTarget, action: EditorAction, newName?: string): Promise<void> => {
    validateTarget(target)
    if (!['drop', 'rename', 'truncate'].includes(action)) throw new Error('Ação inválida.')
    if (action !== 'drop' && target.kind !== 'table') throw new Error(`${action} só está disponível para tabelas.`)
    if (action === 'rename') {
      if (!newName?.trim() || newName.length > 64 || newName.includes('\0')) throw new Error('Nome novo inválido.')
      await driver.executeSql(target.connectionId, `RENAME TABLE ${quoteIdentifier(target.database)}.${quoteIdentifier(target.name)} TO ${quoteIdentifier(target.database)}.${quoteIdentifier(newName)}`)
    } else if (action === 'truncate') await driver.executeSql(target.connectionId, `TRUNCATE TABLE ${quoteIdentifier(target.database)}.${quoteIdentifier(target.name)}`)
    else await driver.executeSql(target.connectionId, dropObject({ kind: target.kind, name: target.name }, target.database))
    editorMetadataCache.invalidate(target.connectionId, target.database)
  })
}

async function writeRecoveryDdl(sql: string): Promise<string> {
  const directory = join(app.getPath('userData'), 'object-recovery')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const details = await lstat(directory)
  if (!details.isDirectory() || details.isSymbolicLink()) throw new Error('O diretório privado de recuperação não é seguro; a alteração foi cancelada.')
  await chmod(directory, 0o700)
  const path = join(directory, `${randomUUID()}.sql`)
  const file = await open(path, 'wx', 0o600)
  try { await file.writeFile(sql, 'utf8'); await file.chmod(0o600) }
  catch (error) { await unlink(path).catch(() => undefined); throw error }
  finally { await file.close() }
  return path
}

function validateTarget(target: ObjectEditorTarget): void {
  if (!target?.connectionId?.trim() || !target.database?.trim() || !target.name?.trim() || !kinds.includes(target.kind)) throw new Error('Selecione um objeto válido no Database Explorer.')
}

function ensureReplace(sql: string): string {
  return /^CREATE\s+OR\s+REPLACE\b/i.test(sql) ? sql : sql.replace(/^CREATE\s+/i, 'CREATE OR REPLACE ')
}

