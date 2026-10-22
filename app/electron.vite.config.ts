import { resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const bundleRoot = resolve(process.cwd(), process.env.TUXSQL_BUILD_DIR ?? 'out')

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], build: { outDir: resolve(bundleRoot, 'main'), emptyOutDir: false } },
  preload: { plugins: [externalizeDepsPlugin()], build: { outDir: resolve(bundleRoot, 'preload'), emptyOutDir: false, rollupOptions: { input: { index: resolve('src/preload/index.ts'), splash: resolve('src/preload/splash.ts') } } } },
  renderer: {
    build: { outDir: resolve(bundleRoot, 'renderer'), emptyOutDir: true, rollupOptions: { input: { index: resolve('src/renderer/index.html'), splash: resolve('src/renderer/splash.html') } } },
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    plugins: [react(), {
      name: 'tuxsql-renderer-module-inventory',
      generateBundle(_options, bundle) {
        const modules = new Set<string>()
        for (const item of Object.values(bundle)) {
          if (item.type === 'chunk') for (const id of Object.keys(item.modules)) modules.add(id)
        }
        const assets = Object.values(bundle).filter((item) => item.type === 'asset').map((item) => ({ fileName: item.fileName, name: item.name ?? '' }))
        const inventoryDirectory = resolve(process.cwd(), 'build-resources')
        mkdirSync(inventoryDirectory, { recursive: true })
        writeFileSync(resolve(inventoryDirectory, 'renderer-bundle-modules.json'), JSON.stringify([...modules].sort()))
        writeFileSync(resolve(inventoryDirectory, 'renderer-bundle-assets.json'), JSON.stringify(assets))
      }
    }]
  }
})
