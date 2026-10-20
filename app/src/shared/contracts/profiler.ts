import type { ProfileResult } from '../../modules/profiler/index.js'
declare module './api.js' { interface DbForgeApi { profile(connectionId:string,query:string):Promise<ProfileResult>; explain(connectionId:string,query:string):Promise<ProfileResult['plan']>; history(connectionId:string):Promise<ProfileResult[]>; clearHistory(connectionId:string,confirmed:boolean):Promise<void> } }
