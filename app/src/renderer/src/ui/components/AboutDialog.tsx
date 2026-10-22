import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/useI18n.js'
import { PanelDialog } from './PanelDialog.js'
import type { AboutInfo } from '../../../../shared/contracts/about.js'
import './AboutDialog.css'

export function AboutDialog({ onClose }: { onClose(): void }): React.JSX.Element {
  const { t, locale } = useI18n()
  const openPage = (link: 'documentation' | 'license'): void => {
    const theme = ['dark', 'high-contrast'].includes(document.documentElement.dataset.theme ?? '') ? 'dark' : 'light'
    void window.tuxsql.openAboutLink(link, locale, theme)
  }
  const [info, setInfo] = useState<AboutInfo>()
  const [copyState, setCopyState] = useState('')

  useEffect(() => { void window.tuxsql.getAboutInfo().then(setInfo).catch(() => setCopyState(t('about.loadError'))) }, [t])

  async function copySystemInfo(): Promise<void> {
    if (!info) return
    const text = [
      `${info.name} ${info.version}`,
      `${t('about.creator')}: ${info.creator}`,
      `${t('about.license')}: ${info.license}`,
      `Electron ${info.electron}`, `Chromium ${info.chromium}`, `Node.js ${info.node}`, `mysql2 ${info.mysql2}`,
      `${t('about.platform')}: ${info.platform} (${info.architecture})`
    ].join('\n')
    try { await navigator.clipboard.writeText(text); setCopyState(t('about.copied')) }
    catch { setCopyState(t('about.copyError')) }
  }

  return <PanelDialog title={t('about.title')} closeLabel={t('about.close')} onClose={onClose}>
    <div className="about-panel">
      <h2>{t('about.title')}</h2>
      <p className="about-product-name">{info?.name ?? 'TuxSQL'} <span>{info ? `v${info.version}` : '…'}</span></p>
      <dl className="about-versions">
        <dt>{t('about.creator')}</dt><dd>{info?.creator ?? 'Danilo Song'}</dd>
        <dt>{t('about.license')}</dt><dd>{info?.license ?? 'MIT'}</dd>
        <dt>{t('about.electron')}</dt><dd>{info?.electron ?? '…'}</dd>
        <dt>{t('about.chromium')}</dt><dd>{info?.chromium ?? '…'}</dd>
        <dt>{t('about.node')}</dt><dd>{info?.node ?? '…'}</dd>
        <dt>{t('about.mysql2')}</dt><dd>{info?.mysql2 ?? '…'}</dd>
      </dl>
      <p className="about-legal">{t('about.legal')}</p>
      <div className="about-links">
        <button type="button" onClick={() => openPage('documentation')}>{t('about.documentation')}</button>
        <button type="button" onClick={() => void window.tuxsql.openAboutLink('repository')}>{t('about.repository')}</button>
        <button type="button" onClick={() => openPage('license')}>{t('about.licenseLink')}</button>
      </div>
      <footer><button type="button" onClick={() => void copySystemInfo()} disabled={!info}>{t('about.copy')}</button>{copyState && <span role="status">{copyState}</span>}<span className="toolbar-spacer" /><button type="button" onClick={onClose}>{t('about.close')}</button></footer>
    </div>
  </PanelDialog>
}
