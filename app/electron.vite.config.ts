import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const bundleRoot = resolve(process.cwd(), process.env.DBFORGE_BUILD_DIR ?? 'out')

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], build: { outDir: resolve(bundleRoot, 'main'), emptyOutDir: false } },
  preload: { plugins: [externalizeDepsPlugin()], build: { outDir: resolve(bundleRoot, 'preload'), emptyOutDir: false } },
  renderer: {
    build: { outDir: resolve(bundleRoot, 'renderer'), emptyOutDir: false },
    publicDir: resolve('node_modules/monaco-editor/min'),
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    plugins: [react()]
  }
})
