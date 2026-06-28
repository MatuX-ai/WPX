// 增强版 smoke test：收集所有 console 输出，捕获错误，检测白屏

import { spawn } from 'node:child_process'
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const electronBin = 'i:\\WPX\\node_modules\\electron\\dist\\electron.exe'
const runnerScript = 'i:\\WPX\\scripts\\smoke-detailed-runner.cjs'
const resultFile = 'i:\\WPX\\wpx-smoke-detailed.json'
const rootDir = 'i:\\WPX'

if (existsSync(resultFile)) unlinkSync(resultFile)

console.log('Launching electron with detailed smoke runner...')
const child = spawn(electronBin, [runnerScript], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: (() => {
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    return env
  })(),
})

let stdout = ''
let stderr = ''
child.stdout.on('data', (d) => {
  const s = d.toString()
  stdout += s
  process.stdout.write(s)
})
child.stderr.on('data', (d) => {
  const s = d.toString()
  stderr += s
  process.stderr.write(s)
})

const timeout = setTimeout(() => {
  console.log('\n[smoke] Timeout 40s, killing child process')
  try { child.kill('SIGKILL') } catch {}
}, 40000)

child.on('exit', (code, signal) => {
  clearTimeout(timeout)
  console.log(`\n[smoke] electron exited code=${code} signal=${signal}`)

  let resultFromFile = null
  if (existsSync(resultFile)) {
    try {
      resultFromFile = JSON.parse(readFileSync(resultFile, 'utf8'))
    } catch (e) {
      console.log('[smoke] Failed to read result file:', e.message)
    }
  }

  console.log('\n=== SMOKE RESULT ===')
  console.log(JSON.stringify(resultFromFile ?? { error: 'no result file', stdoutTail: stdout.slice(-2000), stderrTail: stderr.slice(-2000) }, null, 2))

  process.exit(code ?? (signal ? 2 : 0))
})