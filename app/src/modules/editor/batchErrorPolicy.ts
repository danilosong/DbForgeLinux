export type BatchErrorChoice = 'stop' | 'continue' | 'ignore-all'
export interface BatchErrorDecision { continueBatch: boolean; ignoreFutureErrors: boolean }

export function decideBatchError(choice: BatchErrorChoice): BatchErrorDecision {
  if (choice === 'stop') return { continueBatch: false, ignoreFutureErrors: false }
  return { continueBatch: true, ignoreFutureErrors: choice === 'ignore-all' }
}
