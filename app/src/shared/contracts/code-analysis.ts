export type AnalysisCategory = 'Correctness' | 'Performance' | 'Style' | 'Security'
export type AnalysisSeverity = 'Error' | 'Warning' | 'Info'
export interface CodeAnalysisFinding { ruleId: string; category: AnalysisCategory; severity: AnalysisSeverity; message: string; line: number; column: number }
export interface CodeAnalysisApi { analyzeSql(sql: string): Promise<CodeAnalysisFinding[]> }
