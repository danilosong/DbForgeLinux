import { useContext } from 'react'
import { I18nContext } from './context.js'
import type { UiLocale, Translator } from './types.js'

export function useI18n(): { locale: UiLocale; t: Translator } { return useContext(I18nContext) }
