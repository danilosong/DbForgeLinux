export interface StreamResultSummary {
  columns: string[]
  rowCount: number
  truncated: boolean
}

/** Writes only the first N rows and drains later rows without retaining them so pooled sessions stay synchronized. */
export async function spoolLimitedRows(
  rows: AsyncIterable<Record<string, unknown>>,
  rowLimit: number,
  append: (row: Record<string, unknown>) => Promise<void>
): Promise<StreamResultSummary> {
  const columns: string[] = []
  let rowCount = 0
  let truncated = false
  for await (const row of rows) {
    if (!columns.length) columns.push(...Object.keys(row))
    if (rowLimit > 0 && rowCount >= rowLimit) { truncated = true; continue }
    await append(row)
    rowCount++
  }
  return { columns, rowCount, truncated }
}
