import { Fragment, useContext, useEffect, useState } from 'react'
import { PanelNavigationContext } from '../registry.js'
import { useI18n } from '../../i18n/useI18n.js'

export default function ObjectViewerPanel(): React.JSX.Element {
  const { selectedObject, metadata } = useContext(PanelNavigationContext)
  const { t } = useI18n()
  const [ddl, setDdl] = useState('')
  const [error, setError] = useState('')
  const [statistics, setStatistics] = useState<Record<string, unknown>>()
  useEffect(() => {
    let cancelled = false
    setDdl(''); setError(''); setStatistics(undefined)
    if (selectedObject) {
      void window.tuxsql.showCreateObject(selectedObject.connection.id, selectedObject.database, selectedObject.object).then((value) => { if (!cancelled) setDdl(value) }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : t('nav.viewerError')) })
      if (selectedObject.object.kind === 'table') {
        const literal = (value: string): string => `'${value.replaceAll("'", "''")}'`
        const query = `SELECT TABLE_ROWS AS rowEstimate, DATA_LENGTH AS dataBytes, INDEX_LENGTH AS indexBytes, CREATE_TIME AS createdAt, UPDATE_TIME AS updatedAt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ${literal(selectedObject.database)} AND TABLE_NAME = ${literal(selectedObject.object.name)}`
        void window.tuxsql.executeSql(selectedObject.connection.id, query, crypto.randomUUID(), selectedObject.database).then(async (results) => {
          const result = results[0]
          if (!result) return
          const rows = result.resultStoreId ? await window.tuxsql.readResultRows(result.resultStoreId, 0, 1) : result.rows
          if (result.resultStoreId) await window.tuxsql.disposeResult(result.resultStoreId)
          if (!cancelled) setStatistics(rows[0])
        }).catch(() => { if (!cancelled) setStatistics(undefined) })
      }
    }
    return () => { cancelled = true }
  }, [selectedObject, t])
  if (!selectedObject) return <section className="navigation-panel"><p>{t('nav.selectObject')}</p></section>
  const object = selectedObject.object
  const columns = metadata.objects.find((item) => item.name === object.name)?.columns ?? []
  const dependencies = metadata.objects.map((item) => item.name).concat(metadata.routines.map((item) => item.name)).filter((name) => name !== object.name && new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(ddl))
  return <section className="navigation-panel object-viewer"><header><strong>{object.name}</strong><span>{object.kind} · {selectedObject.database} · {selectedObject.connection.name}</span></header><h3>{t('nav.properties')}</h3><dl><dt>{t('nav.objectType')}</dt><dd>{object.kind}</dd><dt>{t('nav.database')}</dt><dd>{selectedObject.database}</dd><dt>{t('nav.connection')}</dt><dd>{selectedObject.connection.name}</dd></dl><h3>{t('nav.columnsAndKeys')}</h3>{columns.length ? <table><thead><tr><th>{t('nav.column')}</th><th>{t('nav.dataType')}</th></tr></thead><tbody>{columns.map((column) => <tr key={column.name}><td>{column.name}</td><td>{column.type}</td></tr>)}</tbody></table> : <p>{t('nav.ddlContains')}</p>}<p>{t('nav.ddlKeys')}</p><h3>{t('nav.dependencies')}</h3>{dependencies.length ? <ul>{dependencies.map((name) => <li key={name}>{name}</li>)}</ul> : <p>{t('nav.noDependencies')}</p>}<h3>{t('nav.statistics')}</h3>{statistics ? <dl>{Object.entries(statistics).map(([key, value]) => <Fragment key={key}><dt>{key}</dt><dd>{value == null ? '—' : String(value)}</dd></Fragment>)}</dl> : <p>{t('nav.statisticsUnavailable')}</p>}<h3>{t('nav.ddl')}</h3>{error ? <p role="alert">{error}</p> : <pre>{ddl || t('nav.loading')}</pre>}</section>
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
