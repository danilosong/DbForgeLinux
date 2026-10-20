import type { ConnectionRecord } from '../../../../shared/contracts'
import { Button } from './Button'

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
}

const shortcuts = [
  ['New SQL', 'Ctrl+N'],
  ['Open SQL file', 'Ctrl+O'],
  ['New connection', 'Ctrl+Shift+N'],
  ['Execute query', 'F5 / Ctrl+Enter']
]

const tips = [
  'Use Ctrl+N para abrir um documento SQL rapidamente.',
  'Salve consultas frequentes como arquivos SQL para encontrá-las aqui.',
  'Conecte-se a um database pelo Explorer para explorar tabelas e objetos.'
]

export function StartPage({ files, connections, onNewSql, onOpenSql, onNewConnection, onManageConnections, onOpenFile, onConnect }: Props): React.JSX.Element {
  const recentConnections = [...connections]
    .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
    .slice(0, 5)

  return <section className="start-page" aria-label="Start Page">
    <p className="eyebrow">MySQL &amp; MariaDB</p>
    <h1>Comece a trabalhar</h1>
    <p>Abra um documento SQL ou conecte-se a um servidor.</p>
    <div className="start-actions">
      <Button variant="primary" onClick={onNewSql}>New SQL</Button>
      <Button onClick={onOpenSql}>Open SQL File…</Button>
      <Button onClick={onNewConnection}>New Connection</Button>
      <Button onClick={onManageConnections}>Connection Manager</Button>
    </div>

    <div className="start-content-grid">
      <section aria-labelledby="start-recent-files">
        <h2 id="start-recent-files">Recent Files</h2>
        {files.length ? <ul className="start-recent-list">{files.map((file) => <li key={file.id}>
          <button className="start-recent-item" title={file.filePath ?? file.label} onClick={() => onOpenFile(file.id)}>
            <span>{file.label}</span><small>{file.filePath ?? 'SQL document'}</small>
          </button>
        </li>)}</ul> : <p className="start-empty">Nenhum arquivo recente.</p>}
      </section>
      <section aria-labelledby="start-recent-connections">
        <h2 id="start-recent-connections">Recent Connections</h2>
        {recentConnections.length ? <ul className="start-recent-list">{recentConnections.map((record) => <li key={record.id}>
          <button className="start-recent-item" onClick={() => onConnect(record)}>
            <span>{record.name}</span><small>{record.user}@{record.host}:{record.port}{record.database ? ` · ${record.database}` : ''}</small>
          </button>
        </li>)}</ul> : <p className="start-empty">Nenhuma conexão recente. <button className="start-inline-action" onClick={onManageConnections}>Abrir Connection Manager</button></p>}
      </section>
      <section aria-labelledby="start-shortcuts">
        <h2 id="start-shortcuts">Shortcuts</h2>
        <ul className="start-shortcuts">{shortcuts.map(([action, shortcut]) => <li key={action}><span>{action}</span><kbd>{shortcut}</kbd></li>)}</ul>
      </section>
      <section aria-labelledby="start-tips">
        <h2 id="start-tips">Tips</h2>
        <ul className="start-tips">{tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
      </section>
    </div>
  </section>
}
