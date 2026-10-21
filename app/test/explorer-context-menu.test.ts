import { describe, expect, it } from 'vitest'
import { buildExplorerSql, explorerContextMenu, explorerFolderContextMenu, type ExplorerMenuItem } from '../src/renderer/src/ui/components/explorerContextMenu.js'
import { navigationEnMessages, navigationPtBrMessages } from '../src/renderer/src/i18n/navigationMessages.js'

function menuPaths(items: ExplorerMenuItem[], prefix = ''): string[] {
  return items.flatMap((item) => item.type === 'separator'
    ? ['|']
    : item.type === 'submenu'
      ? [`${prefix}${item.id}>`, ...menuPaths(item.items, `${prefix}${item.id}.`)]
      : [`${prefix}${item.id}`])
}

describe('Database Explorer context menus', () => {
  it('keeps the table actions and nested script destinations in the requested order', () => {
    expect(menuPaths(explorerContextMenu('table'))).toEqual([
      'newTable', 'openEditor', 'openData', 'selectAllRows', '|', 'exportData', 'importData', 'generateData', 'tableMaintenance', 'flush', 'truncateTable', '|', 'duplicateObject',
      'generateScriptAs>', 'generateScriptAs.create>', 'generateScriptAs.create.newSqlWindow', 'generateScriptAs.create.file', 'generateScriptAs.create.clipboard',
      'generateScriptAs.drop>', 'generateScriptAs.drop.newSqlWindow', 'generateScriptAs.drop.file', 'generateScriptAs.drop.clipboard',
      'generateScriptAs.dropAndCreate>', 'generateScriptAs.dropAndCreate.newSqlWindow', 'generateScriptAs.dropAndCreate.file', 'generateScriptAs.dropAndCreate.clipboard',
      'generateScriptAs.select>', 'generateScriptAs.select.newSqlWindow', 'generateScriptAs.select.file', 'generateScriptAs.select.clipboard',
      'generateScriptAs.insert>', 'generateScriptAs.insert.newSqlWindow', 'generateScriptAs.insert.file', 'generateScriptAs.insert.clipboard',
      'generateScriptAs.update>', 'generateScriptAs.update.newSqlWindow', 'generateScriptAs.update.file', 'generateScriptAs.update.clipboard',
      'generateScriptAs.delete>', 'generateScriptAs.delete.newSqlWindow', 'generateScriptAs.delete.file', 'generateScriptAs.delete.clipboard',
      'generateScriptAs.crud>', 'generateScriptAs.crud.newSqlWindow', 'generateScriptAs.crud.file', 'generateScriptAs.crud.clipboard',
      'sendTo>', 'sendTo.queryBuilder', 'sendTo.masterDetail', 'sendTo.databaseDiagram', 'sendTo.dataReport', 'sendTo.chartDesigner', 'sendTo.pivotTable',
      'editPrivileges', 'showDetails', '|', 'rename', 'deleteObject', '|', 'refresh', 'properties'
    ])
  })

  it('provides object-specific menus for the other Explorer node types', () => {
    expect(menuPaths(explorerContextMenu('view'))).toContain('openData')
    for (const kind of ['procedure', 'function', 'trigger', 'event'] as const) {
      expect(menuPaths(explorerContextMenu(kind))).toContain('openEditor')
      expect(menuPaths(explorerContextMenu(kind))).toContain('deleteObject')
    }
    expect(menuPaths(explorerContextMenu('database'))).toEqual(['newObject>', 'newObject.createTable', 'newObject.createView', 'newObject.createProcedure', 'newObject.createFunction', 'newObject.createTrigger', 'newObject.createEvent', 'openEditor', 'generateScriptAs>', 'generateScriptAs.create>', 'generateScriptAs.create.newSqlWindow', 'generateScriptAs.create.file', 'generateScriptAs.create.clipboard', 'generateScriptAs.drop>', 'generateScriptAs.drop.newSqlWindow', 'generateScriptAs.drop.file', 'generateScriptAs.drop.clipboard', 'generateScriptAs.dropAndCreate>', 'generateScriptAs.dropAndCreate.newSqlWindow', 'generateScriptAs.dropAndCreate.file', 'generateScriptAs.dropAndCreate.clipboard', 'generateScriptAs.select>', 'generateScriptAs.select.newSqlWindow', 'generateScriptAs.select.file', 'generateScriptAs.select.clipboard', 'generateScriptAs.insert>', 'generateScriptAs.insert.newSqlWindow', 'generateScriptAs.insert.file', 'generateScriptAs.insert.clipboard', 'generateScriptAs.update>', 'generateScriptAs.update.newSqlWindow', 'generateScriptAs.update.file', 'generateScriptAs.update.clipboard', 'generateScriptAs.delete>', 'generateScriptAs.delete.newSqlWindow', 'generateScriptAs.delete.file', 'generateScriptAs.delete.clipboard', 'generateScriptAs.crud>', 'generateScriptAs.crud.newSqlWindow', 'generateScriptAs.crud.file', 'generateScriptAs.crud.clipboard', '|', 'backup', 'showDetails', 'refresh'])
    expect(menuPaths(explorerContextMenu('server'))).toEqual(['modifyConnection', 'createConnectionLike', 'newDatabase', '|', 'close'])
    expect(menuPaths(explorerFolderContextMenu('procedure'))).toEqual(['createProcedure', 'filter', 'showDetails', 'refresh'])
  })

  it('offers full script generation and send-to destinations across object contexts', () => {
    for (const kind of ['table', 'view', 'procedure', 'function', 'trigger', 'event'] as const) {
      const paths = menuPaths(explorerContextMenu(kind))
      expect(paths).toContain('generateScriptAs.dropAndCreate.clipboard')
      expect(paths).toContain('generateScriptAs.crud.file')
      expect(paths).toContain('sendTo.databaseDiagram')
    }
    expect(menuPaths(explorerContextMenu('server'))).toContain('createConnectionLike')
  })

  it('has translated labels for every menu item in English and Brazilian Portuguese', () => {
    const ids = new Set<string>()
    const collect = (items: ExplorerMenuItem[]): void => { for (const item of items) { if (item.type === 'separator') continue; ids.add(item.id); if (item.type === 'submenu') collect(item.items) } }
    for (const kind of ['table', 'view', 'procedure', 'function', 'trigger', 'event', 'database', 'server'] as const) collect(explorerContextMenu(kind))
    collect(explorerFolderContextMenu('table'))
    for (const id of ids) {
      expect(navigationEnMessages[`explorer.menu.${id}`], `missing en label for ${id}`).toBeTruthy()
      expect(navigationPtBrMessages[`explorer.menu.${id}`], `missing pt-BR label for ${id}`).toBeTruthy()
    }
  })

  it('quotes object identifiers and generates the requested DML templates', () => {
    expect(buildExplorerSql('select', 'table', 'order`data', 'line items')).toBe('SELECT * FROM `order``data`.`line items`;')
    expect(buildExplorerSql('crud', 'table', 'app', 'customers')).toContain('INSERT INTO `app`.`customers`')
    expect(buildExplorerSql('dropAndCreate', 'view', 'app', 'active customers', 'CREATE VIEW `active customers` AS SELECT 1;')).toContain('DROP VIEW IF EXISTS `app`.`active customers`;')
  })
})
