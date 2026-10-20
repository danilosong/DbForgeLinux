import type { PivotResult, ReportExportFormat } from './types.js'

const text = (value: unknown): string => value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value)
const csvCell = (value: unknown): string => `"${text(value).replace(/"/g, '""')}"`
const escapeHtml = (value: unknown): string => text(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
function matrix(pivot: PivotResult): unknown[][] {
  const headers = [...pivot.rowFields, ...pivot.columns.map((column) => column.label), ...(pivot.rowFields.length && Object.keys(pivot.rowTotals).length ? ['Row Total'] : [])]
  const rows = pivot.rows.map((row) => [...row.values, ...pivot.columns.map((column) => row.cells[column.key]), ...(pivot.rowFields.length && row.total ? [Object.values(row.total).join(' · ')] : [])])
  if (Object.keys(pivot.grandTotal).length) rows.push([...pivot.rowFields.map((_, index) => index ? '' : 'Grand Total'), ...pivot.columns.map((column) => pivot.columnTotals[column.key]), Object.values(pivot.grandTotal).join(' · ')])
  return [headers, ...rows]
}

function csv(pivot: PivotResult): string { return matrix(pivot).map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n' }

function html(pivot: PivotResult): string {
  const rows = matrix(pivot)
  return `<!doctype html><html><head><meta charset="utf-8"><title>Data Report</title><style>body{font:14px system-ui,sans-serif;margin:2rem;color:#20242b}h1{font-size:1.4rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbc3ce;padding:.4rem;text-align:left}th{background:#edf1f6}tr:last-child{font-weight:700;background:#f7f8fa}</style></head><body><h1>Data Report</h1><p>${pivot.rowCount} rows${pivot.truncated ? ' · partial result' : ''}</p><table><thead><tr>${rows[0]!.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`
}

function pdf(pivot: PivotResult): Buffer {
  const rows = matrix(pivot)
  const strip = (value: unknown): string => text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?').replace(/[()\\]/g, (char) => `\\${char}`).slice(0, 150)
  const lines = [`Data Report · ${pivot.rowCount} rows`, rows[0]!.map(strip).join(' | '), ...rows.slice(1).map((row) => row.map(strip).join(' | '))]
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / 55)) }, (_, index) => lines.slice(index * 55, (index + 1) * 55))
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const pageRefs: number[] = []
  for (const [index, pageLines] of pages.entries()) {
    const content = `BT\n/F1 9 Tf\n40 790 Td\n12 TL\n${pageLines.map((line, lineIndex) => `${lineIndex ? 'T*\n' : ''}(${strip(line)}) Tj`).join('\n')}\nT*\n(${index + 1} / ${pages.length}) Tj\nET`
    const contentRef = objects.length + 1
    objects.push(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`)
    const pageRef = objects.length + 1
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentRef} 0 R >>`)
    pageRefs.push(pageRef)
  }
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pages.length} >>`
  let document = '%PDF-1.4\n'; const offsets = [0]
  for (let index = 0; index < objects.length; index++) { offsets.push(Buffer.byteLength(document, 'latin1')); document += `${index + 1} 0 obj\n${objects[index]}\nendobj\n` }
  const xref = Buffer.byteLength(document, 'latin1')
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(document, 'latin1')
}

export function exportPivot(pivot: PivotResult, format: ReportExportFormat): string | Buffer {
  if (format === 'csv') return csv(pivot)
  if (format === 'html') return html(pivot)
  return pdf(pivot)
}
