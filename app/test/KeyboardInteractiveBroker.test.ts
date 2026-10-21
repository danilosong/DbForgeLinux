import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { KeyboardInteractiveBroker, type KeyboardPromptSender } from '../src/main/db/KeyboardInteractiveBroker.js'

class FakeSender extends EventEmitter implements KeyboardPromptSender {
  readonly sent: Array<{ channel: string; payload: unknown }> = []
  constructor(readonly id: number) { super() }
  isDestroyed(): boolean { return false }
  send(channel: string, payload: unknown): void { this.sent.push({ channel, payload }) }
}

describe('SSH keyboard interactive broker', () => {
  it('routes a response only to its originating renderer and supports cancellation', async () => {
    const broker = new KeyboardInteractiveBroker(100)
    const sender = new FakeSender(10)
    const request = broker.request(sender, { name: 'SSH', instructions: '', prompts: [{ prompt: 'Code: ', echo: false }] })
    const { requestId } = sender.sent[0].payload as { requestId: string }
    expect(broker.respond(11, requestId, ['123456'])).toBe(false)
    expect(broker.respond(10, requestId, null)).toBe(true)
    await expect(request).resolves.toBeNull()
  })

  it('rejects a prompt when its renderer closes or the request times out', async () => {
    const broker = new KeyboardInteractiveBroker(5)
    const sender = new FakeSender(10)
    const closed = broker.request(sender, { name: '', instructions: '', prompts: [{ prompt: 'Code: ', echo: false }] })
    sender.emit('destroyed')
    await expect(closed).rejects.toThrow('closed')
    const timedOut = broker.request(new FakeSender(12), { name: '', instructions: '', prompts: [{ prompt: 'Code: ', echo: false }] })
    await expect(timedOut).rejects.toThrow('timed out')
  })
})
