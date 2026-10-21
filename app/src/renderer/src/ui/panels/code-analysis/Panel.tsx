import { useI18n } from '../../i18n/useI18n.js'
import { useContext, useState } from 'react'
import type { CodeAnalysisFinding } from '../../../../../shared/contracts/code-analysis.js'
import { PanelEditorContext } from '../registry.js'

export default function CodeAnalysisPanel(): React.JSX.Element {
  const { t } = useI18n()

  const { sql, onFindings } = useContext(PanelEditorContext)
  const [findings, setFindings] = useState<CodeAnalysisFinding[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function analyze(): Promise<void> {
    setBusy(true); setMessage(t('audit.code.preparing'))
    try {
      const result = await window.tuxsql.analyzeSql(sql)
      setFindings(result); onFindings(result)
      setMessage(result.length ? t('audit.code.findings', [result.length]) : t('audit.code.clean'))
    } catch (error) { setMessage(error instanceof Error ? error.message : t('audit.code.error')) }
    finally { setBusy(false) }
  }
  return <section className="tool-panel code-analysis-panel">
    <div className="code-analysis-toolbar"><p>{t('panel.code.analysis.m64fcc58a4a')}</p><button className="button-primary" disabled={busy || !sql.trim()} onClick={() => void analyze()}>{busy ? `◌ ${t('audit.code.analyzing')}` : t('audit.code.run')}</button></div>
    {message && <p role="status">{message}</p>}
    {findings.length > 0 && <table><thead><tr><th>{t('panel.code.analysis.me248ad354c')}</th><th>{t('panel.code.analysis.md19904a865')}</th><th>{t('panel.code.analysis.me5c3b8995b')}</th><th>{t('panel.code.analysis.m40f506f1af')}</th><th>{t('panel.code.analysis.med9e98b898')}</th><th>{t('panel.code.analysis.md70c9d8946')}</th></tr></thead><tbody>{findings.map((finding, index) => <tr key={`${finding.ruleId}:${finding.line}:${finding.column}:${index}`}><td className={`analysis-${finding.severity.toLowerCase()}`}>{finding.severity}</td><td>{finding.ruleId}</td><td>{finding.category}</td><td>{t(`analysis.rule.${finding.ruleId}`) || finding.message}</td><td>{finding.line}</td><td>{finding.column}</td></tr>)}</tbody></table>}
  </section>
}
