import { useState } from 'react'
import Editor from '@monaco-editor/react'
import type { ConnectionSummary, QueryResult } from '../../../shared/contracts'

export default function App(): React.JSX.Element {
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState('3306')
  const [user, setUser] = useState('root')
  const [password, setPassword] = useState('')
  const [connection, setConnection] = useState<ConnectionSummary | null>(null)
  const [databases, setDatabases] = useState<string[]>([])
  const [tables, setTables] = useState<string[]>([])
  const [database, setDatabase] = useState('')
  const [sql, setSql] = useState('SELECT 1 AS ready;')
  const [results, setResults] = useState<QueryResult[]>([])
  const [status, setStatus] = useState('Desconectado')
  const [busy, setBusy] = useState(false)

  async function connect(): Promise<void> {
    setBusy(true)
    try {
      const config = { host, port: Number(port), user, password }
      const check = await window.dbforge.testConnection(config)
      const connected = await window.dbforge.connect(config)
      setConnection(connected)
      const found = await window.dbforge.listDatabases(connected.id)
      setDatabases(found)
      setStatus(`Conectado · ${check.serverVersion}`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Falha na conexão') }
    finally { setBusy(false) }
  }

  async function selectDatabase(value: string): Promise<void> {
    setDatabase(value)
    setTables(connection ? await window.dbforge.listTables(connection.id, value) : [])
  }

  async function runSql(): Promise<void> {
    if (!connection) return
    setBusy(true)
    try { setResults(await window.dbforge.executeSql(connection.id, sql)); setStatus('Consulta concluída') }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Falha na consulta') }
    finally { setBusy(false) }
  }

  async function disconnect(): Promise<void> {
    if (connection) await window.dbforge.disconnect(connection.id)
    setConnection(null); setDatabases([]); setTables([]); setStatus('Desconectado')
  }

  return <main className="shell">
    <header className="topbar"><strong>dbForgeLinux</strong><span className="status">{status}</span></header>
    <aside className="sidebar">
      <h2>Conexão</h2>
      <label>Host<input value={host} onChange={(e) => setHost(e.target.value)} /></label>
      <div className="row"><label>Porta<input value={port} onChange={(e) => setPort(e.target.value)} /></label><label>Usuário<input value={user} onChange={(e) => setUser(e.target.value)} /></label></div>
      <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <div className="row actions"><button disabled={busy || Boolean(connection)} onClick={() => void connect()}>Conectar</button><button disabled={!connection} onClick={() => void disconnect()}>Desconectar</button></div>
      <h2>Explorer</h2>
      {connection && databases.map((name) => <div key={name} className="tree">
        <button className="tree-item" onClick={() => void selectDatabase(name)}>{database === name ? '▾' : '▸'} {name}</button>
        {database === name && tables.map((table) => <div key={table} className="table-item">▤ {table}</div>)}
      </div>)}
      {!connection && <p className="muted">Conecte-se para listar databases e tabelas.</p>}
    </aside>
    <section className="workspace">
      <div className="editor-heading"><span>Consulta SQL {database && `· ${database}`}</span><button disabled={!connection || busy} onClick={() => void runSql()}>Executar</button></div>
      <div className="editor"><Editor height="100%" language="sql" theme="vs-dark" value={sql} onChange={(value) => setSql(value ?? '')} options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true }} /></div>
      <section className="results"><div className="results-heading">Resultados {results.length > 1 ? `(${results.length} conjuntos)` : ''}</div>
        {results.length === 0 ? <p className="muted">Execute uma consulta para ver os resultados.</p> : results.map((result, index) => <div className="result-set" key={index}>
          {result.columns.length ? <table><thead><tr>{result.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{result.rows.map((row, rowIndex) => <tr key={rowIndex}>{result.columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}</tr>)}</tbody></table> : <p>{result.affectedRows} linha(s) afetada(s) · ID {result.insertId}</p>}
        </div>)}
      </section>
    </section>
    <footer>{connection ? `${connection.user}@${connection.host}:${connection.port}` : 'Nenhuma conexão ativa'} <span>{status}</span></footer>
  </main>
}

function formatCell(value: unknown): string {
  if (value === null) return 'NULL'
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
