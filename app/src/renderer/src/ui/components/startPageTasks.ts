export const startTaskGroups = [
  { id: 'development', tasks: ['query-builder', 'snippets-manager'] },
  { id: 'design', tasks: ['er-diagram', 'object-viewer'] },
  { id: 'sync', tasks: ['schema-compare', 'data-compare', 'source-control'] },
  { id: 'administration', tasks: ['security', 'sessions', 'database-tools'] },
  { id: 'dataPump', tasks: ['import-export', 'data-generator', 'database-tools'] },
  { id: 'analysis', tasks: ['profiler', 'documenter', 'database-tools'] }
] as const
