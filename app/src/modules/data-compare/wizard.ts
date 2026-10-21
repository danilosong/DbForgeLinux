export interface CompareEndpoints {
  source: string
  target: string
  sourceDb: string
  targetDb: string
}

export function copySourceToTarget(endpoints: CompareEndpoints): CompareEndpoints {
  return { ...endpoints, target: endpoints.source, targetDb: endpoints.sourceDb }
}

export function swapCompareEndpoints(endpoints: CompareEndpoints): CompareEndpoints {
  return { source: endpoints.target, target: endpoints.source, sourceDb: endpoints.targetDb, targetDb: endpoints.sourceDb }
}

export function serializeCompareArguments(value: unknown): string {
  return JSON.stringify(value, null, 2)
}
