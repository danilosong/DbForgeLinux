import { contextBridge, ipcRenderer } from 'electron'

interface SplashProgressPayload { percent: number; label: string; version: string; kicker: string }
interface SplashApi { onProgress(callback: (payload: SplashProgressPayload) => void): () => void }

const api: SplashApi = {
  onProgress(callback) {
    const listener = (_event: Electron.IpcRendererEvent, value: unknown): void => {
      if (!value || typeof value !== 'object') return
      const payload = value as Partial<SplashProgressPayload>
      if (typeof payload.percent !== 'number' || typeof payload.label !== 'string' || typeof payload.version !== 'string' || typeof payload.kicker !== 'string') return
      callback({ percent: Math.min(100, Math.max(0, payload.percent)), label: payload.label.slice(0, 80), version: payload.version.slice(0, 40), kicker: payload.kicker.slice(0, 80) })
    }
    ipcRenderer.on('splash:progress', listener)
    return () => ipcRenderer.removeListener('splash:progress', listener)
  }
}

contextBridge.exposeInMainWorld('tuxsqlSplash', api)
