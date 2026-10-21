export interface ExplorerMenuAction { type: 'action'; id: string; shortcut?: string }
export interface ExplorerMenuSeparator { type: 'separator' }
export interface ExplorerMenuSubmenu { type: 'submenu'; id: string; items: ExplorerMenuItem[] }
export type ExplorerMenuItem = ExplorerMenuAction | ExplorerMenuSeparator | ExplorerMenuSubmenu

const action = (id: string, shortcut?: string): ExplorerMenuAction => ({ type: 'action', id, ...(shortcut ? { shortcut } : {}) })
const separator: ExplorerMenuSeparator = { type: 'separator' }
const submenu = (id: string, items: ExplorerMenuItem[]): ExplorerMenuSubmenu => ({ type: 'submenu', id, items })
const destinations = (): ExplorerMenuItem[] => [action('newSqlWindow'), action('file'), action('clipboard')]
const scriptItem = (id: string): ExplorerMenuItem => submenu(id, destinations())
const scriptMenu = (): ExplorerMenuItem => submenu('generateScriptAs', [
  scriptItem('create'), scriptItem('drop'), scriptItem('dropAndCreate'), scriptItem('select'),
  scriptItem('insert'), scriptItem('update'), scriptItem('delete'), scriptItem('crud')
])
const sendTo = (): ExplorerMenuItem => submenu('sendTo', [
  action('queryBuilder'), action('masterDetail'), action('databaseDiagram'), action('dataReport'), action('chartDesigner'), action('pivotTable')
])
const commonObjectTail = (): ExplorerMenuItem[] => [
  sendTo(), action('editPrivileges'), action('showDetails'), separator,
  action('rename', 'F2'), action('deleteObject', 'Delete'), separator, action('refresh', 'F5'), action('properties', 'Ctrl+W, P')
]

export function explorerContextMenu(kind: 'table' | 'view' | 'procedure' | 'function' | 'trigger' | 'event' | 'database' | 'server'): ExplorerMenuItem[] {
  if (kind === 'table') return [
    action('newTable'), action('openEditor'), action('openData'), action('selectAllRows'), separator,
    action('exportData'), action('importData'), action('generateData'), action('tableMaintenance'), action('flush'), action('truncateTable'), separator,
    action('duplicateObject'), scriptMenu(), ...commonObjectTail()
  ]
  if (kind === 'view') return [
    action('openEditor'), action('openData'), action('selectAllRows'), separator, action('exportData'), scriptMenu(),
    sendTo(), action('editPrivileges'), action('showDetails'), separator, action('deleteObject', 'Delete'), separator, action('refresh', 'F5'), action('properties', 'Ctrl+W, P')
  ]
  if (kind === 'procedure' || kind === 'function' || kind === 'trigger' || kind === 'event') return [
    action('openEditor'), scriptMenu(), sendTo(), action('editPrivileges'), action('showDetails'), separator,
    action('deleteObject', 'Delete'), separator, action('refresh', 'F5'), action('properties', 'Ctrl+W, P')
  ]
  if (kind === 'database') return [
    action('newTable'), action('exportData'), action('importData'), action('generateData'), separator,
    scriptItem('create'), action('backup'), sendTo(), action('editPrivileges'), action('showDetails'), separator,
    action('refresh', 'F5'), action('properties', 'Ctrl+W, P')
  ]
  return [
    action('newDatabase'), action('newConnection'), separator, action('refresh', 'F5'), action('tableMaintenance'), action('flush'), sendTo(), separator,
    action('editPrivileges'), action('serverDetails'), action('properties', 'Ctrl+W, P')
  ]
}

export type ScriptKind = 'create' | 'drop' | 'dropAndCreate' | 'select' | 'insert' | 'update' | 'delete' | 'crud'
export function quoteExplorerIdentifier(value: string): string { return `\`${value.replaceAll('`', '``')}\`` }
export function buildExplorerSql(kind: ScriptKind, objectKind: string, database: string, name: string, createSql = ''): string {
  const target = `${quoteExplorerIdentifier(database)}.${quoteExplorerIdentifier(name)}`
  const dropVerb = objectKind === 'procedure' || objectKind === 'function' || objectKind === 'trigger' || objectKind === 'event' || objectKind === 'view' ? objectKind.toUpperCase() : 'TABLE'
  const create = createSql.trim() || `-- ${objectKind.toUpperCase()} ${target}\n`
  const select = `SELECT * FROM ${target};`
  const insert = `INSERT INTO ${target} (/* columns */) VALUES (/* values */);`
  const update = `UPDATE ${target} SET /* column = value */ WHERE /* condition */;`
  const remove = `DELETE FROM ${target} WHERE /* condition */;`
  const statements: Record<ScriptKind, string> = {
    create, drop: `DROP ${dropVerb} IF EXISTS ${target};`, dropAndCreate: `DROP ${dropVerb} IF EXISTS ${target};\n\n${create}`,
    select, insert, update, delete: remove, crud: [select, insert, update, remove].join('\n\n')
  }
  return statements[kind]
}
