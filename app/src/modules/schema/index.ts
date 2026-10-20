export * from './model.js'
export * from './sql.js'
export * from './ddl.js'
export * from './introspect.js'
export * from './compare.js'

import { SchemaIntrospector, type SchemaQuery } from './introspect.js'

export function inspectDatabase(query: SchemaQuery, database: string) {
  return new SchemaIntrospector(query).inspect(database)
}
