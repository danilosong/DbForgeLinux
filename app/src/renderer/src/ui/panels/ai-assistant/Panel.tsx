import { useI18n } from '../../i18n/useI18n.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConnectionRecord } from '../../../../../shared/contracts.js'
import { defaultAiAssistantSettings, type AiAssistantSettings, type AiChatMessage, type AiSchemaContext } from '../../../../../modules/ai-assistant/types.js'
import { usePanelConnection } from '../registry.js'

interface ChatMessage extends AiChatMessage { id: string; requestId?: string }
interface Chat { id: string; title: string; messages: ChatMessage[] }

export default function AiAssistantPanel(): React.JSX.Element {
  const { t } = useI18n()

  const active = usePanelConnection()
  const [settings, setSettings] = useState<AiAssistantSettings>({ ...defaultAiAssistantSettings })
  const [hasKey, setHasKey] = useState(false); const [apiKey, setApiKey] = useState(''); const [settingsOpen, setSettingsOpen] = useState(false); const [settingsBusy, setSettingsBusy] = useState(false); const [settingsMessage, setSettingsMessage] = useState('')
  const [connections, setConnections] = useState<ConnectionRecord[]>([]); const [connectionId, setConnectionId] = useState(active?.recordId ?? ''); const [database, setDatabase] = useState(active?.database ?? ''); const [databases, setDatabases] = useState<string[]>([])
  const [schemaReview, setSchemaReview] = useState<AiSchemaContext | null>(null); const [approvedSchema, setApprovedSchema] = useState<AiSchemaContext | null>(null); const [schemaBusy, setSchemaBusy] = useState(false)
  const [chats, setChats] = useState<Chat[]>([{ id: crypto.randomUUID(), title: 'New chat', messages: [] }]); const [chatId, setChatId] = useState(''); const [showChats, setShowChats] = useState(false)
  const [draft, setDraft] = useState(''); const [busy, setBusy] = useState(false); const [requestId, setRequestId] = useState(''); const [error, setError] = useState(''); const [insertSql, setInsertSql] = useState('')
  const runningRequest = useRef('')
  const currentChat = chats.find((chat) => chat.id === chatId) ?? chats[0]!
  const enabled = settings.provider === 'local' || hasKey || Boolean(apiKey.trim())
  const safeSchemaPreview = useMemo(() => schemaReview ? JSON.stringify(schemaReview, null, 2) : '', [schemaReview])

  useEffect(() => {
    let cancelled = false
    void window.tuxsql.loadAiAssistantSettings().then((state) => { if (!cancelled) { setSettings(state.settings); setHasKey(state.hasApiKey) } }).catch((reason: unknown) => { if (!cancelled) setSettingsMessage(reason instanceof Error ? reason.message : t('audit.ai.loadSettingsFailed')) })
    void window.tuxsql.getConnections().then((items) => { if (!cancelled) { setConnections(items); setConnectionId((current) => items.some((item) => item.id === current) ? current : active?.recordId && items.some((item) => item.id === active.recordId) ? active.recordId : items[0]?.id ?? '') } }).catch(() => undefined)
    return () => { cancelled = true }
  }, [active?.recordId, t])

  useEffect(() => {
    let cancelled = false
    const record = connections.find((item) => item.id === connectionId)
    setDatabases([])
    if (!record) return
    void window.tuxsql.connect(record).then(async (connected) => {
      try { const items = await window.tuxsql.listDatabases(connected.id); if (!cancelled) { setDatabases(items); setDatabase((current) => items.includes(current) ? current : record.database && items.includes(record.database) ? record.database : items[0] ?? '') } }
      finally { await window.tuxsql.disconnect(connected.id) }
    }).catch(() => { if (!cancelled) setDatabases([]) })
    return () => { cancelled = true }
  }, [connectionId, connections])

  useEffect(() => () => {
    const activeRequest = runningRequest.current
    if (activeRequest) void window.tuxsql.cancelAiAssistant(activeRequest).catch(() => undefined)
  }, [])

  async function reviewSchema(): Promise<void> {
    const record = connections.find((item) => item.id === connectionId)
    if (!record || !database) { setError(t('audit.ai.schemaRequired')); return }
    setSchemaBusy(true); setError('')
    try {
      const connected = await window.tuxsql.connect(record)
      let schema
      try { schema = await window.tuxsql.getQueryBuilderSchema(connected.id, database) }
      finally { await window.tuxsql.disconnect(connected.id) }
      const payload: AiSchemaContext = { database, tables: schema.tables.map((table) => ({ name: table.name, columns: table.columns.map((column) => ({ name: column.name, type: column.type, primaryKey: column.primaryKey, nullable: column.nullable })), foreignKeys: table.foreignKeys.map((foreignKey) => ({ column: foreignKey.column, referencedTable: foreignKey.referencedTable, referencedColumn: foreignKey.referencedColumn })) })) }
      setSchemaReview(payload)
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('audit.ai.schemaFailed')) }
    finally { setSchemaBusy(false) }
  }

  async function saveSettings(): Promise<void> {
    setSettingsBusy(true); setSettingsMessage('Saving securely…')
    try { const state = await window.tuxsql.saveAiAssistantSettings(settings, apiKey); setSettings(state.settings); setHasKey(state.hasApiKey); setApiKey(''); setSettingsMessage('Settings saved. API keys are stored in the secure vault.') }
    catch (reason) { setSettingsMessage(reason instanceof Error ? reason.message : t('audit.ai.saveFailed')) }
    finally { setSettingsBusy(false) }
  }

  async function testSettings(): Promise<void> {
    setSettingsBusy(true); setSettingsMessage('Testing provider…')
    try { const result = await window.tuxsql.testAiAssistantSettings(settings, apiKey); setSettingsMessage(`Provider ready · ${Math.round(result.latencyMs)} ms`) }
    catch (reason) { setSettingsMessage(reason instanceof Error ? reason.message : 'Provider test failed.') }
    finally { setSettingsBusy(false) }
  }

  function newChat(): void { const id = crypto.randomUUID(); setChats((current) => [...current, { id, title: 'New chat', messages: [] }]); setChatId(id); setError(''); setDraft('') }

  async function sendMessage(text = draft): Promise<void> {
    const prompt = text.trim()
    if (!prompt || busy) return
    if (!enabled) { setSettingsOpen(true); setError('Configure an AI provider before sending a message.'); return }
    const id = crypto.randomUUID()
    const targetChatId = currentChat.id
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: prompt }
    const assistantMessageId = crypto.randomUUID()
    const promptMessages = [...currentChat.messages, userMessage]
    const nextMessages = [...promptMessages, { id: assistantMessageId, role: 'assistant' as const, content: '', requestId: id }]
    setChats((items) => items.map((chat) => chat.id === targetChatId ? { ...chat, title: chat.title === 'New chat' ? prompt.slice(0, 48) : chat.title, messages: nextMessages } : chat))
    setDraft(''); setBusy(true); setRequestId(id); runningRequest.current = id; setError('')
    let pendingText = ''
    let animationFrame = 0
    let receivedText = false
    const flush = (): void => {
      if (!pendingText) return
      const textChunk = pendingText
      pendingText = ''
      setChats((items) => items.map((chat) => chat.id === targetChatId ? { ...chat, messages: chat.messages.map((message) => message.id === assistantMessageId ? { ...message, content: message.content + textChunk } : message) } : chat))
    }
    const unsubscribe = window.tuxsql.onAiAssistantEvent((event) => {
      if (event.requestId !== id) return
      if (event.type === 'chunk') {
        receivedText = true
        pendingText += event.text
        if (!animationFrame) animationFrame = window.requestAnimationFrame(() => { animationFrame = 0; flush() })
      } else if (event.type === 'error' && event.message !== 'AI request canceled.') setError(event.message)
    })
    try {
      const response = await window.tuxsql.completeAiAssistant({ requestId: id, messages: promptMessages.map(({ role, content }) => ({ role, content })), schema: approvedSchema ?? undefined })
      if (animationFrame) { window.cancelAnimationFrame(animationFrame); animationFrame = 0 }
      flush()
      setChats((items) => items.map((chat) => chat.id === targetChatId ? { ...chat, messages: chat.messages.map((message) => message.id === assistantMessageId ? { ...message, content: response.text } : message) } : chat))
    } catch (reason) {
      if (animationFrame) { window.cancelAnimationFrame(animationFrame); animationFrame = 0 }
      flush()
      const message = reason instanceof Error ? reason.message : 'AI request failed.'
      if (message !== 'AI request canceled.') setError(message)
      if (!receivedText) setChats((items) => items.map((chat) => chat.id === targetChatId ? { ...chat, messages: chat.messages.filter((entry) => entry.id !== assistantMessageId) } : chat))
    } finally {
      unsubscribe()
      setBusy(false)
      setRequestId('')
      if (runningRequest.current === id) runningRequest.current = ''
    }
  }

  async function stop(): Promise<void> { if (requestId) await window.tuxsql.cancelAiAssistant(requestId) }

  function confirmInsert(): void {
    window.dispatchEvent(new CustomEvent('tuxsql:insert-ai-sql', { detail: { sql: insertSql } }))
    setInsertSql('')
  }

  return <section className="ai-panel">
    <header className="ai-header"><div><h2>✦ {t('ai.title')}</h2><p>{t('panel.ai.assistant.m9c6d59766f')}</p></div><div><button onClick={() => setShowChats((value) => !value)}>{t('ai.chat.all')}</button><button onClick={newChat}>＋ {t('ai.chat.new')}</button><button onClick={() => setSettingsOpen((value) => !value)}>⚙ {t('ai.chat.settings')}</button></div></header>
    {showChats && <nav className="ai-chat-list" aria-label={t('ai.chat.all')}>{chats.map((chat) => <button key={chat.id} className={chat.id === currentChat.id ? 'selected' : ''} onClick={() => { setChatId(chat.id); setShowChats(false) }}>{chat.title}</button>)}</nav>}
    <div className="ai-context">
      {approvedSchema ? <><span className="ai-schema-chip">{t('panel.ai.assistant.m6514b013df')} {approvedSchema.tables.length} {t('panel.ai.assistant.m13fb7ad882')}</span><button onClick={() => setApprovedSchema(null)}>{t('panel.ai.assistant.m6e4f81b152')}</button></> : <><label>{t('panel.ai.assistant.m5739038c16')} <select aria-label={t('panel.ai.assistant.m474411a091')} value={connectionId} onChange={(event) => setConnectionId(event.target.value)}><option value="">{t('panel.ai.assistant.m6c8c9edfbe')}</option>{connections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{t('panel.ai.assistant.m67bcf34e02')} <select aria-label={t('panel.ai.assistant.m33ac32d2b1')} value={database} onChange={(event) => setDatabase(event.target.value)}><option value="">{t('panel.ai.assistant.mf13e241de9')}</option>{databases.map((item) => <option key={item}>{item}</option>)}</select></label><button disabled={schemaBusy || !database} onClick={() => void reviewSchema()}>{schemaBusy ? 'Loading schema…' : 'Review schema payload'}</button><span>{t('panel.ai.assistant.ma57d6237cc')}</span></>}
    </div>
    <div className="ai-actions"><button onClick={() => setDraft((value) => `Explain the SQL and describe its behavior:\n\n${value}`)}>{t('ai.cmd.explainSql')}</button><button onClick={() => setDraft((value) => `Optimize this SQL and explain any index suggestions:\n\n${value}`)}>{t('ai.cmd.optimizeHint')}</button><button onClick={() => setDraft((value) => `Generate a MySQL SQL query for this request:\n\n${value}`)}>{t('ai.cmd.nl2sql')}</button></div>
    <div className="ai-thread" aria-live="polite">{!currentChat.messages.length && <div className="ai-empty">{t('panel.ai.assistant.m943dfa33e5')}</div>}{currentChat.messages.map((message) => <article className={`ai-message ai-${message.role}`} key={message.id}><strong>{message.role === 'user' ? 'You' : 'AI Assistant'}</strong><MessageContent message={message} onInsert={(sql) => setInsertSql(sql)} /></article>)}{busy && <p className="ai-thinking">{t('panel.ai.assistant.m00aa89ad0a')}</p>}{error && <p className="ai-error" role="alert">{error}</p>}</div>
    <div className="ai-composer"><textarea aria-label={t('panel.ai.assistant.mce6f588240')} placeholder={t('panel.ai.assistant.m11efc409e0')} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() } }} /><button disabled={!draft.trim() || busy} onClick={() => void sendMessage()}>{t('panel.ai.assistant.ma338c309a6')}</button>{busy && <button onClick={() => void stop()}>{t('panel.ai.assistant.m8d7f489db0')}</button>}</div>
    {!enabled && <p className="ai-note">{t('panel.ai.assistant.mb190d1d7d5')}</p>}
    <p className="ai-disclaimer">{t('panel.ai.assistant.m02fcc7610e')}</p>
    {settingsOpen && <div className="ai-overlay"><section role="dialog" aria-modal="true" aria-label={t('panel.ai.assistant.m73b26359c1')} className="ai-settings"><header><h3>{t('panel.ai.assistant.m73b26359c1')}</h3><button onClick={() => setSettingsOpen(false)}>×</button></header><label>{t('panel.ai.assistant.m8b2c909fb2')}<select value={settings.provider} onChange={(event) => setSettings((value) => ({ ...value, provider: event.target.value as AiAssistantSettings['provider'] }))}><option value="openai">{t('panel.ai.assistant.m33647e67c8')}</option><option value="anthropic">{t('panel.ai.assistant.m04689d28fb')}</option><option value="compatible">{t('panel.ai.assistant.m4b0517f70b')}</option><option value="local">{t('panel.ai.assistant.mf51ed27613')}</option></select></label><label>{t('panel.ai.assistant.mb72379e9b0')}<input value={settings.endpoint} onChange={(event) => setSettings((value) => ({ ...value, endpoint: event.target.value }))} placeholder={t('panel.ai.assistant.m7050bdc376')} /></label><label>{t('panel.ai.assistant.mdcfa4b5683')}<input value={settings.model} onChange={(event) => setSettings((value) => ({ ...value, model: event.target.value }))} /></label><label>{t('panel.ai.assistant.m2020b5b28a')}<input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={hasKey ? 'Saved in the secure vault' : settings.provider === 'local' ? 'Not required for local provider' : 'Enter API key'} /></label><div className="ai-setting-grid"><label>{t('panel.ai.assistant.ma905b1d067')}<input type="number" min="0" max="2" step="0.1" value={settings.temperature} onChange={(event) => setSettings((value) => ({ ...value, temperature: Number(event.target.value) }))} /></label><label>{t('panel.ai.assistant.m89283ec1b4')}<input type="number" min="1" max="128000" value={settings.maxTokens} onChange={(event) => setSettings((value) => ({ ...value, maxTokens: Number(event.target.value) }))} /></label><label>{t('panel.ai.assistant.m5d836609e3')}<input type="number" min="500" max="300000" value={settings.timeoutMs} onChange={(event) => setSettings((value) => ({ ...value, timeoutMs: Number(event.target.value) }))} /></label></div><p className="ai-vault-note">{t('panel.ai.assistant.m37b85ca5b5')}</p><div className="ai-settings-actions"><button disabled={settingsBusy} onClick={() => void testSettings()}>{t('panel.ai.assistant.m1ca271a920')}</button><button disabled={settingsBusy} onClick={() => void saveSettings()}>{t('panel.ai.assistant.m27c0fd4f48')}</button></div>{settingsMessage && <p role="status">{settingsMessage}</p>}</section></div>}
    {schemaReview && <div className="ai-overlay"><section role="dialog" aria-modal="true" aria-label={t('panel.ai.assistant.m1e1f33802a')} className="ai-payload"><header><h3>{t('panel.ai.assistant.mccc23836cc')}</h3><button onClick={() => setSchemaReview(null)}>×</button></header><p>{t('panel.ai.assistant.mf8f701a90f')}</p><pre>{safeSchemaPreview}</pre><footer><button onClick={() => setSchemaReview(null)}>{t('common.cancel')}</button><button onClick={() => { setApprovedSchema(schemaReview); setSchemaReview(null) }}>{t('panel.ai.assistant.m93ff5605f3')}</button></footer></section></div>}
    {insertSql && <div className="ai-overlay"><section role="dialog" aria-modal="true" aria-label={t('panel.ai.assistant.md94e4e6dd2')} className="ai-payload"><h3>{t('panel.ai.assistant.m165cf39ad2')}</h3><p>{t('panel.ai.assistant.m792b6bc268')}</p><pre>{insertSql}</pre><footer><button onClick={() => setInsertSql('')}>{t('common.cancel')}</button><button onClick={confirmInsert}>{t('panel.ai.assistant.m3e51529cca')}</button></footer></section></div>}
    <style>{`.ai-panel{height:100%;min-height:0;display:flex;flex-direction:column;gap:9px;color:var(--text);position:relative;overflow:hidden}.ai-header,.ai-header>div,.ai-context,.ai-actions,.ai-composer,.ai-settings header,.ai-settings-actions,.ai-payload footer{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ai-header{justify-content:space-between;flex:0 0 auto}.ai-header h2{margin:0}.ai-header p{margin:3px 0;color:var(--text-secondary)}.ai-context{flex:0 0 auto;padding:7px;background:var(--bg-surface-alt);border:1px solid var(--border);border-radius:8px}.ai-context span{color:var(--text-secondary);font-size:12px}.ai-schema-chip{color:var(--accent)!important}.ai-actions{flex:0 0 auto;flex-direction:column;align-items:stretch;gap:6px}.app-shell .ai-panel .ai-actions button:not(.button-primary){width:100%;min-height:36px;justify-content:flex-start;padding:7px 10px;text-align:left;border:1px solid color-mix(in srgb,var(--border-control) 24%,transparent);border-radius:8px;background:color-mix(in srgb,var(--text-primary) 4%,transparent);color:var(--text-secondary);transition:color 140ms ease,background-color 140ms ease,border-color 140ms ease}.app-shell .ai-panel .ai-actions button:not(.button-primary):hover:not(:disabled){border-color:color-mix(in srgb,var(--accent) 34%,var(--border-control));background:color-mix(in srgb,var(--accent) 8%,var(--bg-surface));color:var(--text-primary)}.ai-thread{flex:1 1 auto;min-height:100px;overflow:auto;padding:8px;border:1px solid var(--border);border-radius:8px;background:color-mix(in srgb,var(--bg-surface) 72%,var(--bg-app))}.ai-thread:has(.ai-empty){overflow:hidden}.ai-empty{max-width:270px;margin:auto;text-align:center;color:var(--text-tertiary);padding:22px 16px;font-size:12px;line-height:1.55}.ai-empty::before{content:"✦";display:grid;place-items:center;width:34px;height:34px;margin:0 auto 10px;border:1px solid color-mix(in srgb,var(--accent) 20%,transparent);border-radius:50%;background:color-mix(in srgb,var(--accent) 8%,var(--bg-surface));color:var(--accent);font-size:17px}.ai-message{max-width:92%;padding:9px 11px;margin:8px 0;border-radius:8px;background:var(--bg-surface-alt);white-space:pre-wrap;overflow-wrap:anywhere}.ai-message strong{display:block;margin-bottom:5px}.ai-user{margin-left:auto;background:var(--bg-hover)}.ai-code{background:var(--bg);border:1px solid var(--border);padding:8px;overflow:auto;white-space:pre}.ai-thinking{color:var(--text-secondary)}.ai-error{color:var(--danger,#c43131)}.ai-composer{flex:0 0 auto;align-items:stretch;padding:5px;border:1px solid color-mix(in srgb,var(--border-control) 48%,transparent);border-radius:10px;background:color-mix(in srgb,var(--bg-surface-alt) 72%,var(--bg-surface));transition:border-color 140ms ease,box-shadow 140ms ease}.ai-composer:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}.ai-composer textarea{flex:1;min-height:62px;resize:vertical;background:transparent;color:var(--text);border:0;border-radius:6px;padding:8px;box-shadow:none}.app-shell .ai-panel .ai-composer>button:first-of-type{align-self:stretch;min-width:72px;border:1px solid var(--accent);border-radius:8px;background:var(--accent);color:var(--text-on-accent);font-weight:650;box-shadow:var(--shadow-xs);transition:filter 140ms ease,opacity 140ms ease}.app-shell .ai-panel .ai-composer>button:first-of-type:hover:not(:disabled){filter:brightness(.94)}.app-shell .ai-panel .ai-composer>button:first-of-type:disabled{opacity:.56}.ai-disclaimer,.ai-note,.ai-vault-note{font-size:12px;color:var(--text-secondary);margin:0}.ai-chat-list{display:flex;gap:4px;overflow:auto}.ai-chat-list button.selected{color:var(--accent)}.ai-overlay{position:absolute;inset:0;z-index:20;display:grid;place-items:center;background:#0007;padding:16px}.ai-settings,.ai-payload{width:min(640px,95%);max-height:90%;overflow:auto;padding:16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:7px;box-shadow:0 12px 36px #0005}.ai-settings header{justify-content:space-between}.ai-settings h3,.ai-payload h3{margin:0}.ai-settings>label{display:flex;flex-direction:column;gap:4px;margin:9px 0}.ai-settings input,.ai-settings select{background:var(--bg);color:var(--text);border:1px solid var(--border);padding:6px}.ai-setting-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ai-setting-grid label{display:flex;flex-direction:column;gap:4px}.ai-settings-actions{justify-content:flex-end;margin-top:10px}.ai-payload pre{max-height:46vh;overflow:auto;padding:10px;background:var(--bg);white-space:pre-wrap;overflow-wrap:anywhere}.ai-payload footer{justify-content:flex-end}`}</style>
  </section>
}

function MessageContent({ message, onInsert }: { message: ChatMessage; onInsert: (sql: string) => void }): React.JSX.Element {
  const { t } = useI18n()
  const match = /```(?:sql|mysql|mariadb)?\s*([\s\S]*?)```/i.exec(message.content)
  if (message.role === 'assistant' && match?.[1]) {
    const sql = match[1].trim()
    return <><p>{message.content.slice(0, match.index).trim()}</p><pre className="ai-code"><code>{sql}</code></pre><button onClick={() => void navigator.clipboard.writeText(sql)}>{t('common.copy')}</button><button onClick={() => onInsert(sql)}>{t('panel.ai.assistant.mb533148700')}</button><p>{message.content.slice((match.index ?? 0) + match[0].length).trim()}</p></>
  }
  return <p>{message.content}</p>
}
