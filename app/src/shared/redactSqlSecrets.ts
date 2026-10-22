const quotedValue = String.raw`(?:'(?:\\.|''|[^'])*'|"(?:\\.|""|[^"])*"|\x60(?:\x60\x60|[^\x60])*\x60)`
const secretValue = String.raw`(?:${quotedValue}|[^\s;,()]+)`
const accountValue = String.raw`(?:${quotedValue}(?:\s*@\s*${quotedValue})?|[^\s;,=]+)`
const functionValue = String.raw`(?:${quotedValue}|[^\s,()]+)`

export function redactSqlSecrets(sql: string): string {
  return sql.slice(0, 100_000)
    .replace(new RegExp(String.raw`(\bIDENTIFIED\s+(?:WITH\s+(?:${secretValue}|[\w.-]+)\s+)?(?:BY|AS)\s+(?:PASSWORD\s+)?)${secretValue}`, 'gi'), "$1'****'")
    .replace(new RegExp(String.raw`(\bSET\s+PASSWORD(?:\s+FOR\s+(?:${accountValue}))?\s*=\s*)(?:PASSWORD\s*\(\s*)${functionValue}(?:\s*\))?`, 'gi'), "$1'****'")
    .replace(new RegExp(String.raw`(\bPASSWORD\s*\(\s*)${functionValue}(\s*\))`, 'gi'), "$1'****'$2")
    .replace(new RegExp(String.raw`(\b(?:MASTER_PASSWORD|SOURCE_PASSWORD)\s*=\s*)${secretValue}`, 'gi'), "$1'****'")
    .replace(/(\b(?:PASSWORD|PASSWD|PASSPHRASE|API[_-]?KEY|TOKEN|SECRET)\s*[:=]\s*)(?:'[^']*'|"[^"]*"|\S+)/gi, '$1\'****\'')
    .replace(/(\bmysql:\/\/[^:/\s]+:)[^@/\s]+@/gi, '$1****@')
}
