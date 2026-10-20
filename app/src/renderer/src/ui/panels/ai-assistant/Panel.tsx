import { useEffect, useMemo, useState } from 'react'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import { defaultAiAssistantSettings, type AiAssistantSettings, type AiChatMessage, type AiSchemaContext } from '../../../../../modules/ai-assistant/types.js'
import { usePanelConnection } from '../registry.js'

interface ChatMessage extends AiChatMessage { id: string; requestId?: string }
interface Chat { id: string; title: string; messages: ChatMessage[] }

export default function AiAssistantPanel(): React.JSX.Element {
  const active = usePanelConnection()
  const [settings, setSettings] = useState<AiAssistantSettings>({ ...defaultAiAssistantSettings })
  const [hasKey, setHasKey] = useState(false); const [apiKey, setApiKey] = useState(''); const [settingsOpen, setSettingsOpen] = useState(false); const [settingsBusy, setSettingsBusy] = useState(false); const [settingsMessage, setSettingsMessage] = useState('')
  const [connections, setConnections] = useState<ConnectionRecord[]>([]); const [connectionId, setConnectionId] = useState(active?.recordId ?? ''); const [database, setDatabase] = useState(active?.database ?? ''); const [databases, setDatabases] = useState<string[]>([])
  const [schemaReview, setSchemaReview] = useState<AiSchemaContext | null>(null); const [approvedSchema, setApprovedSchema] = useState<AiSchemaContext | null>(null); const [schemaBusy, setSchemaBusy] = useState(false)
  const [chats, setChats] = useState<Chat[]>([{ id: crypto.randomUUID(), title: 'New chat', messages: [] }]); const [chatId, setChatId] = useState(''); const [showChats, setShowChats] = useState(false)
  const [draft, setDraft] = useState(''); const [busy, setBusy] = useState(false); const [requestId, setRequestId] = useState(''); const [error, setError] = useState(''); const [insertSql, setInsertSql] = useState('')
  const currentChat = chats.find((chat) => chat.id === chatId) ?? chats[0]!
  const enabled = settings.provider === 'local' || hasKey || Boolean(apiKey.trim())
  const safeSchemaPreview = useMemo(() => schemaReview ? JSON.stringify(schemaReview, null, 2) : '', [schemaReview])

  useEffect(() => {
    let cancelled = false
    void window.dbforge.loadAiAssistantSettings().then((state) => { if (!cancelled) { setSettings(state.settings); setHasKey(state.hasApiKey) } }).catch((reason: unknown) => { if (!cancelled) setSettingsMessage(reason instanceof Error ? reason.message : 'Could not load AI settings.') })
    void window.dbforge.getConnections().then((items) => { if (!cancelled) { setConnections(items); setConnectionId((current) => items.some((item) => item.id === current) ? current : active?.recordId && items.some((item) => item.id === active.recordId) ? active.recordId : items[0]?.id ?? '') } }).catch(() => undefined)
    return () => { cancelled = true }
  }, [active?.recordId])

  useEffect(() => {
    let cancelled = false
    const record = connections.find((item) => item.id === connectionId)
    setDatabases([])
    if (!record) return
    void window.dbforge.connect(record).then(async (connected) => {
      try { const items = await window.dbforge.listDatabases(connected.id); if (!cancelled) { setDatabases(items); setDatabase((current) => items.includes(current) ? current : record.database && items.includes(record.database) ? record.database : items[0] ?? '') } }
      finally { await window.dbforge.disconnect(connected.id) }
    }).catch(() => { if (!cancelled) setDatabases([]) })
    return () => { cancelled = true }
  }, [connectionId, connections])

  async function reviewSchema(): Promise<void> {
    const record = connections.find((item) => item.id === connectionId)
    if (!record || !database) { setError('Choose a connection and database before attaching schema.'); return }
    setSchemaBusy(true); setError('')
    try {
      const connected = await window.dbforge.connect(record)
      let schema
      try { schema = await window.dbforge.getQueryBuilderSchema(connected.id, database) }
      finally { await window.dbforge.disconnect(connected.id) }
      const payload: AiSchemaContext = { database, tables: schema.tables.map((table) => ({ name: table.name, columns: table.columns.map((column) => ({ name: column.name, type: column.type, primaryKey: column.primaryKey, nullable: column.nullable })), foreignKeys: table.foreignKeys.map((foreignKey) => ({ column: foreignKey.column, referencedTable: foreignKey.referencedTable, referencedColumn: foreignKey.referencedColumn })) })) }
      setSchemaReview(payload)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read schema metadata.') }
    finally { setSchemaBusy(false) }
  }

  async function saveSettings(): Promise<void> {
    setSettingsBusy(true); setSettingsMessage('Saving securely…')
    try { const state = await window.dbforge.saveAiAssistantSettings(settings, apiKey); setSettings(state.settings); setHasKey(state.hasApiKey); setApiKey(''); setSettingsMessage('Settings saved. API keys are stored in the secure vault.') }
    catch (reason) { setSettingsMessage(reason instanceof Error ? reason.message : 'Could not save AI settings.') }
    finally { setSettingsBusy(false) }
  }

  async function testSettings(): Promise<void> {
    setSettingsBusy(true); setSettingsMessage('Testing provider…')
    try { const result = await window.dbforge.testAiAssistantSettings(settings, apiKey); setSettingsMessage(`Provider ready · ${Math.round(result.latencyMs)} ms`) }
    catch (reason) { setSettingsMessage(reason instanceof Error ? reason.message : 'Provider test failed.') }
    finally { setSettingsBusy(false) }
  }

  function newChat(): void { const id = crypto.randomUUID(); setChats((current) => [...current, { id, title: 'New chat', messages: [] }]); setChatId(id); setError(''); setDraft('') }

  async function sendMessage(text = draft): Promise<void> {
    const prompt = text.trim()
    if (!prompt || busy) return
    if (!enabled) { setSettingsOpen(true); setError('Configure an AI provider before sending a message.'); return }
    const id = crypto.randomUUID()
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: prompt }
    const nextMessages = [...currentChat.messages, userMessage]
    setChats((items) => items.map((chat) => chat.id === currentChat.id ? { ...chat, title: chat.title === 'New chat' ? prompt.slice(0, 48) : chat.title, messages: nextMessages } : chat))
    setDraft(''); setBusy(true); setRequestId(id); setError('')
    try {
      const response = await window.dbforge.completeAiAssistant({ requestId: id, messages: nextMessages.map(({ role, content }) => ({ role, content })), schema: approvedSchema ?? undefined })
      const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: response.text, requestId: id }
      setChats((items) => items.map((chat) => chat.id === currentChat.id ? { ...chat, messages: [...chat.messages, assistantMessage] } : chat))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'AI request failed.') }
    finally { setBusy(false); setRequestId('') }
  }

  async function stop(): Promise<void> { if (requestId) await window.dbforge.cancelAiAssistant(requestId); setBusy(false) }

  function confirmInsert(): void {
    window.dispatchEvent(new CustomEvent('dbforge:insert-ai-sql', { detail: { sql: insertSql } }))
    setInsertSql('')
  }

  return <section className="ai-panel">
    <header className="ai-header"><div><h2>✦ AI Assistant</h2><p>Review every answer before using generated SQL.</p></div><div><button onClick={() => setShowChats((value) => !value)}>All Chats</button><button onClick={newChat}>＋ New chat</button><button onClick={() => setSettingsOpen((value) => !value)}>⚙ Chat Settings</button></div></header>
    {showChats && <nav className="ai-chat-list" aria-label="All Chats">{chats.map((chat) => <button key={chat.id} className={chat.id === currentChat.id ? 'selected' : ''} onClick={() => { setChatId(chat.id); setShowChats(false) }}>{chat.title}</button>)}</nav>}
    <div className="ai-context">
      {approvedSchema ? <><span className="ai-schema-chip">Sending: {approvedSchema.tables.length} tables · metadata only</span><button onClick={() => setApprovedSchema(null)}>Remove schema</button></> : <><label>Connection <select aria-label="Schema connection" value={connectionId} onChange={(event) => setConnectionId(event.target.value)}><option value="">Select connection</option>{connections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Database <select aria-label="Schema database" value={database} onChange={(event) => setDatabase(event.target.value)}><option value="">Select database</option>{databases.map((item) => <option key={item}>{item}</option>)}</select></label><button disabled={schemaBusy || !database} onClick={() => void reviewSchema()}>{schemaBusy ? 'Loading schema…' : 'Review schema payload'}</button><span>No schema context is sent unless you approve it.</span></>}
    </div>
    <div className="ai-actions"><button onClick={() => setDraft((value) => `Explain the SQL and describe its behavior:\n\n${value}`)}>Explain SQL</button><button onClick={() => setDraft((value) => `Optimize this SQL and explain any index suggestions:\n\n${value}`)}>Optimize</button><button onClick={() => setDraft((value) => `Generate a MySQL SQL query for this request:\n\n${value}`)}>Convert Natural Language to SQL</button></div>
    <div className="ai-thread" aria-live="polite">{!currentChat.messages.length && <div className="ai-empty">You have no chats yet. Ask about SQL, query plans, or database design.</div>}{currentChat.messages.map((message) => <article className={`ai-message ai-${message.role}`} key={message.id}><strong>{message.role === 'user' ? 'You' : 'AI Assistant'}</strong><MessageContent message={message} onInsert={(sql) => setInsertSql(sql)} /></article>)}{busy && <p className="ai-thinking">Thinking…</p>}{error && <p className="ai-error" role="alert">{error}</p>}</div>
    <div className="ai-composer"><textarea aria-label="Message to AI Assistant" placeholder="Ask a database question… (Enter to send, Shift+Enter for a new line)" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() } }} /><button disabled={!draft.trim() || busy} onClick={() => void sendMessage()}>Send ▶</button>{busy && <button onClick={() => void stop()}>Stop ■</button>}</div>
    {!enabled && <p className="ai-note">Configure a provider to start the chat. Local models can use an HTTP endpoint without an API key.</p>}
    <p className="ai-disclaimer">AI responses may be incorrect. Review SQL before running it. Query rows are never attached by default.</p>
    {settingsOpen && <div className="ai-overlay"><section role="dialog" aria-modal="true" aria-label="AI Assistant settings" className="ai-settings"><header><h3>AI Assistant settings</h3><button onClick={() => setSettingsOpen(false)}>×</button></header><label>Provider<select value={settings.provider} onChange={(event) => setSettings((value) => ({ ...value, provider: event.target.value as AiAssistantSettings['provider'] }))}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="compatible">OpenAI compatible</option><option value="local">Local (Ollama / HTTP)</option></select></label><label>Endpoint URL<input value={settings.endpoint} onChange={(event) => setSettings((value) => ({ ...value, endpoint: event.target.value }))} placeholder="https://api.openai.com" /></label><label>Model<input value={settings.model} onChange={(event) => setSettings((value) => ({ ...value, model: event.target.value }))} /></label><label>API key<input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={hasKey ? 'Saved in the secure vault' : settings.provider === 'local' ? 'Not required for local provider' : 'Enter API key'} /></label><div className="ai-setting-grid"><label>Temperature<input type="number" min="0" max="2" step="0.1" value={settings.temperature} onChange={(event) => setSettings((value) => ({ ...value, temperature: Number(event.target.value) }))} /></label><label>Max tokens<input type="number" min="1" max="128000" value={settings.maxTokens} onChange={(event) => setSettings((value) => ({ ...value, maxTokens: Number(event.target.value) }))} /></label><label>Timeout (ms)<input type="number" min="500" max="300000" value={settings.timeoutMs} onChange={(event) => setSettings((value) => ({ ...value, timeoutMs: Number(event.target.value) }))} /></label></div><p className="ai-vault-note">API keys are encrypted in the system vault. They are never written to settings files or logs.</p><div className="ai-settings-actions"><button disabled={settingsBusy} onClick={() => void testSettings()}>Test provider</button><button disabled={settingsBusy} onClick={() => void saveSettings()}>Save settings</button></div>{settingsMessage && <p role="status">{settingsMessage}</p>}</section></div>}
    {schemaReview && <div className="ai-overlay"><section role="dialog" aria-modal="true" aria-label="Schema payload review" className="ai-payload"><header><h3>Review schema payload</h3><button onClick={() => setSchemaReview(null)}>×</button></header><p>Only database, table/column names, types, keys, nullability and foreign-key metadata will be sent. No row values are included.</p><pre>{safeSchemaPreview}</pre><footer><button onClick={() => setSchemaReview(null)}>Cancel</button><button onClick={() => { setApprovedSchema(schemaReview); setSchemaReview(null) }}>Approve and attach schema</button></footer></section></div>}
    {insertSql && <div className="ai-overlay"><section role="dialog" aria-modal="true" aria-label="Confirm SQL insertion" className="ai-payload"><h3>Insert generated SQL into the editor?</h3><p>This opens a new SQL tab. It will not run the statement.</p><pre>{insertSql}</pre><footer><button onClick={() => setInsertSql('')}>Cancel</button><button onClick={confirmInsert}>Insert into editor</button></footer></section></div>}
    <style>{`.ai-panel{height:100%;display:flex;flex-direction:column;gap:9px;color:var(--text);position:relative}.ai-header,.ai-header>div,.ai-context,.ai-actions,.ai-composer,.ai-settings header,.ai-settings-actions,.ai-payload footer{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ai-header{justify-content:space-between}.ai-header h2{margin:0}.ai-header p{margin:3px 0;color:var(--text-secondary)}.ai-context{padding:7px;background:var(--bg-surface-alt);border:1px solid var(--border);border-radius:5px}.ai-context span{color:var(--text-secondary);font-size:12px}.ai-schema-chip{color:var(--accent)!important}.ai-thread{flex:1;min-height:180px;overflow:auto;padding:8px;border:1px solid var(--border);border-radius:5px}.ai-empty{text-align:center;color:var(--text-secondary);padding:35px}.ai-message{max-width:92%;padding:9px 11px;margin:8px 0;border-radius:8px;background:var(--bg-surface-alt);white-space:pre-wrap;overflow-wrap:anywhere}.ai-message strong{display:block;margin-bottom:5px}.ai-user{margin-left:auto;background:var(--bg-hover)}.ai-code{background:var(--bg);border:1px solid var(--border);padding:8px;overflow:auto;white-space:pre}.ai-thinking{color:var(--text-secondary)}.ai-error{color:var(--danger,#c43131)}.ai-composer{align-items:stretch}.ai-composer textarea{flex:1;min-height:62px;resize:vertical;background:var(--bg-surface);color:var(--text);border:1px solid var(--border);padding:8px}.ai-disclaimer,.ai-note,.ai-vault-note{font-size:12px;color:var(--text-secondary);margin:0}.ai-chat-list{display:flex;gap:4px;overflow:auto}.ai-chat-list button.selected{color:var(--accent)}.ai-overlay{position:absolute;inset:0;z-index:20;display:grid;place-items:center;background:#0007;padding:16px}.ai-settings,.ai-payload{width:min(640px,95%);max-height:90%;overflow:auto;padding:16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:7px;box-shadow:0 12px 36px #0005}.ai-settings header{justify-content:space-between}.ai-settings h3,.ai-payload h3{margin:0}.ai-settings>label{display:flex;flex-direction:column;gap:4px;margin:9px 0}.ai-settings input,.ai-settings select{background:var(--bg);color:var(--text);border:1px solid var(--border);padding:6px}.ai-setting-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ai-setting-grid label{display:flex;flex-direction:column;gap:4px}.ai-settings-actions{justify-content:flex-end;margin-top:10px}.ai-payload pre{max-height:46vh;overflow:auto;padding:10px;background:var(--bg);white-space:pre-wrap;overflow-wrap:anywhere}.ai-payload footer{justify-content:flex-end}`}</style>
  </section>
}

function MessageContent({ message, onInsert }: { message: ChatMessage; onInsert: (sql: string) => void }): React.JSX.Element {
  const match = /```(?:sql|mysql|mariadb)?\s*([\s\S]*?)```/i.exec(message.content)
  if (message.role === 'assistant' && match?.[1]) {
    const sql = match[1].trim()
    return <><p>{message.content.slice(0, match.index).trim()}</p><pre className="ai-code"><code>{sql}</code></pre><button onClick={() => void navigator.clipboard.writeText(sql)}>Copy</button><button onClick={() => onInsert(sql)}>Insert SQL…</button><p>{message.content.slice((match.index ?? 0) + match[0].length).trim()}</p></>
  }
  return <p>{message.content}</p>
}
