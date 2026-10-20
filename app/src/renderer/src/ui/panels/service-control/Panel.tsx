import { useI18n } from '../../i18n/useI18n.js'
import { useCallback, useEffect, useState } from 'react'
import type { MysqlService, MysqlServiceAction } from '../../../../../shared/contracts/service-control.js'

export default function ServiceControlPanel(): React.JSX.Element {
  const { t } = useI18n()

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
    <p>{t('panel.service.control.maad4b74753')}</p>
    <div className="service-control-toolbar"><button disabled={busy} onClick={() => void refresh()}>{busy ? 'Refreshing…' : 'Refresh'}</button><span>{services.length} {t('panel.service.control.mbec5158286')}</span></div>
    {message && <p className="service-control-message" role="status">{message}{command && <code>{command}</code>}</p>}
    {services.length === 0 && !busy && !message && <p>{t('panel.service.control.m9958ba388b')}</p>}
    <table><thead><tr><th>{t('panel.service.control.mec328ffe29')}</th><th>{t('panel.service.control.madc9b65190')}</th><th>{t('panel.service.control.m31b407c962')}</th><th>{t('panel.service.control.m6420934d2a')}</th></tr></thead><tbody>{services.map((service) => <tr key={service.unit}><td><strong>{service.unit}</strong><small>{service.description}</small></td><td><span className={`service-state ${service.state}`}>● {service.state}</span></td><td>{service.enabled === null ? 'unknown' : service.enabled ? 'enabled' : 'disabled'}</td><td className="service-actions"><button disabled={busy || service.state === 'active'} onClick={() => void control(service, 'start')}>{t('panel.service.control.m3491702b8c')}</button><button disabled={busy || service.state !== 'active'} onClick={() => void control(service, 'stop')}>{t('editor.stop')}</button><button disabled={busy || service.state !== 'active'} onClick={() => void control(service, 'restart')}>{t('panel.service.control.mb26e588cef')}</button></td></tr>)}</tbody></table>
  </section>
}

function errorText(error: unknown): string { return error instanceof Error ? error.message : 'Service Control failed.' }
