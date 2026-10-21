import { useI18n } from '../../i18n/useI18n.js'
import { useEffect, useMemo, useState } from 'react'
import type { GeneratedDocumentation, WrittenDocumentation } from '../../../../../modules/documenter/index.js'
import type { DocumentFormat } from '../../../../../modules/documenter/index.js'
import { usePanelConnection } from '../registry'

const localDateTime = (): { date: string; stamp: string } => {
  const now = new Date(); const pad = (value: number): string => String(value).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return { date, stamp: `${date.replaceAll('-', '')}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}` }
}

export default function Panel(): React.JSX.Element {
  const { t } = useI18n()
  const activeConnection = usePanelConnection()
  const [connectionId, setConnectionId] = useState(activeConnection?.id ?? '')
  const [database, setDatabase] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [copyright, setCopyright] = useState('')
  const [logo, setLogo] = useState('')
  const [directory, setDirectory] = useState('')
  const [appendTimestamp, setAppendTimestamp] = useState(true)
  const [openAfter, setOpenAfter] = useState(true)
  const [formats, setFormats] = useState<DocumentFormat[]>(['html'])
  const [diagram, setDiagram] = useState(true)
  const [preview, setPreview] = useState<GeneratedDocumentation | null>(null)
  const [result, setResult] = useState<WrittenDocumentation | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tree, setTree] = useState<Array<{name:string;columns:string[];indexes:string[]}>>([])
  const [excludedColumns, setExcludedColumns] = useState<string[]>([])
  const [excludedIndexes, setExcludedIndexes] = useState<string[]>([])
  const folderName = useMemo(() => `${(database || 'documentation').replace(/[^a-zA-Z0-9_-]/g, '_')}${appendTimestamp ? `_${localDateTime().stamp}` : ''}`, [database, appendTimestamp])
  useEffect(() => setConnectionId(activeConnection?.id ?? ''), [activeConnection?.id])
  useEffect(() => { if (!connectionId || !database.trim()) { setTree([]); return }; let live = true; void window.dbforge.listDocumenterObjects(connectionId, database).then((items) => { if (live) setTree(items) }).catch(() => { if (live) setTree([]) }); return () => { live = false } }, [connectionId, database])

  async function previewDoc(): Promise<void> {
    setError('')
    try { setPreview(await window.dbforge.previewDatabaseDocumentation(connectionId, database, title || undefined)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('documenter.error')) }
  }
  async function generate(): Promise<void> {
    if (!window.confirm(t('documenter.confirm'))) return
    setBusy(true); setError('')
    try {
      const paths = await window.dbforge.generateDatabaseDocumentation({ connectionId, database, title: title || undefined, author, copyright, logo, created: localDateTime().date, folderName, descriptions: { cover: description }, formats, outputDirectory: directory, includeDiagram: diagram, excludedColumns, excludedIndexes, confirmed: true })
      setResult(paths)
      if (openAfter) {
        const first = paths.html ?? paths.pdf ?? paths.markdown
        if (first) { const openError = await window.dbforge.openDocumentationPath(first); if (openError) setError(openError) }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('documenter.error')) }
    finally { setBusy(false) }
  }
  function toggleFormat(format: DocumentFormat): void { setFormats((current) => current.includes(format) ? current.filter((item) => item !== format) : [...current, format]) }

  return <section className="tool-panel documenter-panel">
    <header><h2>{t('documenter.title')}</h2><p>{t('documenter.help')}</p></header>
    <fieldset><legend>{t('documenter.scope')}</legend>
      {activeConnection ? <p>{t('documenter.connection')}: <strong>{activeConnection.name}</strong></p> : <label>{t('documenter.connection')} <input value={connectionId} onChange={(event) => setConnectionId(event.target.value)} /></label>}
      <label>{t('documenter.database')} <input value={database} onChange={(event) => setDatabase(event.target.value)} /></label>
      <details><summary>{t('documenter.tree')}</summary><ul><li><label><input type="checkbox" defaultChecked /> {t('documenter.cover')}</label></li><li><details open><summary>{activeConnection?.name || connectionId || t('documenter.server')} / {database || t('documenter.database')}</summary><ul>{tree.map((table) => <li key={table.name}><details><summary>{table.name}</summary><ul><li><strong>{t('documenter.columnsTree')}</strong><ul>{table.columns.map((column) => { const key = `${table.name}.${column}`; return <li key={key}><label><input type="checkbox" checked={!excludedColumns.includes(key)} onChange={(event) => setExcludedColumns((current) => event.target.checked ? current.filter((item) => item !== key) : [...current, key])} />{column}</label></li> })}</ul></li><li><strong>{t('documenter.indexesTree')}</strong><ul>{table.indexes.map((index) => { const key = `${table.name}.${index}`; return <li key={key}><label><input type="checkbox" checked={!excludedIndexes.includes(key)} onChange={(event) => setExcludedIndexes((current) => event.target.checked ? current.filter((item) => item !== key) : [...current, key])} />{index}</label></li> })}</ul></li></ul></details></li>)}</ul></details></li><li><label><input type="checkbox" defaultChecked /> {t('documenter.users')}</label></li></ul></details>
    </fieldset>
    <fieldset><legend>{t('documenter.cover')}</legend>
      <nav aria-label={t('documenter.breadcrumb')}>{t('documenter.server')} / {database || t('documenter.database')} / {t('documenter.cover')}</nav>
      <div className="documenter-fields">
        <label>{t('documenter.titleField')} <input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>{t('documenter.logo')} <input value={logo} onChange={(event) => setLogo(event.target.value)} placeholder={t('documenter.logoHint')} /></label>
        <label>{t('documenter.description')} <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></label>
        <label>{t('documenter.author')} <input value={author} onChange={(event) => setAuthor(event.target.value)} /></label>
        <label>{t('documenter.copyright')} <input value={copyright} onChange={(event) => setCopyright(event.target.value)} /></label>
        <label>{t('documenter.created')} <input type="date" value={localDateTime().date} readOnly /></label>
      </div>
    </fieldset>
    <fieldset><legend>{t('documenter.generate')}</legend>
      <label>{t('documenter.output')} <input value={directory} onChange={(event) => setDirectory(event.target.value)} placeholder="/home/user/Documents" /></label>
      <label>{t('documenter.folder')} <input value={folderName} readOnly /></label>
      <div className="documenter-formats">{(['html', 'pdf', 'markdown'] as const).map((format) => <label key={format}><input type="checkbox" checked={formats.includes(format)} onChange={() => toggleFormat(format)} /> {format.toUpperCase()}</label>)}</div>
      <label><input type="checkbox" checked={appendTimestamp} onChange={(event) => setAppendTimestamp(event.target.checked)} /> {t('documenter.timestamp')}</label>
      <label><input type="checkbox" checked={openAfter} onChange={(event) => setOpenAfter(event.target.checked)} /> {t('documenter.openAfter')}</label>
      <label><input type="checkbox" checked={diagram} onChange={(event) => setDiagram(event.target.checked)} /> {t('panel.documenter.m914977dcaa')}</label>
      <div><button disabled={!connectionId || !database} onClick={() => void previewDoc()}>{t('panel.documenter.m697fa19667')}</button> <button className="button-primary" disabled={busy || !connectionId || !database || !directory.trim() || !formats.length} onClick={() => void generate()}>{busy ? t('documenter.generating') : t('documenter.generate')}</button></div>
    </fieldset>
    {preview && <details open><summary>{t('panel.documenter.m48be62c9c8')}</summary><iframe title={t('panel.documenter.m772c9aea69')} srcDoc={preview.html} style={{ width: '100%', height: 260, border: '1px solid var(--border)' }} /><pre>{preview.markdown.slice(0, 1800)}</pre></details>}
    {result && <p role="status">{t('panel.documenter.mace24bede7')} {Object.values(result).filter(Boolean).join(' · ')}</p>}{error && <p role="alert">{error}</p>}
    <style>{`.documenter-panel{display:flex;flex-direction:column;gap:10px;overflow:auto}.documenter-panel header h2{margin:0}.documenter-panel header p{margin:4px 0;color:var(--text-secondary)}.documenter-panel fieldset{border:1px solid var(--border);border-radius:5px;padding:10px}.documenter-panel legend{font-weight:600}.documenter-panel label{display:inline-flex;align-items:center;gap:6px;margin:5px 12px 5px 0}.documenter-panel fieldset>label{display:flex;max-width:650px}.documenter-panel fieldset>label input:not([type=checkbox]),.documenter-fields input,.documenter-fields textarea{flex:1;min-width:120px}.documenter-fields{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:4px 12px}.documenter-fields label{display:flex}.documenter-formats{display:flex;gap:12px}.documenter-panel details{margin-top:8px}.documenter-panel pre{max-height:220px;overflow:auto}`}</style>
  </section>
}
