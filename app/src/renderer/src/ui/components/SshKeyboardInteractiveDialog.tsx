import { useEffect, useState } from 'react'
import type { SshInteractiveRequest } from '../../../../shared/contracts.js'
import { Button, Dialog } from './Button.js'

export function SshKeyboardInteractiveDialog(): React.JSX.Element | null {
  const [queue, setQueue] = useState<SshInteractiveRequest[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const request = queue[0]

  useEffect(() => window.tuxsql.onSshKeyboardInteractivePrompt((incoming) => {
    setQueue((current) => current.some(({ requestId }) => requestId === incoming.requestId) ? current : [...current, incoming])
  }), [])

  useEffect(() => { setAnswers(request?.prompts.map(() => '') ?? []) }, [request])

  if (!request) return null
  const finish = async (response: string[] | null): Promise<void> => {
    setAnswers([])
    await window.tuxsql.respondSshKeyboardInteractive(request.requestId, response).catch(() => false)
    setQueue((current) => current.filter(({ requestId }) => requestId !== request.requestId))
  }
  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    void finish(answers)
  }

  return <Dialog title="SSH Authentication" className="ssh-interactive-dialog">
    <form onSubmit={submit}>
      {request.name && <p>{request.name}</p>}
      {request.instructions && <p>{request.instructions}</p>}
      {request.prompts.map((prompt, index) => <label className="form-field" key={`${index}:${prompt.prompt}`}>
        <span>{prompt.prompt}</span>
        <input autoFocus={index === 0} type={prompt.echo ? 'text' : 'password'} autoComplete="off" value={answers[index] ?? ''} onChange={(event) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))} />
      </label>)}
      <footer><Button type="button" onClick={() => void finish(null)}>Cancel</Button><Button type="submit" variant="primary">Continue</Button></footer>
    </form>
  </Dialog>
}
