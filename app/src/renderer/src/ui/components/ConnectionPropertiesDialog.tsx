import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import type { ConnectionRecord, ConnectionTestResult } from '../../../../shared/contracts'
import { Button, Dialog, Field } from './Button'

type Page = 'General' | 'Security' | 'SSH' | 'HTTP' | 'Advanced'
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

const PAGES: Page[] = ['General', 'Security', 'SSH', 'HTTP', 'Advanced']
const EMPTY_SECRETS: ConnectionSecrets = { password: '', sshPassword: '', sshPassphrase: '', httpPassword: '', proxyPassword: '' }

export function ConnectionPropertiesDialog({ initial, isNew, names, onAction, onTrustHostKey, onCancel }: Props): React.JSX.Element {
  const [record, setRecord] = useState(initial)
  const [secrets, setSecrets] = useState(EMPTY_SECRETS)
  const [remember, setRemember] = useState(true)
  const [page, setPage] = useState<Page>('General')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'loading' | 'success' | 'error'; text: string } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const duplicateName = useMemo(() => names.some((name) => name.toLocaleLowerCase() === record.name.trim().toLocaleLowerCase() && name !== initial.name), [initial.name, names, record.name])

  useEffect(() => {
    if (status?.kind !== 'success') return
    const timer = window.setTimeout(() => setStatus(null), 8000)
    return () => window.clearTimeout(timer)
  }, [status])

  function update<K extends keyof ConnectionRecord>(key: K, value: ConnectionRecord[K]): void {
    setRecord((current) => ({ ...current, [key]: value }))
    setStatus(null)
  }
  function updateSsl(patch: Partial<ConnectionRecord['ssl']>): void { update('ssl', { ...record.ssl, ...patch }) }
  function updateSsh(patch: Partial<ConnectionRecord['ssh']>): void { update('ssh', { ...record.ssh, ...patch }) }
  function updateHttp(patch: Partial<ConnectionRecord['http']>): void { update('http', { ...record.http, ...patch }) }
  function updateAdvanced(patch: Partial<ConnectionRecord['advanced']>): void { update('advanced', { ...record.advanced, ...patch }) }
  function updateSecret(key: keyof ConnectionSecrets, value: string): void { setSecrets((current) => ({ ...current, [key]: value })) }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {}
    if (!record.name.trim()) next.name = 'Informe um nome para a conexão.'
    else if (duplicateName) next.name = 'Este nome já está em uso.'
    if (!record.host.trim() || /\s/.test(record.host)) next.host = 'Informe um host válido, sem espaços.'
    if (!Number.isInteger(record.port) || record.port < 1 || record.port > 65535) next.port = 'A porta deve estar entre 1 e 65535.'
    if (!record.user.trim()) next.user = 'Informe o usuário.'
    if (record.ssl.mode.startsWith('verify') && !record.ssl.caPath) next.caPath = 'CA obrigatório para este modo SSL.'
    if (Boolean(record.ssl.certPath) !== Boolean(record.ssl.keyPath)) next.clientKey = 'Informe o certificado e a chave juntos.'
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
    const firstPage: Page | undefined = next.sshHost || next.sshUser || next.sshPort || next.sshPassword || next.privateKeyFile
      ? 'SSH'
      : next.caPath || next.clientKey ? 'Security' : next.httpUrl ? 'HTTP' : 'General'
    if (firstPage) setPage(firstPage)
    return next
  }

  async function runAction(action: ConnectionAction, attempted = record): Promise<void> {
    if (Object.keys(validate()).length > 0) return
    setBusy(true)
    setStatus(action === 'test' ? { kind: 'loading', text: `Conectando a ${attempted.host}:${attempted.port}…` } : null)
    try {
      const result = await onAction(attempted, secrets, remember, action)
      if (action === 'test' && result) {
        const tls = result.tlsVersion ? ` · ${result.tlsVersion}` : ''
        const ssh = result.sshTunnel ? ' · via SSH' : ''
        const http = result.httpTunnel ? ' · via HTTP tunnel' : ''
        setStatus({ kind: 'success', text: `Conexão bem-sucedida · ${result.serverVersion} · ${result.elapsedMs} ms${tls}${ssh}${http}` })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha na conexão.'
      const fingerprint = message.match(/SSH host key não confiável: (SHA256:\S+)/)?.[1]
      if (fingerprint && window.confirm(`Fingerprint SSH ${fingerprint}\n\nConfiar nesta chave e salvar?`)) {
        const trusted = { ...attempted, ssh: { ...attempted.ssh, hostFingerprint: fingerprint } }
        setRecord(trusted)
        await onTrustHostKey(trusted)
        setStatus({ kind: 'loading', text: `Verificando chave e conectando a ${trusted.host}:${trusted.port}…` })
        try {
          const result = await onAction(trusted, secrets, remember, action)
          if (action === 'test' && result) setStatus({ kind: 'success', text: `Conexão bem-sucedida · ${result.serverVersion} · ${result.elapsedMs} ms · via SSH` })
          return
        } catch (retryError) {
          setStatus({ kind: 'error', text: humanizeError(retryError) })
          return
        }
      }
      setStatus({ kind: 'error', text: humanizeError(error) })
    } finally {
      setBusy(false)
    }
  }

  return <Dialog title="Database Connection Properties" className="connection-dialog">
    <div className="connection-dialog-body">
      <nav className="connection-pages" aria-label="Propriedades da conexão">
        {PAGES.map((item) => <button key={item} className={page === item ? 'selected' : ''} onClick={() => setPage(item)}>
          {item}{Object.keys(errors).length && ((item === 'General' && (errors.name || errors.host || errors.port || errors.user)) || (item === 'Security' && (errors.caPath || errors.clientKey)) || (item === 'SSH' && (errors.sshHost || errors.sshUser || errors.sshPort || errors.sshPassword || errors.privateKeyFile)) || (item === 'HTTP' && errors.httpUrl)) ? <i aria-label="contém erros" /> : null}
        </button>)}
      </nav>
      <div className="connection-page-content" key={page}>
        {errors.transport && <p className="inline-error" role="alert">{errors.transport}</p>}
        {page === 'General' && <div className="form-grid">
          <Field label="Type"><select value={record.type} onChange={(event) => update('type', event.target.value as ConnectionRecord['type'])}><option value="mysql">MySQL</option><option value="mariadb">MariaDB</option></select></Field>
          <Field label="Connection name" error={errors.name}><input autoFocus value={record.name} onChange={(event) => update('name', event.target.value)} placeholder={`${record.user}@${record.host}`} /></Field>
          <Field label="Host" error={errors.host}><input disabled={Boolean(record.socketPath)} value={record.host} onChange={(event) => update('host', event.target.value)} /></Field>
          <Field label="Port" error={errors.port}><input type="number" min="1" max="65535" disabled={Boolean(record.socketPath)} value={record.port} onChange={(event) => update('port', Number(event.target.value))} /></Field>
          <Field label="Socket (Unix)" help="Exemplo: /var/run/mysqld/mysqld.sock"><input value={record.socketPath ?? ''} onChange={(event) => update('socketPath', event.target.value || undefined)} /></Field>
          <Field label="User" error={errors.user}><input value={record.user} onChange={(event) => update('user', event.target.value)} /></Field>
          <Field label="Password"><input type="password" autoComplete="new-password" value={secrets.password} onChange={(event) => updateSecret('password', event.target.value)} placeholder={record.passwordRef ? '•••••••• (salva no cofre)' : ''} /></Field>
          <label className="check-field"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Save password</label>
          <Field label="Database"><input value={record.database ?? ''} onChange={(event) => update('database', event.target.value || undefined)} placeholder="opcional" /></Field>
          <Field label="Connection environment"><select value={record.environment} onChange={(event) => update('environment', event.target.value as ConnectionRecord['environment'])}>{['none', 'dev', 'test', 'prod', 'custom'].map((value) => <option key={value} value={value}>{value === 'none' ? 'None' : value.toUpperCase()}</option>)}</select></Field>
          {record.environment === 'custom' && <Field label="Environment label"><input value={record.environmentLabel ?? ''} onChange={(event) => update('environmentLabel', event.target.value)} /></Field>}
          <Field label="Connection color"><input type="color" value={record.color ?? '#2f6fde'} onChange={(event) => update('color', event.target.value)} /></Field>
          <Field label="Category / folder"><input value={record.category ?? ''} onChange={(event) => update('category', event.target.value || undefined)} /></Field>
          <Field label="Comment"><textarea rows={3} value={record.comment ?? ''} onChange={(event) => update('comment', event.target.value || undefined)} /></Field>
        </div>}
        {page === 'Security' && <div className="form-grid">
          <Field label="Use SSL/TLS"><select value={record.ssl.mode} onChange={(event) => updateSsl({ mode: event.target.value as ConnectionRecord['ssl']['mode'] })}><option value="disabled">Disabled</option><option value="preferred">Preferred</option><option value="required">Required</option><option value="verify-ca">Verify CA</option><option value="verify-identity">Verify Identity</option></select></Field>
          <PathField label="CA certificate" value={record.ssl.caPath ?? ''} enabled={record.ssl.mode !== 'disabled'} error={errors.caPath} onChange={(caPath) => updateSsl({ caPath: caPath || undefined })} />
          <PathField label="Client certificate" value={record.ssl.certPath ?? ''} enabled={record.ssl.mode !== 'disabled'} onChange={(certPath) => updateSsl({ certPath: certPath || undefined })} />
          <PathField label="Client key" value={record.ssl.keyPath ?? ''} enabled={record.ssl.mode !== 'disabled'} error={errors.clientKey} onChange={(keyPath) => updateSsl({ keyPath: keyPath || undefined })} />
          <Field label="Cipher"><input value={record.ssl.cipher ?? ''} onChange={(event) => updateSsl({ cipher: event.target.value || undefined })} /></Field>
          <Field label="TLS min. version"><select value={record.ssl.minVersion ?? 'auto'} onChange={(event) => updateSsl({ minVersion: event.target.value as ConnectionRecord['ssl']['minVersion'] })}><option value="auto">Auto</option><option value="TLSv1.2">1.2</option><option value="TLSv1.3">1.3</option></select></Field>
          <Field label="Server fingerprint"><input readOnly value="Disponível após teste" /></Field>
        </div>}
        {page === 'SSH' && <div className="form-grid">
          <label className="check-field wide"><input type="checkbox" checked={record.ssh.enabled} onChange={(event) => { const enabled = event.target.checked; updateSsh({ enabled }); if (enabled) updateHttp({ enabled: false }) }} /> Use SSH tunnel</label>
          <Field label="SSH host" error={errors.sshHost}><input disabled={!record.ssh.enabled} value={record.ssh.host} onChange={(event) => updateSsh({ host: event.target.value })} /></Field>
          <Field label="SSH port" error={errors.sshPort}><input type="number" min="1" max="65535" disabled={!record.ssh.enabled} value={record.ssh.port} onChange={(event) => updateSsh({ port: Number(event.target.value) })} /></Field>
          <Field label="SSH user" error={errors.sshUser}><input disabled={!record.ssh.enabled} value={record.ssh.user} onChange={(event) => updateSsh({ user: event.target.value })} /></Field>
          <Field label="Auth method"><select disabled={!record.ssh.enabled} value={record.ssh.authMethod} onChange={(event) => updateSsh({ authMethod: event.target.value as ConnectionRecord['ssh']['authMethod'] })}><option value="password">Password</option><option value="private-key">Private key</option><option value="agent">ssh-agent</option></select></Field>
          {record.ssh.authMethod === 'password' && <Field label="SSH password" error={errors.sshPassword}><input type="password" disabled={!record.ssh.enabled} value={secrets.sshPassword} onChange={(event) => updateSecret('sshPassword', event.target.value)} placeholder={record.ssh.passwordRef ? '•••••••• (salva no cofre)' : ''} /></Field>}
          {record.ssh.authMethod === 'private-key' && <PathField label="Private key file" value={record.ssh.privateKeyFile ?? ''} enabled={record.ssh.enabled} error={errors.privateKeyFile} onChange={(privateKeyFile) => updateSsh({ privateKeyFile: privateKeyFile || undefined })} startInSsh />}
          {record.ssh.authMethod === 'private-key' && <Field label="Passphrase"><input type="password" disabled={!record.ssh.enabled} value={secrets.sshPassphrase} onChange={(event) => updateSecret('sshPassphrase', event.target.value)} placeholder={record.ssh.passphraseRef ? '•••••••• (salva no cofre)' : 'opcional'} /></Field>}
          {record.ssh.authMethod === 'agent' && <p className="form-help wide">SSH_AUTH_SOCK será verificado no processo principal ao conectar.</p>}
          <Field label="Remote host"><input disabled={!record.ssh.enabled} value={record.ssh.remoteHost || record.host} onChange={(event) => updateSsh({ remoteHost: event.target.value })} /></Field>
          <Field label="Remote port"><input type="number" disabled={!record.ssh.enabled} value={record.ssh.remotePort} onChange={(event) => updateSsh({ remotePort: Number(event.target.value) })} /></Field>
          <Field label="Local bind port" help="0 = Auto"><input type="number" min="0" max="65535" disabled={!record.ssh.enabled} value={record.ssh.localPort ?? 0} onChange={(event) => updateSsh({ localPort: Number(event.target.value) || undefined })} /></Field>
          <Field label="Keepalive (s)"><input type="number" min="0" disabled={!record.ssh.enabled} value={record.ssh.keepAliveSeconds} onChange={(event) => updateSsh({ keepAliveSeconds: Number(event.target.value) })} /></Field>
          <Field label="Known hosts fingerprint" help="A primeira conexão pede confirmação explícita."><input readOnly value={record.ssh.hostFingerprint ?? 'ainda não confiável'} /></Field>
        </div>}
        {page === 'HTTP' && <div className="form-grid">
          <label className="check-field wide"><input type="checkbox" checked={record.http.enabled} onChange={(event) => { const enabled = event.target.checked; updateHttp({ enabled }); if (enabled) updateSsh({ enabled: false }) }} /> Use HTTP tunneling</label>
          <Field label="Tunnel URL" error={errors.httpUrl} help="URL do endpoint tunnel.php instalado no servidor web."><input disabled={!record.http.enabled} value={record.http.url} onChange={(event) => updateHttp({ url: event.target.value })} placeholder="https://server/tunnel.php" /></Field>
          <Field label="HTTP user"><input disabled={!record.http.enabled} value={record.http.user ?? ''} onChange={(event) => updateHttp({ user: event.target.value || undefined })} /></Field>
          <Field label="HTTP password"><input type="password" disabled={!record.http.enabled} value={secrets.httpPassword} onChange={(event) => updateSecret('httpPassword', event.target.value)} placeholder={record.http.passwordRef ? '•••••••• (salva no cofre)' : ''} /></Field>
          <Field label="Proxy host"><input disabled={!record.http.enabled} value={record.http.proxyHost ?? ''} onChange={(event) => updateHttp({ proxyHost: event.target.value || undefined })} /></Field>
          <Field label="Proxy port"><input type="number" disabled={!record.http.enabled} value={record.http.proxyPort ?? 8080} onChange={(event) => updateHttp({ proxyPort: Number(event.target.value) })} /></Field>
          <Field label="Proxy user"><input disabled={!record.http.enabled} value={record.http.proxyUser ?? ''} onChange={(event) => updateHttp({ proxyUser: event.target.value || undefined })} /></Field>
          <Field label="Proxy password"><input type="password" disabled={!record.http.enabled} value={secrets.proxyPassword} onChange={(event) => updateSecret('proxyPassword', event.target.value)} placeholder={record.http.proxyPasswordRef ? '•••••••• (salva no cofre)' : ''} /></Field>
          <Field label="Timeout (s)"><input type="number" min="1" disabled={!record.http.enabled} value={record.http.timeoutSeconds} onChange={(event) => updateHttp({ timeoutSeconds: Number(event.target.value) })} /></Field>
          <label className="check-field wide"><input type="checkbox" disabled={!record.http.enabled} checked={!record.http.rejectUnauthorized} onChange={(event) => updateHttp({ rejectUnauthorized: !event.target.checked })} /> Ignorar erros de certificado <b className="field-error">(inseguro)</b></label>
          {record.http.enabled && <p className="form-help wide">O MySQL é encaminhado pelo servidor web; host e porta da aba General são o destino remoto do banco.</p>}
        </div>}
        {page === 'Advanced' && <div className="form-grid">
          <Field label="Connection timeout (s)"><input type="number" min="1" value={record.advanced.connectionTimeoutSeconds} onChange={(event) => updateAdvanced({ connectionTimeoutSeconds: Number(event.target.value) })} /></Field>
          <Field label="Command timeout (s)"><input type="number" min="0" value={record.advanced.commandTimeoutSeconds} onChange={(event) => updateAdvanced({ commandTimeoutSeconds: Number(event.target.value) })} /></Field>
          <Field label="Default charset"><input value={record.advanced.charset} onChange={(event) => updateAdvanced({ charset: event.target.value })} /></Field>
          <Field label="Collation"><input value={record.advanced.collation ?? ''} onChange={(event) => updateAdvanced({ collation: event.target.value || undefined })} /></Field>
          <Field label="Time zone"><select value={record.advanced.timeZone ?? 'SERVER'} onChange={(event) => updateAdvanced({ timeZone: event.target.value })}><option value="SERVER">Server</option><option value="LOCAL">Local</option><option value="Z">UTC</option></select></Field>
          <Field label="SQL mode (init)"><input value={record.advanced.sqlMode ?? ''} onChange={(event) => updateAdvanced({ sqlMode: event.target.value || undefined })} /></Field>
          <Field label="Init command(s)"><textarea rows={3} value={record.advanced.initCommands} onChange={(event) => updateAdvanced({ initCommands: event.target.value })} /></Field>
          <Field label="Keep-alive interval (s)"><input type="number" min="0" value={record.advanced.keepAliveSeconds} onChange={(event) => updateAdvanced({ keepAliveSeconds: Number(event.target.value) })} /></Field>
          <label className="check-field"><input type="checkbox" checked={record.advanced.compression} onChange={(event) => updateAdvanced({ compression: event.target.checked })} /> Compression</label>
          <label className="check-field"><input type="checkbox" checked={record.advanced.multipleStatements} onChange={(event) => updateAdvanced({ multipleStatements: event.target.checked })} /> Allow multiple statements</label>
          <label className="check-field"><input type="checkbox" checked={record.advanced.tinyInt1isBit} onChange={(event) => updateAdvanced({ tinyInt1isBit: event.target.checked })} /> Treat TINYINT(1) as boolean</label>
          <label className="check-field"><input type="checkbox" checked={record.advanced.readOnly} onChange={(event) => updateAdvanced({ readOnly: event.target.checked })} /> Read-only session</label>
          <label className="check-field"><input type="checkbox" checked={record.advanced.autoReconnect} onChange={(event) => updateAdvanced({ autoReconnect: event.target.checked })} /> Auto-reconnect</label>
          <Field label="Custom parameters" help="Uma chave=valor por linha"><textarea rows={3} value={record.advanced.customParameters.map(({ key, value }) => `${key}=${value}`).join('\n')} onChange={(event) => updateAdvanced({ customParameters: parseParameters(event.target.value) })} /></Field>
          <div><Button onClick={() => setRecord(initial)}>Restaurar padrões</Button></div>
        </div>}
      </div>
    </div>
    <div className={`connection-status ${status?.kind ?? ''}`} aria-live="polite">
      {status && <><span aria-hidden="true">{status.kind === 'loading' ? '◌' : status.kind === 'success' ? '✓' : '!'}</span> {status.text}</>}
    </div>
    <footer className="dialog-footer">
      <Button onClick={() => void runAction('test')} disabled={busy}>{busy ? 'Testing…' : 'Test Connection'}</Button>
      {busy && status?.kind === 'loading' && <Button onClick={() => { setBusy(false); setStatus({ kind: 'error', text: 'Teste cancelado.' }) }}>Cancel test</Button>}
      <span className="footer-spacer" />
      <Button variant="primary" onClick={() => void runAction('connect')} disabled={busy}>Connect</Button>
      <Button variant="primary" onClick={() => void runAction('save')} disabled={busy}>{isNew ? 'Save' : 'OK'}</Button>
      <Button onClick={onCancel} disabled={busy}>Cancel</Button>
    </footer>
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

function humanizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Falha na conexão.'
  if (/ECONNREFUSED/.test(message)) return 'Servidor recusou conexão. Verifique host/porta e se o MySQL está ativo.'
  if (/ETIMEDOUT|timed out/i.test(message)) return 'Tempo esgotado ao conectar. Verifique a rede e o timeout.'
  if (/1045|ER_ACCESS_DENIED_ERROR/.test(message)) return 'Usuário ou senha inválidos.'
  if (/1049|ER_BAD_DB_ERROR/.test(message)) return 'Database inexistente.'
  return message
}
