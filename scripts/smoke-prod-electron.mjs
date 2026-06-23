/**
 * 本地冒烟：用 Electron 加载 wpx-app/dist（与安装包相同的 file:// 路径）
 * 用法：node scripts/smoke-prod-electron.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const runnerScript = path.join(__dirname, 'smoke-prod-runner.cjs')
const resultFile = path.join(rootDir, 'smoke-result.json')
const electronBin = path.join(
  rootDir,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron',
)

if (fs.existsSync(resultFile)) fs.unlinkSync(resultFile)

const child = spawn(electronBin, [runnerScript], {
  cwd: rootDir,
  stdio: 'inherit',
  env: (() => {
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    return env
  })(),
})

child.on('exit', (code) => {
  if (fs.existsSync(resultFile)) {
    console.log(fs.readFileSync(resultFile, 'utf8'))
  }
  process.exit(code ?? 1)
})
