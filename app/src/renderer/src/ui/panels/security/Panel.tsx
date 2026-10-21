import { useI18n } from '../../i18n/useI18n.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import './Panel.css'
import type { ConnectionRecord, ConnectionSummary } from '../../../../../shared/contracts.js'
import type { AccountRef, PrivilegeScope, SecurityChange, UserAccount, UserSecurityDetails } from '../../../../../modules/security/index.js'
import { cloneAccessChanges } from '../../../../../modules/security/clone.js'
import { usePanelConnection } from '../registry'

type Tab = 'General' | 'Privileges' | 'Global Privileges' | 'Object Privileges' | 'Roles' | 'Users' | 'Limits' | 'Preview SQL'
const fallbackPrivileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'INDEX', 'CREATE VIEW', 'SHOW VIEW', 'EXECUTE', 'TRIGGER', 'EVENT', 'PROCESS', 'RELOAD', 'SUPER', 'CREATE USER', 'SHOW DATABASES']

export default function Panel(): React.JSX.Element {
  const { t } = useI18n()

  const activeConnection = usePanelConnection()
  const [records, setRecords] = useState<ConnectionRecord[]>([])
  const [recordId, setRecordId] = useState('')
  const [connection, setConnection] = useState<ConnectionSummary | undefined>(activeConnection)
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [databases, setDatabases] = useState<string[]>([])
  const [databaseObjects, setDatabaseObjects] = useState<Array<{ name: string; kind: string }>>([])
  const [showAllObjects, setShowAllObjects] = useState(false)
  const [selected, setSelected] = useState<AccountRef>()
  const [details, setDetails] = useState<UserSecurityDetails>()
  const [cloneSource, setCloneSource] = useState<UserSecurityDetails>()
  const [changes, setChanges] = useState<SecurityChange[]>([])
  const [tab, setTab] = useState<Tab>('General')
  const [search, setSearch] = useState('')
  const [scopeKind, setScopeKind] = useState<'global' | 'database' | 'table' | 'column'>('global')
  const [database, setDatabase] = useState('')
  const [table, setTable] = useState('')
  const [columnNames, setColumnNames] = useState('')
  const [privileges, setPrivileges] = useState<string[]>([])
  const [supportedPrivileges, setSupportedPrivileges] = useState<string[]>(fallbackPrivileges)
  const [privilegeGrantOptions, setPrivilegeGrantOptions] = useState<string[]>([])
  const [defaultRoleGrant, setDefaultRoleGrant] = useState(false)
  const [adminRoleOption, setAdminRoleOption] = useState(false)
  const [accountForm, setAccountForm] = useState<UserAccount>({ user: '', host: '%', locked: false, passwordExpired: false })
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState('')

  useEffect(() => { void window.tuxsql.getConnections().then((items) => { setRecords(items); if (!activeConnection?.recordId && items[0]) setRecordId(items[0].id) }).catch(showError) }, [activeConnection?.recordId])
  useEffect(() => { setConnection(activeConnection) }, [activeConnection])
  useEffect(() => { if (activeConnection?.recordId) setRecordId(activeConnection.recordId) }, [activeConnection?.recordId])
  useEffect(() => {
    const connectionId = connection?.id
    const shouldDisconnect = Boolean(connectionId && connectionId !== activeConnection?.id)
    return () => { if (connectionId && shouldDisconnect) void window.tuxsql.disconnect(connectionId) }
  }, [connection?.id, activeConnection?.id])
  const refreshAccounts = useCallback(async (): Promise<void> => {
    if (!connection) return
    setLoading(true); setError('')
    try {
      const rows = await window.tuxsql.listSecurityAccounts(connection.id)
      setAccounts(rows)
      if (selected && !rows.some((row) => row.user === selected.user && row.host === selected.host)) setSelected(undefined)
      setMessage('')
    } catch (reason) { showError(reason) }
    finally { setLoading(false) }
  }, [connection, selected])
  const loadDetails = useCallback(async (ref: AccountRef): Promise<void> => {
    if (!connection) return
    setError('')
    try {
      const value = await window.tuxsql.getSecurityDetails(connection.id, ref)
      setDetails(value); setAccountForm(value.account); setMode('view'); setPrivileges([]); setPrivilegeGrantOptions([])
    } catch (reason) { showError(reason) }
  }, [connection])
  useEffect(() => { if (connection) void refreshAccounts() }, [connection, refreshAccounts])
  useEffect(() => { if (connection) void window.tuxsql.listSupportedPrivileges(connection.id).then(setSupportedPrivileges).catch(() => setSupportedPrivileges(fallbackPrivileges)); else setSupportedPrivileges(fallbackPrivileges) }, [connection])
  useEffect(() => { if (connection) void window.tuxsql.listDatabases(connection.id).then(setDatabases).catch(showError) }, [connection])
  useEffect(() => { if (!connection || !database || !['table', 'column'].includes(scopeKind)) { setDatabaseObjects([]); return } void window.tuxsql.listDatabaseObjects(connection.id, database).then((objects) => setDatabaseObjects(objects.map(({ name, kind }) => ({ name, kind })))).catch(showError) }, [connection, database, scopeKind])
  useEffect(() => { if (connection && selected) void loadDetails(selected) }, [connection, selected, loadDetails])

  const visibleAccounts = useMemo(() => accounts.filter((item) => `${item.user}@${item.host}`.toLowerCase().includes(search.toLowerCase())), [accounts, search])
  const accountsByHost = useMemo(() => {
    const hosts = new Map<string, UserAccount[]>()
    for (const account of visibleAccounts.filter((item) => !item.isRole)) {
      const list = hosts.get(account.host) ?? []
      list.push(account)
      hosts.set(account.host, list)
    }
    return [...hosts.entries()].sort(([left], [right]) => left.localeCompare(right))
  }, [visibleAccounts])
  const visibleRoles = useMemo(() => visibleAccounts.filter((item) => item.isRole), [visibleAccounts])
  const selectedLabel = selected ? `${selected.user}@${selected.host}` : ''
  const isReadOnly = Boolean(connection && records.find((item) => item.id === connection.recordId)?.advanced.readOnly)

  async function connect(): Promise<void> {
    const record = records.find((item) => item.id === recordId)
    if (!record) return
    setLoading(true); setError(''); setMessage('')
    try { setConnection(await window.tuxsql.connect(record)) }
    catch (reason) { showError(reason) }
    finally { setLoading(false) }
  }
  function showError(reason: unknown): void { setError(reason instanceof Error ? reason.message : String(reason)) }
  function queue(change: SecurityChange): void { setChanges((items) => [...items, change]); setPreview(''); setMessage('') }
  function beginCreate(clone = false): void {
    const base = clone && details ? details.account : undefined
    setCloneSource(clone ? details : undefined)
    setSelected(undefined); setDetails(undefined); setMode('create'); setTab('General')
    setAccountForm(base ? { ...base, user: '', host: '%' } : { user: '', host: '%', locked: false, passwordExpired: false })
    setPassword(''); setConfirmPassword(''); setError('')
  }
  function stageAccount(): void {
    if (!accountForm.user.trim()) { setError('User name cannot be empty.'); return }
    if (mode === 'create' && !password) { setError('Password cannot be empty.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    const duplicate = accounts.some((row) => row.user === accountForm.user && row.host === (accountForm.host || '%'))
    if (mode === 'create' && duplicate) { setError(`User '${accountForm.user}' already exists.`); return }
    const account = { ...accountForm, host: accountForm.host || '%' }
    if (mode === 'create') {
      queue({ kind: 'createUser', account, password })
      if (cloneSource) for (const change of cloneAccessChanges(cloneSource, { user: account.user, host: account.host })) queue(change)
    }
    else if (selected) {
      const changeset = { plugin: account.plugin, locked: account.locked, passwordExpired: account.passwordExpired, sslType: account.sslType, sslIssuer: account.sslIssuer, sslSubject: account.sslSubject, comment: account.comment, limits: account.limits, isRole: account.isRole }
      queue({ kind: 'alterUser', account: selected, changes: changeset, ...(password ? { password } : {}) })
    }
    setPassword(''); setConfirmPassword(''); setMode('view'); setMessage(mode === 'create' ? `User ${account.user}@${account.host} queued for creation.` : `User ${account.user}@${account.host} changes queued.`)
  }
  async function buildPreview(): Promise<void> {
    if (!connection || !changes.length) return
    setLoading(true); setError('')
    try {
      const plan = await window.tuxsql.previewSecurityChanges(connection.id, changes)
      setPreview(plan.statements.map((item) => item.previewSql).join('\n\n'))
      setTab('Preview SQL')
    } catch (reason) { showError(reason) }
    finally { setLoading(false) }
  }
  async function applyChanges(): Promise<void> {
    if (!connection || !changes.length) return
    let plan
    try { plan = await window.tuxsql.previewSecurityChanges(connection.id, changes) }
    catch (reason) { showError(reason); return }
    const risky = plan.statements.some((item) => item.risk !== 'normal')
    const summary = `${plan.statements.length} statement(s) will be applied.\n\n${plan.statements.map((item) => `${item.risk.toUpperCase()}: ${item.previewSql}`).join('\n\n')}${risky ? '\n\nThis operation includes risky or destructive changes.' : ''}`
    if (!window.confirm(summary)) return
    setLoading(true); setError('')
    try {
      const results = await window.tuxsql.applySecurityChanges(connection.id, changes, true)
      const failed = results.filter((item) => !item.success)
      setChanges([]); setPreview('')
      if (failed.length) setError(failed.map((item) => `Statement ${item.index + 1}: ${item.error}`).join('\n'))
      else setMessage('Changes applied successfully.')
      await window.tuxsql.listSecurityAccounts(connection.id).then(setAccounts)
    } catch (reason) { showError(reason) }
    finally { setLoading(false) }
  }
  function grantOrRevoke(): void {
    if (!selected || !privileges.length) return
    const scope: PrivilegeScope = scopeKind === 'global' ? { kind: 'global' } : scopeKind === 'database' ? { kind: 'database', database } : scopeKind === 'table' ? { kind: 'table', database, table } : { kind: 'column', database, table, columns: columnNames.split(',').map((name) => name.trim()).filter(Boolean) }
    if (scope.kind === 'column' && !scope.columns.length) { setError('Enter at least one column.'); return }
    for (const privilege of privileges) queue({ kind: 'grant', privileges: [privilege], scope, grantee: selected, grantOption: privilegeGrantOptions.includes(privilege) })
    setMessage(`Grant queued for ${selectedLabel}.`)
  }
  function revokePrivileges(): void {
    if (!selected || !privileges.length) return
    const scope: PrivilegeScope = scopeKind === 'global' ? { kind: 'global' } : scopeKind === 'database' ? { kind: 'database', database } : scopeKind === 'table' ? { kind: 'table', database, table } : { kind: 'column', database, table, columns: columnNames.split(',').map((name) => name.trim()).filter(Boolean) }
    if (scope.kind === 'column' && !scope.columns.length) { setError('Enter at least one column.'); return }
    queue({ kind: 'revoke', privileges, scope, grantee: selected })
    setMessage(`Revoke queued for ${selectedLabel}.`)
  }

  return <section className="tool-panel security-panel">
    <h2>{t('panel.security.m831b5a1b40')}</h2>
    {!connection ? <div className="module-toolbar"><label>{t('panel.security.m9ffa7bec9d')} <select value={recordId} onChange={(event) => setRecordId(event.target.value)}><option value="">{t('panel.security.mf419d178f7')}</option>{records.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.host})</option>)}</select></label><button disabled={!recordId || loading} onClick={() => void connect()}>{loading ? 'Connecting…' : 'Connect'}</button></div> : <div className="module-toolbar"><strong>{connection.name}</strong><span>{connection.environment.toUpperCase()}</span><button onClick={() => void refreshAccounts()} disabled={loading}>{t('panel.security.m9796c3e3f0')}</button><button onClick={() => setChanges([])} disabled={!changes.length}>{t('panel.security.m414d29de5a')}</button><button onClick={() => void buildPreview()} disabled={!changes.length || loading}>{t('panel.security.mdd86e4e053')}</button><button onClick={() => void applyChanges()} disabled={!changes.length || loading || Boolean(records.find((item) => item.id === connection.recordId)?.advanced.readOnly)}>{t('panel.security.m03af5bb912')}</button><span>{changes.length ? `${changes.length} pending` : ''}</span></div>}
    {error && <div role="alert" className="module-error">{error}</div>}{message && <div role="status" className="module-message">{message}</div>}
    {connection && <div className="security-layout"><aside className="security-users"><div className="module-toolbar"><button disabled={isReadOnly} onClick={() => beginCreate()}>{t('panel.security.mc933673f7c')}</button><button disabled={isReadOnly || !details} onClick={() => beginCreate(true)}>{t('panel.security.m9b2be6066b')}</button><button disabled={isReadOnly || !selected || (selected.user === 'root' && selected.host === 'localhost')} onClick={() => { if (selected && window.confirm(`Delete ${selected.user}@${selected.host}? Active sessions will not be terminated.`)) queue({ kind: 'dropUser', account: selected }) }}>{t('panel.security.m289f28dacf')}</button></div><input placeholder={t('panel.security.m95c0211998')} value={search} onChange={(event) => setSearch(event.target.value)} />{loading && !accounts.length ? <p>{t('panel.security.mf8d2cb2775')}</p> : visibleAccounts.length ? <div className="security-account-tree"><section><h3>{t('panel.security.users')}</h3>{accountsByHost.map(([host, items]) => <details key={host} open><summary>{host} ({items.length})</summary><ul>{items.map((item) => <li key={`${item.user}@${item.host}`}><button className={selected?.user === item.user && selected.host === item.host ? 'selected' : ''} onClick={() => { setSelected({ user: item.user, host: item.host }); setTab('General') }}>{item.locked ? '🔒 ' : '♙ '}{item.user}@{item.host} <small>{item.plugin ?? ''}</small></button></li>)}</ul></details>)}</section><section><h3>{t('panel.security.roles')}</h3>{visibleRoles.length ? <ul>{visibleRoles.map((item) => <li key={`${item.user}@${item.host}`}><button className={selected?.user === item.user && selected.host === item.host ? 'selected' : ''} onClick={() => { setSelected({ user: item.user, host: item.host }); setTab('General') }}>◇ {item.user}@{item.host}</button></li>)}</ul> : <p>{t('panel.security.noRoles')}</p>}</section></div> : <p>{t('panel.security.m2c6c1318d5')}</p>}</aside>
      <div className="security-detail"><nav className="module-tabs">{(['General', 'Roles', 'Users', 'Global Privileges', 'Object Privileges', 'Limits', 'Preview SQL'] as Tab[]).map((item) => <button key={item} aria-pressed={tab === item} onClick={() => { setTab(item); if (item === 'Global Privileges') setScopeKind('global'); if (item === 'Object Privileges') setScopeKind('table') }}>{item}</button>)}</nav>
        {tab === 'General' && <div className="module-form"><label>{t('panel.security.m9177ac3a64')}<input value={accountForm.user} disabled={mode === 'view' && Boolean(selected)} onChange={(event) => setAccountForm({ ...accountForm, user: event.target.value })} /></label><label>{t('panel.security.me2e5faa0b8')}<input value={accountForm.host ?? '%'} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, host: event.target.value })} /></label><label>{t('panel.security.m7de493e6d8')}<select value={accountForm.plugin ?? ''} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, plugin: event.target.value || undefined })}><option value="">{t('panel.security.m665caba3ff')}</option><option>{t('panel.security.m90c2027224')}</option><option>{t('panel.security.m7f8868d2bd')}</option><option>{t('panel.security.m19487b5831')}</option></select></label><label>{t('panel.security.mc6cd235716')}<input type="password" autoComplete="new-password" value={password} disabled={mode === 'view'} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'edit' ? 'Leave empty to keep current password' : ''} /></label>{mode !== 'view' && <label>{t('panel.security.m75dce3390b')}<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}<label><input type="checkbox" checked={Boolean(accountForm.locked)} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, locked: event.target.checked })} /> {t('sec.acct.locked')}</label><label><input type="checkbox" checked={Boolean(accountForm.passwordExpired)} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, passwordExpired: event.target.checked })} /> {t('sec.acct.passwordExpire')}</label><label>{t('panel.security.m6c8e54de00')}<select value={accountForm.sslType ?? 'NONE'} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, sslType: event.target.value })}><option value="NONE">{t('panel.security.m4a9b1e05cd')}</option><option value="SSL">SSL</option><option value="X509">X509</option></select></label><label>{t('panel.security.mbd0a70b25f')}<input value={accountForm.comment ?? ''} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, comment: event.target.value })} /></label>{mode === 'view' && selected && <button disabled={isReadOnly} onClick={() => { setMode('edit'); setPassword(''); setConfirmPassword('') }}>{t('panel.security.m3226df7eb2')}</button>}{mode !== 'view' && <><button disabled={isReadOnly} onClick={stageAccount}>{t('panel.security.m6ed2fa956c')}</button><button onClick={() => { setMode('view'); setPassword(''); setConfirmPassword('') }}>{t('common.cancel')}</button></>}</div>}
        {(tab === 'Privileges' || tab === 'Global Privileges' || tab === 'Object Privileges') && <div><label>{t('panel.security.macc320241b')} <select value={scopeKind} onChange={(event) => setScopeKind(event.target.value as typeof scopeKind)}><option value="global">{t('panel.security.maf11b50a56')}</option><option value="database">{t('sec.priv.database')}</option><option value="table">{t('sec.priv.object')}</option><option value="column">{t('panel.security.m74705a7d27')}</option></select></label>{scopeKind !== 'global' && <label>{t('panel.security.m4a6c02f58a')} <select value={database} onChange={(event) => setDatabase(event.target.value)}><option value="">{t('panel.security.m35b319dfa3')}</option>{databases.map((name) => <option key={name}>{name}</option>)}</select></label>}{(scopeKind === 'table' || scopeKind === 'column') && <section className="security-object-tree"><label><input type="checkbox" checked={showAllObjects} onChange={(event) => setShowAllObjects(event.target.checked)} />{t('sec.object.showAll')}</label><input type="search" aria-label={t('sec.object.search')} placeholder={t('sec.object.search')} value={table} onChange={(event) => setTable(event.target.value)} />{showAllObjects && <ul>{databaseObjects.filter((item) => item.name.toLowerCase().includes(table.toLowerCase())).map((item) => <li key={`${item.kind}:${item.name}`}><button aria-pressed={table === item.name} onClick={() => setTable(item.name)}>{item.kind} · {item.name}</button></li>)}</ul>}</section>}{scopeKind === 'column' && <label>{t('panel.security.ma3f9be8107')}<input value={columnNames} onChange={(event) => setColumnNames(event.target.value)} /></label>}<h3>{t('sec.priv.available')}</h3><table className="security-privileges"><thead><tr><th>{t('sec.privilege')}</th><th>{t('sec.priv.granted')}</th><th>{t('sec.priv.grantOption')}</th></tr></thead><tbody>{(scopeKind === 'global' ? supportedPrivileges : fallbackPrivileges).map((privilege) => <tr key={privilege}><th scope="row">{privilege}</th><td><input type="checkbox" aria-label={`${t('sec.priv.granted')} ${privilege}`} checked={privileges.includes(privilege)} onChange={(event) => setPrivileges((items) => event.target.checked ? [...items, privilege] : items.filter((item) => item !== privilege))} /></td><td><input type="checkbox" aria-label={`${t('sec.priv.grantOption')} ${privilege}`} checked={privilegeGrantOptions.includes(privilege)} disabled={!privileges.includes(privilege)} onChange={(event) => setPrivilegeGrantOptions((items) => event.target.checked ? [...items, privilege] : items.filter((item) => item !== privilege))} /></td></tr>)}</tbody></table><button disabled={!selected || !privileges.length || isReadOnly || (scopeKind !== 'global' && !database) || (scopeKind !== 'global' && scopeKind !== 'database' && !table) || (scopeKind === 'column' && !columnNames.trim())} onClick={grantOrRevoke}>{t('panel.security.m6c491e0527')}</button><button disabled={!selected || !privileges.length || isReadOnly || (scopeKind !== 'global' && !database) || (scopeKind !== 'global' && scopeKind !== 'database' && !table) || (scopeKind === 'column' && !columnNames.trim())} onClick={revokePrivileges}>{t('sec.priv.revokeSelected')}</button><p>{t('panel.security.m0f4fac1fe7')} {details?.grants.join(' · ') || 'None'}</p></div>}
        {tab === 'Roles' && <div><h3>{t('panel.security.me4d96332c0')}</h3><p>{t('panel.security.m90791c9ce9')} {details?.grantedRoles.map((role) => `${role.user}@${role.host}`).join(', ') || 'None'}</p><label>{t('panel.security.m840b933591')}<input id="security-role-user" placeholder={t('panel.security.m1af3629ffd')} /></label><label>{t('panel.security.m76b8755e90')}<input id="security-role-host" defaultValue="%" /></label><label><input type="checkbox" checked={adminRoleOption} onChange={(event) => setAdminRoleOption(event.target.checked)} />{t('sec.roles.adminOption')}</label><label><input type="checkbox" checked={defaultRoleGrant} onChange={(event) => setDefaultRoleGrant(event.target.checked)} />{t('sec.roles.setDefault')}</label><button disabled={!selected} onClick={() => { const user = (document.getElementById('security-role-user') as HTMLInputElement).value; const host = (document.getElementById('security-role-host') as HTMLInputElement).value || '%'; if (user && selected) queue({ kind: 'grantRole', role: { user, host }, grantee: selected, ...(defaultRoleGrant ? { default: true } : {}), ...(adminRoleOption ? { adminOption: true } : {}) }) }}>{t('panel.security.md67aaeaa7f')}</button><button disabled={!selected} onClick={() => { const user = (document.getElementById('security-role-user') as HTMLInputElement).value; const host = (document.getElementById('security-role-host') as HTMLInputElement).value || '%'; if (user && selected) queue({ kind: 'revokeRole', role: { user, host }, grantee: selected }) }}>{t('panel.security.mbc728bfcdd')}</button></div>}
        {tab === 'Users' && <div><h3>{t('panel.security.users')}</h3>{selected && details?.account.isRole ? accounts.filter((item) => !item.isRole).map((account) => <div className="security-role-user" key={`${account.user}@${account.host}`}><span>{account.user}@{account.host}</span><button disabled={isReadOnly} onClick={() => queue({ kind: 'grantRole', role: selected, grantee: { user: account.user, host: account.host } })}>{t('panel.security.roleGrantUser')}</button><button disabled={isReadOnly} onClick={() => queue({ kind: 'revokeRole', role: selected, grantee: { user: account.user, host: account.host } })}>{t('panel.security.roleRevokeUser')}</button></div>) : <p>{t('panel.security.selectRoleUsers')}</p>}</div>}
        {tab === 'Limits' && <div className="module-form">{(['MAX_QUERIES_PER_HOUR', 'MAX_UPDATES_PER_HOUR', 'MAX_CONNECTIONS_PER_HOUR', 'MAX_USER_CONNECTIONS'] as const).map((name) => <label key={name}>{name}<input type="number" min="0" value={accountForm.limits?.[name] ?? ''} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, limits: { ...accountForm.limits, [name]: event.target.value === '' ? undefined : Number(event.target.value) } })} /></label>)}{mode === 'view' && selected && <button onClick={() => setMode('edit')}>{t('panel.security.mc85053d211')}</button>}{mode === 'edit' && <button onClick={stageAccount}>{t('panel.security.m6ed2fa956c')}</button>}</div>}
        {tab === 'Preview SQL' && <pre className="module-sql-preview">{preview || "Select 'Preview SQL' to generate a masked preview."}</pre>}
      </div></div>}
  </section>
}
