import { BrowserWindow, ipcMain, type IpcMain } from 'electron'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type Kind = 'id' | 'text' | 'identifier' | 'sql' | 'path' | 'relative-path' | 'boolean' | 'true' | 'number' | 'integer' | 'object' | 'nullable-object' | 'array-text' | 'array-null-text' | 'array-int' | 'array-object' | 'string-number' | 'enum'
interface Spec { kind: Kind; optional?: boolean; values?: readonly string[]; maxItems?: number }
const s = (kind: Kind, options: Omit<Spec, 'kind'> = {}): Spec => ({ kind, ...options })
const opt = (spec: Spec): Spec => ({ ...spec, optional: true })
const id = s('id')
const text = s('text')
const ident = s('identifier')
const sql = s('sql')
const path = s('path')
const bool = s('boolean')
const trueOnly = s('true')
const integer = s('integer')
const object = s('object')
const strings = s('array-text', { maxItems: 10000 })
const objects = s('array-object', { maxItems: 10000 })
const intArray = s('array-int', { maxItems: 1000 })
const enumOf = (...values: string[]): Spec => s('enum', { values })
const scope = enumOf('GLOBAL', 'SESSION')
const fileFormat = enumOf('csv', 'text', 'json', 'xml', 'sql', 'xlsx')
const outputFormat = enumOf('csv', 'text', 'json', 'xml', 'sql', 'xlsx', 'html', 'pdf')

/** Runtime argument contracts for every invoke channel. Structured records are recursively size/type checked below. */
export const IPC_CHANNEL_SCHEMAS: Readonly<Record<string, readonly Spec[]>> = {
  'app:renderer-ready': [],
  'about:info': [], 'about:open-link': [enumOf('documentation', 'repository', 'license')],
  'ai-assistant:settings:load': [], 'ai-assistant:settings:save': [object, opt(s('text'))], 'ai-assistant:settings:test': [object, opt(s('text'))],
  'ai-assistant:complete': [object], 'ai-assistant:cancel': [id], 'code-analysis:run': [sql],
  'connections:list': [], 'connections:save': [object], 'connections:delete': [id], 'vault:save': [ident, s('text')], 'vault:delete': [ident], 'vault:status': [],
  'data-compare:compare': [id, ident, ident, id, ident, ident, strings, opt(strings), opt(bool), opt(object)],
  'data-compare:synchronize': [id, ident, ident, id, ident, ident, strings, strings, bool, trueOnly, opt(objects), opt(object)],
  'data-generator:inspect': [id, ident], 'data-generator:preview': [id, ident, ident, object, opt(s('string-number'))], 'data-generator:generate': [object],
  'report-pivot:load': [id, sql], 'report-pivot:build': [id, object], 'report-pivot:export': [object, enumOf('csv', 'xlsx')],
  'database-tools:search': [id, ident, text, object], 'database-tools:invalid': [id, ident], 'database-tools:backup': [id, ident, bool], 'database-tools:select-backup': [],
  'database-tools:backup-directory': [], 'database-tools:backup-project:save': [object], 'database-tools:backup-project:load': [], 'database-tools:backup:run': [id, ident, object, id], 'database-tools:backup:cancel': [id], 'database-tools:restore:select-file': [], 'database-tools:restore:preview': [id, text], 'database-tools:restore:run-selected': [id, ident, text, id, text, enumOf('abort', 'ignore', 'log'), id], 'database-tools:restore:cancel': [id],
  'database-tools:format-select': [bool], 'database-tools:format-run': [s('array-text', { maxItems: 1000 }), bool, bool, object], 'database-tools:format-preview': [s('array-text', { maxItems: 1000 }), bool, object], 'database-tools:large-select': [], 'database-tools:large-run': [id, text, path, enumOf('utf8', 'utf16le', 'latin1', 'windows1252'), id], 'database-tools:large-cancel': [id], 'database-tools:large-error-action': [id, enumOf('stop', 'continue', 'ignore-all')],
  'database-tools:maintenance': [id, ident, enumOf('ANALYZE', 'OPTIMIZE', 'CHECK', 'REPAIR', 'CHECKSUM'), strings],
  'database-tools:restore': [id, ident, text, sql, opt(bool)], 'database-tools:copy': [id, ident, id, ident, text, bool, opt(bool)],
  'database-tools:schedule:list': [], 'database-tools:schedule:save': [object], 'database-tools:schedule:delete': [id],
  'db:test': [object], 'db:connect': [object], 'db:disconnect': [id], 'db:databases': [id], 'db:execute': [id, sql, opt(id), opt(ident)],
  'grid-editing:describe': [id, sql, opt(ident)], 'grid-editing:preview': [object, objects], 'grid-editing:apply': [id, object, objects, bool],
  'grid-data:master-detail': [id, object, object],
  'db:result-read': [id, integer, integer], 'db:result-dispose': [id], 'db:cancel': [id, id], 'db:transaction-begin': [id], 'db:transaction-commit': [id], 'db:transaction-rollback': [id],
  'db:tables': [id, ident], 'db:objects': [id, ident], 'db:show-create': [id, ident, object], 'db:set-database': [id, ident],
  'file:open-sql': [], 'file:open-sql-path': [path], 'file:reveal-path': [path], 'file:save-sql': [opt(path), sql],
  'documenter:tree': [id, ident], 'documenter:preview': [id, ident, opt(text)], 'documenter:generate': [object], 'documenter:open': [path], 'editor:metadata': [id, ident, opt(bool)], 'editor:invalidate-metadata': [id, opt(ident)],
  'er-diagram:load': [id, ident, id], 'er-diagram:save-relations': [id, ident, objects], 'er-diagram:save-file': [object], 'er-diagram:open-file': [],
  'schema-update:list': [], 'schema-update:queue': [object], 'schema-update:queue-table': [id, ident, s('nullable-object'), object], 'schema-update:remove': [strings], 'schema-update:execute': [strings, trueOnly],
  'snippets:list': [], 'snippets:save': [object], 'snippets:delete': [id], 'snippets:import': [enumOf('en', 'pt-BR')], 'snippets:export': [enumOf('en', 'pt-BR')],
  'history:list': [opt(object)], 'history:record': [object],
  'updater:check': [], 'updater:apply': [object], 'updater:cancel': [], 'updater:status': [],
  'import-export:export': [id, sql, outputFormat, opt(object), opt(id)], 'import-export:select-source': [id, fileFormat, opt(object)], 'import-export:preview-export': [id, sql, id],
  'import-export:import': [id, ident, fileFormat, enumOf('append', 'upsert', 'update', 'delete', 'repopulate'), strings, opt(object), opt(id)], 'import-export:cancel': [id], 'import-export:templates:list': [],
  'import-export:script': [ident, fileFormat, enumOf('append', 'upsert', 'update', 'delete', 'repopulate'), strings, opt(object), opt(id)],
  'import-export:templates:save': [object], 'import-export:templates:delete': [id], 'import-export:save-log': [sql],
  'object-editor:load': [object], 'object-editor:apply-table': [id, ident, s('nullable-object'), object], 'object-editor:apply': [object, sql],
  'object-editor:mutate': [object, enumOf('drop', 'rename', 'truncate'), opt(ident)],
  'options:load': [], 'options:save': [object], 'options:reset': [], 'options:export': [object], 'options:import': [],
  'profiler:profile': [id, sql], 'profiler:explain': [id, sql], 'profiler:history': [id], 'profiler:clear-history': [id, trueOnly], 'profiler:status': [id],
  'query-builder:schema': [id, ident], 'query-builder:build': [object], 'query-builder:parse': [sql, opt(ident)], 'query-builder:execute': [id, object, opt(bool), opt(id)], 'query-builder:cancel': [id],
  'routine-debugger:engine:inspect': [id], 'routine-debugger:engine:deploy': [id, trueOnly], 'routine-debugger:engine:remove': [id, trueOnly], 'routine-debugger:compile': [object],
  'routine-debugger:start': [object, s('array-null-text', { maxItems: 64 }), objects, bool, bool, opt(text)], 'routine-debugger:command': [id, enumOf('into', 'over', 'out', 'continue', 'stop'), opt(integer)],
  'routine-debugger:breakpoints': [id, objects], 'routine-debugger:watches': [id, strings], 'routine-debugger:snapshot': [id],
  'schema-compare:inspect': [id, ident], 'schema-compare:compare': [id, ident, id, ident, opt(bool)], 'schema-compare:load-offline': [enumOf('Scripts Folder', 'Snapshot')], 'schema-compare:compare-models': [object, object, opt(bool)], 'schema-compare:save-snapshot': [id, ident], 'schema-compare:synchronize': [id, ident, sql, trueOnly],
  'security:accounts': [id], 'security:details': [id, object], 'security:preview': [id, objects], 'security:apply': [id, objects, trueOnly],
  'service-control:list': [], 'service-control:action': [ident, enumOf('start', 'stop', 'restart')],
  'sessions:list': [id, opt(object)], 'sessions:details': [id, integer], 'sessions:kill': [id, intArray, enumOf('connection', 'query'), trueOnly],
  'sessions:variables': [id, opt(scope)], 'sessions:status': [id, opt(scope)], 'sessions:set-variable': [id, object, object],
  'source-control:choose-repository': [], 'source-control:choose-project-folder': [], 'source-control:clone-repository': [text, path, ident], 'source-control:link-database': [object], 'source-control:has-remote': [path],
  'source-control:status': [path], 'source-control:init': [path], 'source-control:diff': [path, opt(s('relative-path')), opt(bool)],
  'source-control:commit': [path, text, strings], 'source-control:branches': [path], 'source-control:create-branch': [path, ident], 'source-control:checkout-branch': [path, ident],
  'source-control:delete-branch': [path, ident, trueOnly], 'source-control:fetch': [path], 'source-control:pull': [path, trueOnly], 'source-control:push': [path, trueOnly],
  'source-control:log': [path, opt(integer), opt(s('relative-path'))], 'source-control:commit-diff': [path, ident, opt(s('relative-path'))], 'source-control:create-project': [text],
  'source-control:open-project': [], 'source-control:open-project-path': [path], 'source-control:recent-projects': [], 'source-control:close-project': [path],
  'source-control:project-files': [path], 'source-control:read-scripts': [path, strings], 'source-control:apply-scripts': [id, ident, objects, trueOnly],
  'source-control:add-file': [path], 'source-control:write-script': [path, s('relative-path'), sql], 'source-control:export-schema': [id, ident, opt(path)]
}

export interface TrustedRendererConfig { rendererFile: string; rendererUrl?: string }
export interface GuardEvent { sender: { id: number; mainFrame: { url: string } }; senderFrame: { url: string } | null }
export type GuardListener = (event: GuardEvent, ...args: unknown[]) => unknown
const WINDOW_MS = 60_000
const rateHistory = new Map<string, number[]>()
const guardedIpcInstances = new WeakSet<object>()

function fail(message: string): never { throw new TypeError(`IPC payload rejected: ${message}`) }

function assertStructured(value: unknown, state: { bytes: number; nodes: number }, depth = 0): void {
  state.nodes++
  if (state.nodes > 50_000 || depth > 20) fail('payload nesting or item budget exceeded')
  if (value === null || typeof value === 'boolean' || typeof value === 'undefined') { state.bytes += 4; return }
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('non-finite number'); state.bytes += 8; return }
  if (typeof value === 'string') { if (value.length > 1_000_000) fail('string too long'); state.bytes += value.length * 2; return }
  if (Array.isArray(value)) {
    if (value.length > 10_000) fail('array too large')
    for (const child of value) assertStructured(child, state, depth + 1)
    return
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) fail('value must be structured-clone data')
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length > 1_000) fail('object has too many properties')
    for (const [key, child] of entries) {
      if (key.length > 256 || key.includes('\0')) fail('invalid property name')
      if (typeof child === 'string' && /(?:path|directory|folder)$/i.test(key) && child && !isAbsolute(child)) fail(`${key} must be an absolute path`)
      state.bytes += key.length * 2
      assertStructured(child, state, depth + 1)
    }
    return
  }
  fail('unsupported payload value')
}

function assertSpec(value: unknown, spec: Spec, label: string): void {
  if (value === undefined && spec.optional) return
  if (value === undefined) fail(`${label} is required`)
  const stringValue = (): string => {
    if (typeof value !== 'string' || value.includes('\0')) fail(`${label} must be a string`)
    return value
  }
  switch (spec.kind) {
    case 'id': { const v = stringValue(); if (!v || v.length > 128) fail(`${label} has invalid id length`); break }
    case 'text': { const v = stringValue(); if (v.length > 8_192) fail(`${label} is too long`); break }
    case 'identifier': { const v = stringValue(); if (!v || v.length > 256) fail(`${label} has invalid identifier length`); break }
    case 'sql': { const v = stringValue(); if (v.length > 20 * 1024 * 1024) fail(`${label} exceeds SQL size limit`); break }
    case 'path': { const v = stringValue(); if (!v || v.length > 4_096 || !isAbsolute(v)) fail(`${label} must be an absolute path`); break }
    case 'relative-path': {
      const v = stringValue()
      if (!v || v.length > 1_024 || isAbsolute(v) || v.split(/[\\/]/).includes('..')) fail(`${label} must be a confined relative path`)
      break
    }
    case 'boolean': if (typeof value !== 'boolean') fail(`${label} must be boolean`); break
    case 'true': if (value !== true) fail(`${label} requires explicit confirmation`); break
    case 'number': if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be finite number`); break
    case 'integer': if (!Number.isSafeInteger(value) || Number(value) < 0) fail(`${label} must be a non-negative integer`); break
    case 'object':
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`)
      break
    case 'nullable-object': if (value !== null) assertSpec(value, { ...spec, kind: 'object' }, label); break
    case 'array-text': case 'array-null-text': case 'array-int': case 'array-object': {
      if (!Array.isArray(value) || value.length > (spec.maxItems ?? 1_000)) fail(`${label} must be a bounded array`)
      const item = spec.kind === 'array-text' || spec.kind === 'array-null-text' ? text : spec.kind === 'array-int' ? integer : object
      for (let index = 0; index < value.length; index++) if (!(spec.kind === 'array-null-text' && value[index] === null)) assertSpec(value[index], item, `${label}[${index}]`)
      break
    }
    case 'string-number': if (!(typeof value === 'string' && value.length <= 128) && !(typeof value === 'number' && Number.isFinite(value))) fail(`${label} must be string or finite number`); break
    case 'enum': if (typeof value !== 'string' || !spec.values?.includes(value)) fail(`${label} is not an allowed value`); break
  }
}

function assertRecord(value: unknown, label: string, required: readonly string[], allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail(`${label} must be a plain record`)
  const record = value as Record<string, unknown>
  for (const key of required) if (!Object.hasOwn(record, key)) fail(`${label}.${key} is required`)
  for (const key of Object.keys(record)) if (!allowed.includes(key)) fail(`${label}.${key} is not allowed`)
  return record
}
function assertStringArray(value: unknown, label: string, maximum = 1000): asserts value is string[] {
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => typeof item !== 'string' || item.length > 256)) fail(`${label} must be a bounded string array`)
}
function assertDomainPayload(channel: string, args: readonly unknown[]): void {
  if (channel.startsWith('object-editor:')) {
    const index = channel === 'object-editor:apply-table' ? -1 : 0
    if (index >= 0) assertObjectEditorTarget(args[index], 'target')
    else {
      const table = assertRecord(args[3], 'target', ['kind', 'name', 'columns', 'indexes', 'foreignKeys', 'checks'], ['kind', 'name', 'columns', 'indexes', 'foreignKeys', 'checks', 'engine', 'charset', 'collation', 'comment', 'options', 'partitioning'])
      if (table.kind !== 'table' || typeof table.name !== 'string' || table.name.length > 64) fail('table draft identity is invalid')
    }
  } else if (channel === 'security:details') {
    const account = assertRecord(args[1], 'account', ['user', 'host'], ['user', 'host'])
    if (typeof account.user !== 'string' || account.user.length > 128 || typeof account.host !== 'string' || account.host.length > 255) fail('account reference is invalid')
  } else if (channel === 'security:preview' || channel === 'security:apply') {
    if (!Array.isArray(args[1]) || args[1].length > 500) fail('security changes must be a bounded array')
    ;(args[1] as unknown[]).forEach((item, index) => assertSecurityChange(item, `changes[${index}]`))
  } else if (channel === 'routine-debugger:compile' || channel === 'routine-debugger:start') {
    const target = assertRecord(args[0], 'target', ['connectionId', 'database', 'name'], ['connectionId', 'database', 'name', 'kind'])
    if (typeof target.connectionId !== 'string' || !target.connectionId || typeof target.database !== 'string' || !target.database || typeof target.name !== 'string' || !target.name || target.name.length > 64 || target.database.length > 64 || (target.kind !== undefined && !['procedure', 'trigger'].includes(String(target.kind)))) fail('debug target is invalid')
    const trigger = target.kind === 'trigger'
    if (channel === 'routine-debugger:start' && trigger) {
      const statement = args[5]
      if (typeof statement !== 'string' || statement.length > 100_000 || !/^(?:\s*)(?:INSERT\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\b/i.test(statement) || /;/.test(statement.replace(/;\s*$/, '')) || /--|#|\/\*/.test(statement)) fail('trigger debugging needs one bounded DML statement without comments')
    }
  } else if (channel === 'grid-editing:apply') {
    const descriptor = assertRecord(args[1], 'descriptor', ['database', 'table', 'keyColumns', 'columns'], ['database', 'table', 'keyColumns', 'columns', 'reason'])
    for (const key of ['database', 'table']) if (typeof descriptor[key] !== 'string' || !descriptor[key]) fail(`descriptor.${key} must be non-empty text`)
    assertStringArray(descriptor.keyColumns, 'descriptor.keyColumns', 256)
    if (!Array.isArray(descriptor.columns) || descriptor.columns.length > 512) fail('descriptor.columns must be bounded')
    const columnNames = new Set<string>()
    descriptor.columns.forEach((item, index) => {
      const column = assertRecord(item, `descriptor.columns[${index}]`, ['name', 'dataType', 'columnType', 'nullable', 'defaultValue', 'extra'], ['name', 'dataType', 'columnType', 'nullable', 'defaultValue', 'extra'])
      if (['name', 'dataType', 'columnType', 'extra'].some((key) => typeof column[key] !== 'string') || typeof column.nullable !== 'boolean') fail(`descriptor.columns[${index}] has invalid fields`)
      columnNames.add(String(column.name))
    })
    const changes = args[2]
    if (!Array.isArray(changes) || changes.length > 10_000) fail('changes must be bounded')
    changes.forEach((item, index) => {
      const change = assertRecord(item, `changes[${index}]`, ['kind'], ['kind', 'original', 'values'])
      if (!['insert', 'update', 'delete'].includes(String(change.kind))) fail(`changes[${index}].kind is invalid`)
      if (change.kind !== 'insert') assertRecord(change.original, `changes[${index}].original`, [], [...columnNames])
      if (change.kind !== 'delete') assertRecord(change.values, `changes[${index}].values`, [], [...columnNames])
      if (change.kind === 'update' && (!change.original || !change.values)) fail(`changes[${index}] needs original and values`)
      if (change.kind === 'insert' && !change.values) fail(`changes[${index}] needs values`)
      if (change.kind === 'delete' && !change.original) fail(`changes[${index}] needs original`)
    })
  } else if (channel === 'report-pivot:build') {
    const config = assertRecord(args[1], 'config', ['rows', 'columns', 'values'], ['rows', 'columns', 'values', 'filters', 'rowTotals', 'columnTotals', 'grandTotal', 'subtotals'])
    for (const key of ['rows', 'columns']) {
      if (!Array.isArray(config[key]) || (config[key] as unknown[]).length > 128) fail(`config.${key} must be bounded`)
      ;(config[key] as unknown[]).forEach((item, index) => {
        const field = assertRecord(item, `${key}[${index}]`, ['field'], ['field', 'label', 'grouping', 'interval'])
        if (typeof field.field !== 'string' || field.field.length > 256) fail(`${key}[${index}].field is invalid`)
      })
    }
    if (!Array.isArray(config.values) || !config.values.length || config.values.length > 64) fail('config.values must contain bounded fields')
    ;(config.values as unknown[]).forEach((item, index) => {
      const field = assertRecord(item, `values[${index}]`, ['field', 'aggregation'], ['field', 'label', 'aggregation'])
      if (typeof field.field !== 'string' || !['sum', 'count', 'average', 'min', 'max', 'stddev', 'distinct-count'].includes(String(field.aggregation))) fail(`values[${index}] is invalid`)
    })
    for (const key of ['rowTotals', 'columnTotals', 'grandTotal', 'subtotals']) if (config[key] !== undefined && typeof config[key] !== 'boolean') fail(`config.${key} must be boolean`)
  } else if (channel === 'schema-compare:compare-models') {
    for (const [index, model] of [args[0], args[1]].entries()) {
      const schema = assertRecord(model, `model[${index}]`, ['kind', 'name', 'tables', 'views', 'procedures', 'functions', 'triggers', 'events'], ['kind', 'name', 'charset', 'collation', 'tables', 'views', 'procedures', 'functions', 'triggers', 'events'])
      if (schema.kind !== 'database' || typeof schema.name !== 'string' || schema.name.length > 256) fail(`model[${index}] identity is invalid`)
      for (const key of ['tables', 'views', 'procedures', 'functions', 'triggers', 'events']) {
        if (!Array.isArray(schema[key]) || (schema[key] as unknown[]).length > 10_000) fail(`model[${index}].${key} must be bounded`)
        ;(schema[key] as unknown[]).forEach((item, objectIndex) => {
          const kind = key === 'tables' ? 'table' : key === 'views' ? 'view' : key === 'procedures' ? 'procedure' : key === 'functions' ? 'function' : key === 'triggers' ? 'trigger' : 'event'
          const allowed = kind === 'table' ? ['kind', 'name', 'createSql', 'columns', 'indexes', 'foreignKeys', 'checks', 'partitions', 'partitioning', 'engine', 'charset', 'collation', 'comment', 'options']
            : kind === 'view' ? ['kind', 'name', 'createSql', 'definition', 'algorithm', 'definer', 'security', 'checkOption', 'columns']
              : kind === 'procedure' || kind === 'function' ? ['kind', 'name', 'createSql', 'definition', 'definer', 'security', 'sqlDataAccess', 'deterministic', 'comment', 'parameters', 'returnType']
                : kind === 'trigger' ? ['kind', 'name', 'createSql', 'table', 'timing', 'event', 'definition', 'definer']
                  : ['kind', 'name', 'createSql', 'definition', 'status', 'schedule', 'definer']
          const object = assertRecord(item, `${key}[${objectIndex}]`, ['kind', 'name'], allowed)
          if (typeof object.kind !== 'string' || typeof object.name !== 'string' || object.name.length > 256) fail(`${key}[${objectIndex}] identity is invalid`)
          if (object.kind !== kind) fail(`${key}[${objectIndex}].kind does not match its collection`)
        })
      }
    }
  } else if ((channel === 'import-export:import' || channel === 'import-export:script' || channel === 'import-export:select-source') && args[channel === 'import-export:import' ? 5 : channel === 'import-export:script' ? 4 : 2] !== undefined) {
    const optionsIndex = channel === 'import-export:import' ? 5 : channel === 'import-export:script' ? 4 : 2
    const options = assertRecord(args[optionsIndex], 'import options', [], ['delimiter', 'quote', 'encoding', 'header', 'skipLines', 'headerPosition', 'autoDelimiter', 'columns', 'columnMapping', 'createTable', 'mode', 'keyColumns', 'batchSize', 'onRowError', 'transactional', 'previewRows', 'rowElement', 'nullValue', 'nullString'])
    if (options.delimiter !== undefined && (typeof options.delimiter !== 'string' || options.delimiter.length > 8)) fail('import delimiter is invalid')
    if (options.encoding !== undefined && !['utf8', 'utf16le', 'latin1'].includes(String(options.encoding))) fail('import encoding is invalid')
    if (options.header !== undefined && typeof options.header !== 'boolean') fail('import header must be boolean')
    if (options.skipLines !== undefined && (!Number.isSafeInteger(options.skipLines) || Number(options.skipLines) < 0 || Number(options.skipLines) > 100_000)) fail('import skipLines is invalid')
    if (options.headerPosition !== undefined && (!Number.isSafeInteger(options.headerPosition) || Number(options.headerPosition) < 1 || Number(options.headerPosition) > 100_000)) fail('import headerPosition is invalid')
    if (options.autoDelimiter !== undefined && typeof options.autoDelimiter !== 'boolean') fail('import autoDelimiter must be boolean')
    if (options.columns !== undefined) assertStringArray(options.columns, 'import columns', 1000)
    if (options.keyColumns !== undefined) assertStringArray(options.keyColumns, 'import keyColumns', 256)
    if (options.columnMapping !== undefined) assertRecord(options.columnMapping, 'import columnMapping', [], Object.keys((options.columnMapping ?? {}) as object))
    if (options.columnMapping && Object.values(options.columnMapping as Record<string, unknown>).some((value) => typeof value !== 'string' || value.length > 256)) fail('import columnMapping values must be text')
    if (options.createTable !== undefined) {
      const schema = assertRecord(options.createTable, 'import createTable', ['database', 'name', 'columns'], ['database', 'name', 'columns'])
      if (typeof schema.database !== 'string' || !schema.database || schema.database.length > 256 || typeof schema.name !== 'string' || !schema.name || schema.name.length > 256 || !Array.isArray(schema.columns) || !schema.columns.length || schema.columns.length > 1000) fail('import createTable identity or columns are invalid')
      ;(schema.columns as unknown[]).forEach((item, index) => {
        const column = assertRecord(item, `import createTable.columns[${index}]`, ['name', 'type', 'primaryKey'], ['name', 'type', 'primaryKey'])
        if (typeof column.name !== 'string' || !column.name || column.name.length > 64 || typeof column.type !== 'string' || !/^(?:INT|BIGINT|DECIMAL\((?:[1-9]\d?|[1-5]\d|65),(?:0|[1-9]\d?|30)\)|DATETIME|TEXT|JSON|VARCHAR\((?:[1-9]\d{0,3}|10000)\))$/i.test(column.type) || typeof column.primaryKey !== 'boolean') fail(`import createTable.columns[${index}] is invalid`)
      })
    }
    if (options.batchSize !== undefined && (!Number.isSafeInteger(options.batchSize) || Number(options.batchSize) < 1 || Number(options.batchSize) > 100_000)) fail('import batchSize is invalid')
  } else if (channel === 'database-tools:backup:run') {
    const options = assertRecord(args[2], 'backup options', ['includeStructure', 'includeData', 'objectKinds', 'singleTransaction', 'includeRoutines', 'includeTriggers', 'includeEvents', 'extendedInserts', 'charset', 'includeDefiner', 'includeDrop', 'dropIfExists', 'includeUse', 'noAutoValueOnZero', 'lockTables', 'flushLogs', 'errorPolicy', 'directory', 'fileName', 'appendTimestamp', 'autoDeleteDays', 'autoDeleteCount', 'zip', 'compressionLevel', 'comment'], ['includeStructure', 'includeData', 'objectKinds', 'singleTransaction', 'includeRoutines', 'includeTriggers', 'includeEvents', 'extendedInserts', 'charset', 'includeDefiner', 'includeDrop', 'dropIfExists', 'includeUse', 'noAutoValueOnZero', 'lockTables', 'flushLogs', 'errorPolicy', 'directory', 'fileName', 'appendTimestamp', 'autoDeleteDays', 'autoDeleteCount', 'zip', 'compressionLevel', 'comment', 'password'])
    for (const key of ['includeStructure', 'includeData', 'singleTransaction', 'includeRoutines', 'includeTriggers', 'includeEvents', 'extendedInserts', 'includeDefiner', 'includeDrop', 'dropIfExists', 'includeUse', 'noAutoValueOnZero', 'lockTables', 'flushLogs', 'appendTimestamp', 'zip']) if (typeof options[key] !== 'boolean') fail(`backup options.${key} must be boolean`)
    if (!Array.isArray(options.objectKinds) || options.objectKinds.length > 6 || options.objectKinds.some((kind) => !['table', 'view', 'procedure', 'function', 'trigger', 'event'].includes(String(kind)))) fail('backup options.objectKinds is invalid')
    if (typeof options.directory !== 'string' || !isAbsolute(options.directory) || typeof options.fileName !== 'string' || options.fileName.length > 180 || typeof options.charset !== 'string' || options.charset.length > 32 || typeof options.comment !== 'string' || options.comment.length > 60_000) fail('backup text options are invalid')
    if (!['abort', 'ignore', 'log'].includes(String(options.errorPolicy)) || !Number.isInteger(options.autoDeleteDays) || Number(options.autoDeleteDays) < 0 || !Number.isInteger(options.autoDeleteCount) || Number(options.autoDeleteCount) < 0 || !Number.isInteger(options.compressionLevel) || Number(options.compressionLevel) < 0 || Number(options.compressionLevel) > 9) fail('backup numeric or enum options are invalid')
    if (options.password !== undefined && (typeof options.password !== 'string' || options.password.length < 8 || options.password.length > 1024)) fail('backup password is invalid')
    if (!options.includeStructure && !options.includeData) fail('backup must include structure or data')
  }
}

function assertObjectEditorTarget(value: unknown, label: string): void {
  const target = assertRecord(value, label, ['connectionId', 'database', 'kind', 'name'], ['connectionId', 'database', 'kind', 'name'])
  if (typeof target.connectionId !== 'string' || !target.connectionId || target.connectionId.length > 256 || typeof target.database !== 'string' || !target.database || target.database.length > 64 || typeof target.name !== 'string' || !target.name || target.name.length > 64 || !['database', 'table', 'view', 'procedure', 'function', 'trigger', 'event'].includes(String(target.kind))) fail(`${label} identity is invalid`)
}

function assertSecurityChange(value: unknown, label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be a record`)
  const change = value as Record<string, unknown>
  const kind = change.kind
  const keys: Record<string, readonly string[]> = {
    createUser: ['kind', 'account', 'password'], alterUser: ['kind', 'account', 'changes', 'password'], dropUser: ['kind', 'account'],
    grant: ['kind', 'privileges', 'scope', 'grantee', 'grantOption'], revoke: ['kind', 'privileges', 'scope', 'grantee', 'grantOptionOnly'],
    grantRole: ['kind', 'role', 'grantee', 'default'], revokeRole: ['kind', 'role', 'grantee']
  }
  const allowed = keys[String(kind)]
  if (!allowed) fail(`${label}.kind is invalid`)
  for (const key of Object.keys(change)) if (!allowed.includes(key)) fail(`${label}.${key} is not allowed`)
  const accountRef = (input: unknown, path: string, userFields: boolean): void => {
    const fields = userFields ? ['user', 'host', 'plugin', 'locked', 'passwordExpired', 'sslType', 'sslIssuer', 'sslSubject', 'comment', 'limits', 'isRole'] : ['user', 'host']
    const record = assertRecord(input, path, ['user', 'host'], fields)
    if (typeof record.user !== 'string' || !record.user || record.user.length > 128 || typeof record.host !== 'string' || !record.host || record.host.length > 255) fail(`${path} identity is invalid`)
    for (const key of ['plugin', 'sslType', 'sslIssuer', 'sslSubject', 'comment']) if (record[key] !== undefined && (typeof record[key] !== 'string' || record[key].length > 1024)) fail(`${path}.${key} is invalid`)
    for (const key of ['locked', 'passwordExpired', 'isRole']) if (record[key] !== undefined && typeof record[key] !== 'boolean') fail(`${path}.${key} must be boolean`)
    if (record.limits !== undefined) {
      const limits = assertRecord(record.limits, `${path}.limits`, [], ['MAX_QUERIES_PER_HOUR', 'MAX_UPDATES_PER_HOUR', 'MAX_CONNECTIONS_PER_HOUR', 'MAX_USER_CONNECTIONS'])
      for (const [key, item] of Object.entries(limits)) if (!Number.isSafeInteger(item) || Number(item) < 0) fail(`${path}.limits.${key} is invalid`)
    }
  }
  if ('account' in change) accountRef(change.account, `${label}.account`, kind === 'createUser')
  if (kind === 'alterUser') {
    accountRef(change.account, `${label}.account`, false)
    const changes = assertRecord(change.changes, `${label}.changes`, [], ['plugin', 'locked', 'passwordExpired', 'sslType', 'sslIssuer', 'sslSubject', 'comment', 'limits', 'isRole'])
    accountRef({ user: 'placeholder', host: 'placeholder', ...changes }, `${label}.changes`, true)
  }
  if (change.password !== undefined && (typeof change.password !== 'string' || change.password.length > 1024)) fail(`${label}.password is invalid`)
  if (kind === 'grant' || kind === 'revoke') {
    assertStringArray(change.privileges, `${label}.privileges`, 128)
    if ((change.privileges as string[]).some((item) => item.length > 128 || !/^[A-Za-z][A-Za-z0-9_ ]*$/.test(item))) fail(`${label}.privileges contains invalid names`)
    const scope = change.scope as Record<string, unknown>
    if (!scope || typeof scope !== 'object' || Array.isArray(scope)) fail(`${label}.scope must be a record`)
    const scopeKeys: Record<string, string[]> = { global: ['kind'], database: ['kind', 'database'], table: ['kind', 'database', 'table'], column: ['kind', 'database', 'table', 'columns'], routine: ['kind', 'database', 'routine', 'routineType'] }
    const expected = scopeKeys[String(scope.kind)]
    if (!expected) fail(`${label}.scope.kind is invalid`)
    for (const key of Object.keys(scope)) if (!expected.includes(key)) fail(`${label}.scope.${key} is not allowed`)
    for (const key of ['database', 'table', 'routine']) if (scope[key] !== undefined && (typeof scope[key] !== 'string' || !scope[key] || scope[key].length > 256)) fail(`${label}.scope.${key} is invalid`)
    if (scope.kind === 'column') assertStringArray(scope.columns, `${label}.scope.columns`, 256)
    if (scope.kind === 'routine' && !['PROCEDURE', 'FUNCTION'].includes(String(scope.routineType))) fail(`${label}.scope.routineType is invalid`)
    accountRef(change.grantee, `${label}.grantee`, false)
    for (const key of ['grantOption', 'grantOptionOnly']) if (change[key] !== undefined && typeof change[key] !== 'boolean') fail(`${label}.${key} must be boolean`)
  }
  if (kind === 'grantRole' || kind === 'revokeRole') { accountRef(change.role, `${label}.role`, false); accountRef(change.grantee, `${label}.grantee`, false) }
  if (kind === 'grantRole' && change.default !== undefined && typeof change.default !== 'boolean') fail(`${label}.default must be boolean`)
}

export function validateIpcArguments(channel: string, args: readonly unknown[]): void {
  const schema = IPC_CHANNEL_SCHEMAS[channel]
  if (!schema) fail(`channel ${channel} has no runtime schema`)
  const requiredLength = schema.findIndex(spec => spec.optional)
  const minimumLength = requiredLength < 0 ? schema.length : requiredLength
  if (args.length < minimumLength || args.length > schema.length) fail(`${channel} expects ${minimumLength} to ${schema.length} arguments, got ${args.length}`)
  const budget = { bytes: 0, nodes: 0 }
  schema.forEach((spec, index) => {
    const arg = args[index]
    assertSpec(arg, spec, `${channel} argument ${index + 1}`)
    if (arg === undefined) return
    if (typeof arg === 'string') { budget.nodes++; budget.bytes += arg.length * 2 }
    else assertStructured(arg, budget)
  })
  assertDomainPayload(channel, args)
  if (budget.bytes > 24 * 1024 * 1024) fail(`${channel} payload exceeds 24 MB`)
}

export function isTrustedIpcFrame(event: GuardEvent, config: TrustedRendererConfig): boolean {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) return false
  const window = BrowserWindow.getAllWindows().find(candidate => candidate.webContents.id === event.sender.id)
  if (!window || window.isDestroyed()) return false
  const frameUrl = event.senderFrame.url
  if (config.rendererUrl) {
    try {
      const expected = new URL(config.rendererUrl)
      const actual = new URL(frameUrl)
      if (expected.origin === actual.origin && ['http:', 'https:'].includes(actual.protocol)) return true
    } catch { /* invalid renderer URL cannot authorize a frame */ }
  }
  try {
    const actual = new URL(frameUrl)
    return actual.protocol === 'file:' && resolve(fileURLToPath(actual)) === resolve(config.rendererFile)
  } catch { return false }
}

function rateLimit(channel: string, senderId: number, args: readonly unknown[], now = Date.now()): void {
  const mutatingSql = channel === 'db:execute' && typeof args[1] === 'string' && /\b(drop|truncate|alter|create|grant|revoke|insert|update|delete|replace)\b/i.test(args[1])
  const queryBuilderMutation = channel === 'query-builder:execute' && typeof args[1] === 'object' && args[1] !== null && ['INSERT', 'UPDATE', 'DELETE'].includes(String((args[1] as Record<string, unknown>).statement))
  const destructive = mutatingSql || queryBuilderMutation || /^(grid-editing:apply|security:apply|sessions:kill|database-tools:(restore|copy|maintenance|large-run|format-run)|object-editor:(apply|apply-table|mutate)|schema-compare:synchronize|schema-update:execute|import-export:import|data-generator:generate|routine-debugger:(engine:(deploy|remove)|start)|service-control:action|updater:apply|source-control:(commit|init|checkout-branch|delete-branch|fetch|pull|push))$/.test(channel)
  const git = channel.startsWith('source-control:')
  const limit = destructive ? 8 : git ? 30 : channel === 'db:execute' ? 60 : 120
  const key = `${senderId}:${channel}`
  const current = (rateHistory.get(key) ?? []).filter(time => now - time < WINDOW_MS)
  if (current.length >= limit) fail(`${channel} rate limit exceeded`)
  current.push(now)
  rateHistory.set(key, current)
}

export function wrapIpcHandler(
  channel: string,
  listener: GuardListener,
  config: TrustedRendererConfig,
  authorize: (event: GuardEvent, config: TrustedRendererConfig) => boolean = isTrustedIpcFrame
): GuardListener {
  if (!IPC_CHANNEL_SCHEMAS[channel]) fail(`channel ${channel} has no runtime schema`)
  return ((event: GuardEvent, ...args: unknown[]) => {
    if (!authorize(event, config)) fail('untrusted renderer or frame')
    validateIpcArguments(channel, args)
    rateLimit(channel, event.sender.id, args)
    return listener(event, ...args)
  })
}

export function installIpcSecurity(config: TrustedRendererConfig, target: IpcMain = ipcMain): void {
  if (guardedIpcInstances.has(target)) return
  const ipc = target as IpcMain & { handle: IpcMain['handle'] }
  const originalHandle = target.handle.bind(target)
  ipc.handle = ((channel: string, listener: Parameters<IpcMain['handle']>[1]) => {
    const wrapped = wrapIpcHandler(channel, listener as unknown as GuardListener, config) as unknown as Parameters<IpcMain['handle']>[1]
    return originalHandle(channel, wrapped)
  }) as IpcMain['handle']
  guardedIpcInstances.add(target)
}

export function defaultTrustedRendererConfig(rendererFile: string, rendererUrl = process.env.ELECTRON_RENDERER_URL): TrustedRendererConfig {
  return { rendererFile: resolve(rendererFile), rendererUrl: rendererUrl && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(rendererUrl) ? rendererUrl : undefined }
}

