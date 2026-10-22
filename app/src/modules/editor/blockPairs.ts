interface BlockToken { kind: 'BEGIN' | 'END'; offset: number }

export function findBeginEndPair(source: string, offset: number): number | undefined {
  const tokens: BlockToken[] = [...source.matchAll(/\bBEGIN\b|\bEND\b(?!\s+(?:IF|CASE|LOOP|WHILE|REPEAT)\b)/gi)]
    .map((match) => ({ kind: match[0]!.toUpperCase() as BlockToken['kind'], offset: match.index ?? 0 }))
  const current = tokens.findIndex((item) => item.offset === offset)
  if (current < 0) return undefined
  let depth = 0
  if (tokens[current]?.kind === 'BEGIN') {
    for (let index = current + 1; index < tokens.length; index++) {
      if (tokens[index]?.kind === 'BEGIN') depth++
      else if (tokens[index]?.kind === 'END' && depth-- === 0) return tokens[index]!.offset
    }
  } else {
    for (let index = current - 1; index >= 0; index--) {
      if (tokens[index]?.kind === 'END') depth++
      else if (tokens[index]?.kind === 'BEGIN' && depth-- === 0) return tokens[index]!.offset
    }
  }
  return undefined
}
