import { useCallback, useEffect, useState } from 'react'
import type { RecentTask, TaskKind } from '../../../../../shared/contracts/tasks.js'
import { useI18n } from '../../i18n/useI18n.js'
import './Panel.css'

const destination: Record<TaskKind, string> = { backup: 'database-tools', export: 'import-export', import: 'import-export', 'schema-compare': 'schema-compare', 'data-compare': 'data-compare' }
export default function Panel(): React.JSX.Element {
  const { t } = useI18n()
  const [tasks, setTasks] = useState<RecentTask[]>([])
  const [message, setMessage] = useState('')
  const refresh = useCallback(async (): Promise<void> => { try { setTasks(await window.tuxsql.listRecentTasks()); setMessage('') } catch { setMessage(t('tasks.loadError')) } }, [t])
  useEffect(() => { void refresh() }, [refresh])
  async function remove(id: string): Promise<void> { try { await window.tuxsql.deleteRecentTask(id); await refresh() } catch { setMessage(t('tasks.loadError')) } }
  function reopen(task: RecentTask): void { window.dispatchEvent(new CustomEvent('tuxsql:task:reopen', { detail: { panel: destination[task.kind], kind: task.kind } })) }
  return <section className="tool-panel tasks-panel" aria-label={t('tasks.title')}>
    <header className="tasks-header"><div><h2>{t('tasks.title')}</h2><p>{t('tasks.hint')}</p></div><button type="button" onClick={() => void refresh()}>{t('common.refresh')}</button></header>
    {message && <p role="status">{message}</p>}
    {tasks.length ? <ul className="tasks-list">{tasks.map((task) => <li key={task.id}>
      <div><strong>{task.title}</strong><span>{t(`tasks.kind.${task.kind}`)}{task.detail ? ` · ${task.detail}` : ''}</span><time dateTime={task.updatedAt}>{new Date(task.updatedAt).toLocaleString()}</time></div>
      <button type="button" onClick={() => reopen(task)}>{t('tasks.reopen')}</button><button type="button" aria-label={t('tasks.remove', [task.title])} onClick={() => void remove(task.id)}>{t('tasks.removeAction')}</button>
    </li>)}</ul> : !message && <p className="tasks-empty">{t('tasks.empty')}</p>}
  </section>
}
