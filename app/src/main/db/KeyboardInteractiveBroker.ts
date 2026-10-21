import { randomUUID } from 'node:crypto'
import type { SshInteractiveChallenge, SshInteractiveRequest } from '../../shared/contracts.js'

export interface KeyboardPromptSender {
  id: number
  isDestroyed(): boolean
  send(channel: string, payload: SshInteractiveRequest): void
  once(event: 'destroyed', listener: () => void): this
  removeListener(event: 'destroyed', listener: () => void): this
}

interface PendingPrompt {
  sender: KeyboardPromptSender
  senderId: number
  resolve(answers: string[] | null): void
  reject(error: Error): void
  timeout: ReturnType<typeof setTimeout>
  onDestroyed: () => void
}

export class KeyboardInteractiveBroker {
  private readonly pending = new Map<string, PendingPrompt>()

  constructor(private readonly timeoutMs = 120_000) {}

  request(sender: KeyboardPromptSender, challenge: SshInteractiveChallenge): Promise<string[] | null> {
    if (sender.isDestroyed()) return Promise.reject(new Error('SSH authentication dialog is unavailable.'))
    if (!challenge.prompts.length || challenge.prompts.length > 16) return Promise.reject(new Error('SSH server sent an invalid number of authentication prompts.'))
    if ([challenge.name, challenge.instructions, ...challenge.prompts.map(({ prompt }) => prompt)].some((value) => value.length > 2048)) {
      return Promise.reject(new Error('SSH server authentication prompt is too long.'))
    }

    const requestId = randomUUID()
    return new Promise((resolve, reject) => {
      const onDestroyed = (): void => this.reject(requestId, new Error('SSH authentication dialog was closed.'))
      const timeout = setTimeout(() => this.reject(requestId, new Error('SSH authentication dialog timed out.')), this.timeoutMs)
      this.pending.set(requestId, { sender, senderId: sender.id, resolve, reject, timeout, onDestroyed })
      sender.once('destroyed', onDestroyed)
      try {
        sender.send('ssh:keyboard-interactive:prompt', { requestId, ...challenge })
      } catch {
        this.reject(requestId, new Error('SSH authentication dialog is unavailable.'))
      }
    })
  }

  respond(senderId: number, requestId: string, answers: string[] | null): boolean {
    const pending = this.pending.get(requestId)
    if (!pending || pending.senderId !== senderId) return false
    if (answers && (answers.length > 16 || answers.some((answer) => typeof answer !== 'string' || answer.length > 4096))) return false
    this.pending.delete(requestId)
    clearTimeout(pending.timeout)
    pending.sender.removeListener('destroyed', pending.onDestroyed)
    pending.resolve(answers)
    return true
  }

  private reject(requestId: string, error: Error): void {
    const pending = this.pending.get(requestId)
    if (!pending) return
    this.pending.delete(requestId)
    clearTimeout(pending.timeout)
    pending.sender.removeListener('destroyed', pending.onDestroyed)
    pending.reject(error)
  }
}
