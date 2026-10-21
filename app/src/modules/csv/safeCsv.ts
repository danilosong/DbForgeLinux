/** Makes cells safe for spreadsheet programs while preserving CSV quoting rules. */
export function safeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : value instanceof Uint8Array
    ? `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
    : typeof value === 'object' ? JSON.stringify(value) : String(value)
  // Spreadsheet programs may ignore leading whitespace/control characters before a formula marker.
  const safe = neutralizeCsvFormulaText(raw)
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function neutralizeCsvFormulaText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value
}
