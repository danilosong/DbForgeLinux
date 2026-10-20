import React from 'react'
import { createRoot } from 'react-dom/client'
import { loader } from '@monaco-editor/react'
import App from './ui/App'
import { I18nProvider } from './i18n/I18n'
import './ui/styles.css'

loader.config({ paths: { vs: new URL('vs', document.baseURI).toString() } })
createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider><App /></I18nProvider></React.StrictMode>)
