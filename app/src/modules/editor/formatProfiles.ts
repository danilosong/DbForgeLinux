export const formatProfileNames = ['Collapsed', 'Commas before', 'Compact', 'Default', 'Extended', 'Indented', 'MSDN SQL', 'Right aligned', 'Stack compact'] as const
export type FormatProfileName = typeof formatProfileNames[number] | 'Custom'
export interface SqlFormatProfile {
  name: FormatProfileName
  keywordCase: 'upper' | 'lower'
  indentSize: 2 | 4
  commaStyle: 'after' | 'before'
  nestedIndent: boolean
  breakBeforeParentheses: boolean
  indentParameterLists: boolean
  stackParameterLists: boolean
}

const base = (name: FormatProfileName, options: Partial<SqlFormatProfile> = {}): SqlFormatProfile => ({
  name, keywordCase: 'upper', indentSize: 2, commaStyle: 'after', nestedIndent: true,
  breakBeforeParentheses: false, indentParameterLists: false, stackParameterLists: false, ...options
})

export const builtInFormatProfiles: SqlFormatProfile[] = [
  base('Collapsed', { nestedIndent: false, indentSize: 2 }),
  base('Commas before', { commaStyle: 'before', indentParameterLists: true }),
  base('Compact', { indentSize: 2, nestedIndent: false, stackParameterLists: true }),
  base('Default'),
  base('Extended', { indentSize: 4, breakBeforeParentheses: true, indentParameterLists: true }),
  base('Indented', { indentSize: 4, indentParameterLists: true }),
  base('MSDN SQL', { keywordCase: 'upper', indentSize: 4, breakBeforeParentheses: true, indentParameterLists: true }),
  base('Right aligned', { commaStyle: 'before', indentSize: 4, indentParameterLists: true }),
  base('Stack compact', { stackParameterLists: true, nestedIndent: false })
]

export const defaultFormatProfile = builtInFormatProfiles.find((profile) => profile.name === 'Default')!

export function findFormatProfile(profiles: SqlFormatProfile[], name: FormatProfileName): SqlFormatProfile {
  return profiles.find((profile) => profile.name === name) ?? builtInFormatProfiles.find((profile) => profile.name === name) ?? defaultFormatProfile
}
