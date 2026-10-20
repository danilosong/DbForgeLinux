import { useContext } from 'react'
import { PanelNavigationContext } from '../registry.js'
import { useI18n } from '../../i18n/useI18n.js'

export default function FindResultsPanel(): React.JSX.Element {
  const { matches, onNavigate } = useContext(PanelNavigationContext)
  const { t } = useI18n()
  return <section className="navigation-panel"><header><strong>{t('nav.findResults')}</strong><span>{matches.length}</span></header>{matches.length ? <div className="navigation-list">{matches.map((match, index) => <button key={`${match.documentId}:${match.offset}:${index}`} onClick={() => onNavigate(match)}><b>{match.documentLabel}:{match.line}:{match.column}</b><code>{match.text}</code></button>)}</div> : <p>{t('nav.noResults')}</p>}</section>
}
