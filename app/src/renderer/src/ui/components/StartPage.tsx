import { useState } from 'react'
import type { ConnectionRecord } from '../../../../shared/contracts'
import { Button } from './Button'
import { useI18n } from '../i18n/useI18n.js'
import { startTaskGroups } from './startPageTasks.js'

export type StartPageFile = { id: string; label: string; filePath?: string }

type Props = {
  files: StartPageFile[]
  connections: ConnectionRecord[]
  onNewSql(): void
  onOpenSql(): void
  onNewConnection(): void
  onManageConnections(): void
  onOpenFile(id: string): void
  onConnect(record: ConnectionRecord): void
  onOpenTask(panel: string): void
}

export function StartPage({ files, connections, onNewSql, onOpenSql, onNewConnection, onManageConnections, onOpenFile, onConnect, onOpenTask }: Props): React.JSX.Element {
  const { t } = useI18n()
  const [activeTask, setActiveTask] = useState<(typeof startTaskGroups)[number]['id']>('development')
  const shortcuts = [
    [t('start.shortcut.newSql'), 'Ctrl+N'],
    [t('start.shortcut.openSql'), 'Ctrl+O'],
    [t('start.shortcut.newConnection'), 'Ctrl+Shift+N'],
    [t('start.shortcut.execute'), 'F5 / Ctrl+Enter']
  ]
  const tips = [t('start.tip.one'), t('start.tip.two'), t('start.tip.three')]
  const recentConnections = [...connections]
    .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
    .slice(0, 5)

  return <section className="start-page" aria-label={t('start.title')}>
    <p className="eyebrow">MySQL &amp; MariaDB</p>
    <h1>{t('start.welcome')}</h1>
    <p>{t('start.description')}</p>
    <div className="start-actions">
      <Button variant="primary" onClick={onNewSql}>{t('start.newSql')}</Button>
      <Button onClick={onOpenSql}>{t('start.openSql')}</Button>
      <Button onClick={onNewConnection}>{t('conn.new')}</Button>
      <Button onClick={onManageConnections}>{t('conn.manager.title')}</Button>
    </div>

    <div className="start-task-groups">
      <div role="tablist" aria-label={t('start.taskGroups')} onKeyDown={(event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const current = startTaskGroups.findIndex((group) => group.id === activeTask); const next = event.key === 'Home' ? 0 : event.key === 'End' ? startTaskGroups.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : startTaskGroups.length - 1)) % startTaskGroups.length; setActiveTask(startTaskGroups[next]!.id); document.getElementById(`start-task-tab-${startTaskGroups[next]!.id}`)?.focus() }}>
        {startTaskGroups.map((group) => <button type="button" role="tab" id={`start-task-tab-${group.id}`} aria-selected={activeTask === group.id} aria-controls="start-task-panel" tabIndex={activeTask === group.id ? 0 : -1} key={group.id} onClick={() => setActiveTask(group.id)}>{t(`start.task.${group.id}`)}</button>)}
      </div>
      {startTaskGroups.filter((group) => group.id === activeTask).map((group) => <section role="tabpanel" id="start-task-panel" aria-labelledby={`start-task-tab-${group.id}`} key={group.id}>
        <div>{group.tasks.map((panel) => <Button key={panel} onClick={() => onOpenTask(panel)}>{t(`start.taskPanel.${panel}`)}</Button>)}</div>
      </section>)}
    </div>

    <div className="start-content-grid">
      <section aria-labelledby="start-recent-files">
        <h2 id="start-recent-files">{t('start.recentFiles')}</h2>
        {files.length ? <ul className="start-recent-list">{files.map((file) => <li key={file.id}>
          <button className="start-recent-item" title={file.filePath ?? file.label} onClick={() => onOpenFile(file.id)}>
            <span>{file.label}</span><small>{file.filePath ?? t('start.sqlDocument')}</small>
          </button>
        </li>)}</ul> : <p className="start-empty">{t('start.emptyFiles')}</p>}
      </section>
      <section aria-labelledby="start-recent-connections">
        <h2 id="start-recent-connections">{t('start.recentConnections')}</h2>
        {recentConnections.length ? <ul className="start-recent-list">{recentConnections.map((record) => <li key={record.id}>
          <button className="start-recent-item" onClick={() => onConnect(record)}>
            <span>{record.name}</span><small>{record.user}@{record.host}:{record.port}{record.database ? ` · ${record.database}` : ''}</small>
          </button>
        </li>)}</ul> : <p className="start-empty">{t('start.emptyConnections')} <button className="start-inline-action" onClick={onManageConnections}>{t('start.openConnectionManager')}</button></p>}
      </section>
      <section aria-labelledby="start-shortcuts">
        <h2 id="start-shortcuts">{t('start.shortcuts')}</h2>
        <ul className="start-shortcuts">{shortcuts.map(([action, shortcut]) => <li key={action}><span>{action}</span><kbd>{shortcut}</kbd></li>)}</ul>
      </section>
      <section aria-labelledby="start-tips">
        <h2 id="start-tips">{t('start.tips')}</h2>
        <ul className="start-tips">{tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
      </section>
    </div>
  </section>
}
