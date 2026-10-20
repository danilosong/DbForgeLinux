import { useEffect, useRef, type ReactNode } from 'react'

interface PanelDialogProps {
  title: string
  onClose: () => void
  children: ReactNode
  closeLabel?: string
}

export function PanelDialog({ title, onClose, children, closeLabel = 'Close panel' }: PanelDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const closeHandler = useRef(onClose)

  useEffect(() => { closeHandler.current = onClose }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const initialFocus = dialogRef.current?.querySelector<HTMLElement>(
      'input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
    )
    ;(initialFocus ?? closeRef.current)?.focus()

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeHandler.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => element.getClientRects().length > 0)
      if (!focusable.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [])

  return <div className="panel-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="panel-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <button ref={closeRef} className="panel-dialog-close" type="button" onClick={onClose} aria-label={closeLabel}>×</button>
      {children}
    </section>
  </div>
}
