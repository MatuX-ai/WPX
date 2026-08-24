/**
 * CI 专用：调用 Vite CLI 构建（与 npm run build 一致，失败时保留完整日志）。
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
process.env.WPX_PRERENDER = process.env.WPX_PRERENDER || '0'

console.log('[ci-build] root:', root)
console.log('[ci-build] node:', process.version)

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', 'build'],
  { stdio: 'inherit', env: process.env, cwd: root },
)

process.exit(result.status ?? 1)
