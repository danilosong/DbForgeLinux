import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import 'monaco-editor/esm/vs/editor/editor.all.js'
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js'
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

const workerEnvironment = globalThis as typeof globalThis & { MonacoEnvironment?: { getWorker(moduleId: string, label: string): Worker } }
workerEnvironment.MonacoEnvironment = {
  getWorker: (_moduleId, label) => label === 'json' ? new JsonWorker() : new EditorWorker()
}

const createWebWorker = monaco.editor.createWebWorker.bind(monaco.editor)
const createDemandWorker = ((value: unknown) => {
  const options = value as monaco.editor.IWebWorkerOptions
  const worker = Promise.resolve(workerEnvironment.MonacoEnvironment!.getWorker(options.moduleId, options.label ?? 'editorWorkerService')).then((instance) => {
    instance.postMessage('ignore')
    instance.postMessage(options.createData)
    return instance
  })
  return createWebWorker({ worker, host: options.host, keepIdleModels: options.keepIdleModels })
}) as typeof monaco.editor.createWebWorker
monaco.editor.createWebWorker = createDemandWorker

loader.config({ monaco })

export default Editor
