import { ipcRenderer } from 'electron'
import type { AboutApi } from '../../shared/contracts/about.js'

export const aboutApi: AboutApi = {
  getAboutInfo: () => ipcRenderer.invoke('about:info'),
  openAboutLink: (link, locale = 'en', theme = 'light') => ipcRenderer.invoke('about:open-link', link, locale, theme)
}
