import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatabaseModel, TableModel } from '../schema/model.js'

export type DocumentFormat = 'html' | 'markdown' | 'pdf'
export type DocumenterPalette = 'default' | 'bootstrap' | 'cerulean' | 'cyborg' | 'default-dark' | 'flatly' | 'journal' | 'paper' | 'yeti' | 'metro-light' | 'ocean' | 'forest'
export interface DocumenterAccount { grantee: string; globalPrivileges: string[]; scopedPrivileges: string[] }
export interface PdfPrintToPdf { printToPDF(html: string, options?: { printBackground?: boolean; pageSize?: 'A4' | 'Letter'; landscape?: boolean; displayHeaderFooter?: boolean; footerTemplate?: string }): Promise<Buffer> }
export interface DocumenterOptions {
  title?: string
  author?: string
  copyright?: string
  created?: string
  logo?: string
  coverPage?: boolean
  breadcrumbs?: boolean
  palette?: DocumenterPalette
  includeUsers?: boolean
  accounts?: DocumenterAccount[]
  descriptions?: Record<string, string>
  includeDiagram?: boolean
  excludedColumns?: string[]
  excludedIndexes?: string[]
  excludedTables?: string[]
  pdfOrientation?: 'portrait' | 'landscape'
  pdfFontScale?: number
  pdfPageNumbers?: boolean
  formats?: DocumentFormat[]
  outputDirectory?: string
  folderName?: string
  pdfPrinter?: PdfPrintToPdf
}
export interface GeneratedDocumentation { html: string; markdown: string; diagramSvg?: string }
export interface WrittenDocumentation { html?: string; markdown?: string; pdf?: string; diagram?: string }

export type { DatabaseModel, TableModel }

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function escapeMarkdown(value: unknown): string { return String(value ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>') }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'schema' }
function description(options: DocumenterOptions, key: string): string { return options.descriptions?.[key] ?? '' }

function viewDependencies(model: DatabaseModel, definition: string): string[] {
  return objectDependencies(model, definition)
}

function objectDependencies(model: DatabaseModel, definition: string): string[] {
  const names = new Set(model.tables.map((table) => table.name))
  const found = new Set<string>()
  for (const match of definition.matchAll(/\b(?:FROM|JOIN)\s+(?:`?([\w$]+)`?\.)?`?([\w$]+)`?/gi)) {
    const name = match[2]
    if (names.has(name)) found.add(name)
  }
  return [...found].sort()
}

function diagram(model: DatabaseModel): string {
  const width = 960
  const boxWidth = 220
  const boxHeight = Math.max(90, ...model.tables.map((table) => 46 + Math.min(table.columns.length, 7) * 20))
  const columns = Math.max(1, Math.ceil(Math.sqrt(model.tables.length)))
  const rows = Math.max(1, Math.ceil(model.tables.length / columns))
  const height = rows * (boxHeight + 60) + 30
  const position = new Map(model.tables.map((table, index) => [table.name, { x: 20 + index % columns * (boxWidth + 70), y: 20 + Math.floor(index / columns) * (boxHeight + 60) }]))
  const edges = model.tables.flatMap((table) => table.foreignKeys.map((fk) => {
    const source = position.get(table.name); const target = position.get(fk.referencedTable)
    if (!source || !target) return ''
    const x1 = source.x + boxWidth / 2; const y1 = source.y + 38
    const x2 = target.x + boxWidth / 2; const y2 = target.y + 38
    return `<path d="M ${x1} ${y1} C ${x1} ${y1 - 30}, ${x2} ${y2 - 30}, ${x2} ${y2}" fill="none" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>`
  })).join('')
  const boxes = model.tables.map((table) => {
    const { x, y } = position.get(table.name)!
    const columnsText = table.columns.slice(0, 7).map((column, index) => `<text x="${x + 12}" y="${y + 64 + index * 18}" class="col">${escapeHtml(column.name)}: ${escapeHtml(column.type)}</text>`).join('')
    return `<g><rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="7" class="box"/><text x="${x + 12}" y="${y + 25}" class="title">${escapeHtml(table.name)}</text>${columnsText}</g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagrama de tabelas" viewBox="0 0 ${width} ${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#64748b"/></marker></defs><style>.box{fill:#f8fafc;stroke:#334155}.title{font:bold 14px sans-serif;fill:#0f172a}.col{font:11px monospace;fill:#334155}</style>${edges}${boxes}</svg>`
}

function htmlTable(table: TableModel, options: DocumenterOptions): string {
  const anchor = `table-${slug(table.name)}`
  const columns = table.columns.filter((column) => !options.excludedColumns?.includes(`${table.name}.${column.name}`)).map((column) => `<tr><td>${escapeHtml(column.name)}</td><td><code>${escapeHtml(column.type)}</code></td><td>${column.nullable ? 'Yes' : 'No'}</td><td>${escapeHtml(column.default ?? '')}</td><td>${column.autoIncrement ? 'AUTO_INCREMENT' : ''}</td><td>${escapeHtml(column.comment ?? '')}</td></tr>`).join('')
  const indexes = table.indexes.filter((index) => !options.excludedIndexes?.includes(`${table.name}.${index.name}`)).map((index) => `<li><strong>${escapeHtml(index.name)}</strong> (${escapeHtml(index.kind)}): ${index.columns.map((column) => escapeHtml(column.name)).join(', ')}</li>`).join('') || '<li>None</li>'
  const fks = table.foreignKeys.map((fk) => `<li>${escapeHtml(fk.name)}: (${fk.columns.map(escapeHtml).join(', ')}) → ${escapeHtml(fk.referencedDatabase ?? '')}.${escapeHtml(fk.referencedTable)} (${fk.referencedColumns.map(escapeHtml).join(', ')})</li>`).join('') || '<li>None</li>'
  const checks = table.checks.map((check) => `<li>${escapeHtml(check.name)}: <code>${escapeHtml(check.expression)}</code></li>`).join('') || '<li>None</li>'
  return `<section id="${anchor}"><h3>Table: ${escapeHtml(table.name)}</h3><p>${escapeHtml(description(options, `table.${table.name}`))}</p><p>${escapeHtml(table.engine ?? '')} ${escapeHtml(table.charset ?? '')} ${escapeHtml(table.collation ?? '')}</p><table><thead><tr><th>Column</th><th>Type</th><th>Nullable</th><th>Default</th><th>Flags</th><th>Comment</th></tr></thead><tbody>${columns}</tbody></table><h4>Indexes</h4><ul>${indexes}</ul><h4>Foreign keys</h4><ul>${fks}</ul><h4>Checks</h4><ul>${checks}</ul></section>`
}

function markdownTable(table: TableModel, options: DocumenterOptions): string {
  const lines = [`### Table: ${escapeMarkdown(table.name)}`, '', escapeMarkdown(description(options, `table.${table.name}`)), '', '| Column | Type | Nullable | Default | Comment |', '| --- | --- | --- | --- | --- |']
  for (const column of table.columns.filter((item) => !options.excludedColumns?.includes(`${table.name}.${item.name}`))) lines.push(`| ${escapeMarkdown(column.name)} | ${escapeMarkdown(column.type)} | ${column.nullable ? 'Yes' : 'No'} | ${escapeMarkdown(column.default ?? '')} | ${escapeMarkdown(column.comment ?? '')} |`)
  lines.push('', 'Indexes:', ...table.indexes.filter((item) => !options.excludedIndexes?.includes(`${table.name}.${item.name}`)).map((index) => `- ${escapeMarkdown(index.name)} (${index.kind}): ${index.columns.map((column) => escapeMarkdown(column.name)).join(', ')}`), '', 'Foreign keys:', ...table.foreignKeys.map((fk) => `- ${escapeMarkdown(fk.name)}: ${fk.columns.map(escapeMarkdown).join(', ')} → ${escapeMarkdown(fk.referencedDatabase ?? '')}.${escapeMarkdown(fk.referencedTable)} (${fk.referencedColumns.map(escapeMarkdown).join(', ')})`), '', 'Checks:', ...table.checks.map((check) => `- ${escapeMarkdown(check.name)}: \`${escapeMarkdown(check.expression)}\``), '')
  return lines.join('\n')
}

export function generateDocumentation(model: DatabaseModel, options: DocumenterOptions = {}): GeneratedDocumentation {
  const title = options.title ?? `Database documentation: ${model.name}`
  const palette = options.palette ?? 'default'
  const paletteColors: Record<DocumenterPalette, { accent: string; surface: string; page: string }> = {
    default: { accent: '#2563eb', surface: '#eff6ff', page: '#ffffff' }, bootstrap: { accent: '#7952b3', surface: '#f3effa', page: '#ffffff' },
    cerulean: { accent: '#2fa4e7', surface: '#eaf7fd', page: '#ffffff' }, cyborg: { accent: '#2a9fd6', surface: '#222222', page: '#060606' },
    'default-dark': { accent: '#78a9ff', surface: '#232a35', page: '#171b22' }, flatly: { accent: '#18bc9c', surface: '#e8f8f5', page: '#ffffff' },
    journal: { accent: '#eb6864', surface: '#fdf0ef', page: '#ffffff' }, paper: { accent: '#4582ec', surface: '#eef3fd', page: '#ffffff' }, yeti: { accent: '#008c8c', surface: '#e7f5f5', page: '#ffffff' },
    'metro-light': { accent: '#0078d4', surface: '#e6f4ff', page: '#ffffff' }, ocean: { accent: '#0f766e', surface: '#ccfbf1', page: '#f0fdfa' }, forest: { accent: '#3f6212', surface: '#ecfccb', page: '#f7fee7' }
  }
  const colors = paletteColors[palette]
  const cover = options.coverPage === false ? '' : `<header class="cover" style="--cover-accent:${colors.accent};--cover-surface:${colors.surface};--cover-page:${colors.page}">${options.logo ? `<p class="logo">${escapeHtml(options.logo)}</p>` : ''}${options.breadcrumbs === false ? '' : `<p class="crumb">${escapeHtml(model.name)} / Documentation</p>`}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(description(options, 'cover'))}</p><p>${options.author ? `Author: ${escapeHtml(options.author)}` : ''}</p><p>${options.copyright ? `© ${escapeHtml(options.copyright)}` : ''}</p><p>${escapeHtml(options.created ?? new Date().toISOString().slice(0, 10))}</p></header>`
  const selectedTables = model.tables.filter((table) => !options.excludedTables?.includes(table.name))
  const tables = selectedTables.map((table) => htmlTable(table, options)).join('\n')
  const views = model.views.map((view) => `<section id="view-${slug(view.name)}"><h3>View: ${escapeHtml(view.name)}</h3><p>${escapeHtml(description(options, `view.${view.name}`))}</p><p>Dependencies: ${viewDependencies(model, view.definition).map(escapeHtml).join(', ') || 'None'}</p><pre><code>${escapeHtml(view.definition)}</code></pre></section>`).join('\n')
  const routines = [...model.procedures, ...model.functions].map((routine) => `<section id="routine-${slug(routine.name)}"><h3>${escapeHtml(routine.kind)}: ${escapeHtml(routine.name)}</h3><p>${escapeHtml(description(options, `routine.${routine.name}`) || routine.comment)}</p><p>Parameters: ${escapeHtml(routine.parameters?.join(', ') ?? '')}${routine.returnType ? `; Return: ${escapeHtml(routine.returnType)}` : ''}</p><p>Dependencies: ${objectDependencies(model, routine.definition).map(escapeHtml).join(', ') || 'None'}</p><pre><code>${escapeHtml(routine.definition)}</code></pre></section>`).join('\n')
  const triggers = model.triggers.map((trigger) => `<li>${escapeHtml(trigger.name)} — ${escapeHtml(trigger.timing)} ${escapeHtml(trigger.event)} ON ${escapeHtml(trigger.table)}; dependencies: ${escapeHtml(trigger.table)}. ${escapeHtml(description(options, `trigger.${trigger.name}`))}: <code>${escapeHtml(trigger.definition)}</code></li>`).join('')
  const events = model.events.map((event) => `<li>${escapeHtml(event.name)} (${escapeHtml(event.status)}; ${escapeHtml(event.schedule)}); dependencies: ${objectDependencies(model, event.definition).map(escapeHtml).join(', ') || 'None'}; ${escapeHtml(description(options, `event.${event.name}`))}: <code>${escapeHtml(event.definition)}</code></li>`).join('')
  const accounts = (options.accounts ?? []).map((account) => `<section><h3>${escapeHtml(account.grantee)}</h3><h4>Global privileges</h4><ul>${(account.globalPrivileges.length ? account.globalPrivileges : ['None']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><h4>Object privileges</h4><ul>${(account.scopedPrivileges.length ? account.scopedPrivileges : ['None']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`).join('')
  const tableIndex = selectedTables.map((table) => `<li><a href="#table-${slug(table.name)}">${escapeHtml(table.name)}</a></li>`).join('')
  const viewIndex = model.views.map((view) => `<li><a href="#view-${slug(view.name)}">${escapeHtml(view.name)}</a></li>`).join('')
  const routineIndex = [...model.procedures, ...model.functions].map((routine) => `<li><a href="#routine-${slug(routine.name)}">${escapeHtml(routine.kind)} ${escapeHtml(routine.name)}</a></li>`).join('')
  const svg = options.includeDiagram ? diagram(model) : undefined
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>:root{--accent:${colors.accent};--surface:${colors.surface};--page:${colors.page}}body{font:14px sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:${palette === 'cyborg' || palette === 'default-dark' ? '#e5e7eb' : '#172033'};background:var(--page)}table{border-collapse:collapse;width:100%;margin:1rem 0}td,th{border:1px solid #94a3b8;padding:.4rem;text-align:left}th{background:var(--surface)}section{border-top:1px solid #cbd5e1;padding:1rem 0}pre{white-space:pre-wrap;background:var(--surface);padding:1rem}svg{width:100%;height:auto}.cover{min-height:80vh;display:flex;flex-direction:column;justify-content:center;border-bottom:4px solid var(--cover-accent);background:var(--cover-surface);padding:2rem}.cover h1{font-size:2.5rem;color:var(--cover-accent)}.crumb{color:#64748b}.logo{font-size:1.4rem;font-weight:bold;color:var(--cover-accent)}</style></head><body>${cover}<h1>${escapeHtml(title)}</h1><p>Database: <strong>${escapeHtml(model.name)}</strong>; charset ${escapeHtml(model.charset)}; collation ${escapeHtml(model.collation)}</p><nav><h2>Index</h2><h3>Tables</h3><ul>${tableIndex}</ul><h3>Views</h3><ul>${viewIndex}</ul><h3>Routines</h3><ul>${routineIndex}</ul></nav>${svg ? `<h2>Diagram</h2>${svg}` : ''}<h2>Tables</h2>${tables}<h2>Views</h2>${views}<h2>Routines</h2>${routines}<h2>Triggers</h2><ul>${triggers}</ul><h2>Events</h2><ul>${events}</ul>${options.includeUsers ? `<h2>Users and privileges</h2>${accounts || '<p>No account privilege metadata was returned.</p>'}` : ''}</body></html>`
  const coverMarkdown = options.coverPage === false ? '' : `---\ntitle: ${escapeMarkdown(title)}\ndescription: ${escapeMarkdown(description(options, 'cover'))}\nauthor: ${escapeMarkdown(options.author ?? '')}\ncopyright: ${escapeMarkdown(options.copyright ?? '')}\ndate: ${escapeMarkdown(options.created ?? new Date().toISOString().slice(0, 10))}\nlogo: ${escapeMarkdown(options.logo ?? '')}\npalette: ${escapeMarkdown(palette)}\nbreadcrumbs: ${options.breadcrumbs === false ? 'false' : 'true'}\n---\n\n`
  const md = [coverMarkdown, `# ${escapeMarkdown(title)}`, '', `Database: **${escapeMarkdown(model.name)}**  `, `Charset: ${escapeMarkdown(model.charset ?? '')}; Collation: ${escapeMarkdown(model.collation ?? '')}`, '', '## Index', '', '### Tables', ...selectedTables.map((table) => `- [${escapeMarkdown(table.name)}](#table-${slug(table.name)})`), '', '### Views', ...model.views.map((view) => `- [${escapeMarkdown(view.name)}](#view-${slug(view.name)})`), '', '## Tables', '', ...selectedTables.map((table) => markdownTable(table, options)), '## Views', '', ...model.views.map((view) => `### View: ${escapeMarkdown(view.name)}\n\n${escapeMarkdown(description(options, `view.${view.name}`))}\n\nDependencies: ${viewDependencies(model, view.definition).map(escapeMarkdown).join(', ')}\n\n\`\`\`sql\n${view.definition}\n\`\`\``), '## Routines', '', ...[...model.procedures, ...model.functions].map((routine) => `### ${routine.kind}: ${escapeMarkdown(routine.name)}\n\n${escapeMarkdown(description(options, `routine.${routine.name}`) || routine.comment)}\n\nDependencies: ${objectDependencies(model, routine.definition).map(escapeMarkdown).join(', ')}\n\n\`\`\`sql\n${routine.definition}\n\`\`\``), '## Triggers', '', ...model.triggers.map((trigger) => `- ${escapeMarkdown(trigger.name)} (${trigger.timing} ${trigger.event} on ${escapeMarkdown(trigger.table)}); dependency: ${escapeMarkdown(trigger.table)}. ${escapeMarkdown(description(options, `trigger.${trigger.name}`))}: ${escapeMarkdown(trigger.definition)}`), '', '## Events', '', ...model.events.map((event) => `- ${escapeMarkdown(event.name)} (${escapeMarkdown(event.status)}; ${escapeMarkdown(event.schedule)}); dependencies: ${objectDependencies(model, event.definition).map(escapeMarkdown).join(', ')}; ${escapeMarkdown(description(options, `event.${event.name}`))}: ${escapeMarkdown(event.definition)}`), ...(options.includeUsers ? ['', '## Users and privileges', ...(options.accounts ?? []).flatMap((account) => [`### ${escapeMarkdown(account.grantee)}`, '', 'Global privileges:', ...(account.globalPrivileges.length ? account.globalPrivileges : ['None']).map((item) => `- ${escapeMarkdown(item)}`), '', 'Object privileges:', ...(account.scopedPrivileges.length ? account.scopedPrivileges : ['None']).map((item) => `- ${escapeMarkdown(item)}`), ''])] : []), ''].join('\n')
  return { html, markdown: md, ...(svg ? { diagramSvg: svg } : {}) }
}

export async function writeDocumentation(model: DatabaseModel, options: DocumenterOptions & { outputDirectory: string }): Promise<WrittenDocumentation> {
  const formats = options.formats ?? ['html', 'markdown']
  if (formats.includes('pdf') && !options.pdfPrinter) throw new Error('PDF generation requires an injected PdfPrintToPdf provider.')
  const generated = generateDocumentation(model, options)
  const targetDirectory = options.folderName?.trim() ? join(options.outputDirectory, options.folderName.replace(/[\\/\0]/g, '_')) : options.outputDirectory
  await mkdir(targetDirectory, { recursive: true })
  const base = slug(model.name)
  const output: WrittenDocumentation = {}
  if (formats.includes('html')) { output.html = join(targetDirectory, `${base}.html`); await writeFile(output.html, generated.html, 'utf8') }
  if (formats.includes('markdown')) { output.markdown = join(targetDirectory, `${base}.md`); await writeFile(output.markdown, generated.markdown, 'utf8') }
  if (formats.includes('pdf')) {
    output.pdf = join(targetDirectory, `${base}.pdf`)
    const scale = Math.min(200, Math.max(50, options.pdfFontScale ?? 100))
    const printHtml = generated.html.replace('</head>', `<style>html{font-size:${scale}%}</style></head>`)
    await writeFile(output.pdf, await options.pdfPrinter!.printToPDF(printHtml, { printBackground: true, pageSize: 'A4', landscape: options.pdfOrientation === 'landscape', displayHeaderFooter: options.pdfPageNumbers ?? false, footerTemplate: options.pdfPageNumbers ? '<div style="width:100%;text-align:center;font:9px sans-serif"><span class="pageNumber"></span> / <span class="totalPages"></span></div>' : undefined }))
  }
  if (options.includeDiagram && generated.diagramSvg) { output.diagram = join(targetDirectory, `${base}.svg`); await writeFile(output.diagram, generated.diagramSvg, 'utf8') }
  return output
}
