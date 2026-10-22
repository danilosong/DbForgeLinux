import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')
const checkedFolders = ['main/ipc', 'main/db', 'modules', 'preload', 'renderer/src/ui', 'shared']
const dictionaryFiles = new Set([
  'modules/profiler/statusDescriptions.ts',
  'renderer/src/i18n/specMessages.ts',
  'renderer/src/i18n/panelMessages.ts',
  'renderer/src/i18n/ptBrGenerated.ts',
  'renderer/src/i18n/aboutMessages.ts',
  'renderer/src/i18n/importExportMessages.ts',
  'renderer/src/i18n/updaterMessages.ts',
  'renderer/src/i18n/menuMessages.ts',
  'renderer/src/i18n/navigationMessages.ts',
  'shared/ptBrSplashMessages.ts'
])
// Generated sample locales contain proper names and place names, not interface copy.
const portugueseDataExceptions = new Set([
  'modules/data-generation/generators.ts',
  'modules/data-generation/generators/location.ts',
  'modules/data-generation/generators/personal.ts',
  // Only the pt-BR row-value pools of the Business/Product generators; their logic files stay English.
  'modules/data-generation/generators/ptBrSamplePools.ts'
])
const portuguese = /[\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff]|\b(?:nao|falha|invalido|invalida|informe|selecione|nenhum|nenhuma|disponivel|removido|removida|alterado|alterada|adicionado|adicionada|tabela|coluna|origem|destino|obrigatorio|obrigatoria|conexao|usuario|senha|arquivo|banco|dados|criado|criada|excluido|excluida|sera|foram|apenas|vazio|vazia|quantidade|privilegio|sessao|definicao|posicao|relacao|colunas|opcoes|chave|estrangeira|limpar|gerar|geracao|execucao|atualizar|comparacao|esquema|documentacao|renderizador|planilha|linha|valores|suportado|suportada|instalacao|conexoes|servicos)\b/i

async function sourceFiles(folder: string): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) result.push(...await sourceFiles(path))
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) result.push(path)
  }
  return result
}

function literals(path: string, text: string): Array<{ value: string; line: number }> {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found: Array<{ value: string; line: number }> = []
  const add = (value: string, pos: number): void => { if (portuguese.test(value)) found.push({ value, line: source.getLineAndCharacterOfPosition(pos).line + 1 }) }
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text, node.getStart(source))
    else if (ts.isTemplateExpression(node)) for (const span of node.templateSpans) add(span.literal.text, span.literal.getStart(source))
    else if (ts.isJsxText(node)) add(node.text, node.getStart(source))
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('Portuguese literals stay in the locale dictionaries', () => {
  it('does not leave Portuguese literals in checked app source folders', async () => {
    const findings: string[] = []
    for (const folder of checkedFolders) {
      for (const path of await sourceFiles(join(sourceRoot, folder))) {
        const relativePath = relative(sourceRoot, path).replaceAll('\\', '/')
        if (dictionaryFiles.has(relativePath) || portugueseDataExceptions.has(relativePath)) continue
        const text = await readFile(path, 'utf8')
        for (const item of literals(path, text)) findings.push(`${relativePath}:${item.line}: ${item.value}`)
      }
    }
    expect(findings, findings.join('\n')).toEqual([])
  })
})
