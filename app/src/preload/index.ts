import { contextBridge } from 'electron'
import type { DbForgeApi } from '../shared/contracts.js'
import { connectionsApi } from './api/connections.js'
import { sqlApi } from './api/sql.js'
import { securityApi } from './api/security.js'
import { profilerApi } from './api/profiler.js'
import { dataGeneratorApi } from './api/data-generator.js'
import { documenterApi } from './api/documenter.js'
import { sessionsApi } from './api/sessions.js'
import { schemaCompareApi } from './api/schema-compare.js'
import { dataCompareApi } from './api/data-compare.js'
import { importExportApi } from './api/import-export.js'
const api:DbForgeApi={...connectionsApi,...sqlApi,...securityApi,...sessionsApi,...profilerApi,...dataGeneratorApi,...documenterApi,...schemaCompareApi,...dataCompareApi,...importExportApi}
contextBridge.exposeInMainWorld('dbforge',api)
