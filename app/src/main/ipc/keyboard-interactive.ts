import { BrowserWindow, ipcMain } from 'electron'
import type { SshInteractiveChallenge } from '../../shared/contracts.js'
import { KeyboardInteractiveBroker } from '../db/KeyboardInteractiveBroker.js'

const broker = new KeyboardInteractiveBroker()

export function registerKeyboardInteractiveIpc(): void {
  ipcMain.handle('ssh:keyboard-interactive:respond', (event, request: { requestId: string; answers: string[] | null }) =>
    broker.respond(event.sender.id, request.requestId, request.answers))
}

export function requestSshKeyboardInteractive(challenge: SshInteractiveChallenge): Promise<string[] | null> {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows().find((item) => !item.isDestroyed())
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
    return Promise.reject(new Error('SSH authentication dialog is unavailable.'))
  }
  return broker.request(window.webContents, challenge)
}
