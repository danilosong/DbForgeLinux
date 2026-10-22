import { useCallback, useEffect, useState } from 'react'
import type { ContainerEngineStatus, DisposableLocalServer, LocalDatabaseFlavor } from '../../../../../shared/contracts/local-server.js'
import { requiredContainerRemovalConfirmation } from '../../../../../shared/contracts/local-server.js'
import { useI18n } from '../../i18n/useI18n.js'

function localizedError(error: unknown, fallback: string, translate: (key: string) => string): string {
  return error instanceof Error && error.message.startsWith('localServer.error.') ? translate(error.message) : translate(fallback)
}

export default function LocalServerPanel(): React.JSX.Element {
  const { t } = useI18n()
  const [engine, setEngine] = useState<ContainerEngineStatus | null>(null)
  const [servers, setServers] = useState<DisposableLocalServer[]>([])
  const [flavor, setFlavor] = useState<LocalDatabaseFlavor>('mysql')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const refresh = useCallback(async () => {
    setBusy(true)
    try { const status = await window.tuxsql.inspectLocalContainerEngine(); setEngine(status); setServers(status.available ? await window.tuxsql.listDisposableLocalServers() : []); setMessage('') }
    catch (error) { setMessage(localizedError(error, 'localServer.createFailed', t)) }
    finally { setBusy(false) }
  }, [t])
  useEffect(() => { void refresh() }, [refresh])
  async function create(): Promise<void> { setBusy(true); setMessage('')
    try { await window.tuxsql.createDisposableLocalServer(flavor); await refresh() }
    catch (error) { setMessage(localizedError(error, 'localServer.createFailed', t)) }
    finally { setBusy(false) }
  }
  async function remove(server: DisposableLocalServer): Promise<void> {
    const phrase = requiredContainerRemovalConfirmation(server.name)
    const entered = window.prompt(t('localServer.removePrompt', [phrase]))
    if (entered !== phrase) { setMessage(t('localServer.removeCanceled')); return }
    setBusy(true); setMessage('')
    try { await window.tuxsql.removeDisposableLocalServer(server.id, entered); await refresh() }
    catch (error) { setMessage(localizedError(error, 'localServer.removeFailed', t)) }
    finally { setBusy(false) }
  }
  async function createProfile(server: DisposableLocalServer): Promise<void> {
    setBusy(true); setMessage('')
    try { const profile = await window.tuxsql.createDisposableConnectionProfile(server.id); setMessage(`${t('localServer.profileCreated')} (${profile.name})`); await refresh() }
    catch (error) { setMessage(localizedError(error, 'localServer.profileFailed', t)) }
    finally { setBusy(false) }
  }
  return <section className="tool-panel service-control-panel local-server-panel">
    <h2>{t('localServer.title')}</h2>
    <p>{t('localServer.description')}</p>
    {engine && <p role="status">{engine.available ? t('localServer.engineAvailable', [engine.engine ?? '']) : t('localServer.engineUnavailable')}</p>}
    {message && <p className="service-control-message" role="status">{message}</p>}
    <div className="service-control-toolbar">
      <label>{t('localServer.database')} <select aria-label={t('localServer.database')} value={flavor} onChange={event => setFlavor(event.target.value as LocalDatabaseFlavor)}><option value="mysql">MySQL</option><option value="mariadb">MariaDB</option></select></label>
      <button disabled={busy || !engine?.available} onClick={() => void create()}>{t('localServer.create')}</button>
      <button disabled={busy} onClick={() => void refresh()}>{t('localServer.refresh')}</button>
    </div>
    {servers.length === 0 && <p>{engine?.available ? t('localServer.none') : t('localServer.engineUnavailable')}</p>}
    {servers.map(server => <article key={server.id} className="local-server-card">
      <strong>{server.name}</strong><span>{server.flavor} · {server.state} · {server.host}{server.port ? `:${server.port}` : ` · ${t('localServer.waitingPort')}`}</span>
      <div><button disabled={busy || !server.canCreateProfile} onClick={() => void createProfile(server)}>{server.profileCreated ? t('localServer.profileExists') : t('localServer.createProfile')}</button><button disabled={busy} onClick={() => void remove(server)}>{t('localServer.remove')}</button></div>
    </article>)}
  </section>
}
