import { createContext } from 'react'
import type { UiLocale, Translator } from './types.js'

export const I18nContext = createContext<{ locale: UiLocale; t: Translator }>({ locale: 'en', t: (key) => key })
