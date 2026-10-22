import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import type { ConnectionRecord, ConnectionTestResult } from '../../../../shared/contracts'
import { normalizeIpcError } from '../../../../shared/normalizeIpcError.js'
import { Button, Dialog, Field } from './Button'
import { useI18n } from '../i18n/useI18n.js'

type Page = 'General' | 'Advanced' | 'Security' | 'HTTP' | 'Embedded'
export interface ConnectionSecrets {
  password: string
  sshPassword: string
  sshPassphrase: string
  httpPassword: string
  proxyPassword: string
}
export type ConnectionAction = 'test' | 'connect' | 'save'

interface Props {
  initial: ConnectionRecord
  isNew: boolean
  names: string[]
  onAction(record: ConnectionRecord, secrets: ConnectionSecrets, remember: boolean, action: ConnectionAction): Promise<ConnectionTestResult | void>
  onTrustHostKey(record: ConnectionRecord): Promise<void>
  onCancel(): void
}

const PAGES: Page[] = ['General', 'Advanced', 'Security', 'HTTP', 'Embedded']
const EMPTY_SECRETS: ConnectionSecrets = { password: '', sshPassword: '', sshPassphrase: '', httpPassword: '', proxyPassword: '' }

export function ConnectionPropertiesDialog({ initial, isNew, names, onAction, onTrustHostKey, onCancel }: Props): React.JSX.Element {
  const { t } = useI18n()
  const [record, setRecord] = useState(initial)
  const [secrets, setSecrets] = useState(EMPTY_SECRETS)
  const [remember, setRemember] = useState(true)
  const [page, setPage] = useState<Page>('General')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'loading' | 'success' | 'error'; text: string } | null>(null)
  const [connectionError, setConnectionError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [nameEdited, setNameEdited] = useState(!isNew)
  const [transport, setTransport] = useState<'tcp' | 'socket'>(initial.socketPath ? 'socket' : 'tcp')
  const [databaseChoices, setDatabaseChoices] = useState<string[]>([])
  const [loadingDatabases, setLoadingDatabases] = useState(false)
  const duplicateName = useMemo(() => names.some((name) => name.toLocaleLowerCase() === record.name.trim().toLocaleLowerCase() && name !== initial.name), [initial.name, names, record.name])

  useEffect(() => { if (!isNew) setDatabaseChoices([]) }, [isNew])

  function update<K extends keyof ConnectionRecord>(key: K, value: ConnectionRecord[K]): void {
    setRecord((current) => ({ ...current, [key]: value }))
    setStatus(null)
    setConnectionError('')
  }
  function updateEndpoint(host: string, port: number): void {
    setRecord((current) => ({ ...current, host, port, ...(!nameEdited ? { name: `${host || 'localhost'}:${port}` } : {}) }))
    setStatus(null)
  }
  function updateSsl(patch: Partial<ConnectionRecord['ssl']>): void { update('ssl', { ...record.ssl, ...patch }) }
  function updateSsh(patch: Partial<ConnectionRecord['ssh']>): void { update('ssh', { ...record.ssh, ...patch }) }
  function updateHttp(patch: Partial<ConnectionRecord['http']>): void { update('http', { ...record.http, ...patch }) }
  function updateAdvanced(patch: Partial<ConnectionRecord['advanced']>): void { update('advanced', { ...record.advanced, ...patch }) }
  function updateSecret(key: keyof ConnectionSecrets, value: string): void { setSecrets((current) => ({ ...current, [key]: value })) }

  async function loadDatabases(): Promise<void> {
    setLoadingDatabases(true)
    try {
      const result = await onAction(record, secrets, remember, 'test')
      if (result) {
        setDatabaseChoices(result.databases ?? [])
        setConnectionError('')
        setStatus({ kind: 'success', text: `${t('conn.test.success')}. ${t('conn.test.serverVersion', [result.serverVersion])}` })
      }
    } catch (error) {
      setConnectionError(sanitizeError(error, secrets))
    } finally { setLoadingDatabases(false) }
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {}
    if (!record.name.trim()) next.name = 'Informe um nome para a conexão.'
    else if (duplicateName) next.name = 'Este nome já está em uso.'
    if (transport === 'tcp' && (!record.host.trim() || /\s/.test(record.host))) next.host = 'Informe um host válido, sem espaços.'
    if (transport === 'tcp' && (!Number.isInteger(record.port) || record.port < 1 || record.port > 65535)) next.port = 'A porta deve estar entre 1 e 65535.'
    if (transport === 'socket' && !record.socketPath?.trim()) next.socket = t('conn.socket.required')
    if (!record.user.trim()) next.user = 'Informe o usuário.'
    if (!record.ssh.enabled && record.ssl.mode.startsWith('verify') && !record.ssl.caPath) next.caPath = 'CA obrigatório para este modo SSL.'
    if (!record.ssh.enabled && Boolean(record.ssl.certPath) !== Boolean(record.ssl.keyPath)) next.clientKey = 'Informe o certificado e a chave juntos.'
    if (record.ssh.enabled) {
      if (record.http.enabled) next.transport = 'SSH e HTTP tunneling são mutuamente exclusivos.'
      if (!record.ssh.host.trim()) next.sshHost = 'Informe o host SSH.'
      if (!record.ssh.user.trim()) next.sshUser = 'Informe o usuário SSH.'
      if (!Number.isInteger(record.ssh.port) || record.ssh.port < 1 || record.ssh.port > 65535) next.sshPort = 'Porta SSH inválida.'
      if (record.ssh.authMethod === 'password' && !secrets.sshPassword && !record.ssh.passwordRef) next.sshPassword = 'Informe a senha SSH.'
      if (record.ssh.authMethod === 'private-key' && !record.ssh.privateKeyFile) next.privateKeyFile = 'Escolha o arquivo da chave privada.'
    }
    if (record.http.enabled) {
      try {
        const url = new URL(record.http.url)
        if (!['http:', 'https:'].includes(url.protocol)) next.httpUrl = 'Use uma URL HTTP ou HTTPS para o tunnel.php.'
      } catch { next.httpUrl = 'Informe uma URL válida para o túnel HTTP.' }
      if (record.http.proxyHost && (!Number.isInteger(record.http.proxyPort) || (record.http.proxyPort ?? 0) < 1 || (record.http.proxyPort ?? 0) > 65535)) next.proxyPort = 'Porta de proxy inválida.'
      if (record.ssh.enabled) next.transport = 'SSH e HTTP tunneling são mutuamente exclusivos.'
    }
    setErrors(next)
    const firstPage: Page | undefined = next.sshHost || next.sshUser || next.sshPort || next.sshPassword || next.privateKeyFile || next.caPath || next.clientKey
      ? 'Security' : next.httpUrl ? 'HTTP' : 'General'
    if (firstPage) setPage(firstPage)
    return next
  }

  async function runAction(action: ConnectionAction, attempted = record): Promise<void> {
    if (action === 'connect' && !attempted.database?.trim() && !window.confirm('You have not specified a default database for this connection. Specifying a default database is not required to create a connection, but it is strongly recommended.\n\nOK: connect without a default database.\nCancel: choose a database first.')) return
    if (Object.keys(validate()).length > 0) return
    setBusy(true)
    setStatus(action === 'test' ? { kind: 'loading', text: t('conn.testing', [`${attempted.host}:${attempted.port}`]) } : null)
    try {
      const result = await onAction(attempted, secrets, remember, action)
      if (action === 'test' && result) {
        setConnectionError('')
        setDatabaseChoices(result.databases ?? [])
        setStatus({ kind: 'success', text: `${t('conn.test.success')}. ${t('conn.test.serverVersion', [result.serverVersion])}` })
      }
    } catch (error) {
      const message = sanitizeError(error, secrets)
      const fingerprint = message.match(/SSH host key não confiável: (SHA256:\S+)/)?.[1]
      if (fingerprint && window.confirm(`Fingerprint SSH ${fingerprint}\n\nConfiar nesta chave e salvar?`)) {
        const trusted = { ...attempted, ssh: { ...attempted.ssh, hostFingerprint: fingerprint } }
        setRecord(trusted)
        await onTrustHostKey(trusted)
        setStatus({ kind: 'loading', text: `Verificando chave e conectando a ${trusted.host}:${trusted.port}…` })
        try {
          const result = await onAction(trusted, secrets, remember, action)
          if (action === 'test' && result) { setDatabaseChoices(result.databases ?? []); setStatus({ kind: 'success', text: `${t('conn.test.success')}. ${t('conn.test.serverVersion', [result.serverVersion])}` }) }
          return
        } catch (retryError) {
          const retryMessage = sanitizeError(retryError, secrets)
          if (action === 'test') setConnectionError(retryMessage)
          else setStatus({ kind: 'error', text: retryMessage })
          return
        }
      }
      if (action === 'test') setConnectionError(message)
      else setStatus({ kind: 'error', text: message })
    } finally {
      setBusy(false)
    }
  }

  return <Dialog title={t('conn.dialog.title')} className="connection-dialog">
    <div className="connection-dialog-body">
      <nav className="connection-pages" aria-label={t('conn.properties')}>
        {PAGES.map((item) => <button key={item} className={page === item ? 'selected' : ''} onClick={() => setPage(item)}>
          {t(`conn.tab.${item.toLowerCase()}`)}{Object.keys(errors).length && ((item === 'General' && (errors.name || errors.host || errors.port || errors.user || errors.socket)) || (item === 'Security' && (errors.caPath || errors.clientKey || errors.sshHost || errors.sshUser || errors.sshPort || errors.sshPassword || errors.privateKeyFile)) || (item === 'HTTP' && errors.httpUrl)) ? <i aria-label={t('conn.hasErrors')} /> : null}
        </button>)}
      </nav>
      <div className="connection-page-content" key={page}>
        {errors.transport && <p className="inline-error" role="alert">{errors.transport}</p>}
        {page === 'General' && <div className="form-grid">
          <Field label={t('conn.type')}><select value={transport} onChange={(event) => { const next = event.target.value as 'tcp' | 'socket'; setTransport(next); if (next === 'tcp') update('socketPath', undefined) }}><option value="tcp">TCP/IP</option><option value="socket">Socket</option></select></Field>
          <Field label={t('conn.serverType')}><select value={record.type} onChange={(event) => update('type', event.target.value as ConnectionRecord['type'])}><option value="mysql">MySQL</option><option value="mariadb">MariaDB</option></select></Field>
          <Field label={t('conn.name')} error={errors.name}><input autoFocus value={record.name} onChange={(event) => { setNameEdited(true); update('name', event.target.value) }} /></Field>
          <Field label={t('conn.host')} error={errors.host}><input disabled={transport === 'socket'} value={record.host} onChange={(event) => updateEndpoint(event.target.value, record.port)} /></Field>
          <Field label={t('conn.port')} error={errors.port}><input type="number" min="1" max="65535" disabled={transport === 'socket'} value={record.port} onChange={(event) => updateEndpoint(record.host, Number(event.target.value))} /></Field>
          {transport === 'socket' && <Field label={t('conn.socket')} error={errors.socket} help={t('conn.socket.help')}><input value={record.socketPath ?? ''} onChange={(event) => update('socketPath', event.target.value || undefined)} /></Field>}
          <Field label={t('conn.user')} error={errors.user}><input value={record.user} onChange={(event) => update('user', event.target.value)} /></Field>
          <Field label={t('conn.password')}><input type="password" autoComplete="new-password" value={secrets.password} onChange={(event) => updateSecret('password', event.target.value)} placeholder={record.passwordRef ? '••••••••' : ''} /></Field>
          <label className="check-field"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> {t('conn.allowSavePassword')}</label>
          <div className="form-field"><label htmlFor="connection-database">{t('conn.database')}</label><select id="connection-database" value={record.database ?? ''} onChange={(event) => update('database', event.target.value || undefined)}><option value="">{t('conn.database.choose')}</option>{databaseChoices.map((database) => <option key={database} value={database}>{database}</option>)}{record.database && !databaseChoices.includes(record.database) && <option value={record.database}>{record.database}</option>}</select><div className="field-actions"><Button disabled={loadingDatabases} onClick={() => void loadDatabases()}>{loadingDatabases ? t('conn.database.loading') : t('common.refresh')}</Button></div></div>
          <label className="check-field"><input type="checkbox" checked={Boolean(record.showAllDatabases)} onChange={(event) => update('showAllDatabases', event.target.checked)} /> {t('conn.showAllDatabases')}</label>
          <Field label={t('conn.environment')}><select value={record.environment} onChange={(event) => update('environment', event.target.value as ConnectionRecord['environment'])}>{['none', 'dev', 'test', 'prod', 'sandbox', 'custom'].map((value) => <option key={value} value={value}>{t(`conn.environment.${value}`)}</option>)}</select></Field>
          {record.environment === 'custom' && <Field label={t('conn.environment.customLabel')}><input value={record.environmentLabel ?? ''} onChange={(event) => update('environmentLabel', event.target.value)} /></Field>}
          <Field label={t('conn.environment.color')}><input type="color" value={record.color ?? '#2f6fde'} onChange={(event) => update('color', event.target.value)} /></Field>
          <Field label={t('conn.environment.shape')}><select value={record.environmentShape ?? (({ none: 'square', dev: 'square', test: 'diamond', prod: 'circle', sandbox: 'triangle', custom: 'triangle' } as Record<ConnectionRecord['environment'], string>)[record.environment] ?? 'square')} onChange={(event) => update('environmentShape', event.target.value as NonNullable<ConnectionRecord['environmentShape']>)}><option value="square">{t('conn.environment.shape.square')}</option><option value="circle">{t('conn.environment.shape.circle')}</option><option value="triangle">{t('conn.environment.shape.triangle')}</option><option value="diamond">{t('conn.environment.shape.diamond')}</option></select></Field>
          <Field label={t('conn.category')}><input value={record.category ?? ''} onChange={(event) => update('category', event.target.value || undefined)} placeholder={t('conn.category.hint')} /></Field>
          <Field label="Comment"><textarea rows={3} value={record.comment ?? ''} onChange={(event) => update('comment', event.target.value || undefined)} /></Field>
        </div>}
        {page === 'Security' && <div className="form-grid">
          <label className="check-field wide"><input type="checkbox" checked={record.ssh.enabled || record.ssl.mode !== 'disabled'} onChange={(event) => { if (!event.target.checked) { updateSsl({ mode: 'disabled' }); updateSsh({ enabled: false }) } else if (record.ssl.mode === 'disabled') updateSsl({ mode: 'preferred' }) }} /> {t('conn.security.useProtocol')}</label>
          <Field label={t('conn.security.protocol')}><select value={record.ssh.enabled ? 'ssh' : 'ssl'} onChange={(event) => { const ssh = event.target.value === 'ssh'; updateSsh({ enabled: ssh }); if (ssh) { updateSsl({ mode: 'disabled' }); updateHttp({ enabled: false }) } else updateSsl({ mode: record.ssl.mode === 'disabled' ? 'preferred' : record.ssl.mode }) }}><option value="ssl">SSL/TLS</option><option value="ssh">SSH tunnel</option></select></Field>
          {!record.ssh.enabled && <>
          <Field label={t('conn.ssl.mode')}><select value={record.ssl.mode} onChange={(event) => updateSsl({ mode: event.target.value as ConnectionRecord['ssl']['mode'] })}><option value="disabled">Disabled</option><option value="preferred">Preferred</option><option value="required">Required</option><option value="verify-ca">Verify CA</option><option value="verify-identity">Verify Identity</option></select></Field>
          <PathField label={t('conn.ssl.ca')} value={record.ssl.caPath ?? ''} enabled={record.ssl.mode !== 'disabled'} error={errors.caPath} onChange={(caPath) => updateSsl({ caPath: caPath || undefined })} />
          <PathField label={t('conn.ssl.cert')} value={record.ssl.certPath ?? ''} enabled={record.ssl.mode !== 'disabled'} onChange={(certPath) => updateSsl({ certPath: certPath || undefined })} />
          <PathField label={t('conn.ssl.key')} value={record.ssl.keyPath ?? ''} enabled={record.ssl.mode !== 'disabled'} error={errors.clientKey} onChange={(keyPath) => updateSsl({ keyPath: keyPath || undefined })} />
          <Field label={t('conn.ssl.cipher')}><input value={record.ssl.cipher ?? ''} onChange={(event) => updateSsl({ cipher: event.target.value || undefined })} /></Field>
          <Field label={t('conn.ssl.tlsVersion')}><select value={record.ssl.minVersion ?? 'auto'} onChange={(event) => updateSsl({ minVersion: event.target.value as ConnectionRecord['ssl']['minVersion'] })}><option value="auto">Auto</option><option value="TLSv1.2">1.2</option><option value="TLSv1.3">1.3</option></select></Field>
          </>}
          {record.ssh.enabled && <>
          <Field label={t('conn.ssh.host')} error={errors.sshHost}><input value={record.ssh.host} onChange={(event) => updateSsh({ host: event.target.value })} /></Field>
          <Field label={t('conn.ssh.port')} error={errors.sshPort}><input type="number" min="1" max="65535" value={record.ssh.port} onChange={(event) => updateSsh({ port: Number(event.target.value) })} /></Field>
          <Field label={t('conn.ssh.user')} error={errors.sshUser}><input value={record.ssh.user} onChange={(event) => updateSsh({ user: event.target.value })} /></Field>
          <Field label={t('conn.ssh.auth')}><select value={record.ssh.authMethod} onChange={(event) => updateSsh({ authMethod: event.target.value as ConnectionRecord['ssh']['authMethod'] })}><option value="password">Password</option><option value="private-key">Private key</option><option value="agent">ssh-agent</option></select></Field>
          {record.ssh.authMethod === 'password' && <Field label={t('conn.ssh.password')} error={errors.sshPassword}><input type="password" value={secrets.sshPassword} onChange={(event) => updateSecret('sshPassword', event.target.value)} placeholder={record.ssh.passwordRef ? '••••••••' : ''} /></Field>}
          {record.ssh.authMethod === 'private-key' && <PathField label={t('conn.ssh.keyFile')} value={record.ssh.privateKeyFile ?? ''} enabled error={errors.privateKeyFile} onChange={(privateKeyFile) => updateSsh({ privateKeyFile: privateKeyFile || undefined })} startInSsh />}
          {record.ssh.authMethod === 'private-key' && <Field label={t('conn.ssh.passphrase')}><input type="password" value={secrets.sshPassphrase} onChange={(event) => updateSecret('sshPassphrase', event.target.value)} /></Field>}
          {record.ssh.authMethod === 'agent' && <p className="form-help wide">SSH_AUTH_SOCK será verificado ao conectar.</p>}
          <Field label={t('conn.ssh.remoteHost')}><input value={record.ssh.remoteHost || record.host} onChange={(event) => updateSsh({ remoteHost: event.target.value })} /></Field>
          <Field label={t('conn.ssh.remotePort')}><input type="number" value={record.ssh.remotePort} onChange={(event) => updateSsh({ remotePort: Number(event.target.value) })} /></Field>
          <Field label={t('conn.ssh.bindPort')} help={t('conn.ssh.bindPort.help')}><input type="number" min="0" max="65535" value={record.ssh.localPort ?? 0} onChange={(event) => updateSsh({ localPort: Number(event.target.value) || undefined })} /></Field>
          <label className="check-field wide"><input type="checkbox" checked={Boolean(record.ssh.keyboardInteractive)} onChange={(event) => updateSsh({ keyboardInteractive: event.target.checked })} /> Keyboard Interactive Mode</label>
          <Field label={t('conn.ssh.keepAlive')}><input type="number" min="0" value={record.ssh.keepAliveSeconds} onChange={(event) => updateSsh({ keepAliveSeconds: Number(event.target.value) })} /></Field>
          </>}
        </div>}
        {page === 'HTTP' && <div className="form-grid">
          <label className="check-field wide"><input type="checkbox" checked={record.http.enabled} onChange={(event) => { const enabled = event.target.checked; updateHttp({ enabled }); if (enabled) updateSsh({ enabled: false }) }} /> {t('conn.http.use')}</label>
          <Field label={t('conn.http.url')} error={errors.httpUrl} help={t('conn.http.url.help')}><input disabled={!record.http.enabled} value={record.http.url} onChange={(event) => updateHttp({ url: event.target.value })} placeholder="https://server/tunnel.php" /></Field>
          <Field label={t('conn.http.timeout')}><input type="number" min="1" disabled={!record.http.enabled} value={record.http.timeoutSeconds} onChange={(event) => updateHttp({ timeoutSeconds: Number(event.target.value) })} /></Field>
          <label className="check-field"><input type="checkbox" disabled={!record.http.enabled} checked={record.http.keepAlive !== false} onChange={(event) => updateHttp({ keepAlive: event.target.checked })} /> {t('conn.http.keepAlive')}</label>
          <label className="check-field"><input type="checkbox" disabled={!record.http.enabled} checked={record.http.useBase64 !== false} onChange={(event) => updateHttp({ useBase64: event.target.checked })} /> {t('conn.http.base64')}</label>
          <label className="check-field wide"><input type="checkbox" disabled={!record.http.enabled} checked={Boolean(record.http.useCredentials)} onChange={(event) => updateHttp({ useCredentials: event.target.checked })} /> {t('conn.http.useCredentials')}</label>
          <Field label={t('conn.http.user')}><input disabled={!record.http.enabled || !record.http.useCredentials} value={record.http.user ?? ''} onChange={(event) => updateHttp({ user: event.target.value || undefined })} /></Field>
          <Field label={t('conn.http.password')}><input type="password" disabled={!record.http.enabled || !record.http.useCredentials} value={secrets.httpPassword} onChange={(event) => updateSecret('httpPassword', event.target.value)} placeholder={record.http.passwordRef ? '••••••••' : ''} /></Field>
          <label className="check-field wide"><input type="checkbox" disabled={!record.http.enabled} checked={Boolean(record.http.useProxy)} onChange={(event) => updateHttp({ useProxy: event.target.checked })} /> {t('conn.http.useProxy')}</label>
          <Field label={t('conn.http.proxyHost')}><input disabled={!record.http.enabled || !record.http.useProxy} value={record.http.proxyHost ?? ''} onChange={(event) => updateHttp({ proxyHost: event.target.value || undefined })} /></Field>
          <Field label={t('conn.http.proxyPort')}><input type="number" disabled={!record.http.enabled || !record.http.useProxy} value={record.http.proxyPort ?? 8080} onChange={(event) => updateHttp({ proxyPort: Number(event.target.value) })} /></Field>
          <label className="check-field wide"><input type="checkbox" disabled={!record.http.enabled || !record.http.useProxy} checked={Boolean(record.http.proxyUser)} onChange={(event) => { if (!event.target.checked) updateHttp({ proxyUser: undefined, proxyPasswordRef: undefined }); else updateHttp({ proxyUser: record.http.proxyUser ?? '' }) }} /> {t('conn.http.proxyCredentials')}</label>
          <Field label={t('conn.http.proxyUser')}><input disabled={!record.http.enabled || !record.http.useProxy || !record.http.proxyUser} value={record.http.proxyUser ?? ''} onChange={(event) => updateHttp({ proxyUser: event.target.value || undefined })} /></Field>
          <Field label={t('conn.http.proxyPassword')}><input type="password" disabled={!record.http.enabled || !record.http.useProxy || !record.http.proxyUser} value={secrets.proxyPassword} onChange={(event) => updateSecret('proxyPassword', event.target.value)} placeholder={record.http.proxyPasswordRef ? '••••••••' : ''} /></Field>
          <label className="check-field wide"><input type="checkbox" disabled={!record.http.enabled} checked={record.http.rejectUnauthorized} onChange={(event) => updateHttp({ rejectUnauthorized: event.target.checked })} /> {t('conn.http.verifyCertificate')}</label>
          {record.http.enabled && <p className="form-help wide">O MySQL é encaminhado pelo servidor web; host e porta da aba General são o destino remoto do banco.</p>}
        </div>}
        {page === 'Advanced' && <div className="form-grid">
          <Field label={t('conn.advanced.connectionTimeout')}><input type="number" min="1" value={record.advanced.connectionTimeoutSeconds} onChange={(event) => updateAdvanced({ connectionTimeoutSeconds: Number(event.target.value) })} /></Field>
          <Field label={t('conn.advanced.executeTimeout')}><input type="number" min="0" value={record.advanced.commandTimeoutSeconds} onChange={(event) => updateAdvanced({ commandTimeoutSeconds: Number(event.target.value) })} /></Field>
          <Field label={t('conn.advanced.encoding')}><input value={record.advanced.charset} onChange={(event) => updateAdvanced({ charset: event.target.value })} /></Field>
          <label className="check-field"><input type="checkbox" checked={Boolean(record.advanced.detectCharacterSet)} onChange={(event) => updateAdvanced({ detectCharacterSet: event.target.checked })} /> {t('conn.advanced.detectCharset')}</label>
          <Field label="Collation"><input value={record.advanced.collation ?? ''} onChange={(event) => updateAdvanced({ collation: event.target.value || undefined })} /></Field>
          <Field label="Time zone"><select value={record.advanced.timeZone ?? 'SERVER'} onChange={(event) => updateAdvanced({ timeZone: event.target.value })}><option value="SERVER">Server</option><option value="LOCAL">Local</option><option value="Z">UTC</option></select></Field>
          <Field label="SQL mode (init)"><input value={record.advanced.sqlMode ?? ''} onChange={(event) => updateAdvanced({ sqlMode: event.target.value || undefined })} /></Field>
          <Field label="Init command(s)"><textarea rows={3} value={record.advanced.initCommands} onChange={(event) => updateAdvanced({ initCommands: event.target.value })} /></Field>
          <label className="check-field"><input type="checkbox" checked={Boolean(record.advanced.keepAliveEnabled)} onChange={(event) => updateAdvanced({ keepAliveEnabled: event.target.checked })} /> {t('conn.advanced.keepAlive')}</label>
          <Field label={t('conn.advanced.pingTimeout')}><input type="number" min="1" disabled={!record.advanced.keepAliveEnabled} value={record.advanced.pingTimeoutSeconds ?? 240} onChange={(event) => updateAdvanced({ pingTimeoutSeconds: Number(event.target.value) })} /></Field>
          <label className="check-field"><input type="checkbox" checked={record.advanced.compression} onChange={(event) => updateAdvanced({ compression: event.target.checked })} /> {t('conn.advanced.compression')}</label>
          <label className="check-field"><input type="checkbox" checked={record.advanced.multipleStatements} onChange={(event) => updateAdvanced({ multipleStatements: event.target.checked })} /> Allow multiple statements</label>
          <label className="check-field"><input type="checkbox" checked={record.advanced.tinyInt1isBit} onChange={(event) => updateAdvanced({ tinyInt1isBit: event.target.checked })} /> Treat TINYINT(1) as boolean</label>
          <label className="check-field"><input type="checkbox" checked={record.advanced.readOnly} onChange={(event) => updateAdvanced({ readOnly: event.target.checked })} /> Read-only session</label>
          <label className="check-field"><input type="checkbox" checked={record.advanced.autoReconnect} onChange={(event) => updateAdvanced({ autoReconnect: event.target.checked })} /> Auto-reconnect</label>
          <Field label="Custom parameters" help="Uma chave=valor por linha"><textarea rows={3} value={record.advanced.customParameters.map(({ key, value }) => `${key}=${value}`).join('\n')} onChange={(event) => updateAdvanced({ customParameters: parseParameters(event.target.value) })} /></Field>
          <div><Button onClick={() => { setRecord(initial); setNameEdited(true); setTransport(initial.socketPath ? 'socket' : 'tcp') }}>{t('conn.restoreDefaults')}</Button></div>
        </div>}
        {page === 'Embedded' && <div className="embedded-disabled"><strong>{t('conn.embedded.unavailable')}</strong><p>{t('conn.embedded.disabled')}</p><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('tuxsql:open-local-server'))}>{t('conn.embedded.openLocal')}</button></div>}
      </div>
    </div>
    <div className={`connection-status ${status?.kind ?? ''}`} aria-live="polite">
      {status && <><span aria-hidden="true">{status.kind === 'loading' ? '◌' : status.kind === 'success' ? '✓' : '!'}</span> {status.text}</>}
    </div>
    <footer className="dialog-footer">
      <Button onClick={() => void runAction('test')} disabled={busy}>{busy ? t('conn.testingShort') : t('conn.test')}</Button>
      {busy && status?.kind === 'loading' && <Button disabled>{t('common.cancel')}</Button>}
      <span className="footer-spacer" />
      <Button variant="primary" onClick={() => void runAction('connect')} disabled={busy}>{t('conn.connect')}</Button>
      {!status || status.kind !== 'success' ? <Button variant="primary" onClick={() => void runAction('save')} disabled={busy}>{isNew ? t('common.save') : t('common.ok')}</Button> : null}
      <Button onClick={status?.kind === 'success' ? () => setStatus(null) : onCancel} disabled={busy}>{t('common.cancel')}</Button>
    </footer>
    {connectionError && <Dialog title={t('conn.test.errorTitle')} className="connection-error-dialog"><p role="alert" className="connection-error-message">{connectionError}</p><footer className="dialog-footer"><Button variant="primary" autoFocus onClick={() => setConnectionError('')}>{t('common.ok')}</Button></footer></Dialog>}
  </Dialog>
}

function PathField({ label, value, enabled, onChange, error, startInSsh = false }: { label: string; value: string; enabled: boolean; onChange(value: string): void; error?: string; startInSsh?: boolean }): React.JSX.Element {
  function chooseFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] as (File & { path?: string }) | undefined
    if (file?.path) onChange(file.path)
  }
  return <Field label={label} error={error}>
    <div className="path-control"><input disabled={!enabled} value={value} onChange={(event) => onChange(event.target.value)} />
      <label className="file-pick"><input type="file" disabled={!enabled} onChange={chooseFile} accept={label.includes('key') || label.includes('certificate') || label.includes('CA') ? '.pem,.crt,.key,.cer' : '*'} />Browse{startInSsh ? ' ~/.ssh' : ''}</label>
    </div>
  </Field>
}

function parseParameters(text: string): Array<{ key: string; value: string }> {
  return text.split('\n').map((line) => line.split(/=(.*)/s)).filter((parts) => parts[0]?.trim()).map(([key, value = '']) => ({ key: key.trim(), value: value.trim() }))
}

function sanitizeError(error: unknown, secrets: ConnectionSecrets): string {
  const normalized = normalizeIpcError(error)
  let message = normalized instanceof Error ? normalized.message : typeof normalized === 'string' ? normalized : 'Connection failed.'
  for (const secret of Object.values(secrets)) if (secret) message = message.split(secret).join('••••••')
  return message
}
