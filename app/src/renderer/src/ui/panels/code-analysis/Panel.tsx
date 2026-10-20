import { useContext, useState } from 'react'
import type { CodeAnalysisFinding } from '../../../../../shared/contracts/code-analysis.js'
import { PanelEditorContext } from '../registry.js'

export default function CodeAnalysisPanel(): React.JSX.Element {
  const { sql, onFindings } = useContext(PanelEditorContext)
  const [findings, setFindings] = useState<CodeAnalysisFinding[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function analyze(): Promise<void> {
    setBusy(true); setMessage('Preparing Code Analysis…')
    try {
      const result = await window.dbforge.analyzeSql(sql)
      setFindings(result); onFindings(result)
      setMessage(result.length ? `Code analysis complete · ${result.length} findings` : 'Code analysis complete · No issues found.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Code Analysis Error') }
    finally { setBusy(false) }
  }
  return <section className="tool-panel code-analysis-panel">
    <div className="code-analysis-toolbar"><p>Static SQL checks for correctness, performance, and style. No query is executed.</p><button className="button-primary" disabled={busy || !sql.trim()} onClick={() => void analyze()}>{busy ? '◌ Analyzing…' : 'Analyze Code'}</button></div>
    {message && <p role="status">{message}</p>}
    {findings.length > 0 && <table><thead><tr><th>Severity</th><th>Rule</th><th>Category</th><th>Message</th><th>Line</th><th>Column</th></tr></thead><tbody>{findings.map((finding, index) => <tr key={`${finding.ruleId}:${finding.line}:${finding.column}:${index}`}><td className={`analysis-${finding.severity.toLowerCase()}`}>{finding.severity}</td><td>{finding.ruleId}</td><td>{finding.category}</td><td>{finding.message}</td><td>{finding.line}</td><td>{finding.column}</td></tr>)}</tbody></table>}
  </section>
}
