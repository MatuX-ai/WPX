/**
 * CI 专用：显式调用 Vite build，失败时打印完整堆栈。
 */
import { build, loadConfigFromFile } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const configFile = path.join(root, 'vite.config.js')

process.chdir(root)
process.env.WPX_PRERENDER = process.env.WPX_PRERENDER || '0'

console.log('[ci-build] root:', root)
console.log('[ci-build] node:', process.version)

const loaded = await loadConfigFromFile(
  { command: 'build', mode: 'production' },
  configFile,
  root,
)
if (!loaded) {
  throw new Error(`Failed to load Vite config: ${configFile}`)
}

await build({ ...loaded.config, configFile, root })
console.log('[ci-build] vite build completed')
