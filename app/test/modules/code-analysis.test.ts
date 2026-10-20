import { describe, expect, it } from 'vitest'
import { analyzeSql } from '../../src/modules/code-analysis/index.js'
import { enMessages, ptBrCatalog } from '../../src/renderer/src/i18n/specMessages.js'

describe('SQL Code Analysis', () => {
  it('provides translated UI text for every analysis rule in English and Brazilian Portuguese', () => {
    for (const rule of ['SQL001', 'SQL002', 'SQL003', 'SQL004', 'SQL005', 'SQL006', 'SQL007', 'SQL008']) {
      expect(enMessages[`analysis.rule.${rule}`]).toBeTruthy()
      expect(ptBrCatalog[`analysis.rule.${rule}`]).toBeTruthy()
    }
  })
  it('finds correctness and performance issues with line and column locations', () => {
    const findings = analyzeSql("SELECT * FROM users WHERE LOWER(email) = 'x' AND deleted = NULL;\nUPDATE users SET active = 0;\nDELETE FROM logs;")
    expect(findings.map((item) => item.ruleId)).toEqual(['SQL001', 'SQL005', 'SQL004', 'SQL002', 'SQL003'])
    expect(findings.find((item) => item.ruleId === 'SQL002')).toMatchObject({ line: 2, severity: 'Warning' })
    expect(findings.find((item) => item.ruleId === 'SQL003')).toMatchObject({ line: 3, severity: 'Warning' })
  })

  it('ignores quoted text/comments and flags unordered limits and joins without predicates', () => {
    const findings = analyzeSql("SELECT 'SELECT *; UPDATE t SET x=1' AS note FROM a JOIN b; -- DELETE FROM x\nSELECT id FROM t LIMIT 10;")
    expect(findings.map((item) => item.ruleId)).toEqual(['SQL006', 'SQL007'])
  })
})
