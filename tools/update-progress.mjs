#!/usr/bin/env node
// Atualiza o bloco "progresso" do README.md a partir de document/progress.json.
// Uso: node tools/update-progress.mjs   (rode antes de cada commit; veja CONTRIBUTING.md)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(readFileSync(join(root, 'document/progress.json'), 'utf8'))
const readmePath = join(root, 'README.md')
const WIDTH = 20

const bar = (value) => {
  const filled = Math.max(0, Math.min(WIDTH, Math.round((value / 100) * WIDTH)))
  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}
const pct = (value) => `${Number.isInteger(value) ? value : value.toFixed(1).replace('.', ',')}%`.padStart(6)

const labelWidth = Math.max(...data.bars.map((item) => item.label.length))
const lines = data.bars.map((item) => {
  const detail = item.detail ? `  (${item.detail})` : ''
  return `${item.label.padEnd(labelWidth)}  ${bar(item.value)} ${pct(item.value)}${detail}`
})

const block = [
  '<!-- PROGRESS:START -->',
  `**Progresso do projeto** · atualizado em ${data.updated}`,
  '',
  '```text',
  ...lines,
  '```',
  '',
  `<sub>${data.note}</sub>`,
  '<!-- PROGRESS:END -->'
].join('\n')

const readme = readFileSync(readmePath, 'utf8')
const pattern = /<!-- PROGRESS:START -->[\s\S]*?<!-- PROGRESS:END -->/
if (!pattern.test(readme)) {
  console.error('Marcadores <!-- PROGRESS:START --> / <!-- PROGRESS:END --> não encontrados no README.md')
  process.exit(1)
}
writeFileSync(readmePath, readme.replace(pattern, block))
console.log(lines.join('\n'))
