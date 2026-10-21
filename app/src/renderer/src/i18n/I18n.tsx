import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { enMessages, ptBrCatalog } from './specMessages.js'
import { I18nContext } from './context.js'
import type { UiLocale } from './types.js'
import { navigationEnMessages, navigationPtBrMessages } from './navigationMessages.js'
import { aboutEnMessages, aboutPtBrMessages } from './aboutMessages.js'
import { menuEnMessages, menuPtBrMessages } from './menuMessages.js'
import { updaterEnMessages, updaterPtBrMessages } from './updaterMessages.js'
import { importExportEnMessages, importExportPtBrMessages } from './importExportMessages.js'

function resolveLocale(value: unknown): UiLocale {
  if (value === 'pt-BR') return 'pt-BR'
  if (value === 'system' && navigator.language.toLowerCase().startsWith('pt')) return 'pt-BR'
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [locale, setLocale] = useState<UiLocale>(() => resolveLocale(localStorage.getItem('dbforge.locale') ?? navigator.language))
  useEffect(() => {
    let active = true
    void window.dbforge.loadSettings().then(({ settings }) => { if (active) setLocale(resolveLocale(settings.language.locale)) }).catch(() => undefined)
    const onSettings = (event: Event): void => {
      const settings = (event as CustomEvent<{ language?: { locale?: unknown } }>).detail
      setLocale(resolveLocale(settings?.language?.locale))
    }
    window.addEventListener('dbforge:settings-changed', onSettings)
    return () => { active = false; window.removeEventListener('dbforge:settings-changed', onSettings) }
  }, [])
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dataset.locale = locale; localStorage.setItem('dbforge.locale', locale) }, [locale])
  const value = useMemo(() => ({ locale, t: (key: string, args: Array<string | number> = []) => {
    const catalog = locale === 'pt-BR' ? { ...ptBrCatalog, ...navigationPtBrMessages, ...aboutPtBrMessages, ...menuPtBrMessages, ...updaterPtBrMessages, ...importExportPtBrMessages } : { ...enMessages, ...navigationEnMessages, ...aboutEnMessages, ...menuEnMessages, ...updaterEnMessages, ...importExportEnMessages }
    return (catalog[key] ?? enMessages[key] ?? key).replace(/\{(\d+)\}/g, (token, index: string) => String(args[Number(index)] ?? token))
  } }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

