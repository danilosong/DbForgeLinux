const electronInvokePrefix = /^Error invoking remote method '[^']+': (?:Error: )?/

export function normalizeIpcError(error: unknown): unknown {
  if (error instanceof Error) {
    const message = error.message.replace(electronInvokePrefix, '')
    if (message === error.message) return error

    const normalized = new Error(message, { cause: error.cause })
    normalized.name = error.name
    for (const key of ['code', 'errno', 'sqlState'] as const) {
      const value = (error as Error & Record<string, unknown>)[key]
      if (value !== undefined) Object.assign(normalized, { [key]: value })
    }
    return normalized
  }

  return typeof error === 'string' ? error.replace(electronInvokePrefix, '') : error
}

export function normalizeApiRejections<T extends Record<string, unknown>>(api: T): T {
  return Object.fromEntries(Object.entries(api).map(([key, value]) => {
    if (typeof value !== 'function') return [key, value]
    return [key, function normalizedApiMethod(this: unknown, ...args: unknown[]) {
      const result: unknown = value.apply(this, args)
      if (result && typeof result === 'object' && 'then' in result && typeof result.then === 'function') {
        return Promise.resolve(result).catch((error: unknown) => { throw normalizeIpcError(error) })
      }
      return result
    }]
  })) as T
}
