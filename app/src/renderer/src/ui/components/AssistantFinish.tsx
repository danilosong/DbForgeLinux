import type { ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n.js'
import './AssistantFinish.css'

type Props = { summary: ReactNode; paths?: string[]; logPath?: string; onError?: (message: string) => void; moreLabel?: string; onMore?: () => void }

/** Shared completion layout and OS file/folder actions for assistant finish pages. */
export default function AssistantFinish({ summary, paths = [], logPath, onError, moreLabel, onMore }: Props): React.JSX.Element {
  const { t } = useI18n()
  async function open(path: string, kind: 'file' | 'folder'): Promise<void> {
    try { await window.tuxsql.openPathInSystem(path, kind) }
    catch (error) { onError?.(error instanceof Error ? error.message : t('assistant.finish.openError')) }
  }
  return <section className="assistant-finish" aria-labelledby="assistant-finish-title">
    <h3 id="assistant-finish-title">{t('assistant.finish.title')}</h3>
    <div className="assistant-finish-summary">{summary}</div>
    {paths.map((path) => <div className="assistant-finish-output" key={path}>
      <code>{path}</code>
      <button type="button" onClick={() => void open(path, 'file')}>{t('assistant.finish.openResultFile')}</button>
      <button type="button" onClick={() => void open(path, 'folder')}>{t('assistant.finish.openResultFolder')}</button>
    </div>)}
    {logPath && <div className="assistant-finish-output"><code>{logPath}</code><button type="button" onClick={() => void open(logPath, 'file')}>{t('assistant.finish.showLogFile')}</button></div>}
    {onMore && moreLabel && <button type="button" onClick={onMore}>{moreLabel}</button>}
  </section>
}
