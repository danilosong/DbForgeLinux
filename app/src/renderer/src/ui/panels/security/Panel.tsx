import { useCallback, useEffect, useMemo, useState } from 'react'
import './Panel.css'
import type { ConnectionRecord, ConnectionSummary } from '../../../../../shared/contracts.js'
import type { AccountRef, PrivilegeScope, SecurityChange, UserAccount, UserSecurityDetails } from '../../../../../modules/security/index.js'
import { cloneAccessChanges } from '../../../../../modules/security/clone.js'

type Tab = 'General' | 'Privileges' | 'Roles' | 'Limits' | 'Preview SQL'
const standardPrivileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'INDEX', 'CREATE VIEW', 'SHOW VIEW', 'EXECUTE', 'TRIGGER', 'EVENT', 'PROCESS', 'RELOAD', 'SUPER', 'CREATE USER', 'SHOW DATABASES']

export default function Panel(): React.JSX.Element {
  const [records, setRecords] = useState<ConnectionRecord[]>([])
  const [recordId, setRecordId] = useState('')
  const [connection, setConnection] = useState<ConnectionSummary>()
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [databases, setDatabases] = useState<string[]>([])
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
  const [accountForm, setAccountForm] = useState<UserAccount>({ user: '', host: '%', locked: false, passwordExpired: false })
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState('')

  useEffect(() => { void window.dbforge.getConnections().then((items) => { setRecords(items); if (items[0]) setRecordId(items[0].id) }).catch(showError) }, [])
  useEffect(() => () => { if (connection) void window.dbforge.disconnect(connection.id) }, [connection])
  const refreshAccounts = useCallback(async (): Promise<void> => {
    if (!connection) return
    setLoading(true); setError('')
    try {
      const rows = await window.dbforge.listSecurityAccounts(connection.id)
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
      const value = await window.dbforge.getSecurityDetails(connection.id, ref)
      setDetails(value); setAccountForm(value.account); setMode('view'); setPrivileges([])
    } catch (reason) { showError(reason) }
  }, [connection])
  useEffect(() => { if (connection) void refreshAccounts() }, [connection, refreshAccounts])
  useEffect(() => { if (connection) void window.dbforge.listDatabases(connection.id).then(setDatabases).catch(showError) }, [connection])
  useEffect(() => { if (connection && selected) void loadDetails(selected) }, [connection, selected, loadDetails])

  const visibleAccounts = useMemo(() => accounts.filter((item) => `${item.user}@${item.host}`.toLowerCase().includes(search.toLowerCase())), [accounts, search])
  const selectedLabel = selected ? `${selected.user}@${selected.host}` : ''
  const isReadOnly = Boolean(connection && records.find((item) => item.id === connection.recordId)?.advanced.readOnly)

  async function connect(): Promise<void> {
    const record = records.find((item) => item.id === recordId)
    if (!record) return
    setLoading(true); setError(''); setMessage('')
    try { setConnection(await window.dbforge.connect(record)) }
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
      const plan = await window.dbforge.previewSecurityChanges(connection.id, changes)
      setPreview(plan.statements.map((item) => item.previewSql).join('\n\n'))
      setTab('Preview SQL')
    } catch (reason) { showError(reason) }
    finally { setLoading(false) }
  }
  async function applyChanges(): Promise<void> {
    if (!connection || !changes.length) return
    let plan
    try { plan = await window.dbforge.previewSecurityChanges(connection.id, changes) }
    catch (reason) { showError(reason); return }
    const risky = plan.statements.some((item) => item.risk !== 'normal')
    const summary = `${plan.statements.length} statement(s) will be applied.\n\n${plan.statements.map((item) => `${item.risk.toUpperCase()}: ${item.previewSql}`).join('\n\n')}${risky ? '\n\nThis operation includes risky or destructive changes.' : ''}`
    if (!window.confirm(summary)) return
    setLoading(true); setError('')
    try {
      const results = await window.dbforge.applySecurityChanges(connection.id, changes, true)
      const failed = results.filter((item) => !item.success)
      setChanges([]); setPreview('')
      if (failed.length) setError(failed.map((item) => `Statement ${item.index + 1}: ${item.error}`).join('\n'))
      else setMessage('Changes applied successfully.')
      await window.dbforge.listSecurityAccounts(connection.id).then(setAccounts)
    } catch (reason) { showError(reason) }
    finally { setLoading(false) }
  }
  function grantOrRevoke(): void {
    if (!selected || !privileges.length) return
    const scope: PrivilegeScope = scopeKind === 'global' ? { kind: 'global' } : scopeKind === 'database' ? { kind: 'database', database } : scopeKind === 'table' ? { kind: 'table', database, table } : { kind: 'column', database, table, columns: columnNames.split(',').map((name) => name.trim()).filter(Boolean) }
    if (scope.kind === 'column' && !scope.columns.length) { setError('Enter at least one column.'); return }
    queue({ kind: 'grant', privileges, scope, grantee: selected })
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
    <h2>◈ Security Manager</h2>
    {!connection ? <div className="module-toolbar"><label>Connection <select value={recordId} onChange={(event) => setRecordId(event.target.value)}><option value="">Select connection</option>{records.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.host})</option>)}</select></label><button disabled={!recordId || loading} onClick={() => void connect()}>{loading ? 'Connecting…' : 'Connect'}</button></div> : <div className="module-toolbar"><strong>{connection.name}</strong><span>{connection.environment.toUpperCase()}</span><button onClick={() => void refreshAccounts()} disabled={loading}>Refresh F5</button><button onClick={() => setChanges([])} disabled={!changes.length}>Discard</button><button onClick={() => void buildPreview()} disabled={!changes.length || loading}>Preview SQL</button><button onClick={() => void applyChanges()} disabled={!changes.length || loading || Boolean(records.find((item) => item.id === connection.recordId)?.advanced.readOnly)}>Apply Ctrl+S</button><span>{changes.length ? `${changes.length} pending` : ''}</span></div>}
    {error && <div role="alert" className="module-error">{error}</div>}{message && <div role="status" className="module-message">{message}</div>}
    {connection && <div className="security-layout"><aside className="security-users"><div className="module-toolbar"><button disabled={isReadOnly} onClick={() => beginCreate()}>New User</button><button disabled={isReadOnly || !details} onClick={() => beginCreate(true)}>Clone</button><button disabled={isReadOnly || !selected || (selected.user === 'root' && selected.host === 'localhost')} onClick={() => { if (selected && window.confirm(`Delete ${selected.user}@${selected.host}? Active sessions will not be terminated.`)) queue({ kind: 'dropUser', account: selected }) }}>Delete</button></div><input placeholder="Search users..." value={search} onChange={(event) => setSearch(event.target.value)} />{loading && !accounts.length ? <p>Loading users…</p> : visibleAccounts.length ? <ul>{visibleAccounts.map((item) => <li key={`${item.user}@${item.host}`}><button className={selected?.user === item.user && selected.host === item.host ? 'selected' : ''} onClick={() => { setSelected({ user: item.user, host: item.host }); setTab('General') }}>{item.locked ? '🔒 ' : item.isRole ? '◇ ' : '♙ '}{item.user}@{item.host} <small>{item.plugin ?? ''}</small></button></li>)}</ul> : <p>No users</p>}</aside>
      <div className="security-detail"><nav className="module-tabs">{(['General', 'Privileges', 'Roles', 'Limits', 'Preview SQL'] as Tab[]).map((item) => <button key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}</nav>
        {tab === 'General' && <div className="module-form"><label>User name<input value={accountForm.user} disabled={mode === 'view' && Boolean(selected)} onChange={(event) => setAccountForm({ ...accountForm, user: event.target.value })} /></label><label>Host<input value={accountForm.host ?? '%'} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, host: event.target.value })} /></label><label>Authentication type<select value={accountForm.plugin ?? ''} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, plugin: event.target.value || undefined })}><option value="">Default</option><option>caching_sha2_password</option><option>mysql_native_password</option><option>auth_socket</option></select></label><label>Password<input type="password" autoComplete="new-password" value={password} disabled={mode === 'view'} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'edit' ? 'Leave empty to keep current password' : ''} /></label>{mode !== 'view' && <label>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}<label><input type="checkbox" checked={Boolean(accountForm.locked)} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, locked: event.target.checked })} /> Account Locked</label><label><input type="checkbox" checked={Boolean(accountForm.passwordExpired)} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, passwordExpired: event.target.checked })} /> Password Expire</label><label>Require SSL/X509<select value={accountForm.sslType ?? 'NONE'} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, sslType: event.target.value })}><option value="NONE">None</option><option value="SSL">SSL</option><option value="X509">X509</option></select></label><label>Comment<input value={accountForm.comment ?? ''} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, comment: event.target.value })} /></label>{mode === 'view' && selected && <button disabled={isReadOnly} onClick={() => { setMode('edit'); setPassword(''); setConfirmPassword('') }}>Edit User</button>}{mode !== 'view' && <><button disabled={isReadOnly} onClick={stageAccount}>Queue changes</button><button onClick={() => { setMode('view'); setPassword(''); setConfirmPassword('') }}>Cancel</button></>}</div>}
        {tab === 'Privileges' && <div><label>Scope <select value={scopeKind} onChange={(event) => setScopeKind(event.target.value as typeof scopeKind)}><option value="global">Global Privileges (*.*)</option><option value="database">Database Privileges</option><option value="table">Object Privileges</option><option value="column">Column Privileges</option></select></label>{scopeKind !== 'global' && <label>Database <select value={database} onChange={(event) => setDatabase(event.target.value)}><option value="">Select database</option>{databases.map((name) => <option key={name}>{name}</option>)}</select></label>}{(scopeKind === 'table' || scopeKind === 'column') && <label>Table <input value={table} onChange={(event) => setTable(event.target.value)} /></label>}{scopeKind === 'column' && <label>Columns (comma separated)<input value={columnNames} onChange={(event) => setColumnNames(event.target.value)} /></label>}<h3>Available Privileges:</h3><div className="privilege-grid">{standardPrivileges.map((privilege) => <label key={privilege}><input type="checkbox" checked={privileges.includes(privilege)} onChange={(event) => setPrivileges((items) => event.target.checked ? [...items, privilege] : items.filter((item) => item !== privilege))} />{privilege}</label>)}</div><button disabled={!selected || !privileges.length || isReadOnly || (scopeKind !== 'global' && !database) || (scopeKind !== 'global' && scopeKind !== 'database' && !table) || (scopeKind === 'column' && !columnNames.trim())} onClick={grantOrRevoke}>Grant Selected Privileges</button><button disabled={!selected || !privileges.length || isReadOnly || (scopeKind !== 'global' && !database) || (scopeKind !== 'global' && scopeKind !== 'database' && !table) || (scopeKind === 'column' && !columnNames.trim())} onClick={revokePrivileges}>Revoke Selected Privilege</button><p>Existing grants: {details?.grants.join(' · ') || 'None'}</p></div>}
        {tab === 'Roles' && <div><h3>Role Members / Role Privileges</h3><p>Granted roles: {details?.grantedRoles.map((role) => `${role.user}@${role.host}`).join(', ') || 'None'}</p><label>Role user<input id="security-role-user" placeholder="role" /></label><label>Role host<input id="security-role-host" defaultValue="%" /></label><button disabled={!selected} onClick={() => { const user = (document.getElementById('security-role-user') as HTMLInputElement).value; const host = (document.getElementById('security-role-host') as HTMLInputElement).value || '%'; if (user && selected) queue({ kind: 'grantRole', role: { user, host }, grantee: selected }) }}>Grant role</button><button disabled={!selected} onClick={() => { const user = (document.getElementById('security-role-user') as HTMLInputElement).value; const host = (document.getElementById('security-role-host') as HTMLInputElement).value || '%'; if (user && selected) queue({ kind: 'revokeRole', role: { user, host }, grantee: selected }) }}>Revoke role</button></div>}
        {tab === 'Limits' && <div className="module-form">{(['MAX_QUERIES_PER_HOUR', 'MAX_UPDATES_PER_HOUR', 'MAX_CONNECTIONS_PER_HOUR', 'MAX_USER_CONNECTIONS'] as const).map((name) => <label key={name}>{name}<input type="number" min="0" value={accountForm.limits?.[name] ?? ''} disabled={mode === 'view'} onChange={(event) => setAccountForm({ ...accountForm, limits: { ...accountForm.limits, [name]: event.target.value === '' ? undefined : Number(event.target.value) } })} /></label>)}{mode === 'view' && selected && <button onClick={() => setMode('edit')}>Edit Limits</button>}{mode === 'edit' && <button onClick={stageAccount}>Queue changes</button>}</div>}
        {tab === 'Preview SQL' && <pre className="module-sql-preview">{preview || "Select 'Preview SQL' to generate a masked preview."}</pre>}
      </div></div>}
  </section>
}
