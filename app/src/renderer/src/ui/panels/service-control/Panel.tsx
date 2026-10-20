import { useCallback, useEffect, useState } from 'react'
import type { MysqlService, MysqlServiceAction } from '../../../../../shared/contracts/service-control.js'

export default function ServiceControlPanel(): React.JSX.Element {
  const [services, setServices] = useState<MysqlService[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [command, setCommand] = useState('')
  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true)
    try { setServices(await window.dbforge.listMysqlServices()); setMessage('') }
    catch (error) { setMessage(errorText(error)) }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function control(service: MysqlService, action: MysqlServiceAction): Promise<void> {
    const commandText = `systemctl ${action} ${service.unit}`
    if (!window.confirm(`${action === 'start' ? 'Start' : action === 'stop' ? 'Stop' : action === 'restart' ? 'Restart' : action === 'enable' ? 'Enable' : 'Disable'} ${service.unit}?\n\nCommand: ${commandText}`)) return
    setBusy(true); setCommand(''); setMessage('')
    try {
      const result = await window.dbforge.controlMysqlService(service.unit, action)
      setCommand(result.command)
      if (result.authorizationRequired) setMessage('Permissão negada. O app não tentou escalar privilégios; execute o comando abaixo manualmente.')
      else setMessage(`${service.unit}: ${result.service.state}${result.service.enabled === null ? '' : ` · ${result.service.enabled ? 'enabled' : 'disabled'}`}`)
      await refresh()
    } catch (error) { setMessage(errorText(error)) }
    finally { setBusy(false) }
  }

  return <section className="tool-panel service-control-panel">
    <p>Controla somente serviços MySQL/MariaDB locais pelo systemd. Ações sempre pedem confirmação; o app nunca chama sudo.</p>
    <div className="service-control-toolbar"><button disabled={busy} onClick={() => void refresh()}>{busy ? 'Refreshing…' : 'Refresh'}</button><span>{services.length} services</span></div>
    {message && <p className="service-control-message" role="status">{message}{command && <code>{command}</code>}</p>}
    {services.length === 0 && !busy && !message && <p>Nenhum serviço MySQL/MariaDB foi encontrado.</p>}
    <table><thead><tr><th>Service</th><th>State</th><th>Enabled at boot</th><th>Actions</th></tr></thead><tbody>{services.map((service) => <tr key={service.unit}><td><strong>{service.unit}</strong><small>{service.description}</small></td><td><span className={`service-state ${service.state}`}>● {service.state}</span></td><td>{service.enabled === null ? 'unknown' : service.enabled ? 'enabled' : 'disabled'}</td><td className="service-actions"><button disabled={busy || service.state === 'active'} onClick={() => void control(service, 'start')}>Start</button><button disabled={busy || service.state !== 'active'} onClick={() => void control(service, 'stop')}>Stop</button><button disabled={busy || service.state !== 'active'} onClick={() => void control(service, 'restart')}>Restart</button></td></tr>)}</tbody></table>
  </section>
}

function errorText(error: unknown): string { return error instanceof Error ? error.message : 'Service Control failed.' }
