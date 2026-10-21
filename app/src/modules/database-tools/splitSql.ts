export function splitBackupSql(source: string): string[] {
  const statements: string[] = []; let delimiter = ';'; let buffer = ''; let quote: string | null = null; let lineComment = false; let blockComment = false
  for (const line of source.split(/(?<=\n)/)) {
    const directive = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(line.trimEnd())
    if (!quote && !buffer.trim() && directive) { delimiter = directive[1]; continue }
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index]; const next = line[index + 1]
      if (lineComment) { buffer += char; if (char === '\n') lineComment = false; continue }
      if (blockComment) { buffer += char; if (char === '*' && next === '/') { buffer += next; index += 1; blockComment = false }; continue }
      if (quote) { buffer += char; if (char === '\\') { if (next) { buffer += next; index += 1 }; continue }; if (char === quote && next === quote) { buffer += next; index += 1; continue }; if (char === quote) quote = null; continue }
      if (char === "'" || char === '"' || char === '`') { quote = char; buffer += char; continue }
      if (char === '-' && next === '-' && (!line[index + 2] || /\s/.test(line[index + 2]))) { lineComment = true; buffer += char + next; index += 1; continue }
      if (char === '#') { lineComment = true; buffer += char; continue }
      if (char === '/' && next === '*') { blockComment = true; buffer += char + next; index += 1; continue }
      if (line.startsWith(delimiter, index)) { const sql = buffer.trim(); if (sql) statements.push(sql); buffer = ''; index += delimiter.length - 1; continue }
      buffer += char
    }
  }
  if (buffer.trim()) statements.push(buffer.trim())
  return statements
}
