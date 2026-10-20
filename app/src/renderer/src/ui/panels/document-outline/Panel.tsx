import { useContext, useMemo } from 'react'
import { splitSqlStatements } from '../../../../../shared/sqlStatements.js'
import { PanelEditorContext, PanelNavigationContext } from '../registry.js'
import { useI18n } from '../../i18n/useI18n.js'

export default function DocumentOutlinePanel(): React.JSX.Element {
  const { sql } = useContext(PanelEditorContext)
  const { onNavigate } = useContext(PanelNavigationContext)
  const { t } = useI18n()
  const nodes = useMemo(() => splitSqlStatements(sql).flatMap((statement) => {
    const body = statement.sql.trim()
    if (!body) return []
    const line = sql.slice(0, statement.start).split('\n').length
    const title = body.match(/^(?:CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMPORARY\s+)?(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?[^`\s.]+`?\.)?`?([^`\s(;]+)`?|(?:WITH\b|SELECT\b|INSERT\b|UPDATE\b|DELETE\b|ALTER\b|DROP\b|CALL\b|SET\b|USE\b))/i)
    return [{ title: title?.[1] ? `${body.match(/^CREATE\s+\w+/i)?.[0] ?? 'CREATE'} ${title[1]}` : title?.[0] ?? body.slice(0, 80), line, start: statement.start }]
  }), [sql])
  return <section className="navigation-panel"><header><strong>{t('outline.title')}</strong><span>{nodes.length}</span></header>{nodes.length ? <div className="navigation-list">{nodes.map((node, index) => <button key={`${node.start}:${index}`} onClick={() => onNavigate({ documentId: '', offset: node.start, line: node.line, column: 1, length: 0, text: node.title })}>↳ {node.title}<small>{t('nav.line', [node.line])}</small></button>)}</div> : <p>{t('nav.outlineEmpty')}</p>}</section>
}
