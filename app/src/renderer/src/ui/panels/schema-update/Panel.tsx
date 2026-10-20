import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/useI18n.js'
import type { SchemaUpdateItem } from '../../../../../modules/schema-update/index.js'

export default function SchemaUpdatePanel(): React.JSX.Element {
  const { t } = useI18n(); const [items, setItems] = useState<SchemaUpdateItem[]>([]); const [selected, setSelected] = useState<string[]>([]); const [previewOpen, setPreviewOpen] = useState(false); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  const chosen = useMemo(() => items.filter((item) => selected.includes(item.id)), [items, selected]); const script = chosen.map((item) => `-- ${item.source} → ${item.database}\n${item.script}`).join('\n\n')
  const refresh = useCallback(async (): Promise<void> => { try { setItems(await window.dbforge.listSchemaUpdates()) } catch (error) { setMessage(error instanceof Error ? error.message : t('extras.schema.previewUnavailable')) } }, [t])
  useEffect(() => { void refresh() }, [refresh])
  async function remove(): Promise<void> { if (!selected.length) return; await window.dbforge.removeSchemaUpdates(selected); setSelected([]); await refresh() }
  async function execute(): Promise<void> {
    if (!chosen.length) return
    const target = chosen[0]!.database
    if (chosen.some((item) => item.database !== target || item.connectionId !== chosen[0]!.connectionId)) { setMessage(t('extras.schema.targetMismatch')); return }
    const risk = chosen.some((item) => item.destructive)
    if (!window.confirm(t('extras.schema.confirm', [target]) + (risk ? '\n\nThis script contains destructive statements.' : ''))) return
    setBusy(true); setMessage('')
    try { const result = await window.dbforge.executeSchemaUpdates(selected, true); setMessage(`${t('extras.schema.result', [result.succeeded, result.failed])}${result.errors.length ? ` · ${result.errors.join('; ')}` : ''}`); await refresh(); setSelected([]) }
    catch (error) { setMessage(error instanceof Error ? error.message : t('extras.schema.failed')) }
    finally { setBusy(false) }
  }
  return <section className="tool-panel extras-schema-panel"><h2>{t('extras.schema.title')}</h2><p>{items.length ? t('extras.schema.count', [items.length]) : t('extras.schema.empty')}</p>
    <div className="extras-schema-list">{items.map((item) => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span><strong>{item.source}</strong><small>{item.database} · {new Date(item.createdAt).toLocaleString()}</small>{item.destructive && <em>{t('extras.schema.destructive')}</em>}</span></label>)}</div>
    <div className="extras-actions"><button disabled={!selected.length} onClick={() => setPreviewOpen(true)}>{t('extras.schema.preview')}</button><button disabled={!selected.length || busy} onClick={() => void execute()}>{t('extras.schema.execute')}</button><button disabled={!selected.length || busy} onClick={() => void remove()}>{t('extras.schema.remove')}</button></div>
    {previewOpen && <div className="extras-overlay" role="dialog" aria-modal="true" aria-label={t('extras.schema.preview')}><section><h3>{t('extras.schema.preview')}</h3><textarea readOnly value={script} /><button onClick={() => setPreviewOpen(false)}>{t('common.cancel')}</button></section></div>}
    {message && <p role="status">{message}</p>}<style>{`.extras-schema-panel{height:100%;display:flex;flex-direction:column;gap:8px;color:var(--text)}.extras-schema-list{overflow:auto;flex:1;border:1px solid var(--border)}.extras-schema-list label{display:flex;gap:8px;padding:9px;border-bottom:1px solid var(--border)}.extras-schema-list span{display:grid;gap:4px}.extras-schema-list small{color:var(--text-secondary)}.extras-schema-list em{color:var(--danger)}.extras-actions{display:flex;gap:6px;flex-wrap:wrap}.extras-overlay{position:fixed;inset:0;display:grid;place-items:center;background:#0008;z-index:200}.extras-overlay section{width:min(800px,90vw);padding:16px;background:var(--bg-surface);border:1px solid var(--border)}.extras-overlay textarea{width:100%;height:50vh;font-family:monospace;background:var(--bg);color:var(--text)}`}</style>
  </section>
}
