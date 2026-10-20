import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    publicDir: resolve('node_modules/monaco-editor/min'),
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    plugins: [react()]
  }
})
