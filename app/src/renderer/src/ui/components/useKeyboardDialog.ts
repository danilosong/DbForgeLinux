import { useEffect, useRef } from 'react'

export function useKeyboardDialog(open: boolean, onEscape: () => void): React.RefObject<HTMLDivElement | null> {
  const dialogRef = useRef<HTMLDivElement>(null)
  const escapeRef = useRef(onEscape)
  escapeRef.current = onEscape
  useEffect(() => {
    if (!open || !dialogRef.current) return
    const dialog = dialogRef.current
    const focusable = (): HTMLElement[] => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')].filter((node) => node.getClientRects().length > 0)
    focusable()[0]?.focus()
    const keydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { event.preventDefault(); escapeRef.current(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) { event.preventDefault(); dialog.focus(); return }
      const first = items[0]
      const last = items.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [open])
  return dialogRef
}
