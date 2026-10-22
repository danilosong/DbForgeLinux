import { ipcRenderer } from 'electron'
import type { RoutineDebugApi, DebugSnapshot } from '../../modules/routine-debugger/types.js'

export const routineDebuggerApi: RoutineDebugApi = {
  inspectDebugEngine: (connectionId) => ipcRenderer.invoke('routine-debugger:engine:inspect', connectionId),
  deployDebugEngine: (connectionId, confirmed) => ipcRenderer.invoke('routine-debugger:engine:deploy', connectionId, confirmed),
  removeDebugEngine: (connectionId, confirmed) => ipcRenderer.invoke('routine-debugger:engine:remove', connectionId, confirmed),
  compileRoutineForDebug: (target) => ipcRenderer.invoke('routine-debugger:compile', target),
  startRoutineDebug: (target, args, breakpoints, autocommit, confirmedAutocommit, triggerSql, parameters, showAfterExecute, timeoutSeconds) => ipcRenderer.invoke('routine-debugger:start', target, args, breakpoints, autocommit, confirmedAutocommit, triggerSql, parameters, showAfterExecute, timeoutSeconds),
  commandRoutineDebug: (sessionId, command, line) => ipcRenderer.invoke('routine-debugger:command', sessionId, command, line),
  setRoutineDebugBreakpoints: (sessionId, breakpoints) => ipcRenderer.invoke('routine-debugger:breakpoints', sessionId, breakpoints),
  setRoutineDebugWatches: (sessionId, watches) => ipcRenderer.invoke('routine-debugger:watches', sessionId, watches),
  getRoutineDebugSnapshot: (sessionId) => ipcRenderer.invoke('routine-debugger:snapshot', sessionId),
  onRoutineDebugEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: DebugSnapshot): void => callback(snapshot)
    ipcRenderer.on('routine-debugger:event', listener)
    return () => ipcRenderer.removeListener('routine-debugger:event', listener)
  }
}
