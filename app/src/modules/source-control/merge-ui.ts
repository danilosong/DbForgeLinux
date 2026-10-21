import type { RepositoryGraphCommit } from './types.js'

export type ConflictSegment = { kind: 'text'; text: string } | { kind: 'block'; ours: string; theirs: string; base: string; output: string | null }
export interface GraphPoint { hash: string; x: number; y: number; parents: string[] }

export function parseConflictSegments(contents: string): ConflictSegment[] {
  const lines = contents.match(/[^\n]*\n|[^\n]+$/g) ?? []
  const segments: ConflictSegment[] = []
  let plain = ''
  for (let index = 0; index < lines.length;) {
    if (!/^<<<<<<<(?:\s|$)/.test(lines[index] ?? '')) { plain += lines[index++]!; continue }
    const start = index++
    let base = ''
    let ours = ''
    let theirs = ''
    while (index < lines.length && !/^\|\|\|\|\|\|\|(?:\s|$)/.test(lines[index]!) && !/^=======(?:\s|$)/.test(lines[index]!)) ours += lines[index++]
    if (index < lines.length && /^\|\|\|\|\|\|\|(?:\s|$)/.test(lines[index]!)) {
      index++
      while (index < lines.length && !/^=======(?:\s|$)/.test(lines[index]!)) base += lines[index++]
    }
    if (index >= lines.length || !/^=======(?:\s|$)/.test(lines[index]!)) { index = start + 1; plain += lines[start]!; continue }
    index++
    while (index < lines.length && !/^>>>>>>>\s/.test(lines[index]!)) theirs += lines[index++]
    if (index >= lines.length) { index = start + 1; plain += lines[start]!; continue }
    index++
    if (plain) { segments.push({ kind: 'text', text: plain }); plain = '' }
    segments.push({ kind: 'block', ours, theirs, base, output: null })
  }
  if (plain) segments.push({ kind: 'text', text: plain })
  return segments
}

export function composeConflictResult(segments: ConflictSegment[]): string {
  return segments.map((segment) => segment.kind === 'text' ? segment.text : segment.output ?? `<<<<<<< OURS\n${segment.ours}=======\n${segment.theirs}>>>>>>> THEIRS\n`).join('')
}

/** Assign stable lanes to commit ancestry so the renderer can draw a compact DAG. */
export function layoutCommitGraph(commits: RepositoryGraphCommit[], laneWidth = 20, rowHeight = 42): GraphPoint[] {
  const lanes: Array<string | null> = []
  const result: GraphPoint[] = []
  for (let index = 0; index < commits.length; index++) {
    const commit = commits[index]!
    let lane = lanes.indexOf(commit.hash)
    if (lane < 0) { lane = lanes.indexOf(null); if (lane < 0) lane = lanes.length; lanes[lane] = commit.hash }
    lanes[lane] = null
    result.push({ hash: commit.hash, x: 12 + lane * laneWidth, y: 20 + index * rowHeight, parents: commit.parents })
    commit.parents.forEach((parent, parentIndex) => {
      if (!commits.some((candidate) => candidate.hash === parent)) return
      if (lanes.includes(parent)) return
      let target = parentIndex === 0 && lanes[lane] === null ? lane : lanes.indexOf(null)
      if (target < 0) target = lanes.length
      lanes[target] = parent
    })
  }
  return result
}
