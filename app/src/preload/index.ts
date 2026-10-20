import { contextBridge } from 'electron'
import type { DbForgeApi } from '../shared/contracts.js'
import { connectionsApi } from './api/connections.js'
import { sqlApi } from './api/sql.js'
import { securityApi } from './api/security.js'
const api:DbForgeApi={...connectionsApi,...sqlApi,...securityApi}
contextBridge.exposeInMainWorld('dbforge',api)
